import { config } from './config.js';
import { evaluate } from './filter.js';
import { logger } from './logger.js';
import { withRetry, sleep } from './retry.js';
import { scrapeInstagram } from './scrapers/instagram.js';
import { scrapeTikTok } from './scrapers/tiktok.js';
import { createSentStore } from './store.js';
import { sendAlert, sendText } from './telegram.js';
import type { GacorVideo, Platform, VideoItem } from './types.js';

const scrapers: Record<Platform, (tag: string) => Promise<VideoItem[]>> = {
  tiktok: scrapeTikTok,
  instagram: scrapeInstagram,
};

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift() as T);
  });
  await Promise.all(workers);
}

let running = false;
let consecutiveTotalFailures = 0;

/** Satu siklus pemantauan. Tidak pernah throw supaya cron tetap hidup. */
export async function runCycle(): Promise<void> {
  if (running) {
    logger.warn('Siklus sebelumnya belum selesai, siklus ini dilewati.');
    return;
  }
  running = true;
  const t0 = Date.now();

  try {
    const store = createSentStore({
      file: config.sentFile,
      redisUrl: config.redisUrl,
      redisToken: config.redisToken,
    });
    const platforms: Platform[] = [];
    if (config.enableTiktok) platforms.push('tiktok');
    if (config.enableInstagram) platforms.push('instagram');

    const jobs = platforms.flatMap((platform) => config.hashtags.map((tag) => ({ platform, tag })));
    logger.info(`Mulai siklus: ${config.hashtags.length} tagar x ${platforms.length} platform = ${jobs.length} job`);

    const hits = new Map<string, GacorVideo>();
    let failed = 0;
    let scanned = 0;

    await pool(jobs, config.concurrency, async ({ platform, tag }) => {
      try {
        const items = await withRetry(() => scrapers[platform](tag), {
          retries: config.maxRetries,
          label: `Scrape ${platform} #${tag}`,
        });
        scanned += items.length;
        for (const item of items) {
          const g = evaluate(item);
          if (g && !(await store.has(g.id)) && !hits.has(g.id)) hits.set(g.id, g);
        }
      } catch (e) {
        failed++;
        logger.error(`Job ${platform} #${tag} gagal total:`, (e as Error).message);
      }
    });

    const winners = [...hits.values()]
      .sort((a, b) => b.viewsPerHour - a.viewsPerHour)
      .slice(0, config.maxAlertsPerCycle);

    let sent = 0;
    for (const v of winners) {
      try {
        await sendAlert(v);
        await store.add(v.id);
        sent++;
        await sleep(1100); // hindari rate limit Telegram (~1 msg/detik per chat)
      } catch (e) {
        logger.error(`Gagal kirim alert ${v.id}:`, (e as Error).message);
      }
    }
    await store.save();

    logger.info(
      `Selesai ${((Date.now() - t0) / 1000).toFixed(0)}s | video dipindai: ${scanned} | lolos filter: ${hits.size} | terkirim: ${sent} | job gagal: ${failed}/${jobs.length}`,
    );

    // Health check: semua job gagal 3 siklus berturut-turut -> kabari lewat Telegram (sekali saja)
    if (jobs.length > 0 && failed === jobs.length) {
      consecutiveTotalFailures++;
      if (consecutiveTotalFailures === 3) {
        await sendText('⚠️ <b>Radar Bot bermasalah:</b> semua scraping gagal 3 siklus berturut-turut. Cek saldo/token Apify & log server.').catch(() => {});
      }
    } else {
      consecutiveTotalFailures = 0;
    }
  } catch (e) {
    logger.error('Error tak terduga di runCycle:', e);
  } finally {
    running = false;
  }
}
