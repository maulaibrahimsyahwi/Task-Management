# React Task Management

Aplikasi manajemen tugas berbasis web yang dibangun menggunakan React, TypeScript, Vite, Tailwind CSS, dan Firebase.

## Prasyarat

Pastikan komputer Anda sudah terinstal:
- [Node.js](https://nodejs.org/) (versi 16 atau terbaru)
- npm (bawaan Node.js) atau yarn

## Cara Instalasi

### 1. Clone Repositori

Buka terminal dan jalankan perintah berikut:

```bash
git clone https://github.com/maulaibrahimsyahwi/Task-Management.git
cd Task-Management
```

### 2. Install Dependencies

Install semua library yang dibutuhkan:

```bash
npm install
```

### 3. Konfigurasi Environment

Aplikasi ini membutuhkan koneksi ke Firebase. Buat file baru bernama `.env` di folder root (sejajar dengan `package.json`), lalu salin konfigurasi berikut dan isi dengan data dari Firebase Console Anda:

```env
VITE_FIREBASE_API_KEY=masukkan_api_key_disini
VITE_FIREBASE_AUTH_DOMAIN=masukkan_auth_domain_disini
VITE_FIREBASE_PROJECT_ID=masukkan_project_id_disini
VITE_FIREBASE_STORAGE_BUCKET=masukkan_storage_bucket_disini
VITE_FIREBASE_MESSAGING_SENDER_ID=masukkan_messaging_sender_id_disini
VITE_FIREBASE_APP_ID=masukkan_app_id_disini
```

## Menjalankan Aplikasi

### Development Mode

Untuk menjalankan aplikasi dalam mode development:

```bash
npm run dev
```

Buka browser dan akses `http://localhost:5173` (atau port lain yang muncul di terminal).

### Build untuk Production

Untuk membuat versi produksi (folder dist):

```bash
npm run build
```

## Teknologi yang Digunakan

- **React** - Library JavaScript untuk membangun UI
- **TypeScript** - JavaScript dengan tipe statis
- **Vite** - Build tool yang cepat
- **Tailwind CSS** - Framework CSS utility-first
- **Firebase** - Backend as a Service untuk autentikasi dan database
