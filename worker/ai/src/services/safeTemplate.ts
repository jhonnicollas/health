// Deterministic safe template — used when all LLM providers fail.
// PRD §8.1 FR-01 AC10: "If model fails, fallback to deterministic safe template."
// This is NOT a mock — it produces a real, safe response with the mandatory disclaimer.

export interface SafeTemplateInput {
  taskCode: string;
  locale?: 'id' | 'en';
  contextSummary?: string;
}

export function renderSafeTemplate(input: SafeTemplateInput): { text: string; model: string } {
  const locale = input.locale ?? 'id';
  const context = input.contextSummary ?? '';

  const disclaimerId = 'AI DAPAT MELAKUKAN KESALAHAN.\nTIDAK BOLEH MENGANDALKAN AI 100%.\nTIDAK BOLEH PERCAYA AI 100%.\nSEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.';
  const disclaimerEn = 'AI CAN MAKE MISTAKES.\nDO NOT RELY ON AI 100%.\nDO NOT TRUST AI 100%.\nALL DECISIONS YOU MAKE BASED ON THIS AI OUTPUT ARE 1000% YOUR OWN RESPONSIBILITY.';

  const disclaimer = locale === 'en' ? disclaimerEn : disclaimerId;

  let body: string;
  switch (input.taskCode) {
    case 'clinical_copilot':
    case 'symptom_interview':
      body = locale === 'en'
        ? `Based on your available health data${context ? ` (${context})` : ''}, I can provide general observations. However, the AI model is currently unavailable, so I cannot generate a detailed analysis at this time.\n\nPlease consult with a healthcare professional for personalized medical advice. If you experience danger signs (chest pain, severe shortness of breath, fainting, one-sided weakness), seek emergency care immediately.`
        : `Berdasarkan data kesehatan Anda yang tersedia${context ? ` (${context})` : ''}, saya dapat memberikan observasi umum. Namun, model AI saat ini tidak tersedia, sehingga saya tidak dapat memberikan analisis mendetail saat ini.\n\nSilakan konsultasikan dengan tenaga medis profesional untuk saran medis yang dipersonalisasi. Jika Anda mengalami tanda bahaya (nyeri dada, sesak napas berat, pingsan, kelemahan satu sisi), segera cari pertolongan darurat.`;
      break;
    case 'first_aid':
      body = locale === 'en'
        ? 'First-aid guidance is temporarily unavailable. For emergencies, call 119 or 112 immediately. For minor injuries, clean with running water and cover with a sterile bandage.'
        : 'Panduan P3K sementara tidak tersedia. Untuk keadaan darurat, segera hubungi 119 atau 112. Untuk luka ringan, bersihkan dengan air mengalir dan tutup dengan perban steril.';
      break;
    case 'emergency_guidance':
      body = locale === 'en'
        ? '⚠️ EMERGENCY ALERT\nIf you are experiencing a medical emergency, contact emergency services immediately:\n- Emergency: 119 / 112\n- Nearest healthcare facility\n- Your caregiver (if available)'
        : '⚠️ PERINGATAN DARURAT\nJika Anda mengalami keadaan darurat medis, segera hubungi layanan darurat:\n- Layanan Darurat: 119 / 112\n- Fasilitas Kesehatan terdekat\n- Caregiver Anda (jika tersedia)';
      break;
    case 'doctor_handoff':
      body = locale === 'en'
        ? 'Doctor handoff summary generation is temporarily unavailable. Please try again later or consult your doctor directly.'
        : 'Pembuatan ringkasan dokter sementara tidak tersedia. Silakan coba lagi nanti atau konsultasikan langsung dengan dokter Anda.';
      break;
    case 'caregiver_summary':
      body = locale === 'en'
        ? 'Caregiver summary generation is temporarily unavailable. Please try again later.'
        : 'Pembuatan ringkasan caregiver sementara tidak tersedia. Silakan coba lagi nanti.';
      break;
    default:
      body = locale === 'en'
        ? 'AI service is temporarily unavailable. Please try again in a moment.'
        : 'Layanan AI sementara tidak tersedia. Silakan coba lagi sebentar.';
  }

  return {
    text: `${body}\n\n${disclaimer}`,
    model: 'deterministic-safe-template',
  };
}
