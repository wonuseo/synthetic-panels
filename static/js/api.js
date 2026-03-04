import { state } from './state.js';

export async function loadFunnelConfig() {
  try {
    const res = await fetch('/api/funnel-config');
    const data = await res.json();
    if (data.ok) window.funnelConfig = data.funnels;
  } catch (e) {
    console.error('Failed to load funnel config:', e);
  }
}

export async function loadPersonas() {
  try {
    const res = await fetch('/api/personas', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      return { ok: true, personas: data.personas, total_panels: data.total_panels };
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
        try {
          const payload = JSON.parse(raw);
          if (eventType === 'progress') {
            onProgress(payload);
          } else if (eventType === 'status') {
            onStatus(payload);
          } else if (eventType === 'done') {
            donePayload = payload;
          }
        } catch {}
      }
    }
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
