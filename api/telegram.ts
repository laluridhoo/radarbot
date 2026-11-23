import { requiredEnv } from '../src/env.js';
import { json } from '../src/http.js';
import {
  SLOTS,
  SLOT_LIMITS,
  cleanHashtags,
  listAllHashtags,
  setHashtags,
  type Slot,
} from '../src/redis.js';
import { escapeHtml, sendTelegram } from '../src/telegram.js';

interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
}

const HELP = [
  '🤖 <b>Perintah tersedia</b>',
  '/set1 tag1 tag2 tag3 tag4  (maks. 4)',
  '/set2 tag1 tag2 tag3  (maks. 3)',
  '/set3 tag1 tag2 tag3  (maks. 3)',
  '/list — lihat isi semua slot',
].join('\n');

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
      const match = text.match(/^\/(set[123]|list)(?:@[\w_]+)?(?:\s+([\s\S]*))?$/i);
      let reply: string;

      if (!match) {
        reply = HELP;
      } else if (match[1].toLowerCase() === 'list') {
        const all = await listAllHashtags();
        const lines = ['📋 <b>Hashtag tersimpan</b>', '────────────────────'];
        for (const slot of SLOTS) {
          const tags = all[slot];
          const display = tags.length ? tags.map((t) => `#${escapeHtml(t)}`).join(' ') : '<i>kosong</i>';
          lines.push(`<b>Slot ${slot}</b> (${tags.length}/${SLOT_LIMITS[slot]}): ${display}`);
        }
        reply = lines.join('\n');
      } else {
        const slot = match[1].slice(-1) as Slot;
        const hashtags = cleanHashtags((match[2] ?? '').split(/\s+/));
        const limit = SLOT_LIMITS[slot];

        if (!hashtags.length) {
          reply = `⚠️ Kirim minimal 1 tagar. Contoh: /set${slot} tag1 tag2`;
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
