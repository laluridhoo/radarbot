# 📡 Radar Bot Spionase Campaign

Bot Node.js/TypeScript yang memantau tagar campaign di TikTok (opsional Instagram Reels) lewat Apify,
menyaring video "gacor" (umur ≤ 6 jam & views ≥ ambang batas), lalu mengirim alert ke Telegram.

## Struktur Folder
```
radar-bot/
├── config/hashtags.json      # daftar tagar agensi (tanpa #)
├── data/sent.json            # (otomatis) ID video yang sudah dialert
├── src/
│   ├── index.ts              # entry point + cron scheduler
│   ├── monitor.ts            # orkestrasi 1 siklus (scrape -> filter -> alert)
│   ├── filter.ts             # logika Age & Velocity filter
│   ├── telegram.ts           # format & kirim pesan
│   ├── store.ts              # anti-duplikat alert
│   ├── config.ts             # baca .env + validasi
│   ├── http.ts / retry.ts    # fetch + exponential backoff
│   └── scrapers/             # apify.ts, tiktok.ts, instagram.ts
├── .env.example
├── Dockerfile
└── package.json
```

## 1. Siapkan API Key

**Telegram Bot Token**
1. Buka Telegram, chat **@BotFather** → `/newbot` → ikuti instruksi.
2. Salin token (format `123456:ABC...`) ke `TELEGRAM_BOT_TOKEN`.

**Telegram Chat ID**
1. Kirim pesan apa saja ke bot kamu (klik Start).
2. Buka `https://api.telegram.org/bot<TOKEN>/getUpdates` di browser.
3. Cari `"chat":{"id":123456789,...}` → itu `TELEGRAM_CHAT_ID`.
   (Untuk grup: tambahkan bot ke grup, kirim pesan, ambil id yang diawali `-100...`.)

**Apify Token**
1. Daftar di https://apify.com (ada kredit gratis bulanan).
2. Settings → API & Integrations → salin **Personal API token** ke `APIFY_TOKEN`.
3. Cari **TikTok Hashtag Scraper** di [Apify Store](https://apify.com/store) (misalnya buatan `novas` atau `epctex`).
   * **Actor ID**: Lihat URL browser. Jika URL-nya `https://apify.com/novas/tiktok-hashtag-scraper`, maka Actor ID-nya adalah `novas~tiktok-hashtag-scraper`. Pastikan ID ini cocok dengan yang ada di file `.env`.
   * **Input**: Parameter (seperti hashtag/jumlah video) bisa dilihat dengan mengklik tombol **"Try for free"** atau scroll ke bagian "Input Schema".
   * **Pricing**: Harga penggunaan scraper (misal: "Free" atau "$2 per 1000 results") biasanya tertera di dekat judul actor. Pastikan sesuai dengan kredit gratis/kebutuhanmu.

## 2. Install & Konfigurasi
```bash
# butuh Node.js >= 18.18
npm install
cp .env.example .env        # lalu edit isinya
```
Isi daftar tagar di `config/hashtags.json` (atau env `HASHTAGS=tag1,tag2`).

## 3. Tes
```bash
npm run test:telegram   # cek token & chat id
npm run once            # jalankan 1 siklus lalu keluar
npm run dev             # mode bot (cron aktif)
```

## 4. Mengubah Ambang Batas (.env)
| Variabel | Fungsi | Default |
|---|---|---|
| `MAX_AGE_HOURS` | umur maksimal video | 6 |
| `MIN_VIEWS` | views minimal | 50000 |
| `MIN_VIEWS_PER_HOUR` | velocity minimal (0 = off) | 0 |
| `CRON_SCHEDULE` | jadwal | `*/30 * * * *` |
| `RESULTS_PER_HASHTAG` | video diambil per tagar | 30 |

Rumus velocity: `views / max(umur_jam, 0.25)`.

## 5. Deployment

### A. Local Machine (paling gampang)
```bash
npm run build
npm i -g pm2
pm2 start dist/index.js --name radar-bot
pm2 save && pm2 startup     # auto-start setelah reboot
pm2 logs radar-bot
```
Komputer harus menyala 24 jam.

### B. VPS murah (Ubuntu) — paling stabil
Opsi: Oracle Cloud Free Tier, atau VPS ±Rp30–60rb/bulan.
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
git clone <repo-kamu> radar-bot && cd radar-bot
npm install && cp .env.example .env && nano .env
npm run build
sudo npm i -g pm2
pm2 start dist/index.js --name radar-bot && pm2 save && pm2 startup
```

### C. Railway
1. Push project ke GitHub (`.env` jangan ikut; sudah ada di `.gitignore`).
2. Railway → New Project → Deploy from GitHub repo.
3. Tab *Variables*: isi semua variabel dari `.env.example`.
4. Build command `npm run build`, start command `npm start`.
5. Tambahkan **Volume** yang di-mount ke `/app/data` supaya `sent.json` tidak hilang saat redeploy
   (tanpa volume, setelah redeploy alert lama bisa terkirim ulang sekali).
Railway berbasis kredit pemakaian; bot ringan ini biasanya murah, cek halaman pricing terbaru.

### D. Docker
```bash
docker build -t radar-bot .
docker run -d --name radar-bot --restart unless-stopped --env-file .env -v $(pwd)/data:/app/data radar-bot
```

### ⚠️ Vercel — tidak cocok
Vercel itu serverless: tidak ada proses yang hidup terus dan filesystem-nya tidak persisten.
Gunakan VPS/Railway/lokal.

## 6. Mengontrol Biaya Apify
- Biaya utama = jumlah video yang di-scrape. Hitung kasar:
  `jumlah_tagar × RESULTS_PER_HASHTAG × siklus_per_hari × harga_per_hasil`.
- Mulai dengan interval 60 menit (`CRON_SCHEDULE=0 * * * *`) dan `RESULTS_PER_HASHTAG=20`.
- Matikan tagar yang tidak pernah menghasilkan alert.
- Pasang *monthly usage limit* di Apify agar tidak kebablasan.

## 7. Troubleshooting
| Gejala | Penyebab / Solusi |
|---|---|
| `HTTP 401/403` dari Apify | Token salah |
| `HTTP 402` | Kredit Apify habis |
| `HTTP 400` dari Apify | Nama field input actor berubah → cek tab Input actor, sesuaikan di `src/scrapers/*.ts` |
| Tidak ada alert sama sekali | Turunkan `MIN_VIEWS` dulu untuk tes, cek log "video dipindai" |
| Telegram `400 chat not found` | Kamu belum menekan Start di bot / chat id salah |

## 8. Catatan Penting
- Hasil tagar TikTok **tidak selalu urut terbaru**. Kalau banyak video lama lolos scraping tapi tidak ada yang
  ≤ 6 jam, naikkan `RESULTS_PER_HASHTAG` atau cek opsi sort di input actor.
- Skema output actor pihak ketiga bisa berubah; kalau field kosong, cek dataset hasil run di Apify Console.
- Instagram jauh lebih tidak stabil untuk scraping hashtag (view Reels sering tidak tersedia). Mulai dari TikTok.
- Scraping tunduk pada ToS platform; gunakan secukupnya.
