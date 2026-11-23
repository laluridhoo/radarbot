# 📡 Radar Bot — Early Viral (Vercel Serverless, Hobby)

Bot Telegram untuk memantau tagar TikTok lewat Apify, lalu mengirim alert jika video lolos filter **early viral**:
umur **< 6 jam** dan **VPH ≥ 3000** (`views / max(umur_jam, 0.5)`).

Arsitektur ini **tanpa SQL, tanpa `node-cron`, tanpa background process**. Semua logika ada di 3 Vercel Serverless Functions dan state disimpan di Upstash Redis.

## Alur

```
Telegram /set1 /set2 /set3 /list  →  POST /api/telegram  →  Upstash Redis (hashtags:slot:N)
                                              ↑
Vercel Cron / scheduler  →  GET /api/cron?secret=...&slot=N
                                  →  Apify Actor run (async, webhooks base64)
                                  →  ACTOR.RUN.SUCCEEDED  →  POST /api/webhook?secret=...&slot=N
                                                                →  baca dataset → filter → Telegram
```

| Slot | Key Redis | Maks tagar | Token Apify |
|---|---|---|---|
| 1 | `hashtags:slot:1` | 4 | `APIFY_TOKEN_1` |
| 2 | `hashtags:slot:2` | 3 | `APIFY_TOKEN_2` |
| 3 | `hashtags:slot:3` | 3 | `APIFY_TOKEN_3` |

## Struktur

```
api/
├── telegram.ts   # webhook chat Telegram (POST)
├── cron.ts       # pemicu actor run Apify (GET)
└── webhook.ts    # filter dataset + kirim alert (POST)
src/
├── apify.ts      # start run + ambil dataset
├── env.ts        # akses environment variable
├── filter.ts     # filter early viral
├── http.ts       # fetch JSON helper
├── redis.ts      # client Upstash + helper slot + dedupe
└── telegram.ts   # kirim pesan + format alert
```

## Setup

1. Buat database **Upstash Redis**, salin REST URL & REST token.
2. Import repo ke Vercel, isi Environment Variables sesuai `.env.example`.
3. Deploy. Set webhook Telegram ke `https://<project>.vercel.app/api/telegram`:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project>.vercel.app/api/telegram"
   ```
4. Uji manual:
   ```bash
   curl "https://<project>.vercel.app/api/cron?secret=<CRON_SECRET>&slot=1"
   ```

## Perintah Telegram

- `/set1 tag1 tag2 tag3 tag4` — isi slot 1 (maks 4)
- `/set2 tag1 tag2 tag3` — isi slot 2 (maks 3)
- `/set3 tag1 tag2 tag3` — isi slot 3 (maks 3)
- `/list` — lihat isi semua slot

Tagar otomatis dibersihkan: `#` dihapus, huruf kecil, duplikat dihapus. Hanya chat dengan ID sesuai `TELEGRAM_CHAT_ID` yang dilayani.

## Penjadwalan di Hobby

⚠️ **Vercel Cron Hobby hanya bisa 1x sehari** (ekspresi lebih sering gagal saat deploy). Kalau butuh tiap 2 jam, pakai scheduler eksternal (cron-job.org, GitHub Actions, atau VPS) yang memanggil:

```
GET https://<project>.vercel.app/api/cron?secret=<CRON_SECRET>&slot=1
GET https://<project>.vercel.app/api/cron?secret=<CRON_SECRET>&slot=2
GET https://<project>.vercel.app/api/cron?secret=<CRON_SECRET>&slot=3
```

## Hemat kredit Apify

Payload actor hanya berisi `hashtags`, `resultsPerPage: 5`, dan add-on nonaktif (`shouldDownloadVideos`, `shouldDownloadCovers`, `shouldDownloadSubtitles: false`, `commentsPerPost: 0`). Tidak ada date filter dan sorting. Run dipicu async;webhook yang memproses hasil setelah run sukses.

## Catatan

- Webhook Apify bisa dikirim lebih dari sekali → `markSeen()` di Redis mencegah alert dobel (TTL 48 jam).
- `VERCEL_PROJECT_URL` harus URL produksi tanpa trailing slash.
- Simpan `CRON_SECRET` minimal 24 karakter acak; jangan pernah taruh di repo.
