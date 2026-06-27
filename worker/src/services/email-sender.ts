import type { Env } from '../types.js'

const DEFAULT_FROM = 'iSehat <otp@mail.isehat.biz.id>'

const testOutbox = new Map<string, { otp: string; sentAt: number }[]>()

function otpHtml(otp: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
<h2 style="color:#1a56db;">Kode Verifikasi iSehat</h2>
<p>Kode verifikasi Anda:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1a56db;">${otp}</p>
<p>Kode berlaku selama 10 menit.</p>
<p style="color:#6b7280;font-size:14px;">Jika Anda tidak meminta kode ini, abaikan email ini.</p>
</body></html>`
}

export const EmailSenderService = {
  async sendOtp(env: Env, email: string, otp: string): Promise<{ sent: boolean; error?: string }> {
    const from = env.EMAIL_FROM || DEFAULT_FROM
    const subject = 'Kode verifikasi iSehat'

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
        body: JSON.stringify({ from, to: [email], subject, html: otpHtml(otp) }),
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
