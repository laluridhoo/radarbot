import cron from 'node-cron';
import { config } from './config.js';
import { logger } from './logger.js';
import { runCycle } from './monitor.js';
import { sendText } from './telegram.js';

async function main() {
  const args = new Set(process.argv.slice(2));

  if (args.has('--test-telegram')) {
    await sendText('✅ Radar Bot Spionase Campaign terhubung ke Telegram.');
    logger.info('Pesan tes terkirim.');
    return;
  }

  if (config.hashtags.length === 0) throw new Error('Daftar tagar kosong. Isi config/hashtags.json atau env HASHTAGS.');

  if (args.has('--once')) {
    await runCycle();
    return;
  }

  if (!cron.validate(config.cronSchedule)) throw new Error(`CRON_SCHEDULE tidak valid: ${config.cronSchedule}`);

  logger.info(
    `Bot aktif. Jadwal: "${config.cronSchedule}" (${config.timezone}) | Kriteria: umur <= ${config.maxAgeHours} jam, views >= ${config.minViews}, views/jam >= ${config.minViewsPerHour}`,
  );

  await runCycle(); // langsung jalan sekali saat start
  cron.schedule(
    config.cronSchedule,
    () => {
      runCycle().catch((e) => logger.error('Cron error:', e));
    },
    { timezone: config.timezone },
  );

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      logger.info(`${sig} diterima, bot berhenti.`);
      process.exit(0);
    });
  }
}

process.on('unhandledRejection', (e) => logger.error('unhandledRejection:', e));
process.on('uncaughtException', (e) => logger.error('uncaughtException:', e));

main().catch((e) => {
  logger.error('Fatal:', (e as Error).message);
  process.exit(1);
});
