import { config } from './config.js';
import type { GacorVideo, VideoItem } from './types.js';

const HOUR = 3_600_000;

/** Return GacorVideo kalau lolos kriteria, selain itu null. */
export function evaluate(v: VideoItem, now = Date.now()): GacorVideo | null {
  const ageMs = now - v.uploadedAt.getTime();
  if (ageMs < -5 * 60_000) return null; // timestamp aneh (di masa depan)

  const ageHours = Math.max(ageMs, 0) / HOUR;
  if (ageHours > config.maxAgeHours) return null;
  if (v.views < config.minViews) return null;

  // Batas bawah 15 menit supaya video baru upload tidak menghasilkan velocity absurd
  const viewsPerHour = v.views / Math.max(ageHours, 0.25);
  if (viewsPerHour < config.minViewsPerHour) return null;

  return { ...v, ageHours, viewsPerHour };
}
