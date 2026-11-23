import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { logger } from './logger.js';

const KEEP_MS = 48 * 3_600_000;

/** Menyimpan ID video yang sudah dikirim agar tidak ada alert dobel (persist ke JSON). */
export class SentStore {
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

  has(id: string) {
    return this.map.has(id);
  }

  add(id: string) {
    this.map.set(id, Date.now());
  }

  save() {
    const cutoff = Date.now() - KEEP_MS;
    for (const [id, t] of this.map) if (t < cutoff) this.map.delete(id);
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.map)));
    renameSync(tmp, this.file);
  }
}
