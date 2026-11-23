import { Redis } from '@upstash/redis';
import { requiredEnv } from './env.js';

/**
 * Slot bersifat dinamis: aktif = semua env APIFY_TOKEN_<N> yang diisi.
 * Jadi kamu bisa pakai 3, 5, 10, ... akun/token tanpa mengubah kode lagi.
 */
export type Slot = string;

const TOKEN_PATTERN = /^APIFY_TOKEN_([1-9]\d*)$/;

export function activeSlots(): Slot[] {
  return Object.keys(process.env)
    .map((key) => TOKEN_PATTERN.exec(key)?.[1])
    .filter((slot): slot is Slot => slot !== undefined && !!process.env[`APIFY_TOKEN_${slot}`]?.trim())
    .sort((a, b) => Number(a) - Number(b));
}

export function isValidSlot(value: unknown): value is Slot {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

export function isSlot(value: unknown): value is Slot {
  return isValidSlot(value) && activeSlots().includes(value);
}

/** Slot 1 maksimal 4 tagar, slot lain maksimal 3. */
export function slotLimit(slot: Slot): number {
  return slot === '1' ? 4 : 3;
}

let client: Redis | undefined;

export function redis(): Redis {
  if (!client) {
    client = new Redis({
      url: requiredEnv('UPSTASH_REDIS_REST_URL'),
      token: requiredEnv('UPSTASH_REDIS_REST_TOKEN'),
    });
  }
  return client;
}

export const slotKey = (slot: Slot): string => `hashtags:slot:${slot}`;
const seenKey = (id: string): string => `seen:video:${id}`;

/** Bersihkan tagar: buang '#', spasi, huruf kecil, hilangkan duplikat. */
export function cleanHashtags(tokens: string[]): string[] {
  const cleaned = tokens
    .map((t) => t.trim().replace(/^#+/, '').toLowerCase())
    .filter(Boolean)
    .map((t) => t.replace(/[^\p{L}\p{N}_]/gu, '')) // emoji & tanda baca dibuang
    .filter(Boolean);
  return [...new Set(cleaned)];
}

export async function getHashtags(slot: Slot): Promise<string[]> {
  const value = await redis().get<string[] | string>(slotKey(slot));
  if (Array.isArray(value)) return cleanHashtags(value);
  if (typeof value === 'string') {
    try {
      return cleanHashtags(JSON.parse(value) as string[]);
    } catch {
      return cleanHashtags(value.split(','));
    }
  }
  return [];
}

export async function setHashtags(slot: Slot, hashtags: string[]): Promise<void> {
  await redis().set(slotKey(slot), hashtags);
}

export async function listAllHashtags(): Promise<Record<Slot, string[]>> {
  const slots = activeSlots();
  const values = await Promise.all(slots.map((slot) => getHashtags(slot)));
  return Object.fromEntries(slots.map((slot, i) => [slot, values[i]]));
}

/** Return true kalau ID ini baru pertama kali dilihat (TTL 48 jam). */
export async function markSeen(id: string): Promise<boolean> {
  const result = await redis().set(seenKey(id), Date.now(), { nx: true, ex: 48 * 3600 });
  return result === 'OK';
}
