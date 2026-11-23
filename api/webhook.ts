import { getDatasetItems } from '../src/apify.js';
import { requiredEnv } from '../src/env.js';
import { findEarlyViral, type ApifyVideo } from '../src/filter.js';
import { json } from '../src/http.js';
import { activeSlots, isSlot, markSeen, type Slot } from '../src/redis.js';
import { formatViralAlert, sendTelegram } from '../src/telegram.js';

interface WebhookBody {
  resource?: { defaultDatasetId?: string };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

    const params = new URL(request.url).searchParams;
    try {
      if (params.get('secret') !== requiredEnv('CRON_SECRET')) {
        return json({ ok: false, error: 'unauthorized' }, 401);
      }

      const rawSlot = params.get('slot');
      if (!isSlot(rawSlot)) {
        return json(
          { ok: false, error: `slot tidak aktif. Slot tersedia: ${activeSlots().join(', ') || '(belum ada)'}` },
          400,
        );
      }
      const slot: Slot = rawSlot;

      let body: WebhookBody;
      try {
        body = (await request.json()) as WebhookBody;
      } catch {
        return json({ ok: false, error: 'invalid JSON' }, 400);
      }

      const datasetId = body.resource?.defaultDatasetId;
      if (!datasetId) return json({ ok: false, error: 'missing resource.defaultDatasetId' }, 400);

      const items = await getDatasetItems<ApifyVideo>(datasetId, slot);
      const viral = findEarlyViral(items);

      // Webhook Apify bisa terkirim lebih dari sekali -> cegah alert dobel.
      const fresh: typeof viral = [];
      for (const video of viral) {
        if (await markSeen(video.id)) fresh.push(video);
      }

      for (let i = 0; i < fresh.length; i += 5) {
        await sendTelegram(formatViralAlert(slot, fresh.slice(i, i + 5)));
      }

      return json({
        ok: true,
        slot,
        scanned: items.length,
        earlyViral: viral.length,
        sent: fresh.length,
        duplicates: viral.length - fresh.length,
      });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 500);
    }
  },
};
