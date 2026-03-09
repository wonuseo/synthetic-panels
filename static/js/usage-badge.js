import { $ } from './ui.js';
import { checkReviewLimit } from './api.js';

export async function refreshUsageBadge() {
  try {
    const info = await checkReviewLimit();
    const d = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
    $.usageBadge.classList.remove('hidden', 'warn', 'locked');
    if (info.needs_password) {
      $.usageBadge.classList.add('locked');
      $.usageBadge.textContent = `🔒 ${d} 사용량: ${info.today_count}/${info.limit} (비밀번호 필요)`;
    } else if (info.today_count >= info.limit - 1 && info.today_count > 0) {
      $.usageBadge.classList.add('warn');
      $.usageBadge.textContent = `⚠️ ${d} 사용량: ${info.today_count}/${info.limit}`;
    } else {
      $.usageBadge.textContent = `📊 ${d} 사용량: ${info.today_count}/${info.limit}`;
    }
  } catch {}
}
