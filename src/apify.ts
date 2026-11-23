import { optionalEnv, requiredEnv } from './env.js';
import { fetchJson } from './http.js';
import type { Slot } from './redis.js';

const APIFY_API = 'https://api.apify.com/v2';
const DEFAULT_ACTOR = 'clockworks~tiktok-hashtag-scraper';

export interface ApifyRunResponse {
  data?: { id?: string; defaultDatasetId?: string };
}

/** Mulai actor run tanpa menunggu selesai. Webhook ad-hoc dipasang lewat query param base64. */
export async function startActorRun(slot: Slot, hashtags: string[]): Promise<{ runId?: string; datasetId?: string }> {
  const token = requiredEnv(`APIFY_TOKEN_${slot}`);
  const actorId = optionalEnv('APIFY_ACTOR_ID', DEFAULT_ACTOR);
  const baseUrl = requiredEnv('VERCEL_PROJECT_URL').replace(/\/+$/, '');
  const webhookUrl = `${baseUrl}/api/webhook?secret=${encodeURIComponent(requiredEnv('CRON_SECRET'))}&slot=${slot}`;

  const webhooks = [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl }];
  const encoded = Buffer.from(JSON.stringify(webhooks)).toString('base64');
  const url = `${APIFY_API}/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(token)}&webhooks=${encodeURIComponent(encoded)}`;

  const input = {
    hashtags,
    resultsPerPage: 5,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    commentsPerPost: 0,
  };

  const res = await fetchJson<ApifyRunResponse>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    15_000,
  );

  return { runId: res.data?.id, datasetId: res.data?.defaultDatasetId };
}

export async function getDatasetItems<T>(datasetId: string, slot: Slot): Promise<T[]> {
  const token = requiredEnv(`APIFY_TOKEN_${slot}`);
  const url = `${APIFY_API}/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(token)}&format=json&clean=true`;
  return fetchJson<T[]>(url, {}, 20_000);
}
