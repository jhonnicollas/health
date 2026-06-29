import type { BillingProvider, CreateCheckoutInput, CreateCheckoutResult } from '../provider.js'
import type { BillingConfig } from '../config.js'

export class XenditBillingProvider implements BillingProvider {
  constructor(private config: BillingConfig) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const secret = this.config.xenditSecretKey
    if (!secret) throw Object.assign(new Error('XENDIT_SECRET_KEY tidak dikonfigurasi.'), { code: 'XENDIT_CONFIG' })

    const body = {
      external_id: input.merchantRef,
      amount: input.amount,
      currency: input.currency,
      payer_email: input.email,
      description: `iSehat ${input.planName}`,
      success_redirect_url: input.successUrl,
      failure_redirect_url: input.cancelUrl
    }

    const encoder = new TextEncoder()
    const authBytes = encoder.encode(`${secret}:`)
    let binary = ''
    for (let i = 0; i < authBytes.length; i++) binary += String.fromCharCode(authBytes[i])
    const auth = btoa(binary)

    const res = await fetch(`${this.config.xenditBaseUrl}/v2/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Xendit API error')
      throw Object.assign(new Error(`Gagal membuat checkout pembayaran: ${errText.slice(0, 200)}`), { code: 'XENDIT_ERROR' })
    }

    const data = await res.json() as { id?: string; invoice_url?: string }
    const providerCheckoutId = data.id || ''
    const checkoutUrl = data.invoice_url || ''

    return {
      provider: 'xendit',
      mode: this.config.xenditMode === 'test' ? 'test' : 'live',
      providerCheckoutId,
      merchantRef: input.merchantRef,
      checkoutUrl
    }
  }
}
