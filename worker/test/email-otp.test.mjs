import assert from 'node:assert/strict'
import test from 'node:test'
import { EmailOtpService } from '../dist/services/email-otp.js'
import { EmailSenderService } from '../dist/services/email-sender.js'
import { app } from '../dist/index.js'
import { D1Mock, env, assertSessionCookie } from './register.test.mjs'

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

test('POST /api/auth/register/start returns otpRequired and no session cookie', async () => {
  EmailSenderService.clearTestOutbox()
  const db = new D1Mock()
  const response = await app.request('/api/auth/register/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'StrongPass123', displayName: 'Budi' })
  }, env(db))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.data.otpRequired, true)
  assert.ok(body.data.challengeId)
  assert.equal(body.data.maskedEmail, 'u***@example.com')
  const cookie = response.headers.get('set-cookie') ?? ''
  assert.ok(!cookie.includes('hlSession='), 'No session cookie on register/start')
  assert.equal(db.users.length, 1)
  assert.equal(db.users[0].active, 0)
  assert.equal(db.emailOtpChallenges.length, 1)
})

test('POST /api/auth/register/verify with valid OTP creates session', async () => {
  EmailSenderService.clearTestOutbox()
  const db = new D1Mock()
  const startRes = await app.request('/api/auth/register/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'verify@example.com', password: 'StrongPass123', displayName: 'Verify' })
  }, env(db))
  const startBody = await startRes.json()
  const challengeId = startBody.data.challengeId
  const outbox = EmailSenderService.getTestOutbox('verify@example.com')
  const otp = outbox[outbox.length - 1]?.otp
  assert.ok(otp, 'OTP in mock outbox')

  const verifyRes = await app.request('/api/auth/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, otp })
  }, env(db))
  const verifyBody = await verifyRes.json()
  assert.equal(verifyRes.status, 200)
  assert.equal(verifyBody.success, true)
  assert.ok(verifyBody.data.user)
  assert.equal(verifyBody.data.user.email, 'verify@example.com')
  assert.equal(verifyBody.data.requiresOnboarding, true)
  assertSessionCookie(verifyRes)
  assert.equal(db.users[0].active, 1)
})

test('POST /api/auth/register/verify invalid OTP returns error', async () => {
  EmailSenderService.clearTestOutbox()
  const db = new D1Mock()
  const startRes = await app.request('/api/auth/register/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'invalid@example.com', password: 'StrongPass123', displayName: 'Invalid' })
  }, env(db))
  const startBody = await startRes.json()
  const verifyRes = await app.request('/api/auth/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId: startBody.data.challengeId, otp: '000000' })
  }, env(db))
  const verifyBody = await verifyRes.json()
  assert.equal(verifyBody.success, false)
  assert.equal(verifyBody.error.code, 'OTP_INVALID')
})

test('OTP response never includes plaintext OTP', async () => {
  EmailSenderService.clearTestOutbox()
  const db = new D1Mock()
  const res = await app.request('/api/auth/register/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'otpcheck@example.com', password: 'StrongPass123', displayName: 'Check' })
  }, env(db))
  const body = await res.json()
  const bodyStr = JSON.stringify(body)
  assert.ok(!bodyStr.includes('otp":') || !/\d{6}/.test(body.data?.otp || ''), 'No 6-digit OTP in response')
  assert.ok(!bodyStr.includes('123456'), 'No OTP plaintext in response')
})
