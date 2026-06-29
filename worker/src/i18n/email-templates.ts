import type { SupportedLocale } from './locale.js'

export function getOtpEmailTemplate(locale: SupportedLocale, otp: string): { subject: string; html: string } {
  if (locale === 'en-US') {
    return {
      subject: 'iSehat Verification Code',
      html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
<h2 style="color:#1a56db;">iSehat Verification Code</h2>
<p>Your verification code:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1a56db;">${otp}</p>
<p>This code is valid for 10 minutes.</p>
<p style="color:#6b7280;font-size:14px;">If you did not request this code, please ignore this email.</p>
</body></html>`,
    }
  }
  return {
    subject: 'Kode verifikasi iSehat',
    html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
<h2 style="color:#1a56db;">Kode Verifikasi iSehat</h2>
<p>Kode verifikasi Anda:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1a56db;">${otp}</p>
<p>Kode berlaku selama 10 menit.</p>
<p style="color:#6b7280;font-size:14px;">Jika Anda tidak meminta kode ini, abaikan email ini.</p>
</body></html>`,
  }
}
