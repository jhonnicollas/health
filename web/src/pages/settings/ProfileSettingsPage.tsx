import { useState, useMemo, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useAuth, type Profile } from '../../context/auth'
import { useI18n } from '../../i18n/useI18n'

type ProfileFull = NonNullable<Profile> & { [key: string]: unknown }

type ProfileSettingsResponse = {
  success: boolean
  data?: { updated: boolean }
  error?: { message: string; details?: Array<{ field: string; message: string }> }
}

type GoogleLinkInfo = {
  provider: string
  email?: string
  displayName?: string
  linkedAt?: string
}

function LinkedAccountsSection() {
  const { t } = useI18n()
  const [accounts, setAccounts] = useState<GoogleLinkInfo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [unlinking, setUnlinking] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/google/accounts', { credentials: 'include', headers: { Accept: 'application/json' } }).catch(() => null)
        const j: { success?: boolean; data?: GoogleLinkInfo[] } | null = r ? await r.json() : null
        setAccounts(j?.success && j?.data ? j.data : [])
      } catch { setAccounts([]) }
      finally { setLoading(false) }
    })()
  }, [])

  async function handleLink() {
    const r = await fetch('/api/auth/google/link', { method: 'POST', credentials: 'include' })
    const j: { success?: boolean; data?: { redirectUrl?: string }; error?: { message?: string } } = await r.json()
    if (j.success && j.data?.redirectUrl) window.location.href = j.data.redirectUrl
    else setMsg(j.error?.message || 'Gagal menghubungkan.')
  }

  async function handleUnlink() {
    if (!confirm(t('settings.unlinkConfirm'))) return
    setUnlinking(true); setMsg('')
    try {
      const r = await fetch('/api/auth/google/link', { method: 'DELETE', credentials: 'include' })
      const j: { success?: boolean; error?: { message?: string; code?: string } } = await r.json()
      if (j.success) { setMsg(t('settings.unlinkSuccess')); setAccounts([]) }
      else setMsg(j.error?.code === 'LAST_LOGIN_METHOD' ? t('settings.unlinkFailed') : j.error?.message || t('settings.unlinkFailed'))
    } catch { setMsg(t('settings.connError')) }
    finally { setUnlinking(false) }
  }

  if (loading) return <p>{t('settings.loadFailed')}</p>
  const googleLinked = accounts?.some((a) => a.provider === 'google')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: 12, borderRadius: 'var(--radiusMd)', border: '1px solid var(--colorBorderSoft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.95H.96A9 9 0 0 0 0 9c0 1.46.35 2.83.96 4.05l3-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3 2.34C4.67 5.16 6.66 3.58 9 3.58z"/></svg>
          <div><strong style={{ font: 'var(--typLabelMd)', display: 'block' }}>{t('settings.google')}</strong><small style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)' }}>{googleLinked ? t('settings.linked') : t('settings.notLinked')}</small></div>
        </div>
        {googleLinked
          ? <button className="btn-secondary" disabled={unlinking} onClick={handleUnlink} style={{ fontSize: 13, padding: '4px 12px' }}>{unlinking ? t('settings.unlinking') : t('settings.unlink')}</button>
          : <button className="btn-primary" onClick={handleLink} style={{ fontSize: 13, padding: '4px 12px' }}>{t('settings.link')}</button>
        }
      </div>
      {msg && <p className={`form-message ${msg.includes('berhasil') || msg.includes('success') || msg.includes('unlinked') ? 'success' : 'error'}`} role="status">{msg}</p>}
    </div>
  )
}

export function ProfileSettingsPage() {
  const { profile, refresh, user, requiresOnboarding, setAuthenticated } = useAuth()
  const { t } = useI18n()

  const pf = (profile ?? {}) as ProfileFull
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [sex, setSex] = useState(pf.sex ?? 'male')
  const [birthDate, setBirthDate] = useState(pf.birthDate ?? '')
  const [heightCm, setHeightCm] = useState(profile?.heightCm?.toString() ?? '')
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'Asia/Jakarta')
  const [whatsappNumber, setWhatsappNumber] = useState(pf.whatsappNumber ?? '')

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

  const formKey = useMemo(() => `${user?.displayName ?? ''}-${pf.sex ?? ''}-${pf.birthDate ?? ''}-${profile?.heightCm ?? ''}-${profile?.timezone ?? ''}-${pf.whatsappNumber ?? ''}`, [user, profile])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    setFieldErrors({})

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          heightCm: Number(heightCm),
          timezone,
          theme: pf.theme ?? 'light',
          accessibilityMode: pf.accessibilityMode ?? 'normal',
          sex,
          birthDate,
          displayName,
          whatsappNumber: whatsappNumber || null
        })
      })
      const body = (await response.json()) as ProfileSettingsResponse

      if (!response.ok || !body.success) {
        const nextErrors: Record<string, string> = {}
        body.error?.details?.forEach((detail) => {
          nextErrors[detail.field] = detail.message
        })
        setFieldErrors(nextErrors)
        setMessage(body.error?.message ?? t('settings.nameSaveFailed'))
        return
      }

      if (user) {
        setAuthenticated({
          user: { ...user, displayName },
          requiresOnboarding,
          profile: {
            ...profile,
            heightCm: Number(heightCm),
            timezone,
            sex,
            birthDate,
            displayName,
            whatsappNumber: whatsappNumber || null
          } as ProfileFull
        })
      }
      void refresh()
      setMessage(t('settings.settingsSaved'))
    } catch {
      setMessage(t('settings.connError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePasswordChange() {
    setPwSaving(true); setPwMsg('')
    if (pwNew !== pwConfirm) { setPwMsg(t('settings.pwMismatch')); setPwSaving(false); return }
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew })
      })
      const body = await res.json() as { success: boolean; error?: { message: string } }
      if (!res.ok || !body.success) { setPwMsg(body.error?.message ?? t('settings.pwChangeFailed')); return }
      setPwMsg(t('settings.pwChanged'))
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
    } catch { setPwMsg(t('settings.connError')) }
    finally { setPwSaving(false) }
  }

  return (
    <section className="settings-panel" aria-labelledby="profile-settings-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h2 id="profile-settings-title">My Profile</h2>
          <p>Manage your personal information and security.</p>
        </div>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--colorSurfaceContainer)', fontSize: 24, fontWeight: 700, color: 'var(--colorTextPrimary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--colorBorderSoft)' }}>
          {user?.displayName?.charAt(0)?.toUpperCase() ?? 'U'}
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-left">
          <section className="card">
            <h3 style={{ font: 'var(--typHeadlineMd)', color: 'var(--colorTextPrimary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>badge</span>
              Personal Information
            </h3>
            <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginBottom: 20 }}>Update your name, demographics, and clinical identifiers.</p>

            <form key={formKey} onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                <div>
                  <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Display Name</label>
                  <input className="input-field" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                  {fieldErrors.displayName ? <span className="field-error">{fieldErrors.displayName}</span> : null}
                </div>
                <div>
                  <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Sex</label>
                  <select className="input-field" value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Birth Date</label>
                  <input className="input-field" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Height (cm)</label>
                  <input className="input-field" inputMode="decimal" max={250} min={50} type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
                  {fieldErrors.heightCm ? <span className="field-error">{fieldErrors.heightCm}</span> : null}
                </div>
                <div>
                  <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Timezone</label>
                  <input className="input-field" type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
                  {fieldErrors.timezone ? <span className="field-error">{fieldErrors.timezone}</span> : null}
                </div>
                <div>
                  <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>WhatsApp Number</label>
                  <input className="input-field" inputMode="tel" type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, '').slice(0, 15))} placeholder="6281234567890" />
                  {fieldErrors.whatsappNumber ? <span className="field-error">{fieldErrors.whatsappNumber}</span> : null}
                </div>
              </div>

              <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--colorBorderSoft)' }}>
                <button className="btn-primary" disabled={submitting} type="submit">
                  {submitting ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
              {message ? <p className={`form-message ${message.toLowerCase().includes('saved') || message.toLowerCase().includes('berhasil') ? 'success' : 'error'}`} role="status" style={{ marginTop: 12 }}>{message}</p> : null}
            </form>
          </section>
        </div>

        <div className="settings-right">
          <section className="card">
            <h3 style={{ font: 'var(--typHeadlineMd)', color: 'var(--colorTextPrimary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>lock</span>
              Security
            </h3>
            <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginBottom: 20 }}>Change your password.</p>

            <div>
              <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Current Password</label>
              <input className="input-field" type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="••••••••" style={{ width: '100%', marginBottom: 12 }} />
              <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>New Password</label>
              <input className="input-field" type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Min. 8 characters" style={{ width: '100%', marginBottom: 12 }} />
              <label style={{ font: 'var(--typLabelSm)', color: 'var(--colorTextSecondary)', display: 'block', marginBottom: 4 }}>Confirm New Password</label>
              <input className="input-field" type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Repeat new password" style={{ width: '100%', marginBottom: 12 }} />
              <button className="btn-primary" disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm} onClick={() => void handlePasswordChange()} type="button">
                {pwSaving ? 'Changing...' : 'Change Password'}
              </button>
              {pwMsg ? <p className={`form-message ${pwMsg.toLowerCase().includes('changed') || pwMsg.toLowerCase().includes('berhasil') ? 'success' : 'error'}`} role="status" style={{ marginTop: 12 }}>{pwMsg}</p> : null}
            </div>
          </section>

          <section className="card" style={{ marginTop: 24 }}>
            <h3 style={{ font: 'var(--typHeadlineMd)', color: 'var(--colorTextPrimary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--colorPrimary)' }}>link</span>
              Linked Accounts
            </h3>
            <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextSecondary)', marginBottom: 16 }}>Manage login methods and connected accounts.</p>
            <LinkedAccountsSection />
          </section>
        </div>
      </div>
    </section>
  )
}
