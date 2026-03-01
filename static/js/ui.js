import { state, OPENAI_MODELS } from './state.js';

export const $ = {
  dropZone:     document.getElementById('drop-zone'),
  fileInput:    document.getElementById('file-input'),
  preview:      document.getElementById('preview'),
  btnRun:       document.getElementById('btn-run'),
  progress:     document.getElementById('progress-area'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  btnLoad:      document.getElementById('btn-load-personas'),
  pStatus:      document.getElementById('persona-status'),
  pListWrap:    document.getElementById('persona-list-wrap'),
  provider:     document.getElementById('provider'),
  providerWarn: document.getElementById('provider-warning'),
  model:        document.getElementById('model'),
  pageUpload:   document.getElementById('page-upload'),
  pageResults:  document.getElementById('page-results'),
  btnBack:      document.getElementById('btn-back'),
  btnSave:      document.getElementById('btn-save'),
  textContent:  document.getElementById('text-content'),
};

export function updateRunBtn() {
  $.btnRun.disabled = !((state.selectedFile || $.textContent.value.trim()) && state.personasLoaded);
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

export function initModelSelector() {
  $.model.innerHTML = OPENAI_MODELS.map(m => `<option value="${m}">${m}</option>`).join('');
}
