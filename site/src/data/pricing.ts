import type { Locale } from "@/i18n/utils";

export interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlight: boolean;
  cta: string;
}

const pricingData: Record<Locale, PricingPlan[]> = {
  id: [
    {
      name: "Gratis",
      price: "Rp 0",
      period: "",
      description: "Mulai catat kesehatan harian tanpa biaya.",
      features: [
        "Pencatatan pengukuran dasar",
        "AI Vision (kuota terbatas)",
        "Dashboard hari ini",
        "Riwayat 7 hari",
        "PWA & offline shell",
      ],
      highlight: false,
      cta: "Daftar Gratis",
    },
    {
      name: "Premium Bulanan",
      price: "Harga segera diumumkan",
      period: "/bulan",
      description: "Fitur lengkap untuk pengguna individu.",
      features: [
        "Semua fitur Gratis",
        "AI Vision tanpa batas",
        "Dashboard mingguan & bulanan",
        "Laporan 30 hari & PDF dokter",
        "Reminder & notifikasi Telegram",
        "Medication & fasting tracker",
        "Symptom log & red flag guardrail",
        "Hydration tracker",
        "AI report & safe insight",
        "AI Clinical Copilot chat (kuota standar)",
        "AI memory hingga 500 vektor",
        "WhatsApp AI (terbatas)",
        "Export data",
      ],
      highlight: true,
      cta: "Segera Hadir",
    },
    {
      name: "Premium 3 Bulan",
      price: "Harga segera diumumkan",
      period: "/3 bulan",
      description: "Hemat dengan paket 3 bulan.",
      features: [
        "Semua fitur Premium Bulanan",
        "Hemat dibayar bulanan",
        "AI Clinical Copilot (kuota proactive)",
        "WhatsApp AI (penuh)",
        "Cycle tracking dengan privacy guardrail",
      ],
      highlight: false,
      cta: "Segera Hadir",
    },
    {
      name: "Premium Tahunan",
      price: "Harga segera diumumkan",
      period: "/tahun",
      description: "Hemat besar dengan paket tahunan.",
      features: [
        "Semua fitur Premium 3 Bulan",
        "Hemat terbesar",
        "AI Clinical Copilot (kuota proactive)",
        "WhatsApp AI (penuh)",
        "Prioritas fitur baru",
      ],
      highlight: false,
      cta: "Segera Hadir",
    },
    {
      name: "Family Premium",
      price: "Harga segera diumumkan",
      period: "/bulan",
      description: "Pantau kesehatan keluarga dari jauh.",
      features: [
        "Semua fitur Premium Bulanan",
        "Hingga 5 anggota keluarga",
        "Caregiver dashboard",
        "Emergency alert keluarga",
        "AI Clinical Copilot untuk anggota keluarga",
        "WhatsApp AI gabungan keluarga",
        "Consent-first access",
        "Laporan gabungan keluarga",
      ],
      highlight: false,
      cta: "Segera Hadir",
    },
  ],
  en: [
    {
      name: "Free",
      price: "Rp 0",
      period: "",
      description: "Start recording daily health at no cost.",
      features: [
        "Basic measurement recording",
        "AI Vision (limited quota)",
        "Today's dashboard",
        "7-day history",
        "PWA & offline shell",
      ],
      highlight: false,
      cta: "Sign Up Free",
    },
    {
      name: "Premium Monthly",
      price: "Pricing to be announced",
      period: "/month",
      description: "Full features for individual users.",
      features: [
        "All Free features",
        "Unlimited AI Vision",
        "Weekly & monthly dashboards",
        "30-day report & doctor PDF",
        "Reminders & Telegram notifications",
        "Medication & fasting tracker",
        "Symptom log & red flag guardrail",
        "Hydration tracker",
        "AI report & safe insight",
        "AI Clinical Copilot chat (standard quota)",
        "AI memory up to 500 vectors",
        "WhatsApp AI (limited)",
        "Data export",
      ],
      highlight: true,
      cta: "Coming Soon",
    },
    {
      name: "Premium 3-Month",
      price: "Pricing to be announced",
      period: "/3 months",
      description: "Save with a 3-month package.",
      features: [
        "All Premium Monthly features",
        "Savings vs monthly billing",
        "AI Clinical Copilot (proactive quota)",
        "WhatsApp AI (full)",
        "Cycle tracking with privacy guardrail",
      ],
      highlight: false,
      cta: "Coming Soon",
    },
    {
      name: "Premium Yearly",
      price: "Pricing to be announced",
      period: "/year",
      description: "Biggest savings with annual plan.",
      features: [
        "All Premium 3-Month features",
        "Maximum savings",
        "AI Clinical Copilot (proactive quota)",
        "WhatsApp AI (full)",
        "Priority access to new features",
      ],
      highlight: false,
      cta: "Coming Soon",
    },
    {
      name: "Family Premium",
      price: "Pricing to be announced",
      period: "/month",
      description: "Monitor family health remotely.",
      features: [
        "All Premium Monthly features",
        "Up to 5 family members",
        "Caregiver dashboard",
        "Family emergency alert",
        "AI Clinical Copilot for family members",
        "Combined family WhatsApp AI",
        "Consent-first access",
        "Combined family report",
      ],
      highlight: false,
      cta: "Coming Soon",
    },
  ],
};

export function getPricingPlans(locale: Locale) {
  return pricingData[locale] || pricingData.id;
}

export const pricingPlans = pricingData.id;
