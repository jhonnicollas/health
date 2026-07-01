// AiMemoryDocumentBuilder — summarizes source data into vector documents.
// PRD S6C §6: Only summarized content is indexed, NOT raw data.
// 8 source types: symptom, measurement, safetyEvent, doctorReport,
//   aiSession, medicationAdherence, hydrationCycle, whatsappChat
//
// NOT indexed: raw secrets, cross-user data, full raw prompts, raw images,
//   sensitive family data without permission.

export interface MemoryDocument {
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface SourceData {
  type: string;
  id: number;
  data: Record<string, unknown>;
}

/**
 * Build a safe, summarized memory document from a single source row.
 * Each source type has a custom summarizer that produces safe text.
 */
export function buildMemoryDocument(source: SourceData): MemoryDocument | null {
  const builders: Record<string, (data: Record<string, unknown>, id: number) => MemoryDocument | null> = {
    symptom: summarizeSymptom,
    measurement: summarizeMeasurement,
    safetyEvent: summarizeSafetyEvent,
    doctorReport: summarizeDoctorReport,
    aiSession: summarizeAiSession,
    medicationAdherence: summarizeMedicationAdherence,
    hydrationCycle: summarizeHydrationCycle,
    whatsappChat: summarizeWhatsAppChat,
  };

  const builder = builders[source.type];
  if (!builder) return null;
  return builder(source.data, source.id);
}

/**
 * Build multiple memory documents from an array of source data.
 * Filters out null results.
 */
export function buildMemoryDocuments(sources: SourceData[]): MemoryDocument[] {
  return sources
    .map(buildMemoryDocument)
    .filter((doc): doc is MemoryDocument => doc !== null);
}

// ─── Individual source type summarizers ───

function summarizeSymptom(data: Record<string, unknown>, id: number): MemoryDocument {
  const bodyArea = String(data.bodyArea || 'unknown');
  const painScale = data.painScale as number | undefined;
  const painSeverity = String(data.painSeverity || 'unknown');
  const isRedFlag = data.isRedFlag ? 'with red flag' : 'no red flag';
  const mood = String(data.mood || 'unknown');
  const dateTime = String(data.symptomDateTime || data.createdAt || '');

  const content = `Symptom: ${bodyArea}, severity=${painSeverity}, pain=${painScale ?? '-'}/10, ${isRedFlag}, mood=${mood}, recorded=${dateTime}`;

  return {
    sourceType: 'symptom',
    sourceId: String(id),
    content,
    metadata: {
      bodyArea,
      painScale: painScale ?? null,
      painSeverity,
      isRedFlag: Boolean(data.isRedFlag),
      mood,
      recordedAt: dateTime,
    },
  };
}

function summarizeMeasurement(data: Record<string, unknown>, id: number): MemoryDocument {
  const metricCode = String(data.metricCode || 'unknown');
  const finalValue = data.finalValue as number | undefined;
  const status = String(data.status || 'unknown');
  const severity = String(data.severity || 'unknown');
  const measuredAt = String(data.measuredAt || '');

  const content = `Measurement: ${metricCode} = ${finalValue ?? 'N/A'}, status=${status}, severity=${severity}, measured=${measuredAt}`;

  return {
    sourceType: 'measurement',
    sourceId: String(id),
    content,
    metadata: {
      metricCode,
      finalValue: finalValue ?? null,
      status,
      severity,
      measuredAt,
    },
  };
}

function summarizeSafetyEvent(data: Record<string, unknown>, id: number): MemoryDocument {
  const eventType = String(data.eventType || 'unknown');
  const severity = String(data.severity || 'unknown');
  const title = String(data.title || '');
  const createdAt = String(data.createdAt || '');

  const content = `Safety event: ${eventType} (${severity}), title=${title}, occurred=${createdAt}`;

  return {
    sourceType: 'safetyEvent',
    sourceId: String(id),
    content,
    metadata: {
      eventType,
      severity,
      title,
      occurredAt: createdAt,
    },
  };
}

function summarizeDoctorReport(data: Record<string, unknown>, id: number): MemoryDocument {
  const reportType = String(data.reportType || 'unknown');
  const createdAt = String(data.createdAt || '');

  // Only summarize metadata — never raw report content
  const content = `Doctor report: type=${reportType}, created=${createdAt}`;

  return {
    sourceType: 'doctorReport',
    sourceId: String(id),
    content,
    metadata: {
      reportType,
      createdAt,
    },
  };
}

function summarizeAiSession(data: Record<string, unknown>, id: number): MemoryDocument {
  const sessionType = String(data.sessionType || 'general');
  const status = String(data.status || 'active');
  const dataSufficiencyScore = data.dataSufficiencyScore as number | undefined;
  const startedAt = String(data.startedAt || data.createdAt || '');

  // Summarize session metadata, never raw chat content
  const content = `AI clinical session: type=${sessionType}, status=${status}, sufficiency=${dataSufficiencyScore ?? 'N/A'}/100, started=${startedAt}`;

  return {
    sourceType: 'aiSession',
    sourceId: String(id),
    content,
    metadata: {
      sessionType,
      status,
      dataSufficiencyScore: dataSufficiencyScore ?? null,
      startedAt,
    },
  };
}

function summarizeMedicationAdherence(data: Record<string, unknown>, id: number): MemoryDocument {
  const medicationName = String(data.medicationName || 'unknown');
  const status = String(data.status || 'unknown');
  const takenAt = String(data.takenAt || '');

  const content = `Medication adherence: ${medicationName}, status=${status}, taken=${takenAt}`;

  return {
    sourceType: 'medicationAdherence',
    sourceId: String(id),
    content,
    metadata: {
      medicationName,
      status,
      takenAt,
    },
  };
}

function summarizeHydrationCycle(data: Record<string, unknown>, id: number): MemoryDocument {
  // This is consent-gated — caller must check dataShareConsent before indexing
  const subType = String(data.subType || 'hydration');
  const amountMl = data.amountMl as number | undefined;
  const flowIntensity = String(data.flowIntensity || '');
  const logDate = String(data.logDate || '');

  let content: string;
  let metadata: Record<string, unknown>;

  if (subType === 'cycle') {
    content = `Cycle log: flow=${flowIntensity}, mood=${data.mood || '-'}, date=${logDate}`;
    metadata = { subType: 'cycle', flowIntensity, mood: data.mood ?? null, logDate };
  } else {
    content = `Hydration: ${amountMl ?? 'N/A'}ml on ${logDate}`;
    metadata = { subType: 'hydration', amountMl: amountMl ?? null, logDate };
  }

  return {
    sourceType: 'hydrationCycle',
    sourceId: String(id),
    content,
    metadata,
  };
}

function summarizeWhatsAppChat(data: Record<string, unknown>, id: number): MemoryDocument {
  // Summarize session-level info, never raw message content
  const messageType = String(data.messageType || 'text');
  const direction = String(data.direction || 'inbound');
  const processedStatus = String(data.processedStatus || 'completed');
  const createdAt = String(data.createdAt || '');

  const content = `WhatsApp clinical chat: direction=${direction}, type=${messageType}, status=${processedStatus}, date=${createdAt}`;

  return {
    sourceType: 'whatsappChat',
    sourceId: String(id),
    content,
    metadata: {
      messageType,
      direction,
      processedStatus,
      createdAt,
    },
  };
}
