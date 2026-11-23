import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Env ${name} wajib diisi (lihat .env.example)`);
  return v;
}
function str(name: string, def: string): string {
  return process.env[name]?.trim() || def;
}
function num(name: string, def: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return def;
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`Env ${name} harus berupa angka, dapat: "${raw}"`);
  return n;
}
function bool(name: string, def: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return def;
  return ['1', 'true', 'yes', 'y'].includes(raw);
}

function loadHashtags(): string[] {
  const fromEnv = process.env.HASHTAGS?.trim();
  let list: string[];
  if (fromEnv) {
    list = fromEnv.split(',');
  } else {
    const path = fileURLToPath(new URL('../config/hashtags.json', import.meta.url));
    const file = JSON.parse(readFileSync(path, 'utf8'));
    list = file.hashtags ?? [];
  }
  const clean = list.map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean);
  return [...new Set(clean)];
}

export const config = {
  telegramToken: required('TELEGRAM_BOT_TOKEN'),
  telegramChatId: required('TELEGRAM_CHAT_ID'),
  apifyToken: required('APIFY_TOKEN'),
  apifyTiktokActor: str('APIFY_TIKTOK_ACTOR', 'clockworks~tiktok-hashtag-scraper'),
  apifyInstagramActor: str('APIFY_INSTAGRAM_ACTOR', 'apify~instagram-hashtag-scraper'),
  enableTiktok: bool('ENABLE_TIKTOK', true),
  enableInstagram: bool('ENABLE_INSTAGRAM', false),
  resultsPerHashtag: num('RESULTS_PER_HASHTAG', 30),
  maxAgeHours: num('MAX_AGE_HOURS', 6),
  minViews: num('MIN_VIEWS', 50000),
  minViewsPerHour: num('MIN_VIEWS_PER_HOUR', 0),
  cronSchedule: str('CRON_SCHEDULE', '*/30 * * * *'),
  timezone: str('TZ', 'Asia/Makassar'),
  concurrency: Math.max(1, num('CONCURRENCY', 2)),
  maxRetries: num('MAX_RETRIES', 3),
  maxAlertsPerCycle: num('MAX_ALERTS_PER_CYCLE', 20),
  hashtags: loadHashtags(),
  sentFile: fileURLToPath(new URL('../data/sent.json', import.meta.url)),
  // Diisi di Vercel. Kosong -> fallback ke data/sent.json untuk lokal.
  redisUrl: str('UPSTASH_REDIS_REST_URL', ''),
  redisToken: str('UPSTASH_REDIS_REST_TOKEN', ''),
};
