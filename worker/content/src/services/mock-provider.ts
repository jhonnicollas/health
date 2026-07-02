// Deterministic mock AI provider. Mirrors the schemas in
// app/contentApp/docs/06.PROMPTS_CE1.md sections 9.8, 10.8, 11.7, 12.9-12.11.

import type {
  AiConfigRow,
  AiGenerateResult,
  AiProvider,
  TokenUsage,
} from '../types/ai.js';

const FIXED_USAGE: TokenUsage = {
  inputTokens: 50,
  outputTokens: 80,
  estimatedCostUsd: 0.0005,
};

// ponytail: classify prompt purpose from the promptText marker rather than
// threading it through config. The config is the only call-time handle
// callers have, and these marker strings come from the persisted prompt text.
function detectPurpose(promptText: string):
  | 'idea_generation'
  | 'draft_generation'
  | 'safety_check'
  | 'health_classifier' {
  if (promptText.includes('idea_generation')) return 'idea_generation';
  if (promptText.includes('draft_generation')) return 'draft_generation';
  if (promptText.includes('safety_check')) return 'safety_check';
  return 'health_classifier';
}

export class MockProvider implements AiProvider {
  name = 'mock' as const;

  async generateJson<T>(
    config: AiConfigRow,
    promptText: string
  ): Promise<AiGenerateResult<T>> {
    // Mimic network latency. 5ms keeps tests fast while preserving async shape.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const purpose = detectPurpose(promptText);
    const data = buildMockOutput(purpose, promptText);

    return {
      data: data as T,
      rawText: JSON.stringify(data),
      modelUsed: `mock-${config.model || 'default'}`,
      tokenUsage: { ...FIXED_USAGE },
      promptVersionId: config.id || null,
    };
  }
}

function buildMockOutput(
  purpose: ReturnType<typeof detectPurpose>,
  promptText: string
): unknown {
  switch (purpose) {
    case 'idea_generation':
      return { ideas: ideaIdeas() };
    case 'draft_generation':
      return draftGeneration(promptText);
    case 'safety_check':
      return safetyCheckReport(promptText);
    case 'health_classifier':
      return classifierReport(promptText);
  }
}

function ideaIdeas() {
  return [
    {
      title: 'Tensi tinggi sekali bukan cuma soal angka',
      pillarSlug: 'health_data_awareness',
      angle:
        'Blood pressure readings are easier to discuss with context, not panic.',
      painPoint:
        'Many people check blood pressure but forget time, activity, and symptoms.',
      targetPlatform: 'instagram',
      contentFormat: 'carousel',
      targetAudience: 'Adults monitoring blood pressure at home.',
      score: 85,
      confidence: 'medium',
      sourceType: 'ai_inferred',
    },
    {
      title: 'Catatan gula darah mingguan bantu dokter',
      pillarSlug: 'health_data_awareness',
      angle:
        'Weekly glucose logs are easier to review when time, meal, and activity are recorded together.',
      painPoint:
        'Patients often bring raw numbers without context to consultations.',
      targetPlatform: 'instagram',
      contentFormat: 'post',
      targetAudience: 'Caregivers supporting family with diabetes.',
      score: 80,
      confidence: 'medium',
      sourceType: 'ai_inferred',
    },
    {
      title: 'Mempersiapkan konsultasi pertama dengan rapi',
      pillarSlug: 'consultation_prep',
      angle:
        'A short structured summary of recent readings helps the first consultation stay focused.',
      painPoint:
        'New users do not know what to bring or what to ask during the first visit.',
      targetPlatform: 'linkedin',
      contentFormat: 'post',
      targetAudience: 'New iSehat users preparing for first doctor visit.',
      score: 78,
      confidence: 'medium',
      sourceType: 'ai_inferred',
    },
  ];
}

function draftGeneration(promptText: string) {
  // ponytail: short marker picks a reels script fixture, otherwise carousel.
  const isReels = promptText.includes('reels_script');
  return isReels ? reelsDraft() : carouselDraft();
}

function carouselDraft() {
  return {
    primaryHook: 'Tensi tinggi sekali bukan cuma soal angkanya.',
    hookAlternatives: [
      'Banyak orang cek tensi, tapi lupa mencatat konteksnya.',
      'Satu angka tensi belum cukup untuk melihat kebiasaan tubuh.',
    ],
    mainContent:
      'Satu angka tensi belum cukup untuk memahami pola kesehatan. Catat juga waktu pengukuran, aktivitas sebelumnya, kondisi tubuh, dan keluhan yang terasa. Data seperti ini bisa membantu kamu menyiapkan informasi yang lebih jelas saat berkonsultasi dengan tenaga medis.',
    carouselSlides: [
      {
        slideNumber: 1,
        title: 'Tensi 150/95. Panik?',
        body: 'Jangan cuma lihat angkanya. Catat juga waktunya.',
        designNote: 'Large number visual with calm neutral layout.',
      },
      {
        slideNumber: 2,
        title: 'Konteks itu penting',
        body: 'Catat aktivitas, keluhan, dan waktu pengukuran.',
        designNote: 'Use simple checklist cards.',
      },
      {
        slideNumber: 3,
        title: 'Bawa data saat konsultasi',
        body: 'Riwayat yang rapi membantu diskusi dengan tenaga medis.',
        designNote: 'Show doctor-ready report illustration.',
      },
    ],
    script: null,
    caption:
      'Banyak orang punya tensimeter, tapi tidak semua mencatat konteks pengukurannya. Padahal waktu, aktivitas sebelumnya, dan keluhan yang terasa bisa membantu kamu melihat pola dengan lebih rapi. iSehat membantu kamu mencatat data kesehatan harian agar lebih siap saat berkonsultasi dengan tenaga medis.',
    cta: 'Mulai catat kesehatan harianmu.',
    hashtags: [
      '#iSehat',
      '#TensiDarah',
      '#CatatanKesehatan',
      '#KesehatanKeluarga',
      '#HealthTech',
    ],
    visualBrief: {
      style: 'clean healthtech, calm, trustworthy',
      layoutNotes: [
        'Use soft card-based layout.',
        'Avoid emergency or panic visuals.',
        'Use app/report illustration instead of patient diagnosis scene.',
      ],
    },
    thumbnailText: 'Tensi tinggi? Catat konteksnya.',
  };
}

function reelsDraft() {
  return {
    primaryHook: 'Cek tensi jangan cuma simpan angkanya.',
    hookAlternatives: [
      'Satu angka tensi bisa lebih berguna kalau ada konteksnya.',
    ],
    mainContent:
      'Script edukasi singkat tentang mencatat konteks saat mengukur tensi di rumah.',
    carouselSlides: [],
    script: {
      durationSeconds: 30,
      hook0To3s: 'Tensi tinggi? Jangan langsung panik.',
      voiceover:
        'Saat cek tensi di rumah, angka memang penting. Tapi konteks juga penting. Catat waktunya, aktivitas sebelumnya, dan keluhan yang terasa. Dengan catatan yang rapi, kamu bisa lebih siap saat berkonsultasi dengan tenaga medis.',
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 5,
          visualInstruction:
            'Show simple blood pressure monitor on table with calm background.',
          voiceoverLine: 'Tensi tinggi? Jangan langsung panik.',
          subtitle: 'Jangan langsung panik',
        },
        {
          sceneNumber: 2,
          durationSeconds: 10,
          visualInstruction: 'Show checklist: time, activity, symptoms.',
          voiceoverLine:
            'Catat waktu, aktivitas sebelumnya, dan keluhan yang terasa.',
          subtitle: 'Catat konteksnya',
        },
        {
          sceneNumber: 3,
          durationSeconds: 15,
          visualInstruction:
            'Show app report illustration, no doctor endorsement.',
          voiceoverLine:
            'Catatan yang rapi membantu kamu menyiapkan informasi sebelum konsultasi.',
          subtitle: 'Siapkan data sebelum konsultasi',
        },
      ],
      closingCta: 'Mulai catat kesehatan harianmu di iSehat.',
    },
    caption:
      'Cek tensi di rumah akan lebih bermanfaat kalau kamu juga mencatat konteksnya: waktu, aktivitas sebelumnya, dan keluhan yang terasa.',
    cta: 'Mulai catat kesehatan harianmu.',
    hashtags: [
      '#iSehat',
      '#TensiDarah',
      '#CatatanKesehatan',
      '#KesehatanKeluarga',
      '#HealthTech',
    ],
    visualBrief: {
      style: 'clean healthtech short-form script',
      layoutNotes: [
        'No video rendering in CE-1.',
        'Use this only as text/script export.',
        'Avoid fear-based emergency visuals.',
      ],
    },
    thumbnailText: 'Cek tensi? Catat konteksnya.',
  };
}

function safetyCheckReport(promptText: string) {
  if (promptText.includes('MOCK_BLOCK_DOCTOR_REPLACE')) return blockedReport();
  if (promptText.includes('MOCK_WARNING_SOURCE')) return warningReport();
  return safeReport();
}

function safeReport() {
  return {
    healthContentStatus: 'health_content',
    safetyStatus: 'safe',
    blockedReasons: [],
    warnings: [],
    rewrittenSuggestion: null,
    requiredDisclaimer:
      'Konten ini bersifat edukatif dan bukan pengganti konsultasi medis. Jika mengalami keluhan berat, memburuk, atau kondisi darurat, segera hubungi tenaga medis.',
    sourceTraceRequired: false,
  };
}

function warningReport() {
  return {
    healthContentStatus: 'health_content',
    safetyStatus: 'warning',
    blockedReasons: [],
    warnings: ['Specific medical factual claim should include source trace.'],
    rewrittenSuggestion: null,
    requiredDisclaimer:
      'Konten ini bersifat edukatif dan bukan pengganti konsultasi medis. Jika mengalami keluhan berat, memburuk, atau kondisi darurat, segera hubungi tenaga medis.',
    sourceTraceRequired: true,
  };
}

function blockedReport() {
  return {
    healthContentStatus: 'health_content',
    safetyStatus: 'blocked',
    blockedReasons: ['Doctor replacement claim detected.'],
    warnings: [],
    rewrittenSuggestion:
      'Revise the copy to clarify that iSehat helps users organize health records and prepare for consultation, but does not replace doctors.',
    requiredDisclaimer:
      'Konten ini bersifat edukatif dan bukan pengganti konsultasi medis. Jika mengalami keluhan berat, memburuk, atau kondisi darurat, segera hubungi tenaga medis.',
    sourceTraceRequired: false,
  };
}

function classifierReport(promptText: string) {
  const status = promptText.includes('MOCK_NON_HEALTH')
    ? 'non_health_content'
    : 'health_content';
  return {
    healthContentStatus: status,
    safetyStatus: 'safe',
    blockedReasons: [],
    warnings: [],
    rewrittenSuggestion: null,
    requiredDisclaimer: '',
    sourceTraceRequired: false,
  };
}
