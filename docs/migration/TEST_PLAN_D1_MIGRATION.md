# TEST PLAN: D1 Database Migration — iSehat Tables
## multi_Ai_db → isehat_db (Hanya tabel HL_*)

**Tanggal:** 2026-06-27  
**Versi:** 2.0  
**Source:** `multi_Ai_db` (b80ca989)  
**Target:** `isehat_db` (d777e991)  
**Scope:** 69 tabel HL_*, 74 index, 52 sqlite_sequence entries

---

## 1. Tujuan Pengujian

1. Semua 69 tabel HL_* berhasil dicopy ke target
2. Semua data tersalin tanpa kehilangan baris
3. AUTOINCREMENT sequence values terjaga
4. Foreign key integrity valid
5. Index 74 user-defined terbuat
6. UNIQUE constraints ter-copy
7. Data sampling valid (bukan NULL/corrupt)
8. Source `multi_Ai_db` tetap utuh

---

## 2. Lingkup

### In Scope
- Row count: 69 tabel
- Schema comparison
- sqlite_sequence: 52 entries
- FK integrity
- Index existence
- UNIQUE constraint
- Data spot-check

### Out of Scope
- Performance test
- Application functional test
- Security test
- Stress test

---

## 3. Test Environment

| Item | Value |
|------|-------|
| Tool | `wrangler` CLI (v4.98+) |
| Source | `multi_Ai_db` — remote |
| Target | `isehat_db` — remote |
| Method | `wrangler d1 execute --remote --command` |

---

## 4. Test Cases

### 4.1 Row Count Verification (TC-001 ~ TC-069)

| TC | Tabel | Source Rows | Target Expected | Status |
|----|-------|-------------|-----------------|--------|
| TC-001 | HL_schemaMigrations | 5 | 5 | ☐ |
| TC-002 | HL_systemConfigs | 59 | 59 | ☐ |
| TC-003 | HL_users | 40 | 40 | ☐ |
| TC-004 | HL_sessions | 59 | 59 | ☐ |
| TC-005 | HL_userProfiles | 28 | 28 | ☐ |
| TC-006 | HL_userConsents | 30 | 30 | ☐ |
| TC-007 | HL_devices | 6 | 6 | ☐ |
| TC-008 | HL_metricCatalog | 15 | 15 | ☐ |
| TC-009 | HL_deviceMetrics | 14 | 14 | ☐ |
| TC-010 | HL_metricRules | 80 | 80 | ☐ |
| TC-011 | HL_measurementDrafts | 0 | 0 | ☐ |
| TC-012 | HL_measurementSessions | 28 | 28 | ☐ |
| TC-013 | HL_measurementValues | 71 | 71 | ☐ |
| TC-014 | HL_measurementAttachments | 3 | 3 | ☐ |
| TC-015 | HL_lastMeasurements | 20 | 20 | ☐ |
| TC-016 | HL_aiExtractions | 0 | 0 | ☐ |
| TC-017 | HL_aiRecommendations | 1 | 1 | ☐ |
| TC-018 | HL_alerts | 3 | 3 | ☐ |
| TC-019 | HL_notifications | 68 | 68 | ☐ |
| TC-020 | HL_telegramLinks | 4 | 4 | ☐ |
| TC-021 | HL_pushSubscriptions | 0 | 0 | ☐ |
| TC-022 | HL_notificationSettings | 0 | 0 | ☐ |
| TC-023 | HL_reminderSettings | 2 | 2 | ☐ |
| TC-024 | HL_familyLinks | 1 | 1 | ☐ |
| TC-025 | HL_familyInvites | 1 | 1 | ☐ |
| TC-026 | HL_emergencyContacts | 2 | 2 | ☐ |
| TC-027 | HL_medications | 3 | 3 | ☐ |
| TC-028 | HL_medicationSchedules | 0 | 0 | ☐ |
| TC-029 | HL_medicationLogs | 2 | 2 | ☐ |
| TC-030 | HL_fastingSessions | 5 | 5 | ☐ |
| TC-031 | HL_badges | 6 | 6 | ☐ |
| TC-032 | HL_userBadges | 0 | 0 | ☐ |
| TC-033 | HL_streaks | 9 | 9 | ☐ |
| TC-034 | HL_reports | 2 | 2 | ☐ |
| TC-035 | HL_reportShares | 0 | 0 | ☐ |
| TC-036 | HL_patternInsights | 0 | 0 | ☐ |
| TC-037 | HL_knowledgeArticles | 8 | 8 | ☐ |
| TC-038 | HL_auditLogs | 163 | 163 | ☐ |
| TC-039 | HL_apiRateLimits | 35 | 35 | ☐ |
| TC-040 | HL_roles | 7 | 7 | ☐ |
| TC-041 | HL_permissions | 42 | 42 | ☐ |
| TC-042 | HL_rolePermissions | 74 | 74 | ☐ |
| TC-043 | HL_userRoles | 8 | 8 | ☐ |
| TC-044 | HL_plans | 5 | 5 | ☐ |
| TC-045 | HL_planFeatures | 70 | 70 | ☐ |
| TC-046 | HL_subscriptions | 13 | 13 | ☐ |
| TC-047 | HL_paymentEvents | 3 | 3 | ☐ |
| TC-048 | HL_usageCounters | 0 | 0 | ☐ |
| TC-049 | HL_featureFlags | 11 | 11 | ☐ |
| TC-050 | HL_configMetadata | 18 | 18 | ☐ |
| TC-051 | HL_oauthAccounts | 2 | 2 | ☐ |
| TC-052 | HL_oauthStates | 51 | 51 | ☐ |
| TC-053 | HL_educationCards | 15 | 15 | ☐ |
| TC-054 | HL_userEducationProgress | 18 | 18 | ☐ |
| TC-055 | HL_symptomLogs | 3 | 3 | ☐ |
| TC-056 | HL_safetyEvents | 0 | 0 | ☐ |
| TC-057 | HL_hydrationSettings | 1 | 1 | ☐ |
| TC-058 | HL_hydrationTargets | 7 | 7 | ☐ |
| TC-059 | HL_waterIntakeLogs | 2 | 2 | ☐ |
| TC-060 | HL_vectorDocuments | 0 | 0 | ☐ |
| TC-061 | HL_aiContextQueries | 0 | 0 | ☐ |
| TC-062 | HL_aiRecommendationContexts | 0 | 0 | ☐ |
| TC-063 | HL_aiMemoryJobs | 0 | 0 | ☐ |
| TC-064 | HL_cycleSettings | 1 | 1 | ☐ |
| TC-065 | HL_cycleLogs | 0 | 0 | ☐ |
| TC-066 | HL_cycleGuardrailAcknowledgements | 0 | 0 | ☐ |
| TC-067 | HL_familyPermissions | 0 | 0 | ☐ |
| TC-068 | HL_telegramCallbackEvents | 0 | 0 | ☐ |
| TC-069 | HL_emailOtpChallenges | 10 | 10 | ☐ |

**Automated Script:**

```bash
#!/bin/bash
# run_hl_rowcount_check.sh
TABLES=(
  HL_schemaMigrations HL_systemConfigs HL_users HL_sessions
  HL_userProfiles HL_userConsents HL_devices HL_metricCatalog
  HL_deviceMetrics HL_metricRules HL_measurementDrafts
  HL_measurementSessions HL_measurementValues HL_measurementAttachments
  HL_lastMeasurements HL_aiExtractions HL_aiRecommendations
  HL_alerts HL_notifications HL_telegramLinks HL_pushSubscriptions
  HL_notificationSettings HL_reminderSettings HL_familyLinks
  HL_familyInvites HL_emergencyContacts HL_medications
  HL_medicationSchedules HL_medicationLogs HL_fastingSessions
  HL_badges HL_userBadges HL_streaks HL_reports HL_reportShares
  HL_patternInsights HL_knowledgeArticles HL_auditLogs
  HL_apiRateLimits HL_roles HL_permissions HL_rolePermissions
  HL_userRoles HL_plans HL_planFeatures HL_subscriptions
  HL_paymentEvents HL_usageCounters HL_featureFlags HL_configMetadata
  HL_oauthAccounts HL_oauthStates HL_educationCards
  HL_userEducationProgress HL_symptomLogs HL_safetyEvents
  HL_hydrationSettings HL_hydrationTargets HL_waterIntakeLogs
  HL_vectorDocuments HL_aiContextQueries HL_aiRecommendationContexts
  HL_aiMemoryJobs HL_cycleSettings HL_cycleLogs
  HL_cycleGuardrailAcknowledgements HL_familyPermissions
  HL_telegramCallbackEvents HL_emailOtpChallenges
)

PASS=0; FAIL=0
for t in "${TABLES[@]}"; do
  SRC=$(wrangler d1 execute multi_Ai_db --remote \
    --command="SELECT COUNT(*) as c FROM $t;" 2>/dev/null \
    | grep '"c"' | grep -o '[0-9]*' | head -1)
  TGT=$(wrangler d1 execute isehat_db --remote \
    --command="SELECT COUNT(*) as c FROM $t;" 2>/dev/null \
    | grep '"c"' | grep -o '[0-9]*' | head -1)
  if [ "$SRC" = "$TGT" ]; then
    echo "PASS  $t: source=$SRC target=$TGT"; PASS=$((PASS+1))
  else
    echo "FAIL  $t: source=$SRC target=$TGT <<< MISMATCH"; FAIL=$((FAIL+1))
  fi
done
echo ""; echo "TOTAL: ${#TABLES[@]} | PASS: $PASS | FAIL: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
```

---

### 4.2 sqlite_sequence Verification (TC-070)

**Command (source):**
```bash
wrangler d1 execute multi_Ai_db --remote \
  --command="SELECT * FROM sqlite_sequence WHERE name LIKE 'HL_%' ORDER BY name;"
```

**Command (target):**
```bash
wrangler d1 execute isehat_db --remote \
  --command="SELECT * FROM sqlite_sequence WHERE name LIKE 'HL_%' ORDER BY name;"
```

**Pass criteria:** 52 entries, semua `name` dan `seq` identik.

| sqlite_sequence Entry | Expected seq |
|-----------------------|-------------|
| HL_aiRecommendations | 1 |
| HL_alerts | 3 |
| HL_apiRateLimits | 35 |
| HL_auditLogs | 163 |
| HL_badges | 6 |
| HL_configMetadata | 18 |
| HL_cycleSettings | 1 |
| HL_deviceMetrics | 14 |
| HL_devices | 6 |
| HL_educationCards | 15 |
| HL_emailOtpChallenges | 10 |
| HL_emergencyContacts | 3 |
| HL_familyInvites | 1 |
| HL_familyLinks | 1 |
| HL_fastingSessions | 5 |
| HL_featureFlags | 11 |
| HL_hydrationSettings | 1 |
| HL_hydrationTargets | 8 |
| HL_knowledgeArticles | 8 |
| HL_lastMeasurements | 25 |
| HL_measurementAttachments | 3 |
| HL_measurementSessions | 30 |
| HL_measurementValues | 73 |
| HL_medicationLogs | 3 |
| HL_medicationSchedules | 1 |
| HL_medications | 4 |
| HL_metricCatalog | 15 |
| HL_metricRules | 104 |
| HL_notifications | 68 |
| HL_oauthAccounts | 2 |
| HL_oauthStates | 51 |
| HL_paymentEvents | 3 |
| HL_permissions | 42 |
| HL_planFeatures | 70 |
| HL_plans | 5 |
| HL_reminderSettings | 2 |
| HL_reports | 2 |
| HL_rolePermissions | 116 |
| HL_roles | 7 |
| HL_schemaMigrations | 5 |
| HL_sessions | 64 |
| HL_streaks | 9 |
| HL_subscriptions | 13 |
| HL_symptomLogs | 3 |
| HL_telegramLinks | 4 |
| HL_userConsents | 30 |
| HL_userEducationProgress | 18 |
| HL_userProfiles | 33 |
| HL_userRoles | 13 |
| HL_users | 45 |
| HL_waterIntakeLogs | 2 |

---

### 4.3 Foreign Key Integrity (TC-071)

```bash
wrangler d1 execute isehat_db --remote --command="PRAGMA foreign_key_check;"
```

**Pass criteria:** 0 results.

**Verify FK enabled:**
```bash
wrangler d1 execute isehat_db --remote --command="PRAGMA foreign_keys;"
```
Expected: 1

---

### 4.4 Index Count (TC-072)

```bash
# Source
wrangler d1 execute multi_Ai_db --remote \
  --command="SELECT COUNT(*) as c FROM sqlite_master WHERE type='index' AND (name LIKE '%HL_%' OR name LIKE 'idxHL%');"

# Target
wrangler d1 execute isehat_db --remote \
  --command="SELECT COUNT(*) as c FROM sqlite_master WHERE type='index' AND (name LIKE '%HL_%' OR name LIKE 'idxHL%' OR name LIKE 'idx_emailOtp%');"
```

**Pass criteria:** Sama, ~74 user-defined + autoindex count match.

---

### 4.5 UNIQUE Constraint Check (TC-073)

**Key tables with UNIQUE:**

| Tabel | UNIQUE Column(s) |
|-------|-------------------|
| HL_users | email |
| HL_sessions | sessionTokenHash |
| HL_systemConfigs | configKey |
| HL_devices | deviceCode |
| HL_metricCatalog | metricCode |
| HL_badges | badgeCode |
| HL_roles | roleCode |
| HL_permissions | permissionCode |
| HL_plans | planCode |
| HL_featureFlags | flagCode |
| HL_configMetadata | configKey, category+configKey |
| HL_oauthAccounts | userId+provider |
| HL_educationCards | topicType+topicCode |
| HL_emailOtpChallenges | challengeToken |
| HL_familyInvites | inviteTokenHash |
| HL_reportShares | shareTokenHash |

```bash
wrangler d1 execute isehat_db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'sqlite_autoindex%HL_%' ORDER BY name;"
```

**Pass criteria:** Autoindex entries exist for all UNIQUE-constrained tables.

---

### 4.6 Data Spot-Check (TC-074 ~ TC-078)

| TC | Tabel | Query | Expected |
|----|-------|-------|----------|
| TC-074 | HL_users | `SELECT id, email, displayName FROM HL_users LIMIT 3;` | 3 rows, no NULLs in id/email |
| TC-075 | HL_measurementValues | `SELECT id, userId, metricCode, measuredAt FROM HL_measurementValues LIMIT 3;` | 3 rows, no NULLs in id/userId/metricCode |
| TC-076 | HL_auditLogs | `SELECT id, userId, action FROM HL_auditLogs LIMIT 3;` | 3 rows, no NULLs in id/action |
| TC-077 | HL_sessions | `SELECT id, userId, sessionTokenHash FROM HL_sessions LIMIT 3;` | 3 rows, no NULLs |
| TC-078 | HL_rolePermissions | `SELECT id, roleCode, permissionCode FROM HL_rolePermissions LIMIT 5;` | 5 rows, no NULLs |

**Cross-check — source vs target first user:**
```bash
# Source
wrangler d1 execute multi_Ai_db --remote \
  --command="SELECT id, email, displayName, authProvider, active FROM HL_users WHERE id = 1;"

# Target
wrangler d1 execute isehat_db --remote \
  --command="SELECT id, email, displayName, authProvider, active FROM HL_users WHERE id = 1;"
```

**Pass criteria:** Output identik.

---

### 4.7 Source Integrity Check (TC-079)

```bash
wrangler d1 execute multi_Ai_db --remote \
  --command="SELECT COUNT(*) as c FROM HL_users;"
```

**Pass criteria:** 40 (sama persis sebelum migrasi).

---

### 4.8 No Cross-Contamination Check (TC-080)

Verify that non-HL tables did NOT get copied to target:

```bash
wrangler d1 execute isehat_db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'HL_%' AND name NOT IN ('_cf_KV','sqlite_sequence');"
```

**Pass criteria:** 0 results. Hanya tabel HL_* yang ada di target.

---

## 5. Test Execution Order

```
Phase 1: Structural
  TC-072  Index count
  TC-073  UNIQUE constraint check
  TC-080  No cross-contamination

Phase 2: Data Integrity
  TC-001 ~ TC-069  Row count ALL tables
  TC-070  sqlite_sequence
  TC-071  FK integrity

Phase 3: Data Quality
  TC-074 ~ TC-078  Spot-check / sampling

Phase 4: Source Integrity
  TC-079  Source unchanged

Phase 5: Sign-off
  All PASS → migration SUCCESS
  Any FAIL → investigate + rollback
```

---

## 6. Pass/Fail Criteria

| Kategori | Kriteria | Action |
|----------|----------|--------|
| PASS | Semua TC lulus | Migrasi sukses |
| FAIL (structural) | Schema/index/UNIQUE mismatch | Drop target, re-import |
| FAIL (data) | Row count mismatch | Drop tabel bermasalah, re-import |
| FAIL (FK) | FK violation | Drop semua HL_* tabel, re-import |
| FAIL (sequence) | sqlite_sequence mismatch | Manual UPDATE |
| FAIL (contamination) | Non-HL tabel di target | Nuke target, re-do |
| FAIL (source) | Source berubah | **TIDAK MUNGKIN** — export read-only |

---

## 7. Test Execution Log Template

```
====================================================================
D1 MIGRATION TEST EXECUTION LOG (iSehat HL_* tables)
Date: ___________
Tester: ___________
====================================================================

Phase 1: Structural
  TC-072 Index count:        [PASS/FAIL] source=___ target=___
  TC-073 UNIQUE check:       [PASS/FAIL] autoindexes=___
  TC-080 No contamination:   [PASS/FAIL] non-HL tables=___

Phase 2: Data Integrity
  TC-001~069 Row counts:     [PASS/FAIL] passed=___/69
  TC-070 Sequences:          [PASS/FAIL] matched=___/52
  TC-071 FK check:           [PASS/FAIL] violations=___

Phase 3: Data Quality
  TC-074 HL_users:            [PASS/FAIL]
  TC-075 HL_measurementValues:[PASS/FAIL]
  TC-076 HL_auditLogs:        [PASS/FAIL]
  TC-077 HL_sessions:         [PASS/FAIL]
  TC-078 HL_rolePermissions:  [PASS/FAIL]

Phase 4: Source Integrity
  TC-079 Source unchanged:   [PASS/FAIL] HL_users=40?

FINAL VERDICT: [PASS / FAIL]
====================================================================
```

---

## 8. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| --table export misses indexes | Confirmed (known) | Medium | Separate index export + import |
| Per-table import slower than bulk | High | Low | Acceptable; ~30-40 min total |
| sqlite_sequence not in per-table export | Confirmed | Medium | Manual UPDATE statements |
| D1 rate limit on many exports | Low | Medium | Add 2s delay between exports |
| foreign_keys pragma not set on target | Low | High | Pragma in export file handles it |
| Non-HL tables accidentally copied | Very Low | High | TC-080 catches it |
