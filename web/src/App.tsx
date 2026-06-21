import { useEffect, useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/auth'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { SelectMetricPage } from './pages/measurement/SelectMetricPage'
import { OnboardingPage } from './pages/onboarding/OnboardingPage'
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage'
import { ProfileDeletePage } from './pages/settings/ProfileDeletePage'
import { ConfigDashboardPage } from './pages/admin/ConfigDashboardPage'
import { SeniorMeasurementFlow } from './pages/measurement/SeniorMeasurementFlow'
import { TodayDashboard } from './pages/dashboard/TodayDashboard'
import { WeeklyDashboard } from './pages/dashboard/WeeklyDashboard'
import { MonthlyDashboard } from './pages/dashboard/MonthlyDashboard'
import { DailyReportPage } from './pages/reports/DailyReportPage'
import { WeeklyReportPage } from './pages/reports/WeeklyReportPage'
import { MonthlyReportPage } from './pages/reports/MonthlyReportPage'
import { DoctorReportPage } from './pages/reports/DoctorReportPage'
import { KnowledgeBasePage } from './pages/kb/KnowledgeBasePage'
import { RemindersPage } from './pages/reminders/RemindersPage'
import { MedicationsPage } from './pages/medications/MedicationsPage'
import { FamilyPage } from './pages/family/FamilyPage'
import { FastingPage } from './pages/fasting/FastingPage'
import { EmergencyContactsPage } from './pages/emergency/EmergencyContactsPage'
import { TelegramSettingsPage } from './pages/telegram/TelegramSettingsPage'
import { CaregiverDashboardPage } from './pages/caregiver/CaregiverDashboardPage'
import { AlertsPage } from './pages/alerts/AlertsPage'
import { PatternsPage } from './pages/patterns/PatternsPage'
import './App.css'

type NavLink = {
  path: string
  label: string
  shortLabel: string
  section: 'overview' | 'capture' | 'care' | 'system'
  adminOnly?: boolean
  visible?: boolean
  badge?: string
}

type HistoryValue = {
  id: string
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  manualOverride: number
}

type HistoryAttachment = {
  id: string
  metricCode: string
  fileName: string
}

type HistorySession = {
  id: string
  measuredAt: string
  source: string
  hasAttachment: number
  values: HistoryValue[]
  attachments: HistoryAttachment[]
}

type AiAssistantResponse = {
  success: boolean
  data?: {
    reply: string
    model: string
    usedFallback: boolean
    vitals: VitalSnapshot[]
  }
  error?: { message: string }
}

type VitalSnapshot = {
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
}

const NAV: NavLink[] = [
  { path: '/dashboard', label: 'Dashboard', shortLabel: 'Home', section: 'overview' },
  { path: '/dashboard/week', label: 'Weekly View', shortLabel: 'Week', section: 'overview', visible: false },
  { path: '/dashboard/month', label: 'Monthly Summary', shortLabel: 'Month', section: 'overview', visible: false },
  { path: '/measurements/new', label: 'New Measurement', shortLabel: 'Input', section: 'capture' },
  { path: '/measurements/history', label: 'History', shortLabel: 'History', section: 'capture' },
  { path: '/measurements/senior', label: 'Senior Mode', shortLabel: 'Senior', section: 'capture', visible: false },
  { path: '/tracker', label: 'Tracker', shortLabel: 'Track', section: 'care', visible: false },
  { path: '/ai-assistant', label: 'AI Assistant', shortLabel: 'AI', section: 'overview' },
  { path: '/reports/daily', label: 'Reports', shortLabel: 'Reports', section: 'overview' },
  { path: '/reports/weekly', label: 'Weekly Report', shortLabel: 'W Report', section: 'overview', visible: false },
  { path: '/reports/monthly', label: 'Monthly Report', shortLabel: 'M Report', section: 'overview', visible: false },
  { path: '/reports/doctor', label: 'Doctor Report', shortLabel: 'Doctor', section: 'overview', visible: false },
  { path: '/reminders', label: 'Reminders', shortLabel: 'Remind', section: 'care', visible: false },
  { path: '/medications', label: 'Medication', shortLabel: 'Meds', section: 'care', visible: false },
  { path: '/family', label: 'Family Link', shortLabel: 'Family', section: 'care' },
  { path: '/caregiver', label: 'Caregiver', shortLabel: 'Care', section: 'care', visible: false },
  { path: '/fasting', label: 'Fasting', shortLabel: 'Fast', section: 'care', visible: false },
  { path: '/emergency', label: 'Emergency Contacts', shortLabel: 'SOS', section: 'care', visible: false },
  { path: '/telegram', label: 'Telegram', shortLabel: 'Telegram', section: 'system', visible: false },
  { path: '/alerts', label: 'Notifications', shortLabel: 'Alerts', section: 'system', badge: '3' },
  { path: '/patterns', label: 'Patterns', shortLabel: 'Pattern', section: 'system', visible: false },
  { path: '/kb', label: 'Help Center', shortLabel: 'Help', section: 'system', visible: false },
  { path: '/settings/profile', label: 'Settings', shortLabel: 'Settings', section: 'system' },
  { path: '/settings/delete', label: 'Delete Account', shortLabel: 'Privacy', section: 'system', visible: false },
  { path: '/admin/configs', label: 'Admin', shortLabel: 'Admin', section: 'system', adminOnly: true }
]

const ALLOWED_PATHS = new Set(NAV.map(n => n.path))
const MOBILE_NAV_PATHS = new Set(['/dashboard', '/measurements/new', '/tracker', '/alerts', '/settings/profile'])
const SECTION_LABELS: Record<NavLink['section'], string> = {
  overview: 'Overview',
  capture: 'Capture',
  care: 'Care Network',
  system: 'System'
}

function normalizePath(path: string) {
  if (path === '/auth/register') return '/register'
  if (path === '/auth/login' || path === '/auth') return '/login'
  return path
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'HL'
}

function TrackerPage() {
  return (
    <div className="tracker-grid">
      <FastingPage />
      <MedicationsPage />
    </div>
  )
}

function MeasurementHistoryPage() {
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [selectedAttachment, setSelectedAttachment] = useState<HistoryAttachment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/measurements/history', { credentials: 'include' })
        const body = (await res.json()) as {
          success: boolean
          data?: { sessions: HistorySession[] }
          error?: { message: string }
        }
        if (!body.success) {
          setError(body.error?.message ?? 'Gagal memuat riwayat.')
          return
        }
        setSessions(body.data?.sessions ?? [])
      } catch {
        setError('Tidak bisa terhubung ke server.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <section className="settings-panel history-panel" aria-labelledby="history-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Capture</p>
          <h2 id="history-title">Measurement History</h2>
          <p>Riwayat sesi, nilai final, manual override, dan bukti final.</p>
        </div>
        <span className="status-chip">{sessions.length} sesi</span>
      </div>

      {loading ? <p>Memuat riwayat...</p> : null}
      {error ? <p className="form-message error" role="status">{error}</p> : null}
      {!loading && sessions.length === 0 ? <p>Belum ada riwayat pengukuran.</p> : null}

      {sessions.length > 0 ? (
        <table className="report-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Nilai</th>
              <th>Status</th>
              <th>Bukti</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>{new Date(session.measuredAt).toLocaleString()}</td>
                <td>
                  {session.values.map((value) => (
                    <div key={value.id}>
                      <strong>{value.metricCode}</strong>: {value.finalValue} {value.unit}
                      {value.manualOverride === 1 ? <span className="badge-override">Manual Override</span> : null}
                    </div>
                  ))}
                </td>
                <td>{session.values.map((value) => value.status).join(', ') || '-'}</td>
                <td>
                  {session.attachments.length > 0 ? (
                    <button onClick={() => setSelectedAttachment(session.attachments[0])} type="button">
                      View Evidence
                    </button>
                  ) : (
                    <span className="muted">No evidence</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {selectedAttachment ? (
        <div className="evidence-modal" role="dialog" aria-modal="true" aria-label="Measurement evidence">
          <div className="evidence-lightbox">
            <div className="page-heading compact">
              <h3>{selectedAttachment.metricCode} evidence</h3>
              <button onClick={() => setSelectedAttachment(null)} type="button">Close</button>
            </div>
            <img alt="Watermarked measurement evidence" src={`/api/measurements/attachments/${selectedAttachment.id}`} />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function AiAssistantPage() {
  const [question, setQuestion] = useState('Saran makan malam untuk hipertensi')
  const [answer, setAnswer] = useState('')
  const [vitals, setVitals] = useState<VitalSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    setLoading(true)
    setError(null)
    setAnswer('')
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })
      const body = (await res.json()) as AiAssistantResponse
      if (!res.ok || !body.success || !body.data) {
        setError(body.error?.message ?? 'AI assistant gagal merespons.')
        return
      }
      setVitals(body.data.vitals)
      setAnswer(body.data.reply)
    } catch {
      setError('Tidak bisa terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="settings-panel ai-assistant-panel" aria-labelledby="ai-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">AI Assistant</p>
          <h2 id="ai-title">Chat kesehatan aman</h2>
          <p>LLM memakai konteks vital terbaru, tapi tidak memberi diagnosis atau dosis obat.</p>
        </div>
        <span className="status-chip">Rule-first</span>
      </div>

      <div className="settings-card">
        <h3>Health context</h3>
        {vitals.length === 0 ? <p>Vital terbaru akan tampil setelah pertanyaan dikirim.</p> : (
          <div className="vital-strip">
            {vitals.map((value) => (
              <span key={`${value.metricCode}-${value.finalValue}`}>
                {value.metricCode}: {value.finalValue} {value.unit} ({value.severity})
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="settings-card">
        <label>
          Pertanyaan
          <textarea onChange={(e) => setQuestion(e.target.value)} rows={4} value={question} />
        </label>
        <button disabled={loading || !question.trim()} onClick={() => void ask()} type="button">
          {loading ? 'Mengirim...' : 'Kirim pertanyaan'}
        </button>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}
      {answer ? (
        <div className="result-card ai-answer">
          <h3>Jawaban</h3>
          <p>{answer}</p>
        </div>
      ) : null}
    </section>
  )
}

function SeniorAppShell({
  activePath,
  navigate
}: {
  activePath: string
  navigate: (path: string) => void
}) {
  const seniorPath = ['/dashboard', '/measurements/new', '/emergency'].includes(activePath)
    ? activePath
    : '/dashboard'
  const [sosPressed, setSosPressed] = useState(false)

  function longPressStart() {
    window.setTimeout(() => setSosPressed(true), 900)
  }

  return (
    <main className="senior-shell">
      <nav className="senior-tabs" aria-label="Navigasi senior">
        <button className={seniorPath === '/dashboard' ? 'active' : ''} onClick={() => navigate('/dashboard')} type="button">
          Beranda
        </button>
        <button className={seniorPath === '/measurements/new' ? 'active' : ''} onClick={() => navigate('/measurements/new')} type="button">
          Tambah Data
        </button>
        <button className={seniorPath === '/emergency' ? 'active' : ''} onClick={() => navigate('/emergency')} type="button">
          Darurat
        </button>
      </nav>

      <section className="senior-content">
        {seniorPath === '/dashboard' ? <TodayDashboard /> : null}
        {seniorPath === '/measurements/new' ? <SeniorMeasurementFlow /> : null}
        {seniorPath === '/emergency' ? (
          <div className="senior-emergency">
            <button
              className={sosPressed ? 'sos-button confirmed' : 'sos-button'}
              onMouseDown={longPressStart}
              onTouchStart={longPressStart}
              type="button"
            >
              TOMBOL SOS
            </button>
            {sosPressed ? <p className="form-message success">SOS long-press terdeteksi. Hubungi kontak darurat atau layanan medis setempat.</p> : null}
            <EmergencyContactsPage />
          </div>
        ) : null}
      </section>
    </main>
  )
}

function renderRoute(appPath: string) {
  if (appPath === '/dashboard') return <TodayDashboard />
  if (appPath === '/dashboard/week') return <WeeklyDashboard />
  if (appPath === '/dashboard/month') return <MonthlyDashboard />
  if (appPath === '/measurements/new') return <SelectMetricPage />
  if (appPath === '/measurements/history') return <MeasurementHistoryPage />
  if (appPath === '/measurements/senior') return <SeniorMeasurementFlow />
  if (appPath === '/tracker') return <TrackerPage />
  if (appPath === '/ai-assistant') return <AiAssistantPage />
  if (appPath === '/reports/daily') return <DailyReportPage />
  if (appPath === '/reports/weekly') return <WeeklyReportPage />
  if (appPath === '/reports/monthly') return <MonthlyReportPage />
  if (appPath === '/reports/doctor') return <DoctorReportPage />
  if (appPath === '/reminders') return <RemindersPage />
  if (appPath === '/medications') return <MedicationsPage />
  if (appPath === '/family') return <FamilyPage />
  if (appPath === '/caregiver') return <CaregiverDashboardPage />
  if (appPath === '/fasting') return <FastingPage />
  if (appPath === '/emergency') return <EmergencyContactsPage />
  if (appPath === '/telegram') return <TelegramSettingsPage />
  if (appPath === '/alerts') return <AlertsPage />
  if (appPath === '/patterns') return <PatternsPage />
  if (appPath === '/kb') return <KnowledgeBasePage />
  if (appPath === '/settings/profile') return <ProfileSettingsPage />
  if (appPath === '/settings/delete') return <ProfileDeletePage />
  if (appPath === '/admin/configs') return <ConfigDashboardPage />
  return <TodayDashboard />
}

function AppRoutes() {
  const { loading, user, profile, requiresOnboarding } = useAuth()
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname))
  const [authView, setAuthView] = useState<'login' | 'register'>(() =>
    normalizePath(window.location.pathname) === '/register' ? 'register' : 'login'
  )

  useEffect(() => {
    function handlePopState() { setCurrentPath(normalizePath(window.location.pathname)) }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function showAuthView(view: 'login' | 'register') {
    const path = view === 'login' ? '/login' : '/register'
    window.history.pushState(null, '', path)
    setCurrentPath(path)
    setAuthView(view)
  }

  function navigate(path: string) {
    window.history.pushState(null, '', path)
    setCurrentPath(normalizePath(path))
  }

  if (loading) {
    return (
      <main className="auth-page">
        <p className="loading-text">Memeriksa sesi...</p>
      </main>
    )
  }

  if (!user) {
    const authPath = normalizePath(window.location.pathname)
    if (!['/login', '/register'].includes(authPath)) {
      window.history.replaceState(null, '', '/login')
    }
    const effectiveAuthView = authPath === '/register' ? 'register' : authView
    return effectiveAuthView === 'login' ? (
      <LoginPage onShowRegister={() => showAuthView('register')} />
    ) : (
      <RegisterPage onShowLogin={() => showAuthView('login')} />
    )
  }

  if (requiresOnboarding) {
    if (window.location.pathname !== '/onboarding') {
      window.history.replaceState(null, '', '/onboarding')
    }
    return <OnboardingPage />
  }

  const appPath = ALLOWED_PATHS.has(currentPath) ? currentPath : '/dashboard'
  if (!ALLOWED_PATHS.has(currentPath) || normalizePath(window.location.pathname) === '/onboarding') {
    window.history.replaceState(null, '', '/dashboard')
  }

  if (profile?.accessibilityMode === 'senior') {
    return <SeniorAppShell activePath={appPath} navigate={navigate} />
  }

  const isAdmin = !!user.email && ['admin@homesungai.com'].includes(user.email)
  const visibleNav = NAV.filter(link => (!link.adminOnly || isAdmin) && link.visible !== false)
  const currentLink = visibleNav.find(link => link.path === appPath)
  const navSections = Object.entries(SECTION_LABELS).map(([section, title]) => ({
    section,
    title,
    links: visibleNav.filter(link => link.section === section)
  }))

  return (
    <main className="app-page">
      <aside className="app-sidebar" aria-label="Navigasi aplikasi">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">+</span>
          <div>
            <strong>HealthSync Pro</strong>
            <span>Enterprise Health</span>
          </div>
        </div>

        <button className="emergency-support-btn" onClick={() => navigate('/emergency')} type="button">
          <span aria-hidden="true">✱</span>
          Emergency Support
        </button>

        <nav className="app-nav" aria-label="Navigasi utama">
          {navSections.map(({ section, links }) => links.length > 0 ? (
            <div className="nav-section" key={section}>
              {links.map((link) => (
                <button
                  aria-current={appPath === link.path ? 'page' : undefined}
                  className={appPath === link.path ? 'nav-btn active' : 'nav-btn'}
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  type="button"
                >
                  <span className="nav-dot" aria-hidden="true" />
                  <span>{link.label}</span>
                  {link.badge ? <span className="nav-badge">{link.badge}</span> : null}
                </button>
              ))}
            </div>
          ) : null)}
        </nav>

        <div className="sidebar-footer">
          <button onClick={() => navigate('/kb')} type="button">
            <span aria-hidden="true">?</span>
            Help Center
          </button>
          <button onClick={() => navigate('/login')} type="button">
            <span aria-hidden="true">↳</span>
            Logout
          </button>
        </div>
      </aside>

      <div className="app-main">
        <div className="app-topbar">
          <label className="topbar-search">
            <span className="visually-hidden">Search</span>
            <input placeholder="Search patients, reports, or data..." type="search" />
          </label>
          <div className="topbar-actions" aria-label="Workspace actions">
            <button type="button" aria-label="Notifications">⌁</button>
            <button type="button" aria-label="Help">?</button>
            <div className="topbar-user" aria-label={`User aktif ${user.displayName}`}>
              <div>
                <strong>{user.displayName}</strong>
                <small>Cardiology</small>
              </div>
              <span>{getInitials(user.displayName)}</span>
            </div>
          </div>
        </div>

        <header className="app-header">
          <div>
            <h1>{currentLink?.label ?? 'Dashboard'}</h1>
            <p>{user.displayName}, here is your clinical overview for today.</p>
          </div>
        </header>

        <section className="app-content">{renderRoute(appPath)}</section>
      </div>

      <nav className="app-bottom-nav" aria-label="Navigasi cepat">
        {visibleNav.filter(link => MOBILE_NAV_PATHS.has(link.path)).map((link) => (
          <button
            aria-current={appPath === link.path ? 'page' : undefined}
            className={appPath === link.path ? 'bottom-nav-btn active' : 'bottom-nav-btn'}
            key={link.path}
            onClick={() => navigate(link.path)}
            type="button"
          >
            <span className="nav-dot" aria-hidden="true" />
            {link.shortLabel}
          </button>
        ))}
      </nav>
    </main>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
