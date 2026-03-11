import { $, updateRunBtn } from './ui.js';
import { state } from './state.js';
import { verifyPassword, runReview } from './api.js';
import { esc } from './render/helpers.js';

export function fmtTime(sec) {
  if (sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const BASE_ESTIMATE = {
  concurrency: 5,
  assumedPersonaCount: 10,
  defaultPanelReviewSeconds: [30, 60],
  defaultPersonaSummarySeconds: [18, 35],
  defaultSynthesisSeconds: [15, 35],
  overheadSeconds: [25, 60],
  safetyFactor: 1.15,
};

const MODEL_ESTIMATE_PROFILE = {
  'gpt-4o-mini': { review: [28, 55], summary: [16, 32], synthesis: [14, 30] },
  'gpt-4o': { review: [45, 95], summary: [28, 60], synthesis: [24, 55] },
};

function getModelEstimateRange(modelName, phase) {
  const fromModel = MODEL_ESTIMATE_PROFILE[modelName];
  if (fromModel && Array.isArray(fromModel[phase])) return fromModel[phase];
  if (phase === 'review') return BASE_ESTIMATE.defaultPanelReviewSeconds;
  if (phase === 'summary') return BASE_ESTIMATE.defaultPersonaSummarySeconds;
  return BASE_ESTIMATE.defaultSynthesisSeconds;
}

export function estimateValidationSeconds(panelCount, modelSelection = {}) {
  const { concurrency, assumedPersonaCount, overheadSeconds, safetyFactor } = BASE_ESTIMATE;
  const panelReviewSeconds = getModelEstimateRange(modelSelection.reviewModel, 'review');
  const personaSummarySeconds = getModelEstimateRange(modelSelection.summaryModel, 'summary');
  const synthesisSeconds = getModelEstimateRange(modelSelection.synthesisModel, 'synthesis');
  const reviewBatches = Math.ceil(panelCount / concurrency);
  const personaCount = Math.min(assumedPersonaCount, panelCount);
  const summaryBatches = Math.ceil(personaCount / concurrency);
  const minSeconds = reviewBatches * panelReviewSeconds[0] + summaryBatches * personaSummarySeconds[0] + synthesisSeconds[0] + overheadSeconds[0];
  const maxSeconds = reviewBatches * panelReviewSeconds[1] + summaryBatches * personaSummarySeconds[1] + synthesisSeconds[1] + overheadSeconds[1];
  return { minSeconds: Math.ceil(minSeconds * safetyFactor), maxSeconds: Math.ceil(maxSeconds * safetyFactor) };
}

export function fmtMinuteRange(minSeconds, maxSeconds) {
  const minMinutes = Math.max(1, Math.ceil(minSeconds / 60));
  const maxMinutes = Math.max(minMinutes, Math.ceil(maxSeconds / 60));
  if (minMinutes === maxMinutes) return `약 ${minMinutes}분`;
  return `약 ${minMinutes}~${maxMinutes}분`;
}

export function renderPanelSizeEstimateGuide() {
  if (!$.panelSizeEstimate || !$.panelSize) return;
  const selectedSize = Number($.panelSize.value || 10);
  const reviewModel = $.reviewModel?.value || 'gpt-4o-mini';
  const summaryModel = $.summaryModel?.value || 'gpt-4o-mini';
  const synthesisModel = $.synthesisModel?.value || 'gpt-4o';
  const { minSeconds, maxSeconds } = estimateValidationSeconds(selectedSize, { reviewModel, summaryModel, synthesisModel });
  const timeLabel = fmtMinuteRange(minSeconds, maxSeconds);
  $.panelSizeEstimate.innerHTML = `
    <div class="panel-size-est-title">검증 예상 소요 시간</div>
    <div class="panel-size-est-main">
      <span class="panel-size-est-size">패널 ${selectedSize}명</span>
      <span class="panel-size-est-time">${timeLabel}</span>
    </div>
    <div class="panel-size-est-note">리뷰 ${esc(reviewModel)} · 요약 ${esc(summaryModel)} · 합성 ${esc(synthesisModel)} 기준의 보수적 추정치입니다.</div>
  `;
}

function setAuthStatus(type, text) {
  if (!$.authStatus) return;
  $.authStatus.className = 'auth-status' + (type ? ' ' + type : '');
  $.authStatus.textContent = text;
}

function resetAuth() {
  state.passwordVerified = false;
  setAuthStatus('', '');
  if ($.btnVerify) $.btnVerify.disabled = false;
  updateRunBtn();
}

export function initReviewRunner(showResults) {
  // Verify button
  if ($.btnVerify && $.runPassword) {
    $.runPassword.addEventListener('input', resetAuth);

    $.btnVerify.addEventListener('click', async () => {
      const pw = $.runPassword.value.trim();
      if (!pw) {
        setAuthStatus('error', '비밀번호를 입력해주세요.');
        return;
      }
      $.btnVerify.disabled = true;
      setAuthStatus('', '확인 중...');
      try {
        const result = await verifyPassword(pw);
        if (result.ok) {
          state.passwordVerified = true;
          setAuthStatus('ok', '인증되었습니다.');
          updateRunBtn();
        } else {
          state.passwordVerified = false;
          setAuthStatus('error', result.error || '비밀번호가 올바르지 않습니다.');
          $.btnVerify.disabled = false;
          updateRunBtn();
        }
      } catch {
        state.passwordVerified = false;
        setAuthStatus('error', '확인 중 오류가 발생했습니다.');
        $.btnVerify.disabled = false;
        updateRunBtn();
      }
    });

    $.runPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $.btnVerify.click();
    });
  }

  // Run button
  $.btnRun.addEventListener('click', async () => {
    const textVal = $.textContent.value.trim();
    if ((!state.selectedFile && !textVal) || !state.personasLoaded || !state.passwordVerified) return;

    const password = $.runPassword ? $.runPassword.value.trim() : null;

    $.btnRun.disabled = true;
    $.progress.classList.remove('hidden');
    $.progressFill.style.width = '0%';
    $.progressText.textContent = '리뷰를 시작합니다...';
    $.progressTime.textContent = '';

    const fd = new FormData();
    if (state.selectedFile) fd.append('file', state.selectedFile);
    if (textVal) fd.append('text_content', textVal);
    fd.append('provider', $.provider.value);
    fd.append('review_model', $.reviewModel.value);
    fd.append('summary_model', $.summaryModel.value);
    fd.append('synthesis_model', $.synthesisModel.value);
    fd.append('qa_mode', document.getElementById('qa-mode').value);
    fd.append('panel_size', String(state.selectedPanelSize || Number($.panelSize.value || 10)));
    fd.append('team', state.team);
    if (state.samplingSeed) fd.append('sampling_seed', state.samplingSeed);
    if (password) fd.append('password', password);

    try {
      const donePayload = await runReview(
        fd,
        (payload) => {
          if (payload.phase === 'panel_review') {
            const pct = (payload.completed / payload.total) * 100;
            $.progressFill.style.width = pct + '%';
            $.progressText.textContent = `패널 리뷰 ${payload.completed}/${payload.total} — ${payload.persona_name}`;
            if (payload.elapsed_seconds && payload.completed >= 3) {
              const perItem = payload.elapsed_seconds / payload.completed;
              const remaining = perItem * (payload.total - payload.completed);
              $.progressTime.textContent = `경과 ${fmtTime(payload.elapsed_seconds)} | 남은 시간 약 ${fmtTime(remaining)}`;
            } else if (payload.elapsed_seconds) {
              $.progressTime.textContent = `경과 ${fmtTime(payload.elapsed_seconds)} | 추정 중...`;
            }
          } else if (payload.phase === 'persona_synthesis') {
            const pct = (payload.completed / payload.total) * 100;
            $.progressFill.style.width = pct + '%';
            $.progressText.textContent = `페르소나 종합 ${payload.completed}/${payload.total} — ${payload.persona_name}`;
            if (payload.elapsed_seconds && payload.completed >= 2) {
              const perItem = payload.elapsed_seconds / payload.completed;
              const remaining = perItem * (payload.total - payload.completed);
              $.progressTime.textContent = `경과 ${fmtTime(payload.elapsed_seconds)} | 남은 시간 약 ${fmtTime(remaining)}`;
            } else if (payload.elapsed_seconds) {
              $.progressTime.textContent = `경과 ${fmtTime(payload.elapsed_seconds)} | 추정 중...`;
            }
          }
        },
        (payload) => {
          $.progressText.textContent = payload.message;
          $.progressTime.textContent = '';
        }
      );
      if (donePayload) showResults(donePayload);
    } catch (e) {
      alert('리뷰 실행 중 오류: ' + (e.message || e));
    }

    $.progress.classList.add('hidden');
    // Reset auth after run so next run requires re-verification
    resetAuth();
  });
}
