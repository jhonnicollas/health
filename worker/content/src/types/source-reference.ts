// Source References and Approvals — conSourceReferences and conApprovals row
// shapes and create inputs. Enums are slightly narrower than the DB CHECK
// constraints: source-reference `sourceType`/`sourceReliability` exclude
// 'competitor' per API contract §11.

import type { Paginated } from './domain.js';

export const SOURCE_REFERENCE_TYPES = [
  'official',
  'medical_reference',
  'platform_docs',
  'social_observation',
  'ai_inferred',
] as const;
export type SourceReferenceType = (typeof SOURCE_REFERENCE_TYPES)[number];

export const SOURCE_RELIABILITIES = [
  'official',
  'medical_reference',
  'platform_docs',
  'social_observation',
  'ai_inferred',
] as const;
export type SourceReliability = (typeof SOURCE_RELIABILITIES)[number];

export const CONFIDENCES = ['low', 'medium', 'high'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export function isSourceReferenceType(v: unknown): v is SourceReferenceType {
  return typeof v === 'string' && (SOURCE_REFERENCE_TYPES as readonly string[]).includes(v);
}

export function isSourceReliability(v: unknown): v is SourceReliability {
  return typeof v === 'string' && (SOURCE_RELIABILITIES as readonly string[]).includes(v);
}

export function isConfidence(v: unknown): v is Confidence {
  return typeof v === 'string' && (CONFIDENCES as readonly string[]).includes(v);
}

// Mirror of conSourceReferences columns.
export interface SourceReferenceRow {
  id: string;
  draftId: string;
  revisionNumber: number;
  title: string;
  url: string | null;
  sourceType: SourceReferenceType;
  sourceReliability: SourceReliability | null;
  confidence: Confidence | null;
  note: string | null;
  fetchedAt: string | null;
  createdAt: string;
}

export interface SourceReferenceCreateInput {
  revisionNumber: number;
  title: string;
  url?: string | null;
  sourceType: SourceReferenceType;
  sourceReliability?: SourceReliability | null;
  confidence?: Confidence | null;
  note?: string | null;
  fetchedAt?: string | null;
}

// Mirror of conApprovals columns.
export const APPROVAL_STATUSES = ['approved', 'rejected', 'revision_requested'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface ApprovalRow {
  id: string;
  draftId: string;
  revisionNumber: number;
  status: ApprovalStatus;
  reviewerId: string;
  reviewerRole: string;
  reviewerNote: string | null;
  warningOverrideReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface ApprovalCreateInput {
  status: ApprovalStatus;
  reviewerId: string;
  reviewerRole: string;
  reviewerNote?: string | null;
  warningOverrideReason?: string | null;
  approvedAt?: string | null;
}

export interface ApprovalQueueFilters {
  brandId?: string;
  healthContentStatus?: string;
  safetyStatus?: string;
  platform?: string;
  contentFormat?: string;
}

export type ApprovalBlocker =
  | 'APPROVAL_REQUIRED'
  | 'REVISION_MISMATCH'
  | 'SOURCE_TRACE_REQUIRED'
  | 'SAFETY_BLOCKED'
  | 'WARNING_OVERRIDE_REQUIRED';

export interface ApprovalQueueItem {
  draftId: string;
  brandId: string;
  currentRevision: number;
  primaryHook: string;
  platform: string;
  contentFormat: string;
  healthContentStatus: string;
  safetyStatus: string;
  approvalStatus: string;
  status: string;
  sourceTraceRequired: boolean;
  sourceReferenceCount: number;
  canApprove: boolean;
  approvalBlockers: ApprovalBlocker[];
}

export type ApprovalQueuePage = Paginated<ApprovalQueueItem>;

// Shared input shape for approve / reject / request-revision.
export interface ApprovalActionInput {
  revisionNumber: number;
  reviewerNote?: string;
  warningOverrideReason?: string;
}
