export type BillingProviderCode = 'mock' | 'xendit_test' | 'xendit_live'

export interface CreateCheckoutInput {
  userId: number
  email: string
  planCode: string
  planName: string
  amount: number
  currency: string
  merchantRef: string
  successUrl: string
  cancelUrl: string
}

export interface CreateCheckoutResult {
  provider: 'mock' | 'xendit'
  mode: 'mock' | 'test' | 'live'
  providerCheckoutId: string
  merchantRef: string
  checkoutUrl: string
}

export interface BillingProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>
}
