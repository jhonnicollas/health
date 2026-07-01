import { test } from 'node:test';
import assert from 'node:assert';
import { buildMemoryDocument, buildMemoryDocuments } from '../dist/services/memoryDocumentBuilder.js';

// S6C tests — 10 tests per PRD S6C §10.
// These tests verify the deterministic parts that don't require live Vectorize bindings.
// The full insert/query flow is integration-tested when Vectorize is available.

// Mock source data for testing
const mockSymptom = { id: 1, type: 'symptom', data: { id: 1, bodyArea: 'head', painScale: 7, painSeverity: 'severe', isRedFlag: 1, mood: 'anxious', symptomDateTime: '2026-06-30T10:00:00Z' } };
const mockMeasurement = { id: 2, type: 'measurement', data: { id: 2, metricCode: 'systolic', finalValue: 145, status: 'high', severity: 'moderate', measuredAt: '2026-06-30T08:00:00Z' } };
const mockSafetyEvent = { id: 3, type: 'safetyEvent', data: { id: 3, eventType: 'hypertensive_crisis', severity: 'critical', title: 'BP > 180/120', createdAt: '2026-06-30T09:00:00Z' } };
const mockMedication = { id: 4, type: 'medicationAdherence', data: { id: 4, medicationName: 'Amlodipine', status: 'taken', takenAt: '2026-06-30T07:00:00Z' } };
const mockHydration = { id: 5, type: 'hydrationCycle', data: { id: 5, subType: 'hydration', amountMl: 2000, logDate: '2026-06-30' } };
const mockCycle = { id: 6, type: 'hydrationCycle', data: { id: 6, subType: 'cycle', flowIntensity: 'medium', mood: 'normal', logDate: '2026-06-28' } };

test('S6C T-1: buildMemoryDocument produces valid symptom document with safe content', () => {
  const doc = buildMemoryDocument(mockSymptom);
  assert.ok(doc);
  assert.equal(doc.sourceType, 'symptom');
  assert.equal(doc.sourceId, '1');
  assert.ok(doc.content.includes('head'));
  assert.ok(doc.content.includes('severe'));
  assert.ok(doc.content.includes('red flag'));
  // No raw sensitive data like physicalSymptomsJson
  assert.ok(!doc.content.includes('physicalSymptomsJson'));
});

test('S6C T-2: buildMemoryDocument produces valid measurement document', () => {
  const doc = buildMemoryDocument(mockMeasurement);
  assert.ok(doc);
  assert.equal(doc.sourceType, 'measurement');
  assert.ok(doc.content.includes('systolic'));
  assert.ok(doc.content.includes('145'));
  assert.ok(doc.content.includes('high'));
});

test('S6C T-3: buildMemoryDocument for safety event includes severity', () => {
  const doc = buildMemoryDocument(mockSafetyEvent);
  assert.ok(doc);
  assert.equal(doc.sourceType, 'safetyEvent');
  assert.ok(doc.content.includes('critical'));
  assert.ok(doc.content.includes('hypertensive_crisis'));
});

test('S6C T-4: buildMemoryDocument for medication adherence includes name and status', () => {
  const doc = buildMemoryDocument(mockMedication);
  assert.ok(doc);
  assert.equal(doc.sourceType, 'medicationAdherence');
  assert.ok(doc.content.includes('Amlodipine'));
  assert.ok(doc.content.includes('taken'));
});

test('S6C T-5: buildMemoryDocument for hydration (consent-gated) produces safe summary', () => {
  const doc = buildMemoryDocument(mockHydration);
  assert.ok(doc);
  assert.equal(doc.sourceType, 'hydrationCycle');
  assert.ok(doc.content.includes('2000ml'));
  assert.ok(!doc.content.includes('rawDetail'));
});

test('S6C T-6: buildMemoryDocument for cycle (consent-gated) produces safe summary', () => {
  const doc = buildMemoryDocument(mockCycle);
  assert.ok(doc);
  assert.equal(doc.sourceType, 'hydrationCycle');
  assert.ok(doc.content.includes('medium'));
  assert.ok(doc.content.toLowerCase().includes('cycle'));
});

test('S6C T-7: buildMemoryDocuments filters null results and handles multiple types', () => {
  const sources = [mockSymptom, mockMeasurement, mockSafetyEvent, mockMedication, mockHydration, mockCycle];
  const docs = buildMemoryDocuments(sources);
  assert.equal(docs.length, 6);
  const types = docs.map(d => d.sourceType);
  assert.ok(types.includes('symptom'));
  assert.ok(types.includes('measurement'));
  assert.ok(types.includes('safetyEvent'));
  assert.ok(types.includes('medicationAdherence'));
  assert.ok(types.includes('hydrationCycle'));
});

test('S6C T-8: buildMemoryDocument returns null for unknown source type', () => {
  const doc = buildMemoryDocument({ id: 99, type: 'unknown_type', data: {} });
  assert.equal(doc, null);
});

test('S6C T-9: Metadata is sanitized — sensitive fields are redacted', () => {
  const sensitiveSource = {
    id: 10,
    type: 'symptom',
    data: {
      id: 10,
      bodyArea: 'chest',
      painScale: 9,
      painSeverity: 'severe',
      isRedFlag: 1,
      mood: 'scared',
      symptomDateTime: '2026-06-30T11:00:00Z',
      description: 'Very detailed raw description of chest pain and other sensitive info',
      notes: 'Private doctor notes about patient history',
      physicalSymptomsJson: '{"raw":"data"}',
    },
  };
  const doc = buildMemoryDocument(sensitiveSource);
  assert.ok(doc);
  // The content should not contain raw sensitive field values
  assert.ok(!doc.content.includes('Very detailed raw description'));
  assert.ok(!doc.content.includes('Private doctor notes'));
  assert.ok(!doc.content.includes('physicalSymptomsJson'));
});

test('S6C T-10: Content preview is safe — no raw secret/token patterns in any document', () => {
  const allSources = [mockSymptom, mockMeasurement, mockSafetyEvent, mockMedication, mockHydration, mockCycle];
  const docs = buildMemoryDocuments(allSources);
  for (const doc of docs) {
    // No secret-like patterns
    assert.ok(!doc.content.includes('apiKey'));
    assert.ok(!doc.content.includes('secret'));
    assert.ok(!doc.content.includes('token'));
    assert.ok(!doc.content.includes('password'));
    // No cross-user references
    assert.ok(!doc.content.includes('pasien lain'));
    assert.ok(!doc.content.includes('other patient'));
  }
});
