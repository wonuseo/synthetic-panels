/**
 * Synthetic Panels — Theme System
 * setTheme(name) 으로 전체 색상 변수를 한번에 전환합니다.
 *
 * 사용 예:
 *   import { setTheme } from './themes.js';
 *   setTheme('cobalt');   // 원래 파란 계열
 *   setTheme('gold');     // 현재 골드+그레이 (기본값)
 *   setTheme('red');      // 강렬한 레드 계열
 */

/* ──────────────────────────────────────────────────────────
   THEME DEFINITIONS
   각 테마는 :root 변수들을 덮어씁니다.
   btn-primary 그래디언트처럼 CSS에 하드코딩된 값은 변경되지 않습니다.
   ────────────────────────────────────────────────────────── */
export const THEMES = {

  /** 기본값: PANTONE 8003C Gold + 425C Grey */
  gold: {
    '--accent':       '#877669',
    '--accent-2':     '#A09383',
    '--accent-dim':   'rgba(135, 118, 105, 0.08)',
    '--accent-glow':  'rgba(135, 118, 105, 0.20)',
    '--upper':        '#DA291C',
    '--upper-dim':    'rgba(218, 41, 28, 0.10)',
    '--mid':          '#877669',
    '--mid-dim':      'rgba(135, 118, 105, 0.12)',
    '--lower':        '#54585A',
    '--lower-dim':    'rgba(84, 88, 90, 0.12)',
    '--success':      '#877669',
    '--success-dim':  'rgba(135, 118, 105, 0.10)',
    '--warn':         '#A2A5A7',
    '--warn-dim':     'rgba(162, 165, 167, 0.14)',
    '--danger':       '#DA291C',
    '--danger-dim':   'rgba(218, 41, 28, 0.10)',
    '--bg':           '#F4F3F1',
    '--surface':      '#FFFFFF',
    '--surface-2':    '#F9F8F7',
    '--surface-3':    '#EEEDEB',
    '--border':       '#E1E2E2',
    '--border-mid':   '#BCBDBF',
    '--text':         '#1A1A1A',
    '--text-muted':   '#54585A',
    '--text-faint':   '#A2A5A7',
  },

  /** 원본: Cobalt Blue (#1d4ed8) + Purple upper funnel */
  cobalt: {
    '--accent':       '#1d4ed8',
    '--accent-2':     '#93afe8',
    '--accent-dim':   'rgba(29, 78, 216, 0.07)',
    '--accent-glow':  'rgba(29, 78, 216, 0.15)',
    '--upper':        '#6c5ce7',
    '--upper-dim':    'rgba(108, 92, 231, 0.10)',
    '--mid':          '#0984e3',
    '--mid-dim':      'rgba(9, 132, 227, 0.10)',
    '--lower':        '#00b894',
    '--lower-dim':    'rgba(0, 184, 148, 0.10)',
    '--success':      '#00b894',
    '--success-dim':  'rgba(0, 184, 148, 0.10)',
    '--warn':         '#e17055',
    '--warn-dim':     'rgba(225, 112, 85, 0.10)',
    '--danger':       '#d63031',
    '--danger-dim':   'rgba(214, 48, 49, 0.10)',
    '--bg':           '#f0f1ee',
    '--surface':      '#ffffff',
    '--surface-2':    '#f5f6f3',
    '--surface-3':    '#edeeed',
    '--border':       '#e2e4df',
    '--border-mid':   '#c8ccc5',
    '--text':         '#1a202c',
    '--text-muted':   '#5a6065',
    '--text-faint':   '#a0a7aa',
  },

  /** PANTONE 485C Red 강조 버전 */
  red: {
    '--accent':       '#DA291C',
    '--accent-2':     '#877669',
    '--accent-dim':   'rgba(218, 41, 28, 0.07)',
    '--accent-glow':  'rgba(218, 41, 28, 0.18)',
    '--upper':        '#DA291C',
    '--upper-dim':    'rgba(218, 41, 28, 0.10)',
    '--mid':          '#877669',
    '--mid-dim':      'rgba(135, 118, 105, 0.12)',
    '--lower':        '#54585A',
    '--lower-dim':    'rgba(84, 88, 90, 0.12)',
    '--success':      '#877669',
    '--success-dim':  'rgba(135, 118, 105, 0.10)',
    '--warn':         '#A2A5A7',
    '--warn-dim':     'rgba(162, 165, 167, 0.14)',
    '--danger':       '#DA291C',
    '--danger-dim':   'rgba(218, 41, 28, 0.10)',
    '--bg':           '#F4F3F1',
    '--surface':      '#FFFFFF',
    '--surface-2':    '#F9F8F7',
    '--surface-3':    '#EEEDEB',
    '--border':       '#E1E2E2',
    '--border-mid':   '#BCBDBF',
    '--text':         '#1A1A1A',
    '--text-muted':   '#54585A',
    '--text-faint':   '#A2A5A7',
  },
};

const STORAGE_KEY = 'sp-theme';
const DEFAULT_THEME = 'cobalt';

/**
 * 테마를 적용합니다.
 * @param {keyof typeof THEMES} name  - 'gold' | 'cobalt' | 'red'
 * @param {boolean} [persist=true]    - localStorage에 저장 여부
 */
export function setTheme(name, persist = true) {
  const theme = THEMES[name];
  if (!theme) {
    console.warn(`[themes] Unknown theme: "${name}". Available: ${Object.keys(THEMES).join(', ')}`);
    return;
  }
  const root = document.documentElement;
  Object.entries(theme).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = name;
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, name); } catch { /* 무시 */ }
  }
}

/**
 * 저장된 테마를 불러옵니다. 없으면 기본값(gold)을 적용합니다.
 */
export function loadSavedTheme() {
  let saved = DEFAULT_THEME;
  try { saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME; } catch { /* 무시 */ }
  if (!THEMES[saved]) saved = DEFAULT_THEME;
  setTheme(saved, false);
}

/** 현재 적용 중인 테마 이름을 반환합니다. */
export function getCurrentTheme() {
  return document.documentElement.dataset.theme || DEFAULT_THEME;
}
