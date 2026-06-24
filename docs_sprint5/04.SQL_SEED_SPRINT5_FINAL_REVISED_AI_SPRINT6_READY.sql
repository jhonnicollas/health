-- HL Health Companion Sprint 5 FINAL FULL seed data
-- Revision: AI Doctor-like Clinical Copilot / AI dokter pribadi is moved to Sprint 6.
-- Sprint 5C seeds only AI Clinical Infrastructure & Vectorize Foundation readiness.
-- File: SQL_SEED_SPRINT5_FINAL.sql
-- Target: Cloudflare D1 / SQLite
-- Run after: 07-schema.sql and SPRINT5_FULL_D1_SCHEMA.sql
-- Idempotent: uses INSERT OR IGNORE / ON CONFLICT DO UPDATE for selected config values.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- Foundation seed: roles
-- ---------------------------------------------------------

INSERT OR IGNORE INTO HL_roles (roleCode, roleName, description, systemRole, active) VALUES
('user', 'User', 'Default application member role.', 1, 1),
('support', 'Support', 'Internal support role with limited access.', 1, 1),
('admin', 'Administrator', 'Operational administrator for master data and configuration.', 1, 1),
('superAdmin', 'Super Administrator', 'Application owner role with full access.', 1, 1),
('billingAdmin', 'Billing Administrator', 'Admin role for plans, subscriptions, and payment events.', 1, 1),
('aiConfigAdmin', 'AI Configuration Administrator', 'Admin role for AI model, endpoint, fallback, Vectorize, and Sprint 6 clinical-copilot readiness configuration.', 1, 1),
('medicalReviewer', 'Medical Content Reviewer', 'Reviewer role for education content, knowledge base, and rule copy.', 1, 1);

-- ---------------------------------------------------------
-- Foundation seed: permissions
-- ---------------------------------------------------------

INSERT OR IGNORE INTO HL_permissions (permissionCode, permissionName, category, description, active) VALUES
('admin.access', 'Access admin shell', 'admin', 'Allows access to /admin shell.', 1),
('admin.users.read', 'Read users', 'admin.users', 'Allows reading user list and user account summaries.', 1),
('admin.users.update', 'Update users', 'admin.users', 'Allows updating user status and role assignment.', 1),
('admin.config.read', 'Read system config', 'admin.config', 'Allows reading non-secret system configuration.', 1),
('admin.config.update', 'Update system config', 'admin.config', 'Allows updating non-secret system configuration.', 1),
('admin.aiConfig.update', 'Update AI configuration', 'admin.ai', 'Allows updating AI model, endpoint, fallback, disclaimer, and Sprint 6 clinical-copilot readiness configuration.', 1),
('admin.metricCatalog.manage', 'Manage metric catalog', 'admin.masterData', 'Allows managing metric catalog.', 1),
('admin.metricRules.manage', 'Manage metric rules', 'admin.masterData', 'Allows managing metric rules and status copy.', 1),
('admin.education.manage', 'Manage education content', 'admin.education', 'Allows managing education cards and knowledge base content.', 1),
('admin.kb.manage', 'Manage knowledge base', 'admin.education', 'Allows managing knowledge base articles.', 1),
('admin.billing.read', 'Read billing data', 'admin.billing', 'Allows reading plans/subscriptions/payment events.', 1),
('admin.billing.manage', 'Manage billing data', 'admin.billing', 'Allows managing plans and manual subscriptions.', 1),
('admin.audit.read', 'Read audit logs', 'admin.audit', 'Allows reading audit logs.', 1),
('admin.support.limitedView', 'Support limited view', 'admin.support', 'Allows limited support access without sensitive health details.', 1),
('admin.support.impersonateLimited', 'Limited support impersonation', 'admin.support', 'Allows audited limited impersonation for support workflows.', 1),

('feature.aiAssistant.use', 'Use AI Assistant', 'feature.ai', 'Allows existing AI Assistant use. Sprint 5 AI cannot diagnose, prescribe, change medication dose, or decide emergency.', 1),
('feature.aiReport.use', 'Use AI Report', 'feature.ai', 'Allows existing AI report analysis with server-side disclaimer and deterministic safety boundaries.', 1),
('feature.doctorPdf.generate', 'Generate Doctor PDF', 'feature.report', 'Allows generating doctor-ready PDF reports.', 1),
('feature.vectorMemory.use', 'Use AI Clinical Infrastructure Memory', 'feature.ai', 'Allows Vectorize-backed AI memory/context infrastructure for Sprint 5 and Sprint 6 readiness.', 1),
('feature.aiClinicalCopilot.use', 'Use AI Clinical Copilot', 'feature.ai', 'Sprint 6 placeholder only. Must remain disabled in Sprint 5 plans/feature flags.', 1),
('feature.telegramReminder.use', 'Use Telegram reminders', 'feature.notification', 'Allows using Telegram reminders.', 1),
('feature.familyDashboard.use', 'Use Family Dashboard', 'feature.family', 'Allows family/caregiver dashboard features.', 1),
('feature.cycleTracking.use', 'Use Cycle Tracking', 'feature.cycle', 'Allows cycle tracking feature.', 1),
('feature.hydration.use', 'Use Hydration Tracker', 'feature.hydration', 'Allows hydration tracker feature.', 1),
('feature.symptomLog.use', 'Use Symptom Log', 'feature.symptom', 'Allows daily symptom logging.', 1),
('feature.advancedHistory.use', 'Use Advanced History', 'feature.history', 'Allows extended/unlimited history.', 1),
('feature.exportFull.use', 'Use Full Export', 'feature.export', 'Allows full CSV/PDF export.', 1),
('feature.medicationReminder.use', 'Use Medication Reminders', 'feature.medication', 'Allows medication reminder features.', 1),
('feature.fastingInsight.use', 'Use Fasting Insight', 'feature.fasting', 'Allows fasting insight/report features.', 1);



-- Final P0 permission consistency patch: permissions used by API contract must exist in seed.
INSERT OR IGNORE INTO HL_permissions (permissionCode, permissionName, category, description, active) VALUES
('admin.roles.read', 'Read roles and permissions', 'admin.roles', 'Allows reading roles, permissions, and assigned role summaries.', 1),
('admin.roles.manage', 'Manage roles and permissions', 'admin.roles', 'Allows creating roles and assigning role permissions.', 1),
('admin.aiMemory.read', 'Read AI Memory status', 'admin.ai', 'Allows reading AI Memory status/counts without exposing raw sensitive context.', 1),
('admin.aiMemory.manage', 'Manage AI Memory jobs', 'admin.ai', 'Allows admin-triggered AI Memory rebuild/delete jobs when audited and authorized.', 1),
('admin.aiClinicalCopilot.manage', 'Manage AI Clinical Copilot readiness', 'admin.ai', 'Allows managing Sprint 6 AI Clinical Copilot readiness settings only. Does not authorize diagnosis, prescription, dosage, or emergency authority in Sprint 5.', 1),
('admin.sensitiveHealth.read', 'Read sensitive health data', 'admin.security', 'Allows audited access to sensitive symptom/cycle/AI context details. Must be restricted.', 1),
('admin.security.read', 'Read security events', 'admin.security', 'Allows reading security/audit/safety event summaries.', 1),
('admin.featureFlags.manage', 'Manage feature flags', 'admin.config', 'Allows enabling and disabling feature flags.', 1);

-- ---------------------------------------------------------
-- Foundation seed: role permissions
-- ---------------------------------------------------------

-- user role: baseline self-use permissions controlled further by plan entitlement.
INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode) VALUES
('user','feature.symptomLog.use'),
('user','feature.hydration.use');

-- support: admin shell + limited support read.
INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode) VALUES
('support','admin.access'),
('support','admin.users.read'),
('support','admin.support.limitedView'),
('support','admin.audit.read');

-- admin: operational master/config permissions except billing full and super sensitive assignment.
INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode) VALUES
('admin','admin.access'),
('admin','admin.users.read'),
('admin','admin.config.read'),
('admin','admin.config.update'),
('admin','admin.metricCatalog.manage'),
('admin','admin.metricRules.manage'),
('admin','admin.education.manage'),
('admin','admin.kb.manage'),
('admin','admin.audit.read');

-- billing admin.
INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode) VALUES
('billingAdmin','admin.access'),
('billingAdmin','admin.users.read'),
('billingAdmin','admin.billing.read'),
('billingAdmin','admin.billing.manage'),
('billingAdmin','admin.audit.read');

-- AI config admin.
INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode) VALUES
('aiConfigAdmin','admin.access'),
('aiConfigAdmin','admin.config.read'),
('aiConfigAdmin','admin.aiConfig.update'),
('aiConfigAdmin','admin.aiMemory.read'),
('aiConfigAdmin','admin.aiMemory.manage'),
('aiConfigAdmin','admin.aiClinicalCopilot.manage'),
('aiConfigAdmin','admin.audit.read');

-- medical reviewer.
INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode) VALUES
('medicalReviewer','admin.access'),
('medicalReviewer','admin.education.manage'),
('medicalReviewer','admin.kb.manage'),
('medicalReviewer','admin.metricRules.manage'),
('medicalReviewer','admin.audit.read');

-- superAdmin gets every seeded permission.
INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode)
SELECT 'superAdmin', permissionCode FROM HL_permissions WHERE active = 1;

-- ---------------------------------------------------------
-- Foundation seed: plans
-- Price is placeholder; adjust from Admin → Plans & Features.
-- ---------------------------------------------------------

INSERT OR IGNORE INTO HL_plans (planCode, planName, billingInterval, durationDays, priceAmount, currency, trialDays, description, active, sortOrder) VALUES
('free', 'Free', 'free', NULL, 0, 'IDR', 0, 'Basic health logging and safety education.', 1, 10),
('premiumMonthly', 'Premium Monthly', 'monthly', 30, 49000, 'IDR', 0, 'Monthly premium health companion features.', 1, 20),
('premiumQuarterly', 'Premium 3 Month', 'quarterly', 90, 129000, 'IDR', 0, 'Three-month premium package.', 1, 30),
('premiumYearly', 'Premium 1 Year', 'yearly', 365, 399000, 'IDR', 0, 'Annual premium package.', 1, 40),
('familyPremium', 'Family Premium', 'monthly', 30, 79000, 'IDR', 0, 'Premium with family/caregiver monitoring.', 1, 50);

-- ---------------------------------------------------------
-- Foundation seed: feature entitlement and quota
-- quotaLimit NULL means unlimited for the enabled feature.
-- ---------------------------------------------------------

-- Free plan.
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow, metadataJson) VALUES
('free','feature.symptomLog.use',1,NULL,NULL,NULL),
('free','feature.hydration.use',1,NULL,NULL,'{"mode":"basic"}'),
('free','feature.aiAssistant.use',1,3,'month',NULL),
('free','feature.aiReport.use',0,0,'month',NULL),
('free','feature.doctorPdf.generate',0,0,'month',NULL),
('free','feature.vectorMemory.use',0,0,'month','{"sprint5Scope":"infrastructureOnly"}'),
('free','feature.aiClinicalCopilot.use',0,0,'month','{"deferredToSprint":6,"enabledInSprint5":false}'),
('free','feature.telegramReminder.use',0,0,'month',NULL),
('free','feature.familyDashboard.use',0,0,'month',NULL),
('free','feature.cycleTracking.use',0,0,'month',NULL),
('free','feature.advancedHistory.use',1,30,'day','{"historyRetentionDays":30}'),
('free','feature.exportFull.use',0,0,'month',NULL),
('free','feature.medicationReminder.use',1,3,'lifetime','{"activeMedicationLimit":3}'),
('free','feature.fastingInsight.use',0,0,'month',NULL);

-- Premium personal plans.
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow, metadataJson)
VALUES
('premiumMonthly','feature.symptomLog.use',1,NULL,NULL,NULL),
('premiumMonthly','feature.hydration.use',1,NULL,NULL,'{"mode":"advanced"}'),
('premiumMonthly','feature.aiAssistant.use',1,100,'month',NULL),
('premiumMonthly','feature.aiReport.use',1,30,'month',NULL),
('premiumMonthly','feature.doctorPdf.generate',1,10,'month',NULL),
('premiumMonthly','feature.vectorMemory.use',1,NULL,NULL,'{"sprint5Scope":"infrastructureOnly","sprint6Ready":true}'),
('premiumMonthly','feature.aiClinicalCopilot.use',0,0,'month','{"deferredToSprint":6,"enabledInSprint5":false}'),
('premiumMonthly','feature.telegramReminder.use',1,NULL,NULL,NULL),
('premiumMonthly','feature.familyDashboard.use',0,0,'month',NULL),
('premiumMonthly','feature.cycleTracking.use',1,NULL,NULL,NULL),
('premiumMonthly','feature.advancedHistory.use',1,NULL,NULL,'{"historyRetentionDays":null}'),
('premiumMonthly','feature.exportFull.use',1,NULL,NULL,NULL),
('premiumMonthly','feature.medicationReminder.use',1,NULL,NULL,NULL),
('premiumMonthly','feature.fastingInsight.use',1,NULL,NULL,NULL),
('premiumQuarterly','feature.symptomLog.use',1,NULL,NULL,NULL),
('premiumQuarterly','feature.hydration.use',1,NULL,NULL,'{"mode":"advanced"}'),
('premiumQuarterly','feature.aiAssistant.use',1,100,'month',NULL),
('premiumQuarterly','feature.aiReport.use',1,30,'month',NULL),
('premiumQuarterly','feature.doctorPdf.generate',1,10,'month',NULL),
('premiumQuarterly','feature.vectorMemory.use',1,NULL,NULL,'{"sprint5Scope":"infrastructureOnly","sprint6Ready":true}'),
('premiumQuarterly','feature.aiClinicalCopilot.use',0,0,'month','{"deferredToSprint":6,"enabledInSprint5":false}'),
('premiumQuarterly','feature.telegramReminder.use',1,NULL,NULL,NULL),
('premiumQuarterly','feature.familyDashboard.use',0,0,'month',NULL),
('premiumQuarterly','feature.cycleTracking.use',1,NULL,NULL,NULL),
('premiumQuarterly','feature.advancedHistory.use',1,NULL,NULL,'{"historyRetentionDays":null}'),
('premiumQuarterly','feature.exportFull.use',1,NULL,NULL,NULL),
('premiumQuarterly','feature.medicationReminder.use',1,NULL,NULL,NULL),
('premiumQuarterly','feature.fastingInsight.use',1,NULL,NULL,NULL),
('premiumYearly','feature.symptomLog.use',1,NULL,NULL,NULL),
('premiumYearly','feature.hydration.use',1,NULL,NULL,'{"mode":"advanced"}'),
('premiumYearly','feature.aiAssistant.use',1,100,'month',NULL),
('premiumYearly','feature.aiReport.use',1,30,'month',NULL),
('premiumYearly','feature.doctorPdf.generate',1,10,'month',NULL),
('premiumYearly','feature.vectorMemory.use',1,NULL,NULL,'{"sprint5Scope":"infrastructureOnly","sprint6Ready":true}'),
('premiumYearly','feature.aiClinicalCopilot.use',0,0,'month','{"deferredToSprint":6,"enabledInSprint5":false}'),
('premiumYearly','feature.telegramReminder.use',1,NULL,NULL,NULL),
('premiumYearly','feature.familyDashboard.use',0,0,'month',NULL),
('premiumYearly','feature.cycleTracking.use',1,NULL,NULL,NULL),
('premiumYearly','feature.advancedHistory.use',1,NULL,NULL,'{"historyRetentionDays":null}'),
('premiumYearly','feature.exportFull.use',1,NULL,NULL,NULL),
('premiumYearly','feature.medicationReminder.use',1,NULL,NULL,NULL),
('premiumYearly','feature.fastingInsight.use',1,NULL,NULL,NULL);

-- Family premium.
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow, metadataJson) VALUES
('familyPremium','feature.symptomLog.use',1,NULL,NULL,NULL),
('familyPremium','feature.hydration.use',1,NULL,NULL,'{"mode":"advanced"}'),
('familyPremium','feature.aiAssistant.use',1,150,'month',NULL),
('familyPremium','feature.aiReport.use',1,50,'month',NULL),
('familyPremium','feature.doctorPdf.generate',1,20,'month',NULL),
('familyPremium','feature.vectorMemory.use',1,NULL,NULL,'{"sprint5Scope":"infrastructureOnly","sprint6Ready":true}'),
('familyPremium','feature.aiClinicalCopilot.use',0,0,'month','{"deferredToSprint":6,"enabledInSprint5":false}'),
('familyPremium','feature.telegramReminder.use',1,NULL,NULL,NULL),
('familyPremium','feature.familyDashboard.use',1,5,'lifetime','{"familyMemberLimit":5}'),
('familyPremium','feature.cycleTracking.use',1,NULL,NULL,NULL),
('familyPremium','feature.advancedHistory.use',1,NULL,NULL,'{"historyRetentionDays":null}'),
('familyPremium','feature.exportFull.use',1,NULL,NULL,NULL),
('familyPremium','feature.medicationReminder.use',1,NULL,NULL,NULL),
('familyPremium','feature.fastingInsight.use',1,NULL,NULL,NULL);

-- ---------------------------------------------------------
-- Feature flags
-- ---------------------------------------------------------

INSERT OR IGNORE INTO HL_featureFlags (flagCode, flagName, description, enabled, metadataJson) VALUES
('sprint5FoundationEnabled', 'Sprint 5 Foundation Enabled', 'Enables RBAC, subscription, and admin core.', 1, NULL),
('googleOAuthEnabled', 'Google OAuth Enabled', 'Allows Google OAuth login/register flow.', 0, NULL),
('dailyHealthHubEnabled', 'Daily Health Hub Enabled', 'Shows Daily Health Hub on dashboard.', 1, NULL),
('educationCardsEnabled', 'Education Cards Enabled', 'Enables health education popup/cards.', 1, NULL),
('symptomLogEnabled', 'Symptom Log Enabled', 'Enables daily symptom log.', 1, NULL),
('hydrationTrackerEnabled', 'Hydration Tracker Enabled', 'Enables hydration tracker.', 1, NULL),
('aiClinicalInfrastructureEnabled', 'AI Clinical Infrastructure Enabled', 'Enables Sprint 5 AI memory, Vectorize metadata, context trace, fallback, and disclaimer infrastructure. Not an AI doctor feature.', 0, '{"scope":"Sprint5C infrastructure only","handoffTo":"Sprint6 AI Clinical Copilot"}'),
('aiMemoryEnabled', 'AI Memory / Vectorize Context Enabled', 'Enables Vectorize-backed AI memory/context retrieval as infrastructure. Not a diagnosis or emergency authority.', 0, '{"scope":"infrastructureOnly"}'),
('aiClinicalCopilotEnabled', 'Sprint 6 AI Clinical Copilot Enabled', 'Sprint 6 placeholder. Must stay disabled in Sprint 5.', 0, '{"deferredToSprint":6,"enabledInSprint5":false}'),
('cycleTrackingEnabled', 'Cycle Tracking Enabled', 'Enables cycle tracking with eligibility guard.', 0, NULL),
('telegramInlineHydrationEnabled', 'Telegram Inline Hydration Enabled', 'Enables Telegram inline hydration quick add.', 0, NULL);

-- ---------------------------------------------------------
-- Sprint 5 system configs
-- Secrets intentionally blank. Set real secrets in deployment/admin config.
-- ---------------------------------------------------------

INSERT OR IGNORE INTO HL_systemConfigs (configKey, configValue, dataType, description) VALUES
('subscriptionEnabled', 'true', 'boolean', 'Global toggle for subscription and entitlement checks.'),
('defaultPlanCode', 'free', 'string', 'Default plan for new users.'),
('billingDefaultProvider', 'manual', 'string', 'Default billing provider adapter: manual, stripe, midtrans, or xendit.'),
('billingGracePeriodDays', '3', 'number', 'Grace period before expired subscription falls back to free.'),

('googleOAuthEnabled', 'false', 'boolean', 'Enables Google OAuth login/register.'),
('googleOAuthClientId', '', 'string', 'Google OAuth client ID. Store securely in env if possible.'),
('googleOAuthClientSecretRef', 'GOOGLE_OAUTH_CLIENT_SECRET', 'string', 'Environment variable name for Google OAuth client secret. Real secret must not be stored in D1.'),
('googleOAuthRedirectUri', '', 'string', 'Google OAuth redirect URI.'),
('googleOAuthAllowedHostedDomain', '', 'string', 'Optional Google hosted domain restriction. Empty means unrestricted.'),

('educationFirstTimeEnabled', 'true', 'boolean', 'Show first-time education guidance per topic.'),
('educationCardDefaultSourceLabel', 'Internal health education copy', 'string', 'Default source label for education cards.'),

('symptomRedFlagKeywords', '["nyeri dada","sesak napas","sesak nafas","kaku kuduk","kelemahan sesisi","pingsan","pandangan gelap","mati rasa"]', 'json', 'Static red flag keyword list for deterministic symptom guardrail.'),
('symptomRedFlagDispatchTimeoutMs', '2000', 'number', 'Target max time for red flag save + emergency notification queue/send best effort.'),

('hydrationDefaultTargetMl', '2000', 'number', 'Default daily hydration target.'),
('hydrationBodyWeightMultiplierMlPerKg', '30', 'number', 'Hydration target multiplier by body weight.'),
('hydrationPregnantMinMl', '2400', 'number', 'Minimum daily hydration target if pregnant.'),
('hydrationLactatingMinMl', '2800', 'number', 'Minimum daily hydration target if lactating.'),
('hydrationFeverThresholdC', '37.5', 'number', 'Temperature threshold for fever hydration adjustment.'),
('hydrationFeverExtraMl', '500', 'number', 'Extra daily hydration target if fever threshold is met.'),
('hydrationOverLimitMl', '5000', 'number', 'Daily total threshold for overhydration warning.'),
('hydrationReminderEnabled', 'true', 'boolean', 'Global hydration reminder toggle.'),
('hydrationOperatingStart', '09:00', 'string', 'Default hydration reminder start time.'),
('hydrationOperatingEnd', '18:00', 'string', 'Default hydration reminder end time.'),

('aiMemoryEnabled', 'false', 'boolean', 'Global toggle for AI Memory/Vectorize retrieval as Sprint 5 infrastructure.'),
('aiClinicalInfrastructureEnabled', 'false', 'boolean', 'Sprint 5C infrastructure toggle for Vectorize/context readiness. This is not an AI doctor runtime.'),
('aiClinicalCopilotRuntimeEnabled', 'false', 'boolean', 'Sprint 6 placeholder. Must remain false in Sprint 5.'),
('aiClinicalCopilotScopeStatus', 'deferred_to_sprint6', 'string', 'Documents that AI Doctor-like Clinical Copilot is deferred to Sprint 6.'),
('aiClinicalCopilotAllowedActionsJson', '["context_index","context_query","context_trace","memory_rebuild","memory_delete","disclaimer_enforcement"]', 'json', 'Allowed AI infrastructure actions in Sprint 5.'),
('aiClinicalCopilotForbiddenActionsJson', '["final_diagnosis","emergency_authority","prescription","medication_dosage_change"]', 'json', 'Forbidden AI actions in Sprint 5; future Sprint 6 must explicitly validate safety boundaries before expanding.'),
('vectorizeIndexName', 'hl-health-memory', 'string', 'Cloudflare Vectorize index name for user health memory.'),
('vectorizeTopK', '8', 'number', 'Default topK for Vectorize context query.'),
('vectorizePurpose', 'sprint6_clinical_copilot_readiness', 'string', 'Purpose marker: prepare Sprint 6 AI Clinical Copilot with isolated context retrieval, not Sprint 5 diagnosis.'),
('vectorizeMinScore', '0.65', 'number', 'Minimum similarity score for context inclusion.'),
('embeddingModel', '@cf/baai/bge-base-en-v1.5', 'string', 'Embedding model used for vector documents.'),
('aiDisclaimerTemplate', '[NamaModelAI] is AI and can make mistakes. Segala keputusan, tindakan medis, dan akibat yang timbul dari informasi ini adalah tanggung jawab Anda sepenuhnya, bukan tanggung jawab pemilik aplikasi maupun aplikasi ini.', 'string', 'Server-side AI liability disclaimer template.'),

('cycleTrackingEnabled', 'false', 'boolean', 'Global cycle tracking toggle.'),
('cycleDefaultLengthDays', '28', 'number', 'Default cycle length.'),
('cycleDefaultPeriodLengthDays', '5', 'number', 'Default period length.'),
('cycleEligibleAgeMin', '15', 'number', 'Minimum age for cycle tracking access.'),
('cycleEligibleAgeMax', '48', 'number', 'Maximum age for cycle tracking access.'),
('cycleIrregularMinDays', '21', 'number', 'Lower bound for cycle irregularity guardrail.'),
('cycleIrregularMaxDays', '35', 'number', 'Upper bound for cycle irregularity guardrail.'),
('cycleGuardrailMessageVersion', 'sprint5.v1', 'string', 'Version for contraception guardrail acknowledgement copy.'),

('telegramWaterWebhookSecretRef', 'TELEGRAM_WATER_WEBHOOK_SECRET', 'string', 'Environment variable name for Telegram water webhook secret. Real secret must not be stored in D1.'),
('telegramWaterQuickAddAmounts', '[200,600]', 'json', 'Allowed Telegram hydration quick add values.'),
('telegramWaterWebhookIdempotencyEnabled', 'true', 'boolean', 'Prevent duplicate Telegram callback processing.');

-- ---------------------------------------------------------
-- Sprint 5 config metadata: classify secrets, refs, and UI policies.
-- Real secrets must live in Cloudflare Secrets/Environment variables, not D1.
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_configMetadata
(configKey, category, isSecret, storageMode, envVarName, masked, readPolicy, writePolicy, description, active)
VALUES
('aiTextApiKey', 'ai', 1, 'env', 'AI_TEXT_API_KEY', 1, 'admin.config.read', 'admin.aiConfig.update', 'Existing AI text API key. D1 must only store empty placeholder or configured marker; real value must be in env.', 1),
('telegramBotToken', 'telegram', 1, 'env', 'TELEGRAM_BOT_TOKEN', 1, 'admin.config.read', 'admin.config.update', 'Existing Telegram bot token. Real value must be stored in Cloudflare Secrets.', 1),
('googleOAuthClientId', 'auth', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.config.update', 'Google OAuth public client ID.', 1),
('googleOAuthClientSecretRef', 'auth', 1, 'env', 'GOOGLE_OAUTH_CLIENT_SECRET', 1, 'admin.config.read', 'admin.config.update', 'Reference to Google OAuth client secret env var.', 1),
('googleOAuthRedirectUri', 'auth', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.config.update', 'Google OAuth redirect URI.', 1),
('telegramWaterWebhookSecretRef', 'telegram', 1, 'env', 'TELEGRAM_WATER_WEBHOOK_SECRET', 1, 'admin.config.read', 'admin.config.update', 'Reference to Telegram water webhook secret env var.', 1),
('billingDefaultProvider', 'billing', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.billing.manage', 'Default billing provider adapter.', 1),
('aiDisclaimerTemplate', 'ai', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.aiConfig.update', 'Server-side AI disclaimer template.', 1),
('vectorizeTopK', 'vectorize', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.aiConfig.update', 'Default topK value for Vectorize context query.', 1),
('vectorizePurpose', 'vectorize', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.aiConfig.update', 'Purpose marker for Sprint 6 AI Clinical Copilot readiness.', 1),
('aiClinicalInfrastructureEnabled', 'ai', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.aiConfig.update', 'Sprint 5C infrastructure toggle only.', 1),
('aiClinicalCopilotRuntimeEnabled', 'feature', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.aiClinicalCopilot.manage', 'Sprint 6 placeholder. Must remain disabled in Sprint 5.', 1),
('aiClinicalCopilotScopeStatus', 'ai', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.aiClinicalCopilot.manage', 'Scope marker that AI Doctor-like Clinical Copilot is deferred to Sprint 6.', 1),
('aiClinicalCopilotAllowedActionsJson', 'ai', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.aiClinicalCopilot.manage', 'Allowed Sprint 5 AI infrastructure actions.', 1),
('aiClinicalCopilotForbiddenActionsJson', 'ai', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.aiClinicalCopilot.manage', 'Forbidden Sprint 5 AI clinical actions.', 1),
('symptomRedFlagKeywords', 'system', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.config.update', 'Deterministic red flag keyword list.', 1),
('cycleGuardrailMessageVersion', 'cycle', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.config.update', 'Version key for cycle contraception guardrail message.', 1),
('hydrationOverLimitMl', 'hydration', 0, 'd1', NULL, 0, 'admin.config.read', 'admin.config.update', 'Daily total threshold for overhydration warning.', 1);


-- ---------------------------------------------------------
-- Non-metric guardrail rule
-- ---------------------------------------------------------
-- Sprint 5 red flag, cycle irregularity, overhydration, and Telegram security events
-- must be stored in HL_safetyEvents, not HL_alerts, because the existing HL_alerts
-- schema is measurement-centric and requires metricCode/finalValue/unit.

-- ---------------------------------------------------------
-- Education cards seed
-- ---------------------------------------------------------

INSERT OR IGNORE INTO HL_educationCards
(topicType, topicCode, title, shortText, whyItMatters, howToUse, normalMeaning, warningMeaning, actionText, redFlagText, sourceLabel, active, sortOrder)
VALUES
('metric','systolic','Apa itu tekanan sistolik?','Tekanan sistolik adalah tekanan saat jantung memompa darah.','Membantu memantau beban kerja jantung dan pembuluh darah.','Duduk tenang 5 menit, lengan sejajar jantung, jangan bicara saat pengukuran.','Nilai dalam rentang normal menunjukkan tekanan saat pompa jantung tidak sedang tinggi.','Nilai tinggi berulang perlu dipantau dan dapat menjadi tanda risiko hipertensi.','Ulangi pengukuran saat istirahat dan catat polanya.','Jika sangat tinggi disertai nyeri dada, sesak, kelemahan satu sisi, atau pingsan, segera cari bantuan medis.','Internal medical education copy',1,10),
('metric','diastolic','Apa itu tekanan diastolik?','Tekanan diastolik adalah tekanan saat jantung beristirahat di antara denyut.','Membantu melihat tekanan dasar di pembuluh darah.','Ukur bersama sistolik menggunakan tensimeter yang terpasang benar.','Rentang normal menunjukkan tekanan dasar pembuluh darah relatif baik.','Nilai tinggi berulang perlu perhatian dan evaluasi gaya hidup/medis.','Catat hasil dan konsultasikan jika sering tinggi.','Jika sangat tinggi disertai gejala berat, cari bantuan medis.','Internal medical education copy',1,20),
('metric','spo2','Apa itu SpO2?','SpO2 adalah perkiraan kadar oksigen dalam darah.','Membantu memantau apakah tubuh mendapat oksigen cukup.','Pastikan jari hangat, diam, dan alat terpasang stabil.','SpO2 normal umumnya menunjukkan oksigenasi cukup.','Nilai rendah atau turun mendadak perlu diperhatikan.','Ulangi pengukuran dan cek posisi alat.','Jika SpO2 rendah disertai sesak, bibir kebiruan, bingung, atau lemas berat, cari bantuan medis.','Internal medical education copy',1,30),
('metric','heartRate','Apa itu denyut jantung?','Denyut jantung menunjukkan jumlah detak per menit.','Membantu melihat respons tubuh terhadap aktivitas, stres, demam, atau kondisi lain.','Ukur saat istirahat untuk pembacaan baseline.','Rentang normal saat istirahat biasanya menunjukkan detak stabil.','Terlalu cepat/lambat berulang atau disertai gejala perlu dipantau.','Cek ulang saat tenang dan catat gejala bila ada.','Jika disertai nyeri dada, sesak, pingsan, atau lemas berat, cari bantuan medis.','Internal medical education copy',1,40),
('metric','glucoseFasting','Apa itu gula darah puasa?','Gula darah puasa adalah kadar gula setelah tidak makan dalam periode tertentu.','Membantu memantau metabolisme glukosa dan risiko diabetes.','Ikuti instruksi puasa yang benar sebelum mengukur.','Nilai normal menunjukkan kontrol gula puasa baik.','Nilai tinggi atau rendah perlu dipantau, terutama jika berulang.','Catat hasil, pola makan, dan konsultasikan jika berulang abnormal.','Jika rendah disertai gemetar, keringat dingin, bingung, atau lemas berat, cari bantuan medis.','Internal medical education copy',1,50),
('metric','bodyTemperature','Apa itu suhu tubuh?','Suhu tubuh membantu mendeteksi demam atau hipotermia.','Berguna untuk melihat infeksi, peradangan, atau perubahan kondisi tubuh.','Ukur sesuai jenis termometer dan lokasi pengukuran.','Rentang normal bervariasi tergantung alat dan lokasi.','Suhu tinggi dapat meningkatkan kebutuhan cairan dan perlu dipantau.','Istirahat, cukup cairan, dan catat gejala penyerta.','Jika demam tinggi, sesak, kaku kuduk, penurunan kesadaran, atau memburuk, cari bantuan medis.','Internal medical education copy',1,60),

('symptom','painScale','Apa itu skala nyeri VAS?','Skala 1–10 membantu menggambarkan seberapa berat keluhan terasa.','Membantu membandingkan perubahan keluhan dari waktu ke waktu.','Pilih angka yang paling mewakili gangguan pada aktivitas Anda.','Skala rendah biasanya keluhan ringan.','Skala tinggi atau memburuk perlu dipantau dan dapat butuh bantuan medis.','Catat lokasi, durasi, dan gejala penyerta.','Jika nyeri dada, sesak, pingsan, kelemahan sesisi, atau pandangan gelap, segera cari bantuan medis.','Internal medical education copy',1,100),
('symptom','redFlag','Apa itu tanda bahaya?','Tanda bahaya adalah keluhan yang perlu perhatian segera.','Sistem memakai keyword deterministic agar tidak menunggu AI untuk kondisi kritis.','Tulis keluhan dengan jelas dan pilih gejala yang sesuai.','Tidak ada red flag tidak berarti pasti aman.','Red flag berarti perlu cek kondisi dan bantuan medis bila berat/memburuk.','Ikuti instruksi emergency UI jika muncul.','Nyeri dada, sesak napas, pingsan, kelemahan satu sisi, kaku kuduk, atau pandangan gelap adalah contoh red flag.','Internal medical education copy',1,110),

('hydration','dailyTarget','Apa itu target hidrasi harian?','Target hidrasi adalah estimasi cairan harian berdasarkan data tubuh.','Membantu menjaga kebiasaan minum dan melihat pola hidrasi.','Tambahkan catatan minum dengan preset atau input manual.','Progress mendekati target menunjukkan catatan cairan cukup untuk hari itu.','Terlalu sedikit atau terlalu banyak perlu diperhatikan.','Minum bertahap dan periksa kembali jika input tampak salah.','Jika setelah minum sangat banyak muncul bingung, mual, sakit kepala berat, atau lemas, cari bantuan medis.','Internal medical education copy',1,200),
('hydration','overhydration','Apa itu peringatan terlalu banyak minum?','Minum terlalu banyak air dalam waktu singkat bisa berbahaya.','Peringatan ini membantu mencegah salah input atau intake berlebihan.','Periksa kembali jumlah yang dimasukkan.','Total wajar tidak memicu warning.','Total di atas batas harian akan menampilkan warning.','Koreksi input jika salah atau hentikan pencatatan berlebihan.','Jika ada bingung, mual berat, kejang, sakit kepala berat, atau lemas setelah minum sangat banyak, cari bantuan medis.','Internal medical education copy',1,210),

('cycle','cycleTracking','Apa itu pelacakan siklus?','Pelacakan siklus membantu mencatat haid, gejala, mood, dan pola bulanan.','Data ini dapat membantu memahami hubungan siklus dengan keluhan atau kondisi harian.','Isi tanggal haid terakhir, panjang siklus, dan log harian.','Prediksi adalah perkiraan, bukan kepastian.','Siklus tidak teratur perlu perhatian dan prediksi dapat dijeda.','Gunakan data sebagai catatan pribadi dan diskusikan dengan tenaga medis jika perlu.','Metode kalender tidak memberikan perlindungan 100% terhadap kehamilan. Gunakan kontrasepsi tambahan bila ingin mencegah kehamilan.','Internal medical education copy',1,300),
('cycle','contraceptionGuardrail','Peringatan metode kalender','Kalender siklus bukan alat kontrasepsi utama.','Prediksi bisa meleset karena stres, sakit, obat, tidur, menyusui, atau siklus tidak teratur.','Baca guardrail sebelum memakai informasi kalender untuk keputusan seksual.','Tidak ada hari yang bisa dijamin 100% aman dari kehamilan.','Unprotected sex tetap memiliki risiko kehamilan.','Gunakan kontrasepsi tambahan bila ingin mencegah kehamilan.','Sperma dapat bertahan hidup hingga beberapa hari; konsultasikan ke tenaga medis untuk pilihan kontrasepsi.','Internal medical education copy',1,310),

('ai','contextTrace','Apa itu konteks AI?','Konteks AI adalah catatan relevan yang dipakai AI untuk menyusun jawaban.','Membantu AI menjawab lebih sesuai riwayat Anda tanpa membuka data lintas user.','Buka context trace untuk melihat sumber data yang dipakai.','Context trace bukan bukti diagnosis.','Jika data kurang, AI harus menyatakan data belum cukup.','Gunakan sebagai bahan diskusi, bukan keputusan medis tunggal.','Untuk gejala berat atau red flag, ikuti guardrail medis dan cari bantuan.','Internal AI safety copy — Sprint 5 infrastructure only',1,400),
('ai','dataSufficiencyScore','Apa itu Data Sufficiency Score?','Skor ini menunjukkan kecukupan data untuk membaca pola, bukan diagnosis.','Membantu membedakan analisis dengan data cukup dan data terbatas.','Baca scoreReason di bawah skor.','Skor tinggi berarti data lebih lengkap, bukan berarti diagnosis pasti.','Skor rendah berarti data belum cukup atau pola belum kuat.','Tambahkan data rutin agar analisis pola lebih stabil.','Keputusan medis tetap harus dikonsultasikan dengan tenaga medis.','Internal AI safety copy — Sprint 5 infrastructure only',1,410),
('ai','sprint6ClinicalCopilot','Apa rencana AI Clinical Copilot Sprint 6?','Sprint 5 hanya menyiapkan pondasi memori, konteks, audit, dan safety boundary.','Pondasi ini disiapkan agar Sprint 6 dapat membangun wawancara gejala adaptif, risk explanation, dan doctor handoff yang lebih kuat.','Fitur AI dokter pribadi tidak aktif di Sprint 5.','AI Sprint 5 tidak membuat diagnosis, resep, perubahan dosis, atau keputusan emergency.','AI Clinical Copilot baru dapat dipertimbangkan di Sprint 6 setelah safety, evaluasi, dan guardrail diperluas.','Gunakan AI Sprint 5 sebagai alat konteks dan ringkasan, bukan dokter final.','Jika ada red flag, ikuti emergency blocking UI dan cari bantuan medis.','Internal AI safety copy — Sprint 6 handoff',1,420);

-- ---------------------------------------------------------
-- Family permission codes for Sprint 5 sensitive data.
-- These are permissionCode values stored in HL_familyPermissions.
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_permissions (permissionCode, permissionName, category, description, active) VALUES
('family.cycle.read', 'Family can view cycle data', 'family', 'Explicit permission for caregiver/family to view cycle data.', 1),
('family.symptom.read', 'Family can view symptom data', 'family', 'Explicit permission for caregiver/family to view symptom data.', 1),
('family.hydration.read', 'Family can view hydration data', 'family', 'Explicit permission for caregiver/family to view hydration data.', 1),
('family.aiReport.read', 'Family can view AI report', 'family', 'Explicit permission for caregiver/family to view AI report outputs.', 1),
('family.aiClinicalCopilot.read', 'Family can view AI Clinical Copilot summary', 'family', 'Sprint 6 placeholder permission. Must not expose raw sensitive context without explicit owner permission and audit.', 1);

-- Super admin also receives these newly inserted family permissions.
INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode)
SELECT 'superAdmin', permissionCode FROM HL_permissions WHERE permissionCode LIKE 'family.%';


-- Ensure superAdmin receives every final seeded permission, including late-added API-contract permissions.
INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode)
SELECT 'superAdmin', permissionCode FROM HL_permissions WHERE active = 1;

INSERT OR IGNORE INTO HL_schemaMigrations (migrationName)
VALUES ('20260624Sprint5FullReleaseProgramSeedFinalAiSprint6Ready');
