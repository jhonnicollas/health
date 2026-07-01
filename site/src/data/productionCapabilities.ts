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
      "AI Clinical Copilot chat dengan safety runtime",
    ],
  },
  monitoring: {
    title: "Monitoring & Keluarga",
    items: [
      "Notifikasi Telegram setelah submit",
      "Alert darurat berbasis rule",
      "Emergency guidance engine (Sprint 6)",
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
  aiCompanion: {
    title: "AI Clinical Companion",
    items: [
      "AI Clinical Copilot (3 mode: standard, proactive, super aktif)",
      "13-detector Safety Runtime v2",
      "Vectorize AI memory per-user (hingga 500 vektor)",
      "Emergency guidance engine",
      "Operating mode governance oleh Super Admin",
      "Medical disclaimer otomatis di setiap output AI",
    ],
  },
  whatsapp: {
    title: "WhatsApp Integration",
    items: [
      "AI health chat via WhatsApp",
      "Emergency guidance delivery via WhatsApp",
      "OTP & notifikasi via WhatsApp",
      "Unlinked session retention 30 hari",
    ],
  },
  commercial: {
    title: "Komersial & Admin",
    items: [
      "Free/Premium/Family plan",
      "Entitlement & usage quota",
      "Admin dashboard",
      "Audit log",
      "AI config governance (16 endpoints)",
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
