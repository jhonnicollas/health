# Integer ID Migration Plan

Status: EP-P1.1 inventory complete. No schema migration has been applied yet.

Owner requirement:

```text
All table IDs that are UUID/TEXT surrogate IDs must migrate to INTEGER PRIMARY KEY AUTOINCREMENT.
```

Migration principle:

```text
Do not partially migrate.
Do not mix INTEGER PK with TEXT FK.
Keep public tokens, natural codes, hashes, slugs, and config keys as TEXT.
Use shadow tables and mapping tables in EP-P1.2.
```

## Recommended Target Model

Convert surrogate primary keys and their foreign keys:

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
```

Keep stable public/natural identifiers as TEXT:

```text
configKey
deviceCode
metricCode
badgeCode
slug
sessionTokenHash
verificationCodeHash
inviteTokenHash
shareTokenHash
r2Key
endpoint
rateKey
routeKey
windowStart
entityType
entityId
```

`entityId` in `HL_auditLogs` should remain `TEXT` because it is polymorphic and can point to integer IDs, config keys, metric codes, badge codes, and external references.

## Table Inventory

| Table | Current PK | Target PK | FK fields to migrate | TEXT fields to keep |
|---|---|---|---|---|
| `HL_schemaMigrations` | `id TEXT` | Keep TEXT | none | `id`, `migrationName` are migration markers, not app entity UUIDs |
| `HL_systemConfigs` | `configKey TEXT` | Keep TEXT | none | `configKey` natural key |
| `HL_users` | `id TEXT` | INTEGER | referenced by all `userId`, `ownerUserId`, `linkedUserId`, `acknowledgedBy` | `email`, auth fields |
| `HL_sessions` | `id TEXT` | INTEGER | `userId` | `sessionTokenHash` must remain secure TEXT |
| `HL_userProfiles` | `id TEXT` | INTEGER | `userId`; referenced by `profileId` | none |
| `HL_userConsents` | `id TEXT` | INTEGER | `userId` | `consentType`, `version` |
| `HL_devices` | `id TEXT` | INTEGER | none currently by `id` | `deviceCode` stays TEXT natural key |
| `HL_metricCatalog` | `id TEXT` | INTEGER | none currently by `id` | `metricCode` stays TEXT natural key |
| `HL_deviceMetrics` | `id TEXT` | INTEGER | none by integer ID; keeps natural-code FKs | `deviceCode`, `metricCode` stay TEXT |
| `HL_metricRules` | `id TEXT` | INTEGER | referenced by `HL_measurementValues.ruleId` | `metricCode` stays TEXT |
| `HL_measurementDrafts` | `id TEXT` | INTEGER | `userId`, `profileId`; referenced by `HL_aiExtractions.sessionDraftId` | JSON/status fields |
| `HL_measurementSessions` | `id TEXT` | INTEGER | `userId`, `profileId`; referenced by `sessionId` fields | none |
| `HL_measurementValues` | `id TEXT` | INTEGER | `sessionId`, `userId`, `ruleId` | `metricCode`, `deviceCode` stay TEXT |
| `HL_measurementAttachments` | `id TEXT` | INTEGER | `sessionId`, `userId` | `metricCode`, `r2Key` stay TEXT |
| `HL_aiExtractions` | `id TEXT` | INTEGER | `userId`, `sessionDraftId` | `deviceCode`, `metricGroup`, model fields |
| `HL_aiRecommendations` | `id TEXT` | INTEGER | `userId`, `sessionId` | model/safety fields |
| `HL_alerts` | `id TEXT` | INTEGER | `userId`, `sessionId`, `acknowledgedBy` | `metricCode` stays TEXT |
| `HL_notifications` | `id TEXT` | INTEGER | `userId` | channel/type fields |
| `HL_telegramLinks` | `id TEXT` | INTEGER | `userId` | `telegramChatId`, `verificationCodeHash` stay TEXT |
| `HL_pushSubscriptions` | `id TEXT` | INTEGER | `userId` | `endpoint`, `p256dh`, `auth` stay TEXT |
| `HL_notificationSettings` | `id TEXT` | INTEGER | `userId` | none |
| `HL_reminderSettings` | `id TEXT` | INTEGER | `userId` | reminder type/channel fields |
| `HL_familyLinks` | `id TEXT` | INTEGER | `ownerUserId`, `linkedUserId` | role/status fields |
| `HL_familyInvites` | `id TEXT` | INTEGER | `ownerUserId` | `inviteEmail`, `inviteTokenHash` stay TEXT |
| `HL_emergencyContacts` | `id TEXT` | INTEGER | `userId` | encrypted contact fields |
| `HL_medications` | `id TEXT` | INTEGER | `userId`; referenced by `medicationId` | medication text fields |
| `HL_medicationSchedules` | `id TEXT` | INTEGER | `userId`, `medicationId` | schedule fields |
| `HL_medicationLogs` | `id TEXT` | INTEGER | `userId`, `medicationId` | note/status fields |
| `HL_fastingSessions` | `id TEXT` | INTEGER | `userId` | fasting type/status fields |
| `HL_badges` | `id TEXT` | INTEGER | none currently by `id` | `badgeCode` stays TEXT |
| `HL_userBadges` | `id TEXT` | INTEGER | `userId` | `badgeCode` stays TEXT |
| `HL_streaks` | `id TEXT` | INTEGER | `userId` | `streakType` stays TEXT |
| `HL_reports` | `id TEXT` | INTEGER | `userId`; referenced by `reportId` | `r2Key`, report type/status |
| `HL_reportShares` | `id TEXT` | INTEGER | `reportId`, `userId` | `shareTokenHash` stays TEXT |
| `HL_patternInsights` | `id TEXT` | INTEGER | `userId` | `insightType` |
| `HL_knowledgeArticles` | `id TEXT` | INTEGER | none | `slug` stays TEXT |
| `HL_auditLogs` | `id TEXT` | INTEGER | `userId` only | `entityId` stays TEXT polymorphic |
| `HL_apiRateLimits` | `id TEXT` | INTEGER | none | `rateKey`, `routeKey`, `windowStart` stay TEXT |

## Foreign Key Conversion Groups

Convert together in one migration group:

```text
HL_users.id
-> userId fields in every user-owned table
-> HL_familyLinks.ownerUserId
-> HL_familyLinks.linkedUserId
-> HL_familyInvites.ownerUserId
-> HL_alerts.acknowledgedBy
```

```text
HL_userProfiles.id
-> HL_measurementDrafts.profileId
-> HL_measurementSessions.profileId
```

```text
HL_measurementDrafts.id
-> HL_aiExtractions.sessionDraftId
```

```text
HL_measurementSessions.id
-> HL_measurementValues.sessionId
-> HL_measurementAttachments.sessionId
-> HL_aiRecommendations.sessionId
-> HL_alerts.sessionId
```

```text
HL_metricRules.id
-> HL_measurementValues.ruleId
```

```text
HL_medications.id
-> HL_medicationSchedules.medicationId
-> HL_medicationLogs.medicationId
```

```text
HL_reports.id
-> HL_reportShares.reportId
```

## Indexes To Rebuild

Rebuild all indexes after shadow-table copy:

```text
idxHLSessionsUser
idxHLSessionsToken
idxHLProfilesUser
idxHLMeasurementSessionsUserDate
idxHLMeasurementValuesUserMetricDate
idxHLMeasurementValuesSession
idxHLMeasurementAttachmentsSession
idxHLMeasurementAttachmentsUser
idxHLAiExtractionsUserDate
idxHLAiRecommendationsUserDate
idxHLAlertsUserDate
idxHLAlertsSession
idxHLNotificationsUserDate
idxHLNotificationsStatus
idxHLFamilyOwner
idxHLFamilyLinked
idxHLFamilyInvitesToken
idxHLMedicationsUser
idxHLMedicationLogsUserDate
idxHLFastingUserStatus
idxHLReportsUserDate
idxHLReportSharesToken
idxHLPatternInsightsUserDate
idxHLAuditUserDate
idxHLRateLimitsLookup
```

Natural-key indexes remain TEXT-based:

```text
idxHLMetricRulesLookup(metricCode, ...)
idxHLMetricCatalogCode(metricCode)
idxHLDeviceMetricsDevice(deviceCode)
```

## Source Code References To Refactor Later

Backend sources still generate string IDs:

```text
worker/src/index.ts
- createId(prefix) -> `${prefix}_${crypto.randomUUID()}`
- crypto.randomUUID() for measurement sessions, values, attachments, recommendations, audit rows
- TypeScript result types use `id: string`, `userId: string`, `sessionId: string`, `ruleId: string`

worker/src/routes-extra.ts
- createId(prefix) -> `${prefix}_${random}`
- TypeScript result types use string IDs across alerts, streaks, reports, fasting, badges, patterns
```

Frontend types still expect string IDs:

```text
web/src/context/auth.ts
web/src/App.tsx
web/src/pages/alerts/AlertsPage.tsx
web/src/pages/caregiver/CaregiverDashboardPage.tsx
web/src/pages/emergency/EmergencyContactsPage.tsx
web/src/pages/family/FamilyPage.tsx
web/src/pages/fasting/FastingPage.tsx
web/src/pages/kb/KnowledgeBasePage.tsx
web/src/pages/medications/MedicationsPage.tsx
web/src/pages/reminders/RemindersPage.tsx
web/src/pages/dashboard/TodayDashboard.tsx
web/src/components/measurement/DynamicMetricForm.tsx
```

Refactor rule for EP-P1.3 and EP-P1.4:

```text
Internal table PK/FK types become number.
Route params for table IDs parse integer and reject invalid input.
API responses return numbers for internal table IDs.
Auth/session/share tokens stay strings.
```

## Schema/Code Mismatches Found During Inventory

These are blockers to keep in mind for migration SQL/code refactor:

```text
worker/src/routes-extra.ts references HL_familyMembers, but schema.sql defines HL_familyLinks and HL_familyInvites.
```

Do not create `HL_familyMembers` blindly. EP-P1.2/EP-P1.3 must either update code to the existing schema or formally add a migration if product still needs that table.

## EP-P1.2 Migration Design Requirements

Use shadow tables and mapping tables:

```text
1. Export/backup production D1 first.
2. Disable FK checks inside one transaction.
3. Create temporary mapping tables for every converted PK:
   oldTextId TEXT PRIMARY KEY,
   newIntegerId INTEGER NOT NULL UNIQUE
4. Create new shadow HL_* tables with INTEGER PK/FK columns.
5. Insert parent tables first, child tables second.
6. Rebuild indexes.
7. Run PRAGMA foreign_key_check.
8. Swap old tables to backup names and shadow tables to production names.
9. Keep rollback SQL notes.
```

Minimum integrity checks:

```sql
PRAGMA foreign_key_check;
SELECT COUNT(*) FROM oldTable;
SELECT COUNT(*) FROM newTable;
SELECT COUNT(*) FROM child WHERE fk IS NULL AND oldFk IS NOT NULL;
```

## Non-Converted TEXT Justification Summary

Keep these as TEXT because they are not UUID surrogate table IDs:

```text
configKey: admin-editable system config key
deviceCode: stable catalog natural key used in seed/UI/AI prompts
metricCode: stable clinical metric natural key used in rules/reports
badgeCode: stable badge natural key
slug: public knowledge article route key
sessionTokenHash: secure auth token hash
verificationCodeHash: Telegram verification hash
inviteTokenHash: family invite token hash
shareTokenHash: report share token hash
r2Key: R2 object key
endpoint: browser push endpoint URL
rateKey/routeKey/windowStart: rate-limit lookup key
entityId: polymorphic audit pointer
```
