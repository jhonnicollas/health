import type { Locale } from "@/i18n/utils";

const faqData: Record<Locale, { question: string; answer: string }[]> = {
  id: [
    {
      question: "Apakah iSehat menggantikan dokter?",
      answer: "Tidak. iSehat adalah alat pencatatan kesehatan harian. Status dan interpretasi kesehatan ditentukan oleh rule/aturan terstruktur, bukan diagnosis AI. Selalu konsultasikan dengan dokter untuk keputusan medis.",
    },
    {
      question: "Apakah AI di iSehat bisa mendiagnosis penyakit?",
      answer: "Tidak. AI di iSehat hanya membantu membaca angka dari foto alat kesehatan, seperti tensimeter atau oximeter. Anda tetap memverifikasi data sebelum disimpan. Status kesehatan ditentukan oleh aturan terstruktur.",
    },
    {
      question: "Apakah data kesehatan saya aman?",
      answer: "Data kesehatan Anda disimpan terpisah dari website publik ini. Akses keluarga dan caregiver memerlukan persetujuan (consent) dari Anda. iSehat tidak membagikan data Anda tanpa izin Anda.",
    },
    {
      question: "Apakah iSehat bisa memberikan resep obat?",
      answer: "Tidak. iSehat tidak memberikan resep obat, tidak mengatur dosis obat, dan tidak menggantikan konsultasi dokter. iSehat membantu Anda mencatat dan memahami data kesehatan Anda.",
    },
    {
      question: "Apa saja alat kesehatan yang didukung?",
      answer: "iSehat mendukung tensimeter, oximeter, alat gula darah (Sinocare GCU), termometer, timbangan, dan input manual. AI Vision membantu membaca angka dari foto alat kesehatan Anda.",
    },
    {
      question: "Bagaimana cara kerja laporan untuk dokter?",
      answer: "iSehat menghasilkan laporan PDF 30 hari yang berisi grafik tren, ringkasan metrik, log obat, log keluhan, dan disclaimer medis. Laporan ini siap dibawa saat konsultasi dokter.",
    },
    {
      question: "Apakah ada fitur untuk memantau orang tua dari jauh?",
      answer: "Ya. Dengan fitur Family dan Caregiver, Anda bisa terhubung dengan akun keluarga Anda. Anda akan menerima notifikasi Telegram dan alert darurat berbasis aturan. Akses memerlukan persetujuan dari pengguna utama.",
    },
    {
      question: "Berapa harga iSehat?",
      answer: "iSehat memiliki paket Gratis, Premium bulanan, Premium 3 bulan, Premium tahunan, dan Family Premium. Harga detail akan diumumkan. Daftar gratis untuk mulai mencatat.",
    },
    {
      question: "Apa itu AI Clinical Copilot di iSehat?",
      answer: "AI Clinical Copilot adalah asisten AI klinis yang membantu Anda memahami data kesehatan. Tersedia dalam 3 mode: standard (AI tidak memberi diagnosis), proactive (AI boleh memberi diagnosis, bukan resep), dan super aktif (AI boleh diagnosis dan resep). Mode diatur oleh Super Admin dan memerlukan persetujuan medical reviewer. Setiap output AI melewati 13-detector Safety Runtime dan selalu dilengkapi disclaimer medis.",
    },
    {
      question: "Apakah AI di iSehat bisa mendiagnosis di semua mode?",
      answer: "Tidak. Dalam mode standard (default), AI tidak memberikan diagnosis final. Hanya dalam mode proactive dan super aktif, AI boleh memberikan diagnosis dengan batasan ketat. Mode proactive tidak boleh memberi resep atau dosis. Mode super aktif boleh memberi resep dan dosis. Semua mode tidak boleh mengubah/menghentikan obat pengguna. Perubahan mode harus disetujui medical reviewer.",
    },
    {
      question: "Apa itu WhatsApp AI di iSehat?",
      answer: "WhatsApp AI memungkinkan Anda berinteraksi dengan AI Clinical Copilot iSehat melalui WhatsApp. Anda bisa bertanya tentang data kesehatan, mendapatkan edukasi, dan menerima emergency guidance. WhatsApp AI tunduk pada aturan Safety Runtime yang sama dan selalu menyertakan disclaimer medis.",
    },
    {
      question: "Bagaimana iSehat menjaga keamanan output AI?",
      answer: "Setiap output AI di iSehat melewati 13-detector Safety Runtime v2 yang meliputi deteksi dosis resep, penurunan severity darurat, reassurance tidak aman, kebocoran data antar-pengguna, dan lainnya. Red flag deterministik dijalankan sebelum LLM call. Emergency condition menggunakan template saja, tanpa LLM freeform.",
    },
  ],
  en: [
    {
      question: "Does iSehat replace doctors?",
      answer: "No. iSehat is a daily health recording tool. Health status and interpretation are determined by structured rules, not AI diagnosis. Always consult a doctor for medical decisions.",
    },
    {
      question: "Can AI in iSehat diagnose diseases?",
      answer: "No. AI in iSehat only helps read numbers from health device photos, like blood pressure monitors or oximeters. You always verify data before saving. Health status is determined by structured rules.",
    },
    {
      question: "Is my health data safe?",
      answer: "Your health data is stored separately from this public website. Family and caregiver access requires your consent. iSehat does not share your data without your permission.",
    },
    {
      question: "Can iSehat prescribe medication?",
      answer: "No. iSehat does not prescribe medication, does not adjust dosages, and does not replace doctor consultations. iSehat helps you record and understand your health data.",
    },
    {
      question: "What health devices are supported?",
      answer: "iSehat supports blood pressure monitors, oximeters, blood glucose devices (Sinocare GCU), thermometers, body scales, and manual input. AI Vision helps read numbers from your health device photos.",
    },
    {
      question: "How does the doctor report work?",
      answer: "iSehat generates a 30-day PDF report with trend charts, metric summaries, medication log, symptom log, and medical disclaimer. The report is ready to bring to doctor consultations.",
    },
    {
      question: "Is there a feature to monitor parents remotely?",
      answer: "Yes. With Family and Caregiver features, you can connect to your family's accounts. You'll receive Telegram notifications and rule-based emergency alerts. Access requires consent from the primary user.",
    },
    {
      question: "How much does iSehat cost?",
      answer: "iSehat has Free, Premium Monthly, Premium 3-Month, Premium Yearly, and Family Premium plans. Detailed pricing will be announced. Sign up for free to start recording.",
    },
    {
      question: "What is the AI Clinical Copilot in iSehat?",
      answer: "AI Clinical Copilot is a clinical AI assistant that helps you understand your health data. Available in 3 modes: standard (AI cannot diagnose), proactive (AI may diagnose, no prescriptions), and super aktif (AI may diagnose and prescribe). Modes are managed by Super Admin and require medical reviewer approval. Every AI output goes through a 13-detector Safety Runtime and always includes a medical disclaimer.",
    },
    {
      question: "Can AI in iSehat diagnose in all modes?",
      answer: "No. In standard mode (default), AI cannot give final diagnoses. Only in proactive and super aktif modes can AI provide diagnoses with strict limits. Proactive mode cannot prescribe or give dosages. Super aktif mode can prescribe and give dosages. All modes cannot change or stop user medications. Mode changes require medical reviewer approval.",
    },
    {
      question: "What is WhatsApp AI in iSehat?",
      answer: "WhatsApp AI lets you interact with iSehat's AI Clinical Copilot via WhatsApp. You can ask about health data, get education, and receive emergency guidance. WhatsApp AI follows the same Safety Runtime rules and always includes a medical disclaimer.",
    },
    {
      question: "How does iSehat ensure AI output safety?",
      answer: "Every AI output in iSehat goes through a 13-detector Safety Runtime v2 covering prescription dosage detection, emergency severity downgrade prevention, unsafe reassurance detection, cross-user data leak prevention, and more. Deterministic red flag checks run before any LLM call. Emergency conditions use templates only, no LLM freeform.",
    },
  ],
};

export function getFaq(locale: Locale) {
  return faqData[locale] || faqData.id;
}
