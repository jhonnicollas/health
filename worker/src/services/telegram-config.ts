import { ConfigService, type SafeConfigResponse } from './config.js'

export type TelegramConfigStatus = {
  botTokenConfigured: boolean
  webhookSecretConfigured: boolean
  allConfigured: boolean
}

export const TelegramConfigService = {
  isConfigured(env: Record<string, unknown>): TelegramConfigStatus {
    const botToken = !!env['TELEGRAM_BOT_TOKEN']
    const webhookSecret = !!env['TELEGRAM_WATER_WEBHOOK_SECRET']
    return { botTokenConfigured: botToken, webhookSecretConfigured: webhookSecret, allConfigured: botToken && webhookSecret }
  },

  getWebhookSecret(env: Record<string, unknown>): string {
    return (env['TELEGRAM_WATER_WEBHOOK_SECRET'] as string) || ''
  },

  getBotToken(env: Record<string, unknown>): string {
    return (env['TELEGRAM_BOT_TOKEN'] as string) || ''
  },

  async getConfigStatus(db: D1Database, env: Record<string, unknown>): Promise<SafeConfigResponse[]> {
    const configs = await ConfigService.list(db, env)
    return configs.filter(c => c.configKey === 'telegramBotToken' || c.configKey === 'telegramWaterWebhookSecretRef')
  }
}
