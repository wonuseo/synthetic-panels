import { state, OPENAI_MODELS } from './state.js';

export const $ = {
  dropZone:     document.getElementById('drop-zone'),
  fileInput:    document.getElementById('file-input'),
  preview:      document.getElementById('preview'),
  btnRun:       document.getElementById('btn-run'),
  progress:     document.getElementById('progress-area'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  progressTime: document.getElementById('progress-time'),
  btnLoad:      document.getElementById('btn-load-personas'),
  panelSize:    document.getElementById('panel-size'),
  panelSizeEstimate: document.getElementById('panel-size-estimate'),
  pStatus:      document.getElementById('persona-status'),
  pListWrap:    document.getElementById('persona-list-wrap'),
  btnDemo:      document.getElementById('btn-demo'),
  provider:     document.getElementById('provider'),
  providerWarn: document.getElementById('provider-warning'),
  reviewModel:  document.getElementById('review-model'),
  summaryModel: document.getElementById('summary-model'),
  synthesisModel: document.getElementById('synthesis-model'),
  pageUpload:   document.getElementById('page-upload'),
  pageResults:  document.getElementById('page-results'),
  btnBack:      document.getElementById('btn-back'),
  btnSave:      document.getElementById('btn-save'),
  textContent:  document.getElementById('text-content'),
  runPassword:  document.getElementById('run-password'),
  btnVerify:    document.getElementById('btn-verify-password'),
  authStatus:   document.getElementById('auth-status'),
};

export function updateRunBtn() {
  $.btnRun.disabled = !((state.selectedFile || $.textContent.value.trim()) && state.personasLoaded && state.passwordVerified);
}

export function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
    alert('PDF, PNG, JPG만 지원합니다.');
    return;
  }
  state.selectedFile = file;
  $.preview.classList.remove('hidden');
  if (ext === 'pdf') {
    $.preview.innerHTML = `<div class="pdf-tag">📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)</div>`;
  } else {
    const url = URL.createObjectURL(file);
    $.preview.innerHTML = `<img src="${url}" alt="${file.name}" />`;
  }
  updateRunBtn();
}

export function initModelSelectors() {
  const prevReview = $.reviewModel.value;
  const prevSummary = $.summaryModel.value;
  const prevSynthesis = $.synthesisModel.value;
  const models = OPENAI_MODELS;
  const opts = models.map(m => `<option value="${m}">${m}</option>`).join('');
  $.reviewModel.innerHTML = opts;
  $.summaryModel.innerHTML = opts;
  $.synthesisModel.innerHTML = opts;

  // Default preset: review=mini, summary=mini, synthesis=4o
  const defaultReview = models.includes('gpt-4o-mini') ? 'gpt-4o-mini' : models[0];
  const defaultSummary = models.includes('gpt-4o-mini') ? 'gpt-4o-mini' : models[0];
  const defaultSynthesis = models.includes('gpt-4o') ? 'gpt-4o' : models[0];

  $.reviewModel.value = models.includes(prevReview) ? prevReview : defaultReview;
  $.summaryModel.value = models.includes(prevSummary) ? prevSummary : defaultSummary;
  $.synthesisModel.value = models.includes(prevSynthesis) ? prevSynthesis : defaultSynthesis;
}

// Keep backward compat alias
export const initModelSelector = initModelSelectors;
