import asyncio
import json
import logging
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

from app.core import MAX_CONCURRENT_CALLS
from app.core.funnel import get_funnel_quant_groups
from app.llm.claude import call_claude, synthesize_claude, synthesize_persona_claude
from app.llm.openai_client import call_openai, synthesize_openai, synthesize_persona_openai
from app.llm.parse import extract_json_or_none
from app.models.persona_summary import PersonaSummary
from app.models.review import Review

logger = logging.getLogger(__name__)

_active_executors: set[ThreadPoolExecutor] = set()
_active_executors_lock = threading.Lock()


def shutdown_active_executors():
    with _active_executors_lock:
        executors = list(_active_executors)
        _active_executors.clear()
    for executor in executors:
        executor.shutdown(wait=False, cancel_futures=True)
    if executors:
        logger.info("Shutdown: cancelled %d active thread pools", len(executors))


# 팀별 합성 정량 지표 정의: metric_key → 평균을 낼 source field 목록
_SYNTHESIS_QUANT_METRICS: dict[str, dict[str, list[str]]] = {
    "marketing": {
        "avg_brand_attitude":       ["brand_favorability", "brand_trust"],
        "avg_brand_fit":            ["brand_fit"],
        "avg_ad_effectiveness":     ["message_clarity", "attention_grabbing"],
        "overall_score":            ["appeal"],
        "avg_perceived_value":      ["value_for_money", "price_fairness"],
        "avg_purchase_intention":   ["purchase_likelihood", "purchase_consideration", "purchase_willingness"],
        "avg_purchase_probability": ["repurchase_intent", "purchase_urgency"],
    },
    "commerce": {
        "avg_product_appeal":       ["product_uniqueness", "product_trust"],
        "avg_brand_presence":       ["brand_premium"],
        "avg_product_presentation": ["visual_appeal", "story_appeal"],
        "overall_score":            ["price_value"],
        "avg_perceived_value":      ["quality_expectation", "gift_suitability"],
        "avg_purchase_intention":   ["purchase_likelihood", "purchase_consideration", "purchase_willingness"],
        "avg_purchase_probability": ["repurchase_intent", "purchase_urgency"],
    },
}


def _compute_synthesis_quant_metrics(persona_summaries: list, team: str = "marketing") -> dict:
    """페르소나 정량 평균으로부터 합성 정량 지표를 코드로 계산 (LLM 대신)."""
    metrics_def = _SYNTHESIS_QUANT_METRICS.get(team, _SYNTHESIS_QUANT_METRICS["marketing"])
    result: dict = {}
    for metric_key, source_keys in metrics_def.items():
        values = []
        for s in persona_summaries:
            for sk in source_keys:
                v = s.quant_averages.get(sk, 0.0)
                if v > 0:
                    values.append(v)
        result[metric_key] = round(sum(values) / len(values), 1) if values else 0.0
    return result


def _compute_cross_persona_quant_groups(persona_summaries: list, team: str = "marketing") -> dict:
    """모든 페르소나의 funnel_quant_groups를 다시 평균하여 반환."""
    funnel_quant_groups = get_funnel_quant_groups(team)
    result: dict = {}
    for funnel_key, groups in funnel_quant_groups.items():
        result[funnel_key] = []
        for grp_def in groups:
            grp_avgs = []
            for s in persona_summaries:
                for grp in s.funnel_quant_groups.get(funnel_key, []):
                    if grp["label"] == grp_def["label"]:
                        if grp["avg"] > 0:
                            grp_avgs.append(grp["avg"])
                        break
            avg = round(sum(grp_avgs) / len(grp_avgs), 1) if grp_avgs else 0.0
            result[funnel_key].append({
                "label": grp_def["label"],
                "sublabels": grp_def["sublabels"],
                "avg": avg,
                "pct": round((avg / 5) * 100),
            })
    return result


def build_event_generator(
    request,
    panels: list,
    total_panels: int,
    provider: str,
    review_model: str,
    summary_model: str,
    synthesis_model: str,
    text_content: str,
    file_bytes,
    filename,
    qa_mode: str,
    team: str,
    selected_panel_size: int,
    selected_seed,
):
    """Returns an async generator for SSE review events."""

    async def event_generator():
        loop = asyncio.get_running_loop()
        executor = ThreadPoolExecutor(max_workers=max(1, MAX_CONCURRENT_CALLS))
        with _active_executors_lock:
            _active_executors.add(executor)
        reviews = []
        persona_summaries = []

        def _cancel_futures(future_map: dict):
            for future in list(future_map.keys()):
                future.cancel()

        try:
            # ═══ Phase 1: 패널별 개별 LLM 호출 ═══
            phase1_start = time.time()

            def run_single(panel):
                if provider == "Claude":
                    return call_claude(panel, file_bytes, filename, review_model, text_content, qa_mode=qa_mode, team=team)
                return call_openai(panel, file_bytes, filename, review_model, text_content, qa_mode=qa_mode, team=team)

            futures = {executor.submit(run_single, p): p for p in panels}
            completed = 0

            while futures:
                if await request.is_disconnected():
                    logger.info("SSE disconnected during panel review; cancelling %d tasks", len(futures))
                    _cancel_futures(futures)
                    return

                done = [f for f in list(futures.keys()) if f.done()]
                if not done:
                    await asyncio.sleep(0.3)
                    continue

                for f in done:
                    panel = futures.pop(f)
                    try:
                        review = f.result()
                    except Exception as e:
                        logger.exception(
                            "Panel review future failed [persona=%s, panel=%s]: %s",
                            panel.persona_name, panel.panel_id, e,
                        )
                        review = Review(
                            persona_id=panel.persona_id,
                            persona_name=panel.persona_name,
                            panel_id=panel.panel_id,
                            error=f"Panel review future failed: {e}",
                        )

                    reviews.append(review)
                    completed += 1
                    elapsed = time.time() - phase1_start
                    yield {
                        "event": "progress",
                        "data": json.dumps({
                            "phase": "panel_review",
                            "completed": completed,
                            "total": total_panels,
                            "persona_name": review.persona_name,
                            "panel_id": review.panel_id,
                            "review": review.to_dict(),
                            "elapsed_seconds": round(elapsed, 1),
                        }),
                    }

            # ═══ Phase 2: persona_id별 그룹핑 + 정량 평균 ═══
            yield {"event": "status", "data": json.dumps({"message": "페르소나별 집계 중..."})}

            grouped = defaultdict(list)
            for r in reviews:
                if not r.error:
                    grouped[r.persona_id].append(r)

            for persona_id, persona_reviews in grouped.items():
                persona_name = persona_reviews[0].persona_name
                summary = PersonaSummary.from_reviews(persona_id, persona_name, persona_reviews, team=team)
                persona_summaries.append(summary)

            total_personas = len(persona_summaries)

            # ═══ Phase 3: 페르소나별 정성 요약 LLM 호출 ═══
            yield {"event": "status", "data": json.dumps({"message": "페르소나별 정성 요약 생성 중..."})}
            phase3_start = time.time()

            def run_persona_synthesis(summary):
                reviews_data = list(summary.panel_reviews)
                if provider == "Claude":
                    return summary.persona_id, synthesize_persona_claude(summary.persona_name, reviews_data, summary_model, team=team)
                return summary.persona_id, synthesize_persona_openai(summary.persona_name, reviews_data, summary_model, team=team)

            p3_futures = {executor.submit(run_persona_synthesis, s): s for s in persona_summaries}
            p3_completed = 0

            while p3_futures:
                if await request.is_disconnected():
                    logger.info("SSE disconnected during persona synthesis; cancelling %d tasks", len(p3_futures))
                    _cancel_futures(p3_futures)
                    return

                done = [f for f in list(p3_futures.keys()) if f.done()]
                if not done:
                    await asyncio.sleep(0.3)
                    continue

                for f in done:
                    summary = p3_futures.pop(f)
                    persona_id = summary.persona_id
                    raw_result = ""
                    try:
                        persona_id_result, raw_result = f.result()
                        if persona_id_result:
                            persona_id = persona_id_result
                    except Exception as e:
                        logger.exception(
                            "Persona synthesis future failed [persona=%s]: %s",
                            summary.persona_name, e,
                        )
                        raw_result = json.dumps({"error": str(e)})

                    p3_completed += 1

                    parsed = extract_json_or_none(raw_result)
                    if parsed:
                        for s in persona_summaries:
                            if s.persona_id == persona_id:
                                s.fill_qualitative(parsed, team=team)
                                break

                    elapsed = time.time() - phase3_start
                    yield {
                        "event": "progress",
                        "data": json.dumps({
                            "phase": "persona_synthesis",
                            "completed": p3_completed,
                            "total": total_personas,
                            "persona_name": next(
                                (s.persona_name for s in persona_summaries if s.persona_id == persona_id), ""
                            ),
                            "elapsed_seconds": round(elapsed, 1),
                        }),
                    }

            if await request.is_disconnected():
                logger.info("SSE disconnected before synthesis")
                return

            # ═══ Phase 4: 전체 합성 ═══
            yield {"event": "status", "data": json.dumps({"message": "통합 분석 생성 중..."})}

            synthesis_input = []
            for s in persona_summaries:
                recommendation = "보통"
                if s.recommendation_distribution:
                    recommendation = max(s.recommendation_distribution, key=s.recommendation_distribution.get)
                entry = {"persona_name": s.persona_name, "recommendation": recommendation}
                entry.update(s.quant_averages)
                entry.update(s.qual_fields)
                synthesis_input.append(entry)

            # 정량 지표를 코드로 미리 계산 (LLM 대신)
            synthesis_quant_metrics = _compute_synthesis_quant_metrics(persona_summaries, team=team)

            # 퍼널 그룹 평균 사전 계산 (synthesis 프롬프트 컨텍스트 + done 이벤트 공용)
            funnel_group_stats = _compute_cross_persona_quant_groups(persona_summaries, team=team)

            synthesis_raw = ""
            if synthesis_input:
                def do_synthesize():
                    if provider == "Claude":
                        return synthesize_claude(synthesis_input, synthesis_model, team=team, funnel_group_stats=funnel_group_stats)
                    return synthesize_openai(synthesis_input, synthesis_model, team=team, funnel_group_stats=funnel_group_stats)

                synthesis_raw = await loop.run_in_executor(None, do_synthesize)

            synthesis = extract_json_or_none(synthesis_raw)

            # 코드로 계산한 정량 지표를 합성 결과에 주입 (LLM 출력값 덮어쓰기)
            if synthesis is None:
                synthesis = {}
            synthesis.update(synthesis_quant_metrics)

            yield {
                "event": "done",
                "data": json.dumps({
                    "persona_summaries": [s.to_dict() for s in persona_summaries],
                    "panel_reviews": [r.to_dict() for r in reviews],
                    "synthesis": synthesis,
                    "synthesis_raw": synthesis_raw,
                    "panel_size": selected_panel_size,
                    "sampling_seed": selected_seed,
                    "funnel_quant_group_averages": funnel_group_stats,
                }),
            }

        except asyncio.CancelledError:
            logger.info("SSE request cancelled")
            raise
        except Exception as e:
            logger.exception("SSE event_generator failed: %s", e)
            try:
                yield {
                    "event": "error",
                    "data": json.dumps({
                        "message": "리뷰 처리 중 서버 오류가 발생했습니다.",
                        "error": str(e),
                    }),
                }
            except Exception:
                pass
        finally:
            with _active_executors_lock:
                _active_executors.discard(executor)
            executor.shutdown(wait=False, cancel_futures=True)

    return event_generator
