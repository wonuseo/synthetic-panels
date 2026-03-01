/* ── State ── */
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o'];

let selectedFile = null;
let personasLoaded = false;
const $textContent = document.getElementById('text-content');
let lastReviews = [];
let lastSynthesis = null;
let lastSynthesisRaw = null;
window.funnelConfig = null;

/* ── Load funnel config ── */
async function loadFunnelConfig() {
  try {
    const res = await fetch('/api/funnel-config');
    const data = await res.json();
    if (data.ok) window.funnelConfig = data.funnels;
  } catch (e) {
    console.error('Failed to load funnel config:', e);
  }
}
loadFunnelConfig();

/* ── DOM refs ── */
const $dropZone     = document.getElementById('drop-zone');
const $fileInput    = document.getElementById('file-input');
const $preview      = document.getElementById('preview');
const $btnRun       = document.getElementById('btn-run');
const $progress     = document.getElementById('progress-area');
const $progressFill = document.getElementById('progress-fill');
const $progressText = document.getElementById('progress-text');
const $btnLoad      = document.getElementById('btn-load-personas');
const $pStatus      = document.getElementById('persona-status');
const $pListWrap    = document.getElementById('persona-list-wrap');
const $provider     = document.getElementById('provider');
const $providerWarn = document.getElementById('provider-warning');
const $model        = document.getElementById('model');
const $pageUpload   = document.getElementById('page-upload');
const $pageResults  = document.getElementById('page-results');
const $btnBack      = document.getElementById('btn-back');
const $btnSave      = document.getElementById('btn-save');

/* ── Model selector ── */
function updateModels() {
  $model.innerHTML = OPENAI_MODELS.map(m => `<option value="${m}">${m}</option>`).join('');
}
$provider.addEventListener('change', () => {
  $providerWarn.classList.toggle('hidden', $provider.value !== 'Claude');
  updateModels();
});
updateModels();

/* ── File upload ── */
$dropZone.addEventListener('click', () => $fileInput.click());
$dropZone.addEventListener('dragover', e => { e.preventDefault(); $dropZone.classList.add('dragover'); });
$dropZone.addEventListener('dragleave', () => $dropZone.classList.remove('dragover'));
$dropZone.addEventListener('drop', e => {
  e.preventDefault(); $dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
$fileInput.addEventListener('change', () => { if ($fileInput.files.length) handleFile($fileInput.files[0]); });

function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf','png','jpg','jpeg'].includes(ext)) { alert('PDF, PNG, JPG만 지원합니다.'); return; }
  selectedFile = file;
  $preview.classList.remove('hidden');
  if (ext === 'pdf') {
    $preview.innerHTML = `<div class="pdf-tag">📄 ${file.name} (${(file.size/1024).toFixed(1)} KB)</div>`;
  } else {
    const url = URL.createObjectURL(file);
    $preview.innerHTML = `<img src="${url}" alt="${file.name}" />`;
  }
  updateRunBtn();
}

function updateRunBtn() {
  $btnRun.disabled = !((selectedFile || $textContent.value.trim()) && personasLoaded);
}
$textContent.addEventListener('input', updateRunBtn);

/* ── Load personas ── */
$btnLoad.addEventListener('click', async () => {
  $pStatus.innerHTML = '<div class="persona-badge" style="color:#636e72">로딩 중...</div>';
  $pListWrap.classList.add('hidden');
  $pListWrap.innerHTML = '';
  try {
    const res = await fetch('/api/personas', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      personasLoaded = true;
      $pStatus.innerHTML = `<div class="persona-badge ok">✅ ${data.personas.length}명 로드 완료</div>`;
      $pListWrap.classList.remove('hidden');
      $pListWrap.innerHTML = `<div class="persona-list">${
        data.personas.map(p => `
          <div class="persona-list-item">
            <span class="p-name">${esc(p.persona_name)}</span>
            ${p.panel_gender ? `<span class="p-tag">${esc(p.panel_gender)}</span>` : ''}
            ${p.persona_season ? `<span class="p-tag">${esc(p.persona_season)}</span>` : ''}
          </div>`).join('')
      }</div>`;
    } else {
      personasLoaded = false;
      $pStatus.innerHTML = `<div class="persona-badge err">❌ ${data.error}</div>`;
    }
  } catch (e) {
    personasLoaded = false;
    $pStatus.innerHTML = `<div class="persona-badge err">❌ 네트워크 오류</div>`;
  }
  updateRunBtn();
});

/* ── Run review (SSE) ── */
$btnRun.addEventListener('click', async () => {
  const textVal = $textContent.value.trim();
  if ((!selectedFile && !textVal) || !personasLoaded) return;
  $btnRun.disabled = true;
  $progress.classList.remove('hidden');
  $progressFill.style.width = '0%';
  $progressText.textContent = '리뷰를 시작합니다...';

  const fd = new FormData();
  if (selectedFile) fd.append('file', selectedFile);
  if (textVal) fd.append('text_content', textVal);
  fd.append('provider', $provider.value);
  fd.append('model', $model.value);
  fd.append('qa_mode', document.getElementById('qa-mode').value);

  try {
    const res = await fetch('/api/review', { method: 'POST', body: fd });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventType = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const payload = JSON.parse(raw);
            if (eventType === 'progress') {
              const pct = (payload.completed / payload.total) * 100;
              $progressFill.style.width = pct + '%';
              $progressText.textContent = `${payload.completed}/${payload.total} 완료 — ${payload.persona_name}`;
            } else if (eventType === 'status') {
              $progressText.textContent = payload.message;
            } else if (eventType === 'done') {
              showResults(payload);
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    alert('리뷰 실행 중 오류: ' + e.message);
  }

  $progress.classList.add('hidden');
  $btnRun.disabled = false;
});

/* ── Navigation ── */
$btnBack.addEventListener('click', () => {
  $pageResults.classList.add('hidden');
  $pageUpload.classList.remove('hidden');
});

/* ── Save ── */
$btnSave.addEventListener('click', async () => {
  if (!lastReviews.length) return;
  $btnSave.disabled = true;
  $btnSave.textContent = '저장 중...';
  const fd = new FormData();
  fd.append('reviews_json', JSON.stringify(lastReviews));
  if (lastSynthesis) fd.append('synthesis_json', JSON.stringify(lastSynthesis));
  try {
    const res = await fetch('/api/save', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.ok) {
      $btnSave.textContent = `✅ ${data.count}건 저장 완료`;
      setTimeout(() => { $btnSave.textContent = '💾 Save to Sheets'; $btnSave.disabled = false; }, 3000);
    } else {
      alert('저장 실패: ' + data.error);
      $btnSave.textContent = '💾 Save to Sheets';
      $btnSave.disabled = false;
    }
  } catch (e) {
    alert('저장 중 오류: ' + e.message);
    $btnSave.textContent = '💾 Save to Sheets';
    $btnSave.disabled = false;
  }
});

/* ── Tab switching ── */
document.getElementById('tab-bar').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const tab = btn.dataset.tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
});

/* ══════════════════════════════
   Render results page
   ══════════════════════════════ */
function showResults(payload) {
  const { reviews, synthesis, synthesis_raw } = payload;
  lastReviews = reviews;
  lastSynthesis = synthesis;
  lastSynthesisRaw = synthesis_raw;

  $pageUpload.classList.add('hidden');
  $pageResults.classList.remove('hidden');

  // Reset to overview tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="overview"]').classList.add('active');
  document.getElementById('tab-overview').classList.add('active');

  renderOverviewTab(reviews, synthesis, synthesis_raw);
  renderFunnelTab('upper');
  renderFunnelTab('mid');
  renderFunnelTab('lower');
  renderIndividualTab(reviews);
  renderQATab(reviews);
}

/* ── Overview Tab ── */
function renderOverviewTab(reviews, synthesis, synthesis_raw) {
  const valid = reviews.filter(r => !r.error);
  const errors = reviews.filter(r => r.error).length;
  const interested = reviews.filter(r => r.recommendation && (
    r.recommendation.includes('관심 있음') || (r.recommendation.includes('Interested') && !r.recommendation.includes('Not'))
  )).length;

  let html = '';

  const metricsCards = [
    metricCard('총 패널 수', `${reviews.length}명`),
    metricCard('유효 응답', `${valid.length}명`),
    metricCard('관심 표명', `${interested}명`),
    metricCard('오류', `${errors}건`),
  ];

  if (window.funnelConfig) {
    for (const [, funnel] of Object.entries(window.funnelConfig)) {
      const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
      if (!quantItems.length) continue;
      const vals = [];
      for (const item of quantItems) {
        const scores = valid.map(r => r[item.key]).filter(v => v > 0);
        if (scores.length) {
          const max = item.scale === '0-10' || item.scale === '1-10' ? 10 : 7;
          const avg = (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1);
          vals.push({ avg, max });
        }
      }
      if (vals.length) {
        const funnelAvg = (vals.reduce((a,v) => a + parseFloat(v.avg), 0) / vals.length).toFixed(1);
        metricsCards.push(metricCard(funnel.label.split('(')[0].trim(), `${funnelAvg} / ${vals[0].max}`));
      }
    }
  }

  const rows = [[], [], []];
  metricsCards.forEach((card, i) => rows[Math.min(Math.floor(i / 4), 2)].push(card));
  html += `<div class="metrics">${rows[0].join('')}</div>`;
  if (rows[1].length) html += `<div class="metrics" style="margin-top:-10px">${rows[1].join('')}</div>`;
  if (rows[2].length) html += `<div class="metrics" style="margin-top:-10px">${rows[2].join('')}</div>`;

  if (synthesis && !synthesis.error) {
    html += `<div class="synthesis">`;
    if (synthesis.executive_summary) {
      html += `<h3>💡 Executive Summary</h3>`;
      html += `<div class="exec-summary">${esc(synthesis.executive_summary)}</div>`;
    }
    if (synthesis.go_nogo_recommendation) {
      html += `<div class="syn-decision"><h4>📋 Go/No-Go 의사결정</h4>`;
      html += `<div class="syn-decision-item">${renderSynValue(synthesis.go_nogo_recommendation)}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  } else if (synthesis_raw) {
    html += `<div class="synthesis"><h3>통합 분석 (Raw)</h3><pre style="white-space:pre-wrap;font-size:.85rem">${esc(synthesis_raw)}</pre></div>`;
  }

  const scored = reviews.filter(r => r.appeal_score > 0).sort((a,b) => b.appeal_score - a.appeal_score);
  if (scored.length) {
    html += `<div class="card chart-area"><h2>📈 매력도 점수 분포</h2><div>`;
    html += scored.map(r => {
      const pct = r.appeal_score * 10;
      const cls = r.appeal_score >= 7 ? 'high' : r.appeal_score >= 4 ? 'mid' : 'low';
      return `<div class="bar-row">
        <div class="name">${esc(r.persona_name)}</div>
        <div class="bar"><div class="bar-fill ${cls}" style="width:${pct}%">${r.appeal_score}</div></div>
      </div>`;
    }).join('');
    html += `</div></div>`;
  }

  document.getElementById('tab-overview').innerHTML = html;
}

/* ── Funnel Tab (upper/mid/lower) ── */
function renderFunnelTab(funnelKey) {
  const $panel = document.getElementById('tab-' + funnelKey);
  if (!window.funnelConfig || !window.funnelConfig[funnelKey]) {
    $panel.innerHTML = '<p>퍼널 설정을 불러올 수 없습니다.</p>';
    return;
  }
  const funnel = window.funnelConfig[funnelKey];
  const valid = lastReviews.filter(r => !r.error);
  let html = '';

  html += `<h2 style="font-size:1.15rem;margin-bottom:6px">${esc(funnel.label)}</h2>`;
  if (funnel.description) {
    html += `<p style="color:#636e72;font-size:.9rem;margin-bottom:18px">${esc(funnel.description)}</p>`;
  }

  if (lastSynthesis && !lastSynthesis.error) {
    const synQuant = [], synQual = [], synCat = [];
    for (const item of funnel.synthesis_items) {
      const val = lastSynthesis[item.key];
      if (val == null || val === '' || (Array.isArray(val) && !val.length)) continue;
      if (item.type === 'quantitative' && typeof val === 'number') {
        const suffix = item.key.includes('probability') || item.key.includes('conversion') || item.key === 'overall_score' ? '/10' : '/7';
        synQuant.push({ label: item.label, val, suffix });
      } else if (item.type === 'categorical') {
        synCat.push({ label: item.label, val });
      } else {
        synQual.push({ label: item.label, val });
      }
    }
    if (synQuant.length || synQual.length || synCat.length) {
      html += `<div class="synthesis"><h3>📊 통합 분석</h3>`;
      if (synQuant.length) {
        html += `<div class="syn-metrics">`;
        for (const m of synQuant) html += synMetric(m.label, m.val, m.suffix);
        html += `</div>`;
      }
      if (synQual.length) {
        html += `<div class="syn-qual"><h4>💬 정성적 분석</h4>`;
        for (const item of synQual)
          html += `<div class="syn-qual-item"><div class="sq-label">${esc(item.label)}</div>${renderSynValue(item.val)}</div>`;
        html += `</div>`;
      }
      if (synCat.length) {
        html += `<div class="syn-decision"><h4>📋 의사결정 지원</h4>`;
        for (const item of synCat)
          html += `<div class="syn-decision-item"><div class="d-label">${esc(item.label)}</div>${renderSynValue(item.val)}</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
  }

  html += `<h3 style="font-size:1.05rem;margin:20px 0 12px">🧑‍🤝‍🧑 개별 페르소나 (${esc(funnel.label.split('(')[0].trim())})</h3>`;
  html += `<div class="persona-cards">`;
  [...lastReviews].sort((a,b) => b.appeal_score - a.appeal_score).forEach((r, i) => {
    const idx = `${funnelKey}-${i}`;
    const emoji = recEmoji(r.recommendation);
    const cls = r.appeal_score >= 7 ? 'high' : r.appeal_score >= 4 ? 'mid' : 'low';
    html += `<div class="persona-card" id="pc-${idx}">
      <div class="persona-card-header" onclick="toggleCard('${idx}')">
        <span class="emoji">${emoji}</span>
        <span class="name">${esc(r.persona_name)}</span>
        <span class="score-badge ${cls}">${r.appeal_score}/10</span>
        <span class="chevron">▶</span>
      </div>
      <div class="persona-card-body">
        ${renderScaleBarsForFunnel(r, funnelKey)}
        ${renderQualItemsForFunnel(r, funnelKey)}
      </div>
    </div>`;
  });
  html += `</div>`;
  $panel.innerHTML = html;
}

/* ── Scale bars for a single funnel ── */
const _scaleCls = ['ba', 'pv', 'bf', 'ae', 'is', 'pi', 'pp'];
const _funnelClsMap = { upper: 0, mid: 1, lower: 2 };

function renderScaleBarsForFunnel(r, funnelKey) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
  if (!quantItems.length) return '';
  const cls = _scaleCls[(_funnelClsMap[funnelKey] || 0) % _scaleCls.length];
  const scaleLabel = quantItems[0].scale || '1-7';
  let html = `<div class="scale-section"><h5>📊 정량 평가 (${scaleLabel})</h5><div class="scale-grid"><div class="scale-group">`;
  for (const item of quantItems) {
    const val = r[item.key];
    if (val == null) continue;
    const max = (item.scale === '0-10' || item.scale === '1-10') ? 10 : 7;
    html += scaleBar(item.label, val, max, cls);
  }
  html += `</div></div></div>`;
  return html;
}

/* ── Qual items for a single funnel ── */
function renderQualItemsForFunnel(r, funnelKey) {
  if (!window.funnelConfig) return '';
  const funnel = window.funnelConfig[funnelKey];
  if (!funnel) return '';
  const qualItems = funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical');
  let items = '';
  for (const item of qualItems) {
    const val = r[item.key];
    if (!val) continue;
    items += `<div class="qual-item"><div class="qual-label">${esc(item.label)}</div><div class="qual-text">${esc(val)}</div></div>`;
  }
  if (!items) return '';
  return `<div class="qual-section"><h5>💬 정성적 코멘트</h5><div class="qual-grid">${items}</div></div>`;
}

/* ── Individual Tab ── */
function renderIndividualTab(reviews) {
  let html = `<h2 style="font-size:1.15rem;margin-bottom:14px">🧑‍🤝‍🧑 개별 페르소나 리뷰</h2>`;
  html += `<div class="persona-cards">`;
  html += [...reviews].sort((a,b) => b.appeal_score - a.appeal_score).map((r, i) => renderPersonaCard(r, i)).join('');
  html += `</div>`;
  document.getElementById('tab-individual').innerHTML = html;
}

/* ── QA Tab ── */
function renderQATab(reviews) {
  const valid = reviews.filter(r => !r.error);
  const errors = reviews.filter(r => r.error);
  const withQA = valid.filter(r => r.qa_result && r.qa_result.qa_mode !== 'off');
  let html = '';

  if (withQA.length) {
    const avg = arr => arr.reduce((a,b) => a+b, 0) / arr.length;
    const qCls = v => v >= 0.7 ? 'good' : v >= 0.5 ? 'warn' : 'bad';
    const avgConsistency = avg(withQA.map(r => r.qa_result.consistency_score || 0));
    const avgTrap = avg(withQA.map(r => r.qa_result.trap_pass_rate || 0));
    const avgQuality = avg(withQA.map(r => r.qa_result.persona_quality || 0));
    const passCount = withQA.filter(r => r.qa_result.qa_passed).length;

    html += `<div class="synthesis"><h3>🔍 QA 통합 현황</h3><div class="qa-summary" style="margin-top:14px">`;
    html += `<div class="qa-score-card"><div class="qa-s-label">평균 일관성</div><div class="qa-s-value ${qCls(avgConsistency)}">${(avgConsistency * 100).toFixed(0)}%</div></div>`;
    html += `<div class="qa-score-card"><div class="qa-s-label">평균 트랩 통과율</div><div class="qa-s-value ${qCls(avgTrap)}">${(avgTrap * 100).toFixed(0)}%</div></div>`;
    html += `<div class="qa-score-card"><div class="qa-s-label">평균 페르소나 품질</div><div class="qa-s-value ${qCls(avgQuality)}">${(avgQuality * 100).toFixed(0)}%</div></div>`;
    html += `<div class="qa-score-card"><div class="qa-s-label">PASS / 전체</div><div class="qa-s-value ${passCount === withQA.length ? 'good' : 'warn'}">${passCount} / ${withQA.length}</div></div>`;
    html += `</div>`;

    if (window.funnelConfig) {
      html += `<div class="qa-detail" style="margin-top:16px">`;
      for (const [, funnel] of Object.entries(window.funnelConfig)) {
        if (!funnel.qa_items.length) continue;
        html += `<div class="qa-detail-group"><h6>${esc(funnel.label.split('(')[0].trim())} QA</h6>`;
        for (const qaItem of funnel.qa_items) {
          const vals = withQA.map(r => r.qa_result[qaItem.key] || r[qaItem.key]).filter(v => v != null && v > 0);
          const avgVal = vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : '-';
          const typeLabel = qaItem.type === 'replication' ? '(일관성)' : '(트랩)';
          html += `<div class="qa-pair"><span class="qp-label">${esc(qaItem.key)} ${typeLabel}</span><span class="qp-val">${avgVal}</span></div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    html += `<h3 style="font-size:1.05rem;margin:20px 0 12px">🧑‍🤝‍🧑 개별 QA 결과</h3><div class="persona-cards">`;
    withQA.forEach((r, i) => {
      const idx = `qa-${i}`;
      html += `<div class="persona-card" id="pc-${idx}">
        <div class="persona-card-header" onclick="toggleCard('${idx}')">
          <span class="name">${esc(r.persona_name)}</span>
          <span class="qa-badge ${r.qa_result.qa_passed ? 'pass' : 'fail'}">${r.qa_result.qa_passed ? 'QA PASS' : 'QA FAIL'}</span>
          <span class="chevron">▶</span>
        </div>
        <div class="persona-card-body">${renderQA(r.qa_result)}</div>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<p style="color:#636e72">QA 데이터가 없습니다 (QA mode가 off이거나 유효 응답이 없습니다).</p>`;
  }

  if (errors.length) {
    html += `<h3 style="font-size:1.05rem;margin:24px 0 12px;color:#d63031">⚠️ 오류 목록 (${errors.length}건)</h3>`;
    html += `<div class="persona-cards">`;
    errors.forEach(r => {
      html += `<div class="persona-card" style="border-left:4px solid #d63031">
        <div class="persona-card-header">
          <span class="emoji">🔴</span>
          <span class="name">${esc(r.persona_name)}</span>
          <span style="color:#d63031;font-size:.85rem">${esc(r.error)}</span>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  document.getElementById('tab-qa').innerHTML = html;
}

/* ── Shared rendering helpers ── */
function metricCard(label, value) {
  return `<div class="metric-card"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function renderSynValue(val) {
  if (Array.isArray(val)) {
    return `<ul style="padding-left:18px;margin-top:4px">${val.map(x => `<li>${esc(typeof x === 'object' ? JSON.stringify(x) : String(x))}</li>`).join('')}</ul>`;
  }
  if (val && typeof val === 'object') {
    let html = '<div style="margin-top:4px">';
    for (const [k, v] of Object.entries(val))
      html += `<div style="margin-bottom:4px"><span style="font-weight:600;color:#636e72">${esc(k)}:</span> ${esc(typeof v === 'object' ? JSON.stringify(v) : String(v))}</div>`;
    return html + '</div>';
  }
  return `<div class="sq-text">${esc(String(val))}</div>`;
}

function synMetric(label, value, suffix) {
  const v = value != null ? value : '-';
  return `<div class="syn-metric"><div class="syn-m-label">${label}</div><div class="syn-m-value">${v}${value != null ? suffix : ''}</div></div>`;
}

function renderQA(qa) {
  if (!qa || qa.qa_mode === 'off') return '';
  const isLite = qa.qa_mode === 'lite';
  const qCls = v => v >= 0.7 ? 'good' : v >= 0.5 ? 'warn' : 'bad';

  let html = `<div class="qa-section"><h5>🔍 QA 검증 결과 (${isLite ? 'Lite' : 'Full'} Mode)</h5>`;
  html += `<div class="qa-summary">`;
  html += `<div class="qa-score-card"><div class="qa-s-label">응답 일관성</div><div class="qa-s-value ${qCls(qa.consistency_score)}">${(qa.consistency_score * 100).toFixed(0)}%</div></div>`;
  html += `<div class="qa-score-card"><div class="qa-s-label">트랩 통과율</div><div class="qa-s-value ${qCls(qa.trap_pass_rate)}">${(qa.trap_pass_rate * 100).toFixed(0)}%</div></div>`;
  html += `<div class="qa-score-card"><div class="qa-s-label">페르소나 품질</div><div class="qa-s-value ${qCls(qa.persona_quality)}">${(qa.persona_quality * 100).toFixed(0)}%</div></div>`;
  html += `<div class="qa-score-card"><div class="qa-s-label">판정</div><div class="qa-s-value ${qa.qa_passed ? 'good' : 'bad'}">${qa.qa_passed ? 'PASS' : 'FAIL'}</div></div>`;
  html += `</div><div class="qa-detail">`;
  html += `<div class="qa-detail-group"><h6>일관성 검증 (Core vs Replication)</h6>`;
  html += `<div class="qa-pair"><span class="qp-label">브랜드 호감도 (Rep)</span><span class="qp-val">${qa.qa_rep_brand_attitude || '-'}</span></div>`;
  if (!isLite) {
    html += `<div class="qa-pair"><span class="qp-label">가치 인식 (Rep)</span><span class="qp-val">${qa.qa_rep_value_perception || '-'}</span></div>`;
    html += `<div class="qa-pair"><span class="qp-label">구매 의향 (Rep)</span><span class="qp-val">${qa.qa_rep_purchase_intent || '-'}</span></div>`;
  }
  html += `</div><div class="qa-detail-group"><h6>트랩 항목 (페르소나 적합성)</h6>`;
  html += `<div class="qa-pair"><span class="qp-label">예산 민감도</span><span class="qp-val">${qa.qa_trap_budget_sensitivity || '-'}</span></div>`;
  if (!isLite) {
    html += `<div class="qa-pair"><span class="qp-label">경쟁사 충성도</span><span class="qp-val">${qa.qa_trap_competitor_loyalty || '-'}</span></div>`;
    html += `<div class="qa-pair"><span class="qp-label">회의감 체크</span><span class="qp-val">${qa.qa_trap_skepticism_check || '-'}</span></div>`;
  }
  html += `</div></div></div>`;
  return html;
}

function renderPersonaCard(r, idx) {
  const emoji = recEmoji(r.recommendation);
  const cls = r.appeal_score >= 7 ? 'high' : r.appeal_score >= 4 ? 'mid' : 'low';
  const positives = (r.key_positives || '').split('; ').filter(Boolean);
  const concerns = (r.key_concerns || '').split('; ').filter(Boolean);

  return `<div class="persona-card" id="pc-ind-${idx}">
    <div class="persona-card-header" onclick="toggleCard('ind-${idx}')">
      <span class="emoji">${emoji}</span>
      <span class="name">${esc(r.persona_name)}</span>
      <span class="score-badge ${cls}">${r.appeal_score}/10</span>
      <span class="rec-text">${esc(r.recommendation)}</span>
      ${r.qa_result && r.qa_result.qa_mode !== 'off' ? `<span class="qa-badge ${r.qa_result.qa_passed ? 'pass' : 'fail'}">${r.qa_result.qa_passed ? 'QA PASS' : 'QA FAIL'}</span>` : ''}
      <span class="chevron">▶</span>
    </div>
    <div class="persona-card-body">
      ${r.error ? `<div style="color:#d63031;margin-bottom:10px">오류: ${esc(r.error)}</div>` : ''}
      <div class="impression">"${esc(r.first_impression)}"</div>
      <div class="pos-neg">
        <div><h5>✅ 긍정 요소</h5><ul>${positives.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h5>⚠️ 우려 사항</h5><ul>${concerns.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
      ${renderScaleBars(r)}
      ${renderQualItems(r)}
      ${renderQA(r.qa_result)}
      <div class="review-summary"><strong>종합 평가:</strong> ${esc(r.review_summary)}</div>
      <button class="raw-toggle" onclick="toggleRaw('ind-${idx}')">Raw Response 보기</button>
      <pre class="raw-content" id="raw-ind-${idx}">${esc(r.raw_response)}</pre>
    </div>
  </div>`;
}

/* ── Scale bars (all funnels — used in Individual tab) ── */
function renderScaleBars(r) {
  if (!window.funnelConfig) return '';
  let html = '<div class="scale-section"><h5>📊 정량 평가</h5><div class="scale-grid">';
  let clsIdx = 0;
  for (const [, funnel] of Object.entries(window.funnelConfig)) {
    const quantItems = funnel.individual_items.filter(i => i.type === 'quantitative');
    if (!quantItems.length) { clsIdx++; continue; }
    const cls = _scaleCls[clsIdx % _scaleCls.length];
    const scaleLabel = quantItems[0].scale || '1-7';
    html += `<div class="scale-group"><h6>${esc(funnel.label.split('(')[0].trim())} (${scaleLabel})</h6>`;
    for (const item of quantItems) {
      const val = r[item.key];
      if (val == null) continue;
      const max = (item.scale === '0-10' || item.scale === '1-10') ? 10 : 7;
      html += scaleBar(item.label, val, max, cls);
    }
    html += '</div>';
    clsIdx++;
  }
  html += '</div></div>';
  return html;
}

/* ── Qual items (all funnels — used in Individual tab) ── */
function renderQualItems(r) {
  if (!window.funnelConfig) return '';
  let items = '';
  for (const [, funnel] of Object.entries(window.funnelConfig)) {
    const qualItems = funnel.individual_items.filter(i => i.type === 'qualitative' || i.type === 'categorical');
    for (const item of qualItems) {
      const val = r[item.key];
      if (!val) continue;
      items += `<div class="qual-item"><div class="qual-label">${esc(item.label)}</div><div class="qual-text">${esc(val)}</div></div>`;
    }
  }
  if (!items) return '';
  return `<div class="qual-section"><h5>💬 정성적 코멘트</h5><div class="qual-grid">${items}</div></div>`;
}

function toggleCard(idx) { document.getElementById('pc-' + idx).classList.toggle('open'); }
function toggleRaw(idx)  { document.getElementById('raw-' + idx).classList.toggle('show'); }

function scaleBar(label, value, max, cls) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return `<div class="scale-item">
    <span class="scale-label">${label}</span>
    <div class="scale-bar"><div class="scale-fill ${cls}" style="width:${pct}%"></div></div>
    <span class="scale-val">${value}/${max}</span>
  </div>`;
}

function recEmoji(rec) {
  const m = {
    'Strongly Interested':'🟢', 'Somewhat Interested':'🔵', 'Neutral':'🟡', 'Not Interested':'🟠', 'Strongly Not Interested':'🔴',
    '매우 관심 있음':'🟢', '다소 관심 있음':'🔵', '보통':'🟡', '관심 없음':'🟠', '전혀 관심 없음':'🔴'
  };
  return m[rec] || '⚪';
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
