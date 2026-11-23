import { startActorRun } from '../src/apify.js';
import { requiredEnv } from '../src/env.js';
import { json } from '../src/http.js';
import { getHashtags, isSlot, type Slot } from '../src/redis.js';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') return json({ ok: false, error: 'method not allowed' }, 405);

    const params = new URL(request.url).searchParams;
    try {
      if (params.get('secret') !== requiredEnv('CRON_SECRET')) {
        return json({ ok: false, error: 'unauthorized' }, 401);
      }

      const rawSlot = params.get('slot');
      if (!isSlot(rawSlot)) return json({ ok: false, error: 'slot harus 1, 2, atau 3' }, 400);
      const slot: Slot = rawSlot;

      const hashtags = await getHashtags(slot);
      if (!hashtags.length) {
        return json({ ok: true, skipped: true, slot, reason: 'hashtag slot kosong' });
      }

      // Hanya memulai run; tidak menunggu actor selesai (webhook yang akan memanggil /api/webhook).
      const run = await startActorRun(slot, hashtags);
      return json({ ok: true, slot, hashtags, runId: run.runId, datasetId: run.datasetId });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 500);
    }
  },
};
