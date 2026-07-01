-- Migration 009: Production config — 9router endpoint, model, dan fallback
-- Berdasarkan credentials dari user (2026-07-01)

INSERT OR IGNORE INTO HL_systemConfigs (configKey, configValue, dataType, description)
VALUES 
  ('9router.baseUrl', 'https://9router.krpmerch.biz.id/v1', 'string', '9router API base URL (production)'),
  ('9router.defaultModel', 'oc/deepseek-v4-flash-free', 'string', 'Default 9router model (production)');

-- Enable direct 9router fallback (AI Gateway mungkin belum di-setup)
UPDATE HL_systemConfigs SET configValue = 'true'
WHERE configKey = 'aiGateway.directFallback.enabled';

INSERT OR IGNORE INTO HL_schemaMigrations (migrationName, appliedAt) VALUES ('009_production_config', datetime('now'));
