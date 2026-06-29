# TASK PLAN: D1 Database Migration — iSehat Tables
## multi_Ai_db → isehat_db (Hanya tabel HL_*)

**Tanggal:** 2026-06-27  
**Status:** READY  
**Tipe:** Selective Copy (hanya tabel prefix HL_*)  
**Motivasi:** iSehat butuh database terpisah untuk privasi

---

## 1. Informasi Database

| Properti | Source | Target |
|----------|--------|--------|
| Nama | `multi_Ai_db` | `isehat_db` |
| UUID | `b80ca989-6771-427f-a656-c7ab6ffc17ce` | `d777e991-ddc9-4072-8522-06cb08a6538c` |
| Ukuran | ~30 MB | Kosong |
| Total Tabel | 148 (all apps) | 0 |
| Tabel iSehat | 69 (HL_*) | 0 (akan diisi) |
| Index iSehat | 74 user-defined + autoindexes | 0 |
| sqlite_sequence | 52 entries untuk HL_* | 0 |

---

## 2. Scope Migrasi

### IN — Dipindah ke isehat_db
- 69 tabel prefix `HL_*`
- 74 user-defined index pada tabel `HL_*`
- sqlite_sequence entries untuk tabel `HL_*`
- Semua data di tabel `HL_*`

### OUT — Tetap di multi_Ai_db (TIDAK disentuh)
- `9R_*` (9Router/API gateway) — 16 tabel
- `api_*` (API key management) — 17 tabel
- `gen_*` (Genesis/logistics) — 26 tabel
- `sh_*` (Shop comparison) — 22 tabel
- `d1_migrations` (D1 internal)
- Source database `multi_Ai_db` tidak dihapus, tidak dimodifikasi

---

## 3. Inventaris Tabel HL_* (69 tabel)

### 3.1 Root Tables (Level 0 — no FK parent, import pertama)

| # | Tabel | Rows | Auto-Incr | sqlite_sequence |
|---|-------|------|-----------|-----------------|
| 1 | `HL_schemaMigrations` | 5 | yes | seq=5 |
| 2 | `HL_systemConfigs` | 59 | yes | seq=59 |
| 3 | `HL_users` | 40 | yes | seq=45 |
| 4 | `HL_devices` | 6 | no (TEXT PK) | - |
| 5 | `HL_metricCatalog` | 15 | no (TEXT PK) | - |
| 6 | `HL_badges` | 6 | no (TEXT PK) | - |
| 7 | `HL_plans` | 5 | no (TEXT PK) | - |
| 8 | `HL_roles` | 7 | no (TEXT PK) | - |
| 9 | `HL_permissions` | 42 | no (TEXT PK) | - |
| 10 | `HL_educationCards` | 15 | yes | seq=15 |
| 11 | `HL_knowledgeArticles` | 8 | yes | seq=8 |
| 12 | `HL_featureFlags` | 11 | yes | seq=11 |
| 13 | `HL_hydrationSettings` | 1 | yes | seq=1 |

### 3.2 Level 1 (FK ke Level 0)

| # | Tabel | Rows | FK Parent | sqlite_sequence |
|---|-------|------|-----------|-----------------|
| 14 | `HL_userProfiles` | 28 | HL_users | seq=33 |
| 15 | `HL_sessions` | 59 | HL_users | seq=64 |
| 16 | `HL_userConsents` | 30 | HL_users | seq=30 |
| 17 | `HL_deviceMetrics` | 14 | HL_devices | seq=14 |
| 18 | `HL_metricRules` | 80 | HL_metricCatalog | seq=104 |
| 19 | `HL_rolePermissions` | 74 | HL_roles, HL_permissions | seq=116 |
| 20 | `HL_userRoles` | 8 | HL_users, HL_roles | seq=13 |
| 21 | `HL_planFeatures` | 70 | HL_plans | seq=70 |
| 22 | `HL_subscriptions` | 13 | HL_users, HL_plans | seq=13 |
| 23 | `HL_configMetadata` | 18 | HL_systemConfigs | seq=18 |
| 24 | `HL_reminderSettings` | 2 | HL_users | seq=2 |
| 25 | `HL_hydrationTargets` | 7 | HL_users | seq=8 |
| 26 | `HL_userEducationProgress` | 18 | HL_users | seq=18 |
| 27 | `HL_oauthAccounts` | 2 | HL_users | seq=2 |
| 28 | `HL_oauthStates` | 51 | - | seq=51 |
| 29 | `HL_emailOtpChallenges` | 10 | - | seq=10 |
| 30 | `HL_apiRateLimits` | 35 | - | seq=35 |
| 31 | `HL_notifications` | 68 | HL_users | seq=68 |
| 32 | `HL_telegramLinks` | 4 | HL_users | seq=4 |
| 33 | `HL_emergencyContacts` | 2 | HL_users | seq=3 |
| 34 | `HL_medications` | 3 | HL_users | seq=4 |
| 35 | `HL_fastingSessions` | 5 | HL_users | seq=5 |
| 36 | `HL_streaks` | 9 | HL_users | seq=9 |
| 37 | `HL_auditLogs` | 163 | HL_users | seq=163 |
| 38 | `HL_alerts` | 3 | HL_users | seq=3 |
| 39 | `HL_aiRecommendations` | 1 | HL_users | seq=1 |
| 40 | `HL_cycleSettings` | 1 | HL_users | seq=1 |
| 41 | `HL_userBadges` | 0 | HL_users, HL_badges | - |
| 42 | `HL_notificationSettings` | 0 | - | - |
| 43 | `HL_pushSubscriptions` | 0 | - | - |
| 44 | `HL_familyLinks` | 1 | HL_users | seq=1 |
| 45 | `HL_familyInvites` | 1 | HL_users | seq=1 |
| 46 | `HL_symptomLogs` | 3 | HL_users | seq=3 |
| 47 | `HL_paymentEvents` | 3 | HL_users, HL_subscriptions | seq=3 |
| 48 | `HL_usageCounters` | 0 | HL_users | - |
| 49 | `HL_reports` | 2 | HL_users | seq=2 |
| 50 | `HL_patternInsights` | 0 | HL_users | - |
| 51 | `HL_waterIntakeLogs` | 2 | HL_users | seq=2 |
| 52 | `HL_vectorDocuments` | 0 | - | - |
| 53 | `HL_aiContextQueries` | 0 | - | - |
| 54 | `HL_aiMemoryJobs` | 0 | - | - |
| 55 | `HL_cycleLogs` | 0 | HL_users | - |
| 56 | `HL_cycleGuardrailAcknowledgements` | 0 | HL_users | - |
| 57 | `HL_familyPermissions` | 0 | HL_familyLinks | - |
| 58 | `HL_telegramCallbackEvents` | 0 | - | - |
| 59 | `HL_aiRecommendationContexts` | 0 | HL_aiRecommendations, HL_users | - |
| 60 | `HL_aiExtractions` | 0 | HL_users | - |
| 61 | `HL_lastMeasurements` | 20 | HL_users | seq=25 |

### 3.3 Level 2 (FK ke Level 1)

| # | Tabel | Rows | FK Parent | sqlite_sequence |
|---|-------|------|-----------|-----------------|
| 62 | `HL_measurementDrafts` | 0 | HL_users, HL_userProfiles | - |
| 63 | `HL_measurementSessions` | 28 | HL_users, HL_userProfiles | seq=30 |
| 64 | `HL_measurementValues` | 71 | HL_users, HL_measurementSessions, HL_metricCatalog, HL_devices, HL_metricRules | seq=73 |
| 65 | `HL_measurementAttachments` | 3 | HL_users, HL_measurementSessions | seq=3 |
| 66 | `HL_medicationSchedules` | 0 | HL_users, HL_medications | seq=1 |
| 67 | `HL_medicationLogs` | 2 | HL_users, HL_medications | seq=3 |
| 68 | `HL_reportShares` | 0 | HL_reports, HL_users | - |
| 69 | `HL_safetyEvents` | 0 | HL_users, HL_waterIntakeLogs | - |

---

## 4. Index Inventory (74 user-defined indexes)

```
idxHLUsersEmail, idxHLSessionsUser, idxHLSessionsToken,
idxHLProfilesUser, idxHLMetricRulesLookup, idxHLMetricCatalogCode,
idxHLDeviceMetricsDevice, idxHLMeasurementSessionsUserDate,
idxHLMeasurementValuesUserMetricDate, idxHLMeasurementValuesSession,
idxHLMeasurementAttachmentsSession, idxHLMeasurementAttachmentsUser,
idxLastMeterialsUserDevice, idxHLAiExtractionsUserDate,
idxHLAiRecommendationsUserDate, idxHLAlertsUserDate, idxHLAlertsSession,
idxHLNotificationsUserDate, idxHLNotificationsStatus,
idxHLFamilyOwner, idxHLFamilyLinked, idxHLFamilyInvitesToken,
idxHLMedicationsUser, idxHLMedicationLogsUserDate,
idxHLFastingUserStatus, idxHLReportsUserDate,
idxHLReportSharesToken, idxHLPatternInsightsUserDate,
idxHLAuditUserDate, idxHLRateLimitsLookup,
idxHLRolesCode, idxHLPermissionsCode,
idxHLRolePermissionsRole, idxHLRolePermissionsPermission,
idxHLUserRolesUserActive, idxHLUserRolesRoleActive,
idxHLPlansCode, idxHLPlanFeaturesPlan, idxHLPlanFeaturesFeature,
idxHLSubscriptionsUserStatus, idxHLSubscriptionsProvider,
idxHLPaymentEventsProvider, idxHLUsageCountersUserFeature,
idxHLFeatureFlagsEnabled, idxHLConfigMetadataCategory,
idxHLConfigMetadataPolicy, idxHLOauthAccountsUser,
idxHLOauthAccountsProviderSubject, idxHLOauthStatesExpires,
idxHLEducationCardsTopic, idxHLUserEducationProgressUser,
idxHLSymptomLogsUserDate, idxHLSymptomLogsSourceSession,
idxHLSymptomLogsRedFlag, idxHLSafetyEventsUserDate,
idxHLSafetyEventsTypeSeverity, idxHLHydrationSettingsUser,
idxHLHydrationTargetsUserDate, idxHLWaterIntakeLogsUserDate,
idxHLWaterIntakeLogsTelegramCallback, idxHLVectorDocumentsUserSource,
idxHLVectorDocumentsNamespace, idxHLVectorDocumentsStatus,
idxHLAiContextQueriesUserDate, idxHLAiRecommendationContextsRecommendation,
idxHLAiMemoryJobsUserStatus, idxHLCycleSettingsUser,
idxHLCycleLogsUserDate, idxHLCycleGuardrailUserDate,
idxHLFamilyPermissionsLink, idxHLTelegramCallbackEventsStatus,
idxHLTelegramCallbackEventsUser,
idx_emailOtpChallenges_normalizedEmail,
idx_emailOtpChallenges_expiresAt
```

---

## 5. Dependency Tree (Import Order)

`wrangler d1 export --table=HL_xxx` menghasilkan `PRAGMA defer_foreign_keys=TRUE;` sehingga urutan INSERT flexible. Namun CREATE TABLE harus berurutan agar FK definition valid.

```
Batch 1 — Root tables (no FK parent):
  HL_schemaMigrations, HL_systemConfigs, HL_users, HL_devices,
  HL_metricCatalog, HL_badges, HL_plans, HL_roles, HL_permissions,
  HL_educationCards, HL_knowledgeArticles, HL_featureFlags,
  HL_hydrationSettings, HL_oauthStates, HL_emailOtpChallenges,
  HL_apiRateLimits, HL_notificationSettings, HL_pushSubscriptions,
  HL_vectorDocuments, HL_aiContextQueries, HL_aiMemoryJobs,
  HL_telegramCallbackEvents

Batch 2 — FK ke Batch 1:
  HL_userProfiles, HL_sessions, HL_userConsents, HL_deviceMetrics,
  HL_metricRules, HL_rolePermissions, HL_userRoles, HL_planFeatures,
  HL_subscriptions, HL_configMetadata, HL_reminderSettings,
  HL_hydrationTargets, HL_userEducationProgress, HL_oauthAccounts,
  HL_notifications, HL_telegramLinks, HL_emergencyContacts,
  HL_medications, HL_fastingSessions, HL_streaks, HL_auditLogs,
  HL_alerts, HL_aiRecommendations, HL_cycleSettings, HL_userBadges,
  HL_familyLinks, HL_familyInvites, HL_symptomLogs, HL_paymentEvents,
  HL_usageCounters, HL_reports, HL_patternInsights,
  HL_waterIntakeLogs, HL_lastMeasurements, HL_cycleLogs,
  HL_cycleGuardrailAcknowledgements, HL_familyPermissions,
  HL_aiRecommendationContexts, HL_aiExtractions,
  HL_measurementDrafts

Batch 3 — FK ke Batch 2:
  HL_measurementSessions, HL_medicationSchedules,
  HL_medicationLogs, HL_reportShares

Batch 4 — FK ke Batch 3:
  HL_measurementValues, HL_measurementAttachments, HL_safetyEvents
```

---

## 6. Task Plan

### T1: Pre-Migration Verification
**Risk:** None (read-only)  
**Estimasi:** 5 menit

| Step | Aksi | Expected |
|------|------|----------|
| T1.1 | Confirm target `isehat_db` kosong | 0 tabel (selain `_cf_KV`) |
| T1.2 | Confirm source `multi_Ai_db` accessible | 148+ tabel |
| T1.3 | Snapshot source HL_* row counts | Save ke `/tmp/hl_source_counts.txt` |
| T1.4 | Snapshot source sqlite_sequence untuk HL_* | Save ke `/tmp/hl_source_sequences.txt` |
| T1.5 | Count source HL_* indexes | 74 user-defined |

---

### T2: Export HL_* Tables (69 tabel)
**Risk:** Low (read-only)  
**Estimasi:** 15-20 menit  
**Method:** `wrangler d1 export multi_Ai_db --remote --table=HL_xxx --output=/tmp/hl_export/HL_xxx.sql` per tabel

| Step | Aksi | Command Template |
|------|------|-------------------|
| T2.1 | Create export directory | `mkdir -p /tmp/hl_export` |
| T2.2-T2.70 | Export setiap tabel HL_* | `wrangler d1 export multi_Ai_db --remote --table=HL_xxx --output=/tmp/hl_export/HL_xxx.sql` |
| T2.71 | Verify semua file ada (69 files) | `ls /tmp/hl_export/HL_*.sql \| wc -l` = 69 |
| T2.72 | Verify setiap file punya CREATE TABLE | `for f in /tmp/hl_export/HL_*.sql; do grep -c "CREATE TABLE" "$f"; done` |
| T2.73 | Verify setiap file punya data (untuk tabel dengan rows > 0) | `grep -c "INSERT" /tmp/hl_export/HL_users.sql` ≥ 1 |

**Catatan penting:** `wrangler d1 export --table=HL_xxx` mengeluarkan:
- `PRAGMA defer_foreign_keys=TRUE;`
- `CREATE TABLE HL_xxx (...)`
- `INSERT INTO "HL_xxx" ...` (semua rows)
- **TIDAK termasuk** CREATE INDEX — index harus di-export terpisah

---

### T3: Export HL_* Indexes
**Risk:** None (read-only)  
**Estimasi:** 5 menit

Index tidak bisa di-export per-tabel dengan `--table`. Strategi: extract index definitions dari full schema dump.

| Step | Aksi | Command |
|------|------|---------|
| T3.1 | Full schema export (no-data) | `wrangler d1 export multi_Ai_db --remote --no-data --output=/tmp/multi_ai_full_schema.sql` |
| T3.2 | Extract only HL_* index definitions | `grep "CREATE.*INDEX.*HL_\|idx.*HL_\|idx_emailOtp" /tmp/multi_ai_full_schema.sql > /tmp/hl_export/HL_indexes.sql` |
| T3.3 | Verify 74 index definitions | `grep -c "CREATE.*INDEX" /tmp/hl_export/HL_indexes.sql` = 74 |

---

### T4: Import Tables ke isehat_db (Batch Order)
**Risk:** Medium (writes ke target)  
**Estimasi:** 30-40 menit (69 table imports × ~30s each)

| Step | Aksi | Expected |
|------|------|----------|
| T4.1-T4.69 | Import setiap tabel sesuai dependency order (Batch 1 → 4) | Success per file |
| T4.70 | Import indexes | `wrangler d1 execute isehat_db --remote --file=/tmp/hl_export/HL_indexes.sql` |
| T4.71 | Verify table count | 69 tabel di target |
| T4.72 | Verify index count | 74 user-defined index di target |

**Fallback jika single-file import gagal:**
- Retry import file tersebut
- Jika tetap gagal, split file menjadi schema-only + data-only

---

### T5: Restore sqlite_sequence
**Risk:** Low  
**Estimasi:** 5 menit  

Export `--table` TIDAK meng-include `sqlite_sequence` restoration. Perlu manual UPDATE.

| Step | Aksi | Command |
|------|------|---------|
| T5.1 | Generate UPDATE statements dari snapshot | Buat script SQL dari `/tmp/hl_source_sequences.txt` |
| T5.2 | Execute UPDATE statements | `wrangler d1 execute isehat_db --remote --file=/tmp/hl_export/HL_restore_sequences.sql` |
| T5.3 | Verify sequences match | Compare source vs target `sqlite_sequence` untuk HL_* |

**T5.1 detail — generate SQL:**

```sql
UPDATE sqlite_sequence SET seq = 5 WHERE name = 'HL_schemaMigrations';
UPDATE sqlite_sequence SET seq = 59 WHERE name = 'HL_systemConfigs';
UPDATE sqlite_sequence SET seq = 45 WHERE name = 'HL_users';
UPDATE sqlite_sequence SET seq = 64 WHERE name = 'HL_sessions';
UPDATE sqlite_sequence SET seq = 33 WHERE name = 'HL_userProfiles';
UPDATE sqlite_sequence SET seq = 30 WHERE name = 'HL_userConsents';
UPDATE sqlite_sequence SET seq = 14 WHERE name = 'HL_deviceMetrics';
UPDATE sqlite_sequence SET seq = 104 WHERE name = 'HL_metricRules';
UPDATE sqlite_sequence SET seq = 15 WHERE name = 'HL_metricCatalog';
UPDATE sqlite_sequence SET seq = 30 WHERE name = 'HL_measurementSessions';
UPDATE sqlite_sequence SET seq = 73 WHERE name = 'HL_measurementValues';
UPDATE sqlite_sequence SET seq = 3 WHERE name = 'HL_measurementAttachments';
UPDATE sqlite_sequence SET seq = 25 WHERE name = 'HL_lastMeasurements';
UPDATE sqlite_sequence SET seq = 1 WHERE name = 'HL_aiRecommendations';
UPDATE sqlite_sequence SET seq = 3 WHERE name = 'HL_alerts';
UPDATE sqlite_sequence SET seq = 35 WHERE name = 'HL_apiRateLimits';
UPDATE sqlite_sequence SET seq = 163 WHERE name = 'HL_auditLogs';
UPDATE sqlite_sequence SET seq = 6 WHERE name = 'HL_badges';
UPDATE sqlite_sequence SET seq = 18 WHERE name = 'HL_configMetadata';
UPDATE sqlite_sequence SET seq = 1 WHERE name = 'HL_cycleSettings';
UPDATE sqlite_sequence SET seq = 15 WHERE name = 'HL_educationCards';
UPDATE sqlite_sequence SET seq = 10 WHERE name = 'HL_emailOtpChallenges';
UPDATE sqlite_sequence SET seq = 3 WHERE name = 'HL_emergencyContacts';
UPDATE sqlite_sequence SET seq = 1 WHERE name = 'HL_familyInvites';
UPDATE sqlite_sequence SET seq = 1 WHERE name = 'HL_familyLinks';
UPDATE sqlite_sequence SET seq = 5 WHERE name = 'HL_fastingSessions';
UPDATE sqlite_sequence SET seq = 11 WHERE name = 'HL_featureFlags';
UPDATE sqlite_sequence SET seq = 1 WHERE name = 'HL_hydrationSettings';
UPDATE sqlite_sequence SET seq = 8 WHERE name = 'HL_hydrationTargets';
UPDATE sqlite_sequence SET seq = 8 WHERE name = 'HL_knowledgeArticles';
UPDATE sqlite_sequence SET seq = 2 WHERE name = 'HL_reminderSettings';
UPDATE sqlite_sequence SET seq = 2 WHERE name = 'HL_reports';
UPDATE sqlite_sequence SET seq = 116 WHERE name = 'HL_rolePermissions';
UPDATE sqlite_sequence SET seq = 7 WHERE name = 'HL_roles';
UPDATE sqlite_sequence SET seq = 42 WHERE name = 'HL_permissions';
UPDATE sqlite_sequence SET seq = 70 WHERE name = 'HL_planFeatures';
UPDATE sqlite_sequence SET seq = 5 WHERE name = 'HL_plans';
UPDATE sqlite_sequence SET seq = 13 WHERE name = 'HL_subscriptions';
UPDATE sqlite_sequence SET seq = 3 WHERE name = 'HL_paymentEvents';
UPDATE sqlite_sequence SET seq = 13 WHERE name = 'HL_userRoles';
UPDATE sqlite_sequence SET seq = 68 WHERE name = 'HL_notifications';
UPDATE sqlite_sequence SET seq = 51 WHERE name = 'HL_oauthStates';
UPDATE sqlite_sequence SET seq = 2 WHERE name = 'HL_oauthAccounts';
UPDATE sqlite_sequence SET seq = 18 WHERE name = 'HL_userEducationProgress';
UPDATE sqlite_sequence SET seq = 3 WHERE name = 'HL_symptomLogs';
UPDATE sqlite_sequence SET seq = 4 WHERE name = 'HL_telegramLinks';
UPDATE sqlite_sequence SET seq = 4 WHERE name = 'HL_medications';
UPDATE sqlite_sequence SET seq = 1 WHERE name = 'HL_medicationSchedules';
UPDATE sqlite_sequence SET seq = 3 WHERE name = 'HL_medicationLogs';
UPDATE sqlite_sequence SET seq = 2 WHERE name = 'HL_waterIntakeLogs';
```

---

### T6: Post-Import Verification
**Risk:** None (read-only)  
**Estimasi:** 15 menit  
**Detail:** Lihat TEST_PLAN terpisah

| Step | Aksi | Referensi |
|------|------|-----------|
| T6.1 | Row count comparison 69 tabel | Test Plan TC-001 ~ TC-069 |
| T6.2 | sqlite_sequence check 52 entries | Test Plan TC-070 |
| T6.3 | FK integrity check | Test Plan TC-071 |
| T6.4 | Index count check | Test Plan TC-072 |
| T6.5 | UNIQUE constraint check | Test Plan TC-073 |
| T6.6 | Data spot-check | Test Plan TC-074 ~ TC-078 |
| T6.7 | Source multi_Ai_db intact | Test Plan TC-079 |

---

### T7: Update Worker Binding
**Risk:** Medium  
**Estimasi:** 3 menit

| Step | Aksi | Detail |
|------|------|--------|
| T7.1 | Update `worker/wrangler.toml` | Sudah diupdate: `database_name = "isehat_db"`, `database_id = "d777e991-ddc9-4072-8522-06cb08a6538c"` |
| T7.2 | Verify typecheck | `cd worker && npx tsc -p tsconfig.json --noEmit` = no errors |
| T7.3 | Local dev test | `cd worker && wrangler dev --local` |

---

### T8: Cleanup & Sign-off
**Risk:** None  
**Estimasi:** 3 menit

| Step | Aksi |
|------|------|
| T8.1 | Verify source multi_Ai_db intact |
| T8.2 | Cleanup temp files: `rm -rf /tmp/hl_export /tmp/multi_ai_db_schema.sql /tmp/hl_source_*.txt` |
| T8.3 | Document completion |

---

## 7. Rollback Plan

| Skenario | Aksi |
|----------|------|
| Import gagal, target partial | Delete `isehat_db`, recreate, re-run dari T2 |
| Row count mismatch | Drop tabel bermasalah di target, re-import |
| FK violation | Drop semua HL_* tabel, re-import dari Batch 1 |
| Worker binding bermasalah | Revert wrangler.toml ke `multi_Ai_db` UUID |
| Source rusak | **TIDAK MUNGKIN** — export hanya membaca |

**Rollback commands:**
```bash
# Undo binding
# database_name = "multi_Ai_db"
# database_id = "b80ca989-6771-427f-a656-c7ab6ffc17ce"

# Nuke target
wrangler d1 delete isehat_db
wrangler d1 create isehat_db
```

---

## 8. Timeline

```
T1 █████ (5 min)
T2       ████████████████████ (15-20 min)
T3                             ████ (5 min)
T4                                  ████████████████████████████████████ (30-40 min)
T5                                                                       ███ (5 min)
T6                                                                            ████████████ (15 min)
T7                                                                                        ███ (3 min)
T8                                                                                           ██ (3 min)
Total: ~80-100 menit
```

---

## 9. Executable Script

Export semua 69 tabel (satu perintah):

```bash
#!/bin/bash
# export_all_hl_tables.sh
set -e
mkdir -p /tmp/hl_export

TABLES=(
  HL_schemaMigrations HL_systemConfigs HL_users HL_devices HL_metricCatalog
  HL_badges HL_plans HL_roles HL_permissions HL_educationCards
  HL_knowledgeArticles HL_featureFlags HL_hydrationSettings HL_oauthStates
  HL_emailOtpChallenges HL_apiRateLimits HL_notificationSettings
  HL_pushSubscriptions HL_vectorDocuments HL_aiContextQueries HL_aiMemoryJobs
  HL_telegramCallbackEvents HL_userProfiles HL_sessions HL_userConsents
  HL_deviceMetrics HL_metricRules HL_rolePermissions HL_userRoles
  HL_planFeatures HL_subscriptions HL_configMetadata HL_reminderSettings
  HL_hydrationTargets HL_userEducationProgress HL_oauthAccounts
  HL_notifications HL_telegramLinks HL_emergencyContacts HL_medications
  HL_fastingSessions HL_streaks HL_auditLogs HL_alerts HL_aiRecommendations
  HL_cycleSettings HL_userBadges HL_familyLinks HL_familyInvites
  HL_symptomLogs HL_paymentEvents HL_usageCounters HL_reports
  HL_patternInsights HL_waterIntakeLogs HL_lastMeasurements HL_cycleLogs
  HL_cycleGuardrailAcknowledgements HL_familyPermissions
  HL_aiRecommendationContexts HL_aiExtractions HL_measurementDrafts
  HL_measurementSessions HL_medicationSchedules HL_medicationLogs
  HL_reportShares HL_measurementValues HL_measurementAttachments
  HL_safetyEvents
)

for t in "${TABLES[@]}"; do
  echo "Exporting $t..."
  wrangler d1 export multi_Ai_db --remote --table="$t" --output="/tmp/hl_export/${t}.sql"
done

echo "Done. $(ls /tmp/hl_export/HL_*.sql | wc -l) files exported."
```

Import semua 69 tabel (dependency order):

```bash
#!/bin/bash
# import_all_hl_tables.sh
set -e

# Batch 1: Root tables
BATCH1=(
  HL_schemaMigrations HL_systemConfigs HL_users HL_devices HL_metricCatalog
  HL_badges HL_plans HL_roles HL_permissions HL_educationCards
  HL_knowledgeArticles HL_featureFlags HL_hydrationSettings HL_oauthStates
  HL_emailOtpChallenges HL_apiRateLimits HL_notificationSettings
  HL_pushSubscriptions HL_vectorDocuments HL_aiContextQueries HL_aiMemoryJobs
  HL_telegramCallbackEvents
)

# Batch 2
BATCH2=(
  HL_userProfiles HL_sessions HL_userConsents HL_deviceMetrics
  HL_metricRules HL_rolePermissions HL_userRoles HL_planFeatures
  HL_subscriptions HL_configMetadata HL_reminderSettings HL_hydrationTargets
  HL_userEducationProgress HL_oauthAccounts HL_notifications HL_telegramLinks
  HL_emergencyContacts HL_medications HL_fastingSessions HL_streaks
  HL_auditLogs HL_alerts HL_aiRecommendations HL_cycleSettings HL_userBadges
  HL_familyLinks HL_familyInvites HL_symptomLogs HL_paymentEvents
  HL_usageCounters HL_reports HL_patternInsights HL_waterIntakeLogs
  HL_lastMeasurements HL_cycleLogs HL_cycleGuardrailAcknowledgements
  HL_familyPermissions HL_aiRecommendationContexts HL_aiExtractions
  HL_measurementDrafts
)

# Batch 3
BATCH3=(
  HL_measurementSessions HL_medicationSchedules HL_medicationLogs
  HL_reportShares
)

# Batch 4
BATCH4=(
  HL_measurementValues HL_measurementAttachments HL_safetyEvents
)

import_batch() {
  local batch_name=$1
  shift
  for t in "$@"; do
    echo "Importing $t..."
    wrangler d1 execute isehat_db --remote --file="/tmp/hl_export/${t}.sql"
  done
}

import_batch "Batch1" "${BATCH1[@]}"
import_batch "Batch2" "${BATCH2[@]}"
import_batch "Batch3" "${BATCH3[@]}"
import_batch "Batch4" "${BATCH4[@]}"

echo "Importing indexes..."
wrangler d1 execute isehat_db --remote --file="/tmp/hl_export/HL_indexes.sql"

echo "Restoring sqlite_sequence..."
wrangler d1 execute isehat_db --remote --file="/tmp/hl_export/HL_restore_sequences.sql"

echo "Done. All HL_* tables imported."
```
