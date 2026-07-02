// Safety check types — request/result shapes, internal classifier + checker
// outputs, and the conSafetyReports row shape. Reuses DraftHealthContentStatus
// and DraftSafetyStatus from domain.ts so DB rows and API payloads stay aligned.

import type {
  DraftHealthContentStatus,
  DraftLifecycleStatus,
  DraftSafetyStatus,
} from './domain.js';

export interface SafetyCheckRequest {
  revisionNumber: number;
}

// Mirror of conSafetyReports columns. JSON columns stored as strings in D1.
export interface SafetyReportRow {
  id: string;
  draftId: string;
  revisionNumber: number;
  healthContentStatus: DraftHealthContentStatus;
  safetyStatus: 'safe' | 'warning' | 'blocked';
  blockedReasonsJson: string | null;
  warningsJson: string | null;
  rewrittenSuggestion: string | null;
  requiredDisclaimer: string | null;
  sourceTraceRequired: number; // 0 or 1
  checkerNote: string | null;
  checkedBy: string;
  modelUsed: string | null;
  promptVersionId: string | null;
  checkedAt: string;
}

export interface HealthClassifierOutput {
  healthContentStatus: DraftHealthContentStatus;
  confidence: 'low' | 'medium' | 'high';
}

export interface MedicalSafetyOutput {
  safetyStatus: 'safe' | 'warning' | 'blocked';
  blockedReasons: string[];
  warnings: string[];
  requiredDisclaimer: string;
  rewrittenSuggestion: string | null;
  sourceTraceRequired: boolean;
}

export interface SafetyCheckResult {
  jobId: string;
  jobStatus: 'completed' | 'failed';
  draftId: string;
  revisionNumber: number;
  healthContentStatus: DraftHealthContentStatus;
  safetyStatus: DraftSafetyStatus;
  status: DraftLifecycleStatus;
  requiredDisclaimer?: string;
  warnings?: string[];
  blockedReasons?: string[];
  rewrittenSuggestion?: string;
  sourceTraceRequired: boolean;
  note?: string;
}

export const SAFETY_REPORT_STATUSES = ['safe', 'warning', 'blocked'] as const;
export type SafetyReportStatus = (typeof SAFETY_REPORT_STATUSES)[number];

export function isSafetyReportStatus(v: unknown): v is SafetyReportStatus {
  return typeof v === 'string' && (SAFETY_REPORT_STATUSES as readonly string[]).includes(v);
}
