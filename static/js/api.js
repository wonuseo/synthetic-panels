import { state } from './state.js';

export async function loadFunnelConfig(team = 'marketing') {
  try {
    const res = await fetch('/api/funnel-config?team=' + encodeURIComponent(team));
    const data = await res.json();
    if (data.ok) window.funnelConfig = data.funnels;
  } catch (e) {
    console.error('Failed to load funnel config:', e);
  }
}

export async function loadSurveyTemplate(team = 'marketing') {
  try {
    const res = await fetch('/api/survey-template?team=' + encodeURIComponent(team));
    const data = await res.json();
    if (data.ok) return data.sections || [];
    return [];
  } catch (e) {
    console.error('Failed to load survey template:', e);
    return [];
  }
}

export async function loadPersonas(panelSize = 10, samplingSeed = null, team = 'marketing') {
  try {
    const params = new URLSearchParams({ panel_size: String(panelSize), team });
    if (samplingSeed) params.set('sampling_seed', samplingSeed);
    const res = await fetch(`/api/personas?${params.toString()}`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      return {
        ok: true,
        personas: data.personas,
        total_panels: data.total_panels,
        panel_size: data.panel_size,
        sampling_seed: data.sampling_seed,
      };
    } else {
      return { ok: false, error: data.error };
    }
  } catch (e) {
    return { ok: false, error: '네트워크 오류' };
  }
}

export async function checkReviewLimit() {
  const res = await fetch('/api/review-limit');
  return await res.json();
}

export async function runReview(fd, onProgress, onStatus) {
  const res = await fetch('/api/review', { method: 'POST', body: fd });
  if (res.status === 403) {
    const err = await res.json();
    throw { needsPassword: err.needs_password, message: err.error };
  }
  if (!res.ok) {
    let message = `서버 오류 (HTTP ${res.status})`;
    try {
      const err = await res.json();
      if (err && (err.error || err.message)) {
        message = err.error || err.message;
      }
    } catch {
      try {
        const text = await res.text();
        if (text) message = text;
      } catch {}
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error('SSE 응답 본문이 비어 있습니다.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';
  let donePayload = null;

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
        let payload;
        try {
          payload = JSON.parse(raw);
        } catch {
          continue;
        }
        if (eventType === 'progress') {
          onProgress(payload);
        } else if (eventType === 'status') {
          onStatus(payload);
        } else if (eventType === 'done') {
          donePayload = payload;
        } else if (eventType === 'error') {
          throw new Error(payload.error || payload.message || '리뷰 처리 중 서버 오류가 발생했습니다.');
        }
      }
    }
  }

  if (!donePayload) {
    throw new Error('완료 이벤트를 받지 못했습니다. 서버 로그를 확인하세요.');
  }
  if (donePayload.error) {
    throw new Error(donePayload.error);
  }
  return donePayload;
}

export async function saveResults(reviewsJson, synthesisJson, personaSummariesJson) {
  try {
    const fd = new FormData();
    fd.append('reviews_json', reviewsJson);
    if (synthesisJson) fd.append('synthesis_json', synthesisJson);
    if (personaSummariesJson) fd.append('persona_summaries_json', personaSummariesJson);
    const res = await fetch('/api/save', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.ok) {
      return { ok: true, count: data.count };
    } else {
      return { ok: false, error: data.error };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
