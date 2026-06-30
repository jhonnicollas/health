import type { Env } from '../types.js'
import type { SupportedLocale } from '../i18n/locale.js'
import { getOtpEmailTemplate } from '../i18n/email-templates.js'

const DEFAULT_FROM = 'iSehat <otp@mail.isehat.biz.id>'

const testOutbox = new Map<string, { otp: string; sentAt: number }[]>()

export const EmailSenderService = {
  async sendOtp(env: Env, email: string, otp: string, locale: SupportedLocale = 'id-ID'): Promise<{ sent: boolean; error?: string }> {
    const from = env.EMAIL_FROM || DEFAULT_FROM
    const { subject, html } = getOtpEmailTemplate(locale, otp)

    if (env.EMAIL_PROVIDER === 'mock' || env.EMAIL_OTP_TEST_MODE === 'true') {
      const list = testOutbox.get(email) || []
      list.push({ otp, sentAt: Date.now() })
      testOutbox.set(email, list)
      return { sent: true }
    }

    const apiKey = env.RESEND_API_KEY
    if (!apiKey) return { sent: false, error: 'RESEND_API_KEY not configured' }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [email], subject, html }),
      })
      if (!res.ok) {
        const body = await res.text()
        return { sent: false, error: `Resend ${res.status}: ${body}` }
      }
      return { sent: true }
    } catch (err) {
      return { sent: false, error: err instanceof Error ? err.message : 'Unknown send error' }
    }
  },

  getTestOutbox(email: string): { otp: string; sentAt: number }[] {
    return testOutbox.get(email) || []
  },

  clearTestOutbox(): void {
    testOutbox.clear()
  }
}
