import json
import streamlit as st
import uuid
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import MAX_CONCURRENT_CALLS
from sheets.client import open_spreadsheet_by_url
from sheets.personas import load_personas
from sheets.results import save_reviews
from llm.claude import call_claude, synthesize_claude
from llm.openai_client import call_openai, synthesize_openai
from models.review import Review

CLAUDE_MODELS = ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"]
OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini"]

st.set_page_config(page_title="Synthetic Panels", page_icon="🏨", layout="wide")

# ── Custom CSS ──
st.markdown("""
<style>
    .block-container { padding-top: 2rem; }
    div[data-testid="stMetric"] {
        background: #f8f9fa; border-radius: 8px; padding: 12px 16px;
        border-left: 4px solid #4CAF50;
    }
    .synthesis-box {
        background: linear-gradient(135deg, #667eea22, #764ba222);
        border: 1px solid #667eea44;
        border-radius: 12px; padding: 24px; margin-bottom: 24px;
    }
    .persona-card {
        background: #ffffff; border: 1px solid #e0e0e0;
        border-radius: 10px; padding: 20px; margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .score-badge {
        display: inline-block; padding: 4px 14px; border-radius: 20px;
        font-weight: 700; font-size: 1.1em; color: white;
    }
    .score-high { background: #4CAF50; }
    .score-mid  { background: #FF9800; }
    .score-low  { background: #f44336; }
</style>
""", unsafe_allow_html=True)


def score_badge(score: int) -> str:
    cls = "score-high" if score >= 7 else "score-mid" if score >= 4 else "score-low"
    return f'<span class="score-badge {cls}">{score}/10</span>'


def recommendation_emoji(rec: str) -> str:
    mapping = {
        "Strongly Interested": "🟢",
        "Somewhat Interested": "🔵",
        "Neutral": "🟡",
        "Not Interested": "🟠",
        "Strongly Not Interested": "🔴",
        "매우 관심 있음": "🟢",
        "다소 관심 있음": "🔵",
        "보통": "🟡",
        "관심 없음": "🟠",
        "전혀 관심 없음": "🔴",
    }
    return mapping.get(rec, "⚪")


# ══════════════════════════════════════════════════
#  PAGE 1 — Upload & Configure
# ══════════════════════════════════════════════════
def page_upload():
    st.markdown("## 📋 Synthetic Panels")
    st.markdown("호텔/리조트 마케팅 프로모션 자료를 가상 소비자 패널이 평가합니다.")
    st.divider()

    # ── Settings ──
    col_left, col_right = st.columns([2, 1])

    with col_right:
        st.markdown("### ⚙️ Settings")
        sheets_url = st.text_input(
            "Google Sheets URL",
            value=st.session_state.get("sheets_url", ""),
            placeholder="https://docs.google.com/spreadsheets/d/...",
        )
        worksheet_name = st.text_input("Personas worksheet name", value="personas")

        st.markdown("---")
        provider = st.selectbox("LLM Provider", ["Claude", "OpenAI"])
        if provider == "Claude":
            model = st.selectbox("Model", CLAUDE_MODELS)
        else:
            model = st.selectbox("Model", OPENAI_MODELS)

        # Load personas
        personas = []
        spreadsheet = None
        if sheets_url:
            try:
                spreadsheet = open_spreadsheet_by_url(sheets_url)
                personas = load_personas(spreadsheet, worksheet_name)
                st.success(f"✅ {len(personas)}명의 페르소나 로드 완료")
            except Exception as e:
                st.error(f"페르소나 로드 실패: {e}")

    with col_left:
        st.markdown("### 📎 프로모션 자료 업로드")
        uploaded_file = st.file_uploader(
            "PDF 또는 이미지 파일을 업로드하세요",
            type=["pdf", "png", "jpg", "jpeg"],
            label_visibility="collapsed",
        )

        if uploaded_file:
            file_bytes = uploaded_file.read()
            filename = uploaded_file.name

            if filename.lower().endswith(".pdf"):
                st.info(f"📄 **{filename}** ({len(file_bytes) / 1024:.1f} KB)")
            else:
                st.image(file_bytes, caption=filename, width=450)

            st.markdown("---")

            # Run button
            if not personas:
                st.warning("먼저 Google Sheets URL을 입력하고 페르소나를 로드하세요.")
            else:
                st.markdown(f"**{len(personas)}명**의 페르소나가 리뷰를 작성합니다.")
                if st.button("🚀 Run Panel Review", type="primary", use_container_width=True):
                    _run_reviews(personas, file_bytes, filename, provider, model, spreadsheet, sheets_url)
        else:
            st.markdown(
                '<div style="border:2px dashed #ccc; border-radius:12px; padding:60px; text-align:center; color:#999;">'
                "PDF, PNG, JPG 파일을 여기에 드래그하거나 클릭하여 업로드"
                "</div>",
                unsafe_allow_html=True,
            )


def _run_reviews(personas, file_bytes, filename, provider, model, spreadsheet, sheets_url):
    reviews: list[Review] = []
    total = len(personas)

    progress_bar = st.progress(0, text="리뷰를 시작합니다...")
    status_text = st.empty()

    def run_single(persona):
        if provider == "Claude":
            return call_claude(persona, file_bytes, filename, model, "")
        else:
            return call_openai(persona, file_bytes, filename, model, "")

    completed = 0
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_CALLS) as executor:
        futures = {executor.submit(run_single, p): p for p in personas}
        for future in as_completed(futures):
            review = future.result()
            reviews.append(review)
            completed += 1
            progress_bar.progress(completed / total)
            status_text.markdown(f"**{completed}/{total}** 완료 — 최근: {review.persona_name}")

    progress_bar.progress(1.0)
    status_text.markdown("**개별 리뷰 완료! 통합 의견을 생성 중...**")

    # Synthesize
    reviews_data = [
        {
            "persona_name": r.persona_name,
            "appeal_score": r.appeal_score,
            "first_impression": r.first_impression,
            "key_positives": r.key_positives,
            "key_concerns": r.key_concerns,
            "recommendation": r.recommendation,
            "review_summary": r.review_summary,
            "like_dislike": r.like_dislike,
            "positive_negative": r.positive_negative,
            "good_bad": r.good_bad,
            "favorable_unfavorable": r.favorable_unfavorable,
            "likelihood_high": r.likelihood_high,
            "probability_consider_high": r.probability_consider_high,
            "willingness_high": r.willingness_high,
            "purchase_probability_juster": r.purchase_probability_juster,
        }
        for r in reviews
        if not r.error
    ]

    synthesis_raw = ""
    if reviews_data:
        if provider == "Claude":
            synthesis_raw = synthesize_claude(reviews_data, model)
        else:
            synthesis_raw = synthesize_openai(reviews_data, model)

    status_text.empty()
    progress_bar.empty()

    # Save to session state and switch to results page
    st.session_state["reviews"] = reviews
    st.session_state["synthesis_raw"] = synthesis_raw
    st.session_state["sheets_url"] = sheets_url
    st.session_state["spreadsheet"] = spreadsheet
    st.session_state["page"] = "results"
    st.rerun()


# ══════════════════════════════════════════════════
#  PAGE 2 — Results
# ══════════════════════════════════════════════════
def page_results():
    reviews: list[Review] = st.session_state["reviews"]
    synthesis_raw: str = st.session_state.get("synthesis_raw", "")

    # Back button
    col_back, col_title, col_save = st.columns([1, 4, 1])
    with col_back:
        if st.button("← 돌아가기"):
            st.session_state["page"] = "upload"
            st.rerun()
    with col_title:
        st.markdown("## 📊 Panel Review Results")
    with col_save:
        spreadsheet = st.session_state.get("spreadsheet")
        if spreadsheet:
            if st.button("💾 Save to Sheets"):
                run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
                try:
                    save_reviews(spreadsheet, reviews, run_id)
                    st.toast(f"✅ {len(reviews)}건 저장 완료 (run_id: {run_id})")
                except Exception as e:
                    st.error(f"저장 실패: {e}")

    st.divider()

    # ── Synthesis Section ──
    _render_synthesis(synthesis_raw, reviews)

    st.divider()

    # ── Individual Reviews ──
    st.markdown("## 🧑‍🤝‍🧑 개별 페르소나 리뷰")

    # Sort by score descending
    sorted_reviews = sorted(reviews, key=lambda r: r.appeal_score, reverse=True)

    for review in sorted_reviews:
        _render_persona_card(review)


def _parse_synthesis(raw: str) -> dict | None:
    if not raw:
        return None
    try:
        text = raw.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except (json.JSONDecodeError, IndexError):
        return None


def _render_synthesis(synthesis_raw: str, reviews: list[Review]):
    st.markdown("## 🔍 통합 분석")

    synthesis = _parse_synthesis(synthesis_raw)

    # Score metrics row
    valid_reviews = [r for r in reviews if not r.error]
    valid_scores = [r.appeal_score for r in valid_reviews if r.appeal_score > 0]

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        avg = sum(valid_scores) / len(valid_scores) if valid_scores else 0
        st.metric("평균 매력도", f"{avg:.1f} / 10")
    with col2:
        st.metric("총 패널 수", f"{len(reviews)}명")
    with col3:
        interested = sum(1 for r in reviews if r.recommendation in ("매우 관심 있음", "다소 관심 있음", "Strongly Interested", "Somewhat Interested"))
        st.metric("관심 표명", f"{interested}명")
    with col4:
        errors = sum(1 for r in reviews if r.error)
        st.metric("오류", f"{errors}건")

    # Brand Attitude / Purchase Intention / Purchase Probability metrics
    if valid_reviews:
        ba_scores = [(r.like_dislike + r.positive_negative + r.good_bad + r.favorable_unfavorable) / 4 for r in valid_reviews if r.like_dislike > 0]
        pi_scores = [(r.likelihood_high + r.probability_consider_high + r.willingness_high) / 3 for r in valid_reviews if r.likelihood_high > 0]
        pp_scores = [r.purchase_probability_juster for r in valid_reviews if r.purchase_probability_juster > 0]

        col5, col6, col7 = st.columns(3)
        with col5:
            avg_ba = sum(ba_scores) / len(ba_scores) if ba_scores else 0
            st.metric("평균 브랜드 태도", f"{avg_ba:.1f} / 7")
        with col6:
            avg_pi = sum(pi_scores) / len(pi_scores) if pi_scores else 0
            st.metric("평균 구매 의향", f"{avg_pi:.1f} / 7")
        with col7:
            avg_pp = sum(pp_scores) / len(pp_scores) if pp_scores else 0
            st.metric("평균 구매 확률", f"{avg_pp:.1f} / 10")

    if synthesis:
        st.markdown('<div class="synthesis-box">', unsafe_allow_html=True)

        # Executive summary
        st.markdown(f"### 💡 Executive Summary")
        st.markdown(synthesis.get("executive_summary", ""))

        col_pos, col_neg = st.columns(2)
        with col_pos:
            st.markdown("#### ✅ 공통 긍정 요소")
            for item in synthesis.get("consensus_positives", []):
                st.markdown(f"- {item}")
        with col_neg:
            st.markdown("#### ⚠️ 공통 우려 사항")
            for item in synthesis.get("consensus_concerns", []):
                st.markdown(f"- {item}")

        # Segment insights
        insights = synthesis.get("segment_insights", [])
        if insights:
            st.markdown("#### 📊 세그먼트별 인사이트")
            for item in insights:
                st.markdown(f"- {item}")

        # Recommendations
        recs = synthesis.get("actionable_recommendations", [])
        if recs:
            st.markdown("#### 🎯 실행 제안")
            for i, item in enumerate(recs, 1):
                st.markdown(f"{i}. {item}")

        st.markdown("</div>", unsafe_allow_html=True)
    else:
        if synthesis_raw:
            st.warning("통합 분석 JSON 파싱 실패. 원본 응답:")
            st.code(synthesis_raw)

    # Score distribution chart
    if valid_scores:
        st.markdown("#### 📈 매력도 점수 분포")
        chart_data = {r.persona_name: r.appeal_score for r in reviews if r.appeal_score > 0}
        st.bar_chart(chart_data)


def _render_persona_card(review: Review):
    with st.expander(
        f"{recommendation_emoji(review.recommendation)} **{review.persona_name}** — {review.appeal_score}/10 · {review.recommendation}",
        expanded=False,
    ):
        if review.error:
            st.error(f"오류: {review.error}")
            return

        col1, col2 = st.columns([1, 3])
        with col1:
            st.markdown(score_badge(review.appeal_score), unsafe_allow_html=True)
            st.markdown(f"**{review.recommendation}**")
        with col2:
            st.markdown(f"**첫인상:** {review.first_impression}")

        col_pos, col_neg = st.columns(2)
        with col_pos:
            st.markdown("**✅ 긍정 요소**")
            for item in review.key_positives.split("; "):
                if item.strip():
                    st.markdown(f"- {item.strip()}")
        with col_neg:
            st.markdown("**⚠️ 우려 사항**")
            for item in review.key_concerns.split("; "):
                if item.strip():
                    st.markdown(f"- {item.strip()}")

        # Brand Attitude / Purchase Intention / Purchase Probability
        col_ba, col_pi, col_pp = st.columns(3)
        with col_ba:
            st.markdown("**📊 브랜드 태도** (1-7)")
            st.markdown(f"- 호감도: {review.like_dislike}")
            st.markdown(f"- 긍/부정: {review.positive_negative}")
            st.markdown(f"- 좋음/나쁨: {review.good_bad}")
            st.markdown(f"- 호의도: {review.favorable_unfavorable}")
        with col_pi:
            st.markdown("**🛒 구매 의향** (1-7)")
            st.markdown(f"- 구매 가능성: {review.likelihood_high}")
            st.markdown(f"- 고려 확률: {review.probability_consider_high}")
            st.markdown(f"- 구매 의향: {review.willingness_high}")
        with col_pp:
            st.markdown("**🎯 구매 확률** (Juster 0-10)")
            st.markdown(f"### {review.purchase_probability_juster}/10")

        st.markdown(f"**종합 평가:** {review.review_summary}")

        with st.expander("Raw LLM Response", expanded=False):
            st.code(review.raw_response)


# ══════════════════════════════════════════════════
#  Router
# ══════════════════════════════════════════════════
if "page" not in st.session_state:
    st.session_state["page"] = "upload"

if st.session_state["page"] == "results" and "reviews" in st.session_state:
    page_results()
else:
    page_upload()
