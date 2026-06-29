import type { BillingProvider, CreateCheckoutInput, CreateCheckoutResult } from '../provider.js'
import type { BillingConfig } from '../config.js'

export class MockBillingProvider implements BillingProvider {
  constructor(private config: BillingConfig) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const checkoutId = input.successUrl.split('checkoutId=')[1]?.split('&')[0] || input.merchantRef
    return {
      provider: 'mock',
      mode: 'mock',
      providerCheckoutId: `mock_${input.merchantRef}`,
      merchantRef: input.merchantRef,
      checkoutUrl: `/billing/mock-checkout?checkoutId=${encodeURIComponent(checkoutId)}`
    }
  }
}
