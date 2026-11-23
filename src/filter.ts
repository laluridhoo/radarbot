export interface ApifyVideo {
  id?: string;
  createTime?: number | string;
  createTimeISO?: string;
  playCount?: number | string;
  webVideoUrl?: string;
  url?: string;
  videoUrl?: string;
  hashtag?: string;
  hashtags?: string[];
  authorMeta?: { name?: string };
}

export interface ViralVideo {
  id: string;
  hashtag: string;
  author: string;
  ageMinutes: number;
  ageHours: number;
  views: number;
  vph: number;
  url: string;
}

const MAX_AGE_SECONDS = 6 * 3600;
const MIN_VPH = 3000;

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value.replace(/[^\d.-]/g, ''));
  return NaN;
}

function createdAtSeconds(v: ApifyVideo): number {
  const fromEpoch = toNumber(v.createTime);
  if (Number.isFinite(fromEpoch) && fromEpoch > 0) {
    return fromEpoch > 1e12 ? Math.floor(fromEpoch / 1000) : fromEpoch;
  }
  if (v.createTimeISO) {
    const parsed = Date.parse(v.createTimeISO);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  return 0;
}

/** Filter early-viral: umur < 6 jam dan VPH >= 3000. */
export function findEarlyViral(items: ApifyVideo[], nowSeconds = Math.floor(Date.now() / 1000)): ViralVideo[] {
  const result: ViralVideo[] = [];

  for (const item of items) {
    const createdAt = createdAtSeconds(item);
    const views = toNumber(item.playCount);
    if (!createdAt || !Number.isFinite(views)) continue;

    const ageSeconds = nowSeconds - createdAt;
    if (ageSeconds < 0 || ageSeconds > MAX_AGE_SECONDS) continue;

    const ageHours = ageSeconds / 3600;
    const vph = views / Math.max(ageHours, 0.5);
    if (vph < MIN_VPH) continue;

    const url = item.webVideoUrl ?? item.url ?? item.videoUrl;
    if (!url) continue;

    result.push({
      id: item.id ?? url,
      hashtag: item.hashtag ?? item.hashtags?.[0] ?? '-',
      author: item.authorMeta?.name ?? 'unknown',
      ageMinutes: Math.floor(ageSeconds / 60),
      ageHours,
      views,
      vph,
      url,
    });
  }

  return result.sort((a, b) => b.vph - a.vph);
}
