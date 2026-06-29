export const productionCapabilities = {
  coreCapture: {
    title: "Pencatatan Inti",
    items: [
      "Multi-user account & onboarding",
      "Profil kesehatan: nama, jenis kelamin, tanggal lahir, tinggi badan, zona waktu",
      "Checklist pengukuran multi-alat",
      "Foto/upload alat kesehatan",
      "AI Vision extraction (5 detik timeout)",
      "Manual override sebelum simpan",
      "Validasi rentang fisik",
      "Watermarked evidence storage",
    ],
  },
  healthIntelligence: {
    title: "Inteligensi Kesehatan",
    items: [
      "Interpretasi berbasis rule/aturan",
      "Suggestion & popup real-time",
      "Laporan harian, mingguan, bulanan",
      "Perbandingan vs 3 hari dan 7 hari",
      "AI report analysis dengan disclaimer",
      "Knowledge base perangkat kesehatan",
    ],
  },
  monitoring: {
    title: "Monitoring & Keluarga",
    items: [
      "Notifikasi Telegram setelah submit",
      "Alert darurat berbasis rule",
      "Family/caregiver linking",
      "Caregiver dashboard",
      "Alert acknowledgement",
    ],
  },
  dailyCompanion: {
    title: "Pendamping Harian",
    items: [
      "Medication tracker",
      "Reminder & browser notification",
      "Fasting timer",
      "Hydration tracker",
      "Symptom log harian",
      "Red flag guardrail deterministik",
    ],
  },
  advanced: {
    title: "Fitur Lanjutan",
    items: [
      "Doctor-ready PDF 30 hari",
      "Pattern detection / correlation insight",
      "Gamification, streak & badge (safety guard)",
      "Senior/accessibility mode",
      "PWA installable & offline shell",
      "Export data & data deletion request",
    ],
  },
  commercial: {
    title: "Komersial & Admin",
    items: [
      "Free/Premium/Family plan",
      "Entitlement & usage quota",
      "Admin dashboard",
      "Audit log",
      "AI config governance",
    ],
  },
};

export const supportedDevices = [
  { name: "Tensimeter", metrics: ["Sistolik", "Diastolik", "Nadi"] },
  { name: "Oximeter", metrics: ["SpO2", "Heart Rate"] },
  { name: "Sinocare GCU", metrics: ["Gula Darah Puasa", "Gula Darah 2 Jam PP", "Kolesterol Total", "Asam Urat"] },
  { name: "Termometer", metrics: ["Suhu Tubuh"] },
  { name: "Timbangan", metrics: ["Berat Badan", "BMI"] },
  { name: "Manual Input", metrics: ["Lingkar Pinggang", "Durasi Tidur", "Hidrasi", "Obat", "Keluhan", "Puasa", "Siklus"] },
];

export const allMetrics = [
  "SpO2", "Heart Rate", "Sistolik", "Diastolik", "Nadi Tekanan Darah",
  "Gula Darah Puasa", "Gula Darah 2 Jam PP", "Kolesterol Total", "Asam Urat",
  "Berat Badan", "BMI", "Lingkar Pinggang", "Suhu Tubuh", "Durasi Tidur",
  "Hidrasi", "Obat", "Keluhan Harian", "Sesi Puasa", "Siklus (eligible users only)",
];
