import { registerTranslations, type SupportedLocale } from '../index'

export const ERROR_MESSAGES: Record<string, Record<SupportedLocale, string>> = {
  UNAUTHORIZED: { 'id-ID': 'Sesi tidak valid.', 'en-US': 'Invalid session.' },
  INTERNAL_ERROR: { 'id-ID': 'Terjadi kesalahan. Coba lagi.', 'en-US': 'An error occurred. Try again.' },
  FORBIDDEN: { 'id-ID': 'Akses ditolak.', 'en-US': 'Access denied.' },
  ENTITLEMENT_REQUIRED: { 'id-ID': 'Fitur ini memerlukan paket Premium.', 'en-US': 'This feature requires a Premium plan.' },
  QUOTA_EXCEEDED: { 'id-ID': 'Kuota terlampaui. Upgrade untuk melanjutkan.', 'en-US': 'Quota exceeded. Upgrade to continue.' },
  VALIDATION_ERROR: { 'id-ID': 'Input tidak valid.', 'en-US': 'Invalid input.' },
  NOT_FOUND: { 'id-ID': 'Data tidak ditemukan.', 'en-US': 'Data not found.' },
  LARGE_INPUT_CONFIRMATION_REQUIRED: { 'id-ID': 'Jumlah besar memerlukan konfirmasi.', 'en-US': 'Large amount requires confirmation.' },
  TELEGRAM_WEBHOOK_FORBIDDEN: { 'id-ID': 'Webhook Telegram tidak valid.', 'en-US': 'Invalid Telegram webhook.' },
  OTP_INVALID: { 'id-ID': 'Kode verifikasi tidak valid.', 'en-US': 'Invalid verification code.' },
  OTP_EXPIRED: { 'id-ID': 'Kode verifikasi kadaluarsa.', 'en-US': 'Verification code expired.' },
  OTP_TOO_MANY_ATTEMPTS: { 'id-ID': 'Terlalu banyak percobaan.', 'en-US': 'Too many attempts.' },
  OTP_RATE_LIMITED: { 'id-ID': 'Terlalu banyak permintaan. Coba lagi nanti.', 'en-US': 'Too many requests. Try again later.' },
  EMAIL_ALREADY_EXISTS: { 'id-ID': 'Email sudah terdaftar.', 'en-US': 'Email already registered.' },
  EMAIL_INVALID_FORMAT: { 'id-ID': 'Format email tidak valid.', 'en-US': 'Invalid email format.' },
  EMAIL_OTP_SEND_FAILED: { 'id-ID': 'Gagal mengirim kode verifikasi.', 'en-US': 'Failed to send verification code.' },
  EMAIL_NOT_VERIFIED: { 'id-ID': 'Email belum diverifikasi.', 'en-US': 'Email not verified.' },
  ACCOUNT_SUSPENDED: { 'id-ID': 'Akun di-suspend. Hubungi admin.', 'en-US': 'Account suspended. Contact admin.' },
  CYCLE_ACCESS_DENIED: { 'id-ID': 'Fitur cycle tracking hanya untuk perempuan usia 15-48 tahun.', 'en-US': 'Cycle tracking is only available for females aged 15-48.' },
  AI_CLINICAL_COPILOT_DEFERRED: { 'id-ID': 'AI Clinical Copilot ditangguhkan ke Sprint 6.', 'en-US': 'AI Clinical Copilot deferred to Sprint 6.' },
  AUTH_PROVIDER_MISMATCH: { 'id-ID': 'Akun Google tidak bisa ganti password di sini. Gunakan Google Account settings.', 'en-US': 'Google account cannot change password here. Use Google Account settings.' },
  INVALID_CREDENTIALS: { 'id-ID': 'Password lama salah.', 'en-US': 'Current password is incorrect.' },
  PAYMENT_PENDING: { 'id-ID': 'Pembayaran sedang diproses.', 'en-US': 'Payment is being processed.' },
  PAYMENT_FAILED: { 'id-ID': 'Pembayaran gagal.', 'en-US': 'Payment failed.' },
  PAYMENT_EXPIRED: { 'id-ID': 'Sesi pembayaran kadaluarsa.', 'en-US': 'Payment session expired.' },
  LAST_LOGIN_METHOD: { 'id-ID': 'Tidak bisa melepas: ini satu-satunya metode login Anda.', 'en-US': 'Cannot unlink: this is your only login method.' },
  OTP_REQUIRED: { 'id-ID': 'Kode verifikasi diperlukan.', 'en-US': 'Verification code required.' },
}

registerTranslations('errors', ERROR_MESSAGES)

export function getErrorMessage(code: string, locale: SupportedLocale = 'id-ID'): string {
  const entry = ERROR_MESSAGES[code]
  if (!entry) return code
  return entry[locale] ?? entry['id-ID'] ?? code
}
