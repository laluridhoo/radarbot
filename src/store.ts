import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Redis } from '@upstash/redis';
import { logger } from './logger.js';

const KEEP_MS = 48 * 3_600_000;
const KEY_PREFIX = 'radarbot:sent:';

export interface SentStore {
  has(id: string): Promise<boolean>;
  add(id: string): Promise<void>;
  save(): Promise<void>;
}

/** Fallback lokal: persist ke JSON (dipakai kalau Redis tidak dikonfigurasi). */
class FileSentStore implements SentStore {
  private map = new Map<string, number>();

  constructor(private file: string) {
    mkdirSync(dirname(file), { recursive: true });
    if (existsSync(file)) {
      try {
        const obj = JSON.parse(readFileSync(file, 'utf8')) as Record<string, number>;
        this.map = new Map(Object.entries(obj));
      } catch (e) {
        logger.warn('sent.json rusak, mulai dari kosong:', (e as Error).message);
      }
    }
  }

  async has(id: string) {
    return this.map.has(id);
  }

  async add(id: string) {
    this.map.set(id, Date.now());
  }

  async save() {
    const cutoff = Date.now() - KEEP_MS;
    for (const [id, t] of this.map) if (t < cutoff) this.map.delete(id);
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.map)));
    renameSync(tmp, this.file);
  }
}

/** Dipakai di Vercel: storage tidak persisten, jadi state anti-duplikat disimpan di Redis dengan TTL 48 jam. */
class RedisSentStore implements SentStore {
  constructor(private redis: Redis) {}

  async has(id: string) {
    return (await this.redis.exists(KEY_PREFIX + id)) === 1;
  }

  async add(id: string) {
    await this.redis.set(KEY_PREFIX + id, Date.now(), { ex: KEEP_MS / 1000 });
  }

  async save() {
    // Tidak perlu cleanup manual: TTL Redis yang menghapus key lama.
  }
}

export function createSentStore(opts: {
  file: string;
  redisUrl?: string;
  redisToken?: string;
}): SentStore {
  if (opts.redisUrl && opts.redisToken) {
    logger.info('Anti-duplikat alert memakai Upstash Redis (TTL 48 jam).');
    return new RedisSentStore(new Redis({ url: opts.redisUrl, token: opts.redisToken }));
  }
  return new FileSentStore(opts.file);
}
