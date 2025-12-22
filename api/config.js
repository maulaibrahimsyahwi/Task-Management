/* eslint-env node */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

// Fungsi untuk memuat Service Account
function getServiceAccount() {
  // OPSI 1: Coba baca dari file lokal
  try {
    const localFilePath = path.join(
      process.cwd(),
      "api",
      "service-account.json"
    );
    if (fs.existsSync(localFilePath)) {
      console.log(
        "✅ [API] Menggunakan konfigurasi dari file: api/service-account.json"
      );
      return JSON.parse(fs.readFileSync(localFilePath, "utf8"));
    }
  } catch (err) {
    console.warn(
      "⚠️ [API] Gagal membaca file service-account.json local, mencoba ENV..."
    );
  }

  // OPSI 2: Coba baca dari Environment Variable
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawEnv) {
    try {
      let cleanJson = rawEnv.trim();
      if (cleanJson.startsWith("'") && cleanJson.endsWith("'"))
        cleanJson = cleanJson.slice(1, -1);
      if (cleanJson.startsWith('"') && cleanJson.endsWith('"'))
        cleanJson = cleanJson.slice(1, -1);

      console.log("✅ [API] Menggunakan konfigurasi dari Environment Variable");
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error(
        "❌ [API ERROR] Gagal parsing JSON dari Environment Variable:",
        error.message
      );
    }
  }

  return null;
}

// Inisialisasi
const serviceAccount = getServiceAccount();

if (!serviceAccount) {
  console.error(
    "❌ [FATAL] Tidak ditemukan konfigurasi Service Account Firebase!"
  );
} else if (!getApps().length) {
  try {
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log("🚀 [API] Firebase Admin berhasil terhubung!");
  } catch (error) {
    console.error("❌ [API ERROR] Gagal inisialisasi Firebase:", error.message);
  }
}

export const db = getFirestore();
export const auth = getAuth();
