import { config } from './config.js';
import { fetchJson } from './http.js';
import { withRetry } from './retry.js';
import type { GacorVideo } from './types.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n: number) => Math.round(n).toLocaleString('id-ID');

export async function sendText(html: string): Promise<void> {
  const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
  await withRetry(
    () =>
      fetchJson(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text: html,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        },
        20_000,
      ),
    { retries: config.maxRetries, label: 'Telegram sendMessage' },
  );
}

export function formatAlert(v: GacorVideo): string {
  return [
    '🚀 <b>CAMPAIGN GACOR DETECTED!</b>',
    '-----------------------------------',
    `🏷️ Tagar: #${esc(v.hashtag)}`,
    `👤 Creator: @${esc(v.authorUsername)}`,
    `⏱️ Umur Video: ${v.ageHours.toFixed(1)} jam lalu`,
    `👁️ Views: ${fmt(v.views)} views (${fmt(v.viewsPerHour)} views/jam)`,
    `❤️ Likes: ${fmt(v.likes)} | 💬 Comments: ${fmt(v.comments)}`,
    `🔗 Link Video: ${esc(v.url)}`,
    '-----------------------------------',
    '⚡ Sikatan ATM (Amati, Tiru, Modifikasi) sekarang!',
  ].join('\n');
}

export const sendAlert = (v: GacorVideo) => sendText(formatAlert(v));
