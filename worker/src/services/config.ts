export type ConfigEnv = Record<string, unknown>

export type ConfigRow = {
  configKey: string
  configValue: string
  dataType: string
  description: string | null
  updatedAt?: string | null
}

export type ConfigMetadataRow = {
  configKey: string
  category: string
  isSecret: number
  storageMode: 'd1' | 'env' | 'secret' | 'reference'
  envVarName: string | null
  masked: number
  readPolicy: string
  writePolicy: string
  description: string | null
  active: number
}

export type SafeConfigResponse = {
  configKey: string
  configValue: string
  dataType: string
  description: string | null
  updatedAt?: string | null
  isSecret: boolean
  configured: boolean
  masked: boolean
  storageMode: string
  envVarName: string | null
  secretValueReturned: false
}

export type ConfigUpdateInput = {
  configValue?: string
  configured?: boolean
  envVarName?: string
}

const SECRET_KEY_PATTERN = /(secret|token|api[-_]?key|apikey|password|webhook.*secret)/i
const ENV_VAR_PATTERN = /^[A-Z][A-Z0-9_]{1,120}$/

const DEFAULT_SECRET_ENV_NAMES: Record<string, string> = {
  aiTextApiKey: 'AI_TEXT_API_KEY',
  telegramBotToken: 'TELEGRAM_BOT_TOKEN',
  googleOAuthClientSecretRef: 'GOOGLE_OAUTH_CLIENT_SECRET',
  telegramWaterWebhookSecretRef: 'TELEGRAM_WATER_WEBHOOK_SECRET'
}

export function isSensitiveConfigKey(configKey: string): boolean {
  return SECRET_KEY_PATTERN.test(configKey)
}

export function defaultSecretEnvVarName(configKey: string): string | null {
  return DEFAULT_SECRET_ENV_NAMES[configKey] ?? null
}

function envString(env: ConfigEnv, key: string | null | undefined): string {
  if (!key) return ''
  const value = env[key]
  return typeof value === 'string' ? value : ''
}

function isConfiguredMarker(value: string | null | undefined): boolean {
  return value === 'configured' || value === 'true' || value === '1'
}

function isSecret(row: ConfigRow, metadata: ConfigMetadataRow | null): boolean {
  return metadata?.isSecret === 1 || isSensitiveConfigKey(row.configKey)
}

export function formatConfigForResponse(row: ConfigRow, metadata: ConfigMetadataRow | null, env: ConfigEnv): SafeConfigResponse {
  const secret = isSecret(row, metadata)
  const envVarName = metadata?.envVarName ?? defaultSecretEnvVarName(row.configKey)
  const configured = secret
    ? Boolean(envString(env, envVarName)) || isConfiguredMarker(row.configValue)
    : row.configValue !== ''

  return {
    configKey: row.configKey,
    configValue: secret ? '' : row.configValue,
    dataType: row.dataType,
    description: row.description,
    updatedAt: row.updatedAt ?? null,
    isSecret: secret,
    configured,
    masked: secret || metadata?.masked === 1,
    storageMode: metadata?.storageMode ?? (secret ? 'env' : 'd1'),
    envVarName,
    secretValueReturned: false
  }
}

async function getMetadata(db: D1Database, configKey: string): Promise<ConfigMetadataRow | null> {
  try {
    return await db.prepare(
      `SELECT configKey, category, isSecret, storageMode, envVarName, masked, readPolicy, writePolicy, description, active
       FROM HL_configMetadata WHERE configKey = ? LIMIT 1`
    ).bind(configKey).first<ConfigMetadataRow>()
  } catch {
    return null
  }
}

async function listMetadata(db: D1Database): Promise<Map<string, ConfigMetadataRow>> {
  try {
    const rows = await db.prepare(
      `SELECT configKey, category, isSecret, storageMode, envVarName, masked, readPolicy, writePolicy, description, active
       FROM HL_configMetadata`
    ).all<ConfigMetadataRow>()
    return new Map((rows.results || []).map((row) => [row.configKey, row]))
  } catch {
    return new Map()
  }
}

async function upsertSecretMetadata(db: D1Database, configKey: string, envVarName: string | null): Promise<void> {
  await db.prepare(
    `INSERT INTO HL_configMetadata
      (configKey, category, isSecret, storageMode, envVarName, masked, readPolicy, writePolicy, description, active, updatedAt)
     VALUES (?, 'security', 1, 'env', ?, 1, 'admin.config.read', 'admin.config.update', 'Secret config reference. Plaintext value must live in Cloudflare env/secrets.', 1, CURRENT_TIMESTAMP)
     ON CONFLICT(configKey) DO UPDATE SET
       isSecret = 1,
       storageMode = 'env',
       envVarName = excluded.envVarName,
       masked = 1,
       updatedAt = CURRENT_TIMESTAMP`
  ).bind(configKey, envVarName).run()
}

export const ConfigService = {
  async list(db: D1Database, env: ConfigEnv): Promise<SafeConfigResponse[]> {
    const [configs, metadata] = await Promise.all([
      db.prepare('SELECT configKey, configValue, dataType, description, updatedAt FROM HL_systemConfigs ORDER BY configKey').all<ConfigRow>(),
      listMetadata(db)
    ])
    return (configs.results || []).map((row) => formatConfigForResponse(row, metadata.get(row.configKey) ?? null, env))
  },

  async update(db: D1Database, env: ConfigEnv, configKey: string, input: ConfigUpdateInput): Promise<SafeConfigResponse> {
    const row = await db.prepare(
      'SELECT configKey, configValue, dataType, description, updatedAt FROM HL_systemConfigs WHERE configKey = ? LIMIT 1'
    ).bind(configKey).first<ConfigRow>()
    if (!row) throw new Error('CONFIG_NOT_FOUND')

    const metadata = await getMetadata(db, configKey)
    if (isSecret(row, metadata)) {
      const envVarName = input.envVarName || metadata?.envVarName || defaultSecretEnvVarName(configKey)
      if (envVarName && !ENV_VAR_PATTERN.test(envVarName)) throw new Error('INVALID_ENV_VAR_NAME')
      const configured = input.configured ?? input.configValue !== undefined
      await db.prepare('UPDATE HL_systemConfigs SET configValue = ?, updatedAt = CURRENT_TIMESTAMP WHERE configKey = ?')
        .bind(configured ? 'configured' : '', configKey)
        .run()
      await upsertSecretMetadata(db, configKey, envVarName)
      return formatConfigForResponse({ ...row, configValue: configured ? 'configured' : '' }, {
        ...(metadata ?? {
          configKey,
          category: 'security',
          isSecret: 1,
          storageMode: 'env',
          masked: 1,
          readPolicy: 'admin.config.read',
          writePolicy: 'admin.config.update',
          description: null,
          active: 1
        }),
        isSecret: 1,
        storageMode: 'env',
        envVarName,
        masked: 1
      }, env)
    }

    await db.prepare('UPDATE HL_systemConfigs SET configValue = ?, updatedAt = CURRENT_TIMESTAMP WHERE configKey = ?')
      .bind(input.configValue ?? '', configKey)
      .run()
    return formatConfigForResponse({ ...row, configValue: input.configValue ?? '' }, metadata, env)
  },

  async create(db: D1Database, env: ConfigEnv, row: ConfigRow): Promise<SafeConfigResponse> {
    const secret = isSensitiveConfigKey(row.configKey)
    const storedValue = secret ? (row.configValue ? 'configured' : '') : row.configValue
    await db.prepare(
      'INSERT INTO HL_systemConfigs (configKey, configValue, dataType, description, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(row.configKey, storedValue, row.dataType, row.description).run()
    if (secret) {
      await upsertSecretMetadata(db, row.configKey, defaultSecretEnvVarName(row.configKey))
    }
    const metadata = secret ? await getMetadata(db, row.configKey) : null
    return formatConfigForResponse({ ...row, configValue: storedValue }, metadata, env)
  }
}
