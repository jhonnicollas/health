import assert from 'node:assert/strict'
import test from 'node:test'
import { EmailOtpService } from '../dist/services/email-otp.js'

test('normalizeEmail trims and lowercases', () => {
  assert.equal(EmailOtpService.normalizeEmail('  USER@Example.COM  '), 'user@example.com')
})

test('validateEmailFormat accepts valid emails', () => {
  assert.equal(EmailOtpService.validateEmailFormat('user@example.com'), true)
  assert.equal(EmailOtpService.validateEmailFormat('bad'), false)
  assert.equal(EmailOtpService.validateEmailFormat(''), false)
  assert.equal(EmailOtpService.validateEmailFormat('a@b.c'), true)
})

test('generateOtp returns 6-digit string', () => {
  const otp = EmailOtpService.generateOtp()
  assert.match(otp, /^\d{6}$/)
})

test('generateOtp with custom length', () => {
  const otp = EmailOtpService.generateOtp(4)
  assert.match(otp, /^\d{4}$/)
})

test('hashOtp produces deterministic output', async () => {
  const hash1 = await EmailOtpService.hashOtp('123456', 'salt1', 'pepper1')
  const hash2 = await EmailOtpService.hashOtp('123456', 'salt1', 'pepper1')
  assert.equal(hash1, hash2)
  assert.ok(hash1.length > 0)
})

test('hashOtp different salt produces different hash', async () => {
  const hash1 = await EmailOtpService.hashOtp('123456', 'salt1', 'pepper1')
  const hash2 = await EmailOtpService.hashOtp('123456', 'salt2', 'pepper1')
  assert.notEqual(hash1, hash2)
})

test('maskEmail hides local part', () => {
  assert.equal(EmailOtpService.maskEmail('user@example.com'), 'u***@example.com')
  assert.equal(EmailOtpService.maskEmail('a@example.com'), '*@example.com')
  assert.equal(EmailOtpService.maskEmail('longemail@example.com'), 'l*****@example.com')
})
