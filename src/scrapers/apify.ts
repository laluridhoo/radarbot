import { config } from '../config.js';
import { fetchJson } from '../http.js';

/** Jalankan actor Apify secara sinkron dan ambil dataset-nya (maks ~5 menit per run). */
export async function runActor<T>(actorId: string, input: Record<string, unknown>): Promise<T[]> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?timeout=240&format=json&clean=true`;
  return fetchJson<T[]>(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apifyToken}`,
      },
      body: JSON.stringify(input),
    },
    280_000,
  );
}
