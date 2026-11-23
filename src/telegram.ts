import { requiredEnv } from './env.js';
import { fetchJson } from './http.js';
import type { Slot } from './redis.js';
import type { ViralVideo } from './filter.js';

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const fmt = (n: number) => Math.round(n).toLocaleString('id-ID');

export async function sendTelegram(text: string): Promise<void> {
  const token = requiredEnv('TELEGRAM_BOT_TOKEN');
  const chatId = requiredEnv('TELEGRAM_CHAT_ID');
  await fetchJson(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    },
    10_000,
  );
}

export function formatViralAlert(slot: Slot, videos: ViralVideo[]): string {
  const lines = [
    `🚀 <b>[SLOT ${slot}] EARLY VIRAL DETECTED</b>`,
    '────────────────────',
  ];

  for (const v of videos) {
    const age = v.ageMinutes < 60 ? `${v.ageMinutes} menit` : `${v.ageHours.toFixed(1)} jam (${v.ageMinutes} menit)`;
    lines.push(
      `🏷️ #${escapeHtml(v.hashtag)} · @${escapeHtml(v.author)}`,
      `⏱️ Umur: ${age}`,
      `👁️ Views: ${fmt(v.views)} · ⚡ VPH: ${fmt(v.vph)}`,
      `🔗 ${escapeHtml(v.url)}`,
      '────────────────────',
    );
  }

  return lines.join('\n');
}
