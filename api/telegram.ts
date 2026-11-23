import { requiredEnv } from '../src/env.js';
import { json } from '../src/http.js';
import {
  activeSlots,
  cleanHashtags,
  isSlot,
  listAllHashtags,
  setHashtags,
  slotLimit,
} from '../src/redis.js';
import { escapeHtml, sendTelegram } from '../src/telegram.js';

interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
}

function helpText(): string {
  const lines = ['🤖 <b>Perintah tersedia</b>'];
  for (const slot of activeSlots()) {
    lines.push(`/set${slot} tag1 tag2 ...  (maks. ${slotLimit(slot)})`);
  }
  lines.push('/list — lihat isi semua slot');
  return lines.join('\n');
}

function isOwner(body: TelegramUpdate): boolean {
  const chatId = body.message?.chat?.id;
  return chatId !== undefined && String(chatId) === requiredEnv('TELEGRAM_CHAT_ID');
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

    let body: TelegramUpdate;
    try {
      body = (await request.json()) as TelegramUpdate;
    } catch {
      return json({ ok: false, error: 'invalid JSON' }, 400);
    }

    try {
      if (!isOwner(body)) return json({ ok: false, error: 'unauthorized' }, 403);

      const text = (body.message?.text ?? '').trim();
      const match = text.match(/^\/(set[1-9]\d*|list)(?:@[\w_]+)?(?:\s+([\s\S]*))?$/i);
      let reply: string;

      if (!match) {
        reply = helpText();
      } else if (match[1].toLowerCase() === 'list') {
        const all = await listAllHashtags();
        const slots = activeSlots();
        if (!slots.length) {
          reply = '⚠️ Belum ada slot aktif. Tambahkan APIFY_TOKEN_1 (dst.) di Vercel lalu deploy ulang.';
        } else {
          const lines = ['📋 <b>Hashtag tersimpan</b>', '────────────────────'];
          for (const slot of slots) {
            const tags = all[slot];
            const display = tags.length
              ? tags.map((t) => `#${escapeHtml(t)}`).join(' ')
              : '<i>kosong</i>';
            lines.push(`<b>Slot ${slot}</b> (${tags.length}/${slotLimit(slot)}): ${display}`);
          }
          reply = lines.join('\n');
        }
      } else {
        const slot = match[1].slice(3); // "set4" -> "4"
        const hashtags = cleanHashtags((match[2] ?? '').split(/\s+/));
        const limit = slotLimit(slot);

        if (!hashtags.length) {
          reply = `⚠️ Kirim minimal 1 tagar. Contoh: /set${slot} tag1 tag2`;
        } else if (!isSlot(slot)) {
          reply = `❌ Slot ${slot} belum aktif. Tambahkan APIFY_TOKEN_${slot} di Environment Variables Vercel lalu deploy ulang.`;
        } else if (hashtags.length > limit) {
          reply = `❌ Slot ${slot} maksimal ${limit} tagar (dikirim ${hashtags.length}).`;
        } else {
          await setHashtags(slot, hashtags);
          reply = `✅ <b>Slot ${slot} tersimpan</b> (${hashtags.length}/${limit}):\n${hashtags.map((t) => `#${escapeHtml(t)}`).join(' ')}`;
        }
      }

      await sendTelegram(reply);
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 500);
    }
  },
};
