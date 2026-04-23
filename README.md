# 🎵 Worship App

Aplikasi manajemen tim Praise & Worship gereja.

## Fitur
- 🎵 Bank Lagu dengan pencarian & filter tema
- 🎼 Nada Dasar (Do = ?) per lagu
- ▶️ Referensi audio via YouTube
- ✨ AI Song Advisor
- 📋 Setlist (Ibadah Raya & Youth)
- 📅 Jadwal Pelayanan bulanan
- 📄 Export PDF Jadwal & Setlist
- 🔐 Mode Koordinator dengan PIN

## Setup

### 1. Firebase
- Buka `src/firebase.js`
- Isi dengan config Firebase kamu
- Aktifkan Firestore Database (test mode)

### 2. Install & Run
```bash
npm install
npm run dev
```

### 3. Deploy ke Vercel
- Push ke GitHub
- Connect repo di vercel.com
- Deploy otomatis!

## Struktur Data Firebase
Collection: `worship_data`
- `pw_songs` → daftar lagu
- `pw_setlists` → daftar setlist
- `pw_sched_YYYY_M` → jadwal per bulan
- `pw_pin` → PIN koordinator
