import { Redis } from '@upstash/redis';
import { requiredEnv } from './env.js';

export type Slot = '1' | '2' | '3';
export const SLOTS: Slot[] = ['1', '2', '3'];
export const SLOT_LIMITS: Record<Slot, number> = { '1': 4, '2': 3, '3': 3 };

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

export function isSlot(value: unknown): value is Slot {
  return value === '1' || value === '2' || value === '3';
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
  const values = await Promise.all(SLOTS.map((slot) => getHashtags(slot)));
  return { '1': values[0], '2': values[1], '3': values[2] };
}

/** Return true kalau ID ini baru pertama kali dilihat (TTL 48 jam). */
export async function markSeen(id: string): Promise<boolean> {
  const result = await redis().set(seenKey(id), Date.now(), { nx: true, ex: 48 * 3600 });
  return result === 'OK';
}
