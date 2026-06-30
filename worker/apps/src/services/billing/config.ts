import type { BillingProvider, BillingProviderCode } from './provider.js'

interface BillingEnv {
  BILLING_PROVIDER?: string
  XENDIT_MODE?: string
  XENDIT_BASE_URL?: string
  XENDIT_SECRET_KEY?: string
  XENDIT_WEBHOOK_TOKEN?: string
  BILLING_SUCCESS_URL?: string
  BILLING_CANCEL_URL?: string
}

export interface BillingConfig {
  provider: BillingProviderCode
  xenditMode: 'test' | 'live'
  xenditBaseUrl: string
  xenditSecretKey: string | null
  xenditWebhookToken: string | null
  successUrl: string
  cancelUrl: string
  isMockEnabled: boolean
}

export function readBillingConfig(env: BillingEnv): BillingConfig {
  const provider = (env.BILLING_PROVIDER || 'mock') as BillingProviderCode
  const xenditMode = (env.XENDIT_MODE || 'test') as 'test' | 'live'
  const xenditBaseUrl = env.XENDIT_BASE_URL || 'https://api.xendit.co'
  const xenditSecretKey = env.XENDIT_SECRET_KEY || null
  const xenditWebhookToken = env.XENDIT_WEBHOOK_TOKEN || null
  const successUrl = env.BILLING_SUCCESS_URL || 'https://app.isehat.biz.id/billing/success'
  const cancelUrl = env.BILLING_CANCEL_URL || 'https://app.isehat.biz.id/billing/cancel'
  const isMockEnabled = provider === 'mock'

  return { provider, xenditMode, xenditBaseUrl, xenditSecretKey, xenditWebhookToken, successUrl, cancelUrl, isMockEnabled }
}

export async function getBillingProvider(config: BillingConfig): Promise<BillingProvider> {
  if (config.provider === 'mock') {
    const { MockBillingProvider } = await import('./providers/mock.js')
    return new MockBillingProvider(config)
  }
  if (config.provider === 'xendit_test' || config.provider === 'xendit_live') {
    if (!config.xenditSecretKey) throw new Error('XENDIT_SECRET_KEY tidak dikonfigurasi.')
    if (config.xenditMode === 'live' && config.provider !== 'xendit_live')
      throw new Error('Live mode memerlukan BILLING_PROVIDER=xendit_live dan XENDIT_MODE=live.')
    const { XenditBillingProvider } = await import('./providers/xendit.js')
    return new XenditBillingProvider(config)
  }
  throw new Error(`BILLING_PROVIDER tidak dikenal: ${config.provider}`)
}
