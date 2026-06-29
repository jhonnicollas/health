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
  ],
};

export function getFaq(locale: Locale) {
  return faqData[locale] || faqData.id;
}
