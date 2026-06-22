import { useEffect, useRef, useState } from 'react'
import { formatIndonesianDate } from './utils/dateFormat'
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
  icon: string
  adminOnly?: boolean
  visible?: boolean
  badge?: string
}

type HistoryValue = {
  id: number
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  manualOverride: number
}

type HistoryAttachment = {
  id: number
  metricCode: string
  fileName: string
}

type HistorySession = {
  id: number
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
  measuredAt?: string
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  usedFallback?: boolean
}

type NavGroup = {
  label: string
  icon: string
  shortLabel: string
  children: NavLink[]
}

const NAV_GROUPS: (NavGroup | NavLink)[] = [
  {
    label: 'Dashboard',
    icon: 'dashboard',
    shortLabel: 'Dash',
    children: [
      { path: '/dashboard', label: 'Today', shortLabel: 'Today', icon: 'dashboard' },
      { path: '/dashboard/week', label: 'Weekly View', shortLabel: 'Week', icon: 'date_range' },
      { path: '/dashboard/month', label: 'Monthly Summary', shortLabel: 'Month', icon: 'calendar_month' },
    ]
  },
  { path: '/measurements/new', label: 'New Measurement', shortLabel: 'New', icon: 'add_circle' },
  { path: '/measurements/history', label: 'History', shortLabel: 'History', icon: 'history' },
  {
    label: 'Reports',
    icon: 'assessment',
    shortLabel: 'Rpts',
    children: [
      { path: '/reports/daily', label: 'Daily Report', shortLabel: 'Daily', icon: 'today' },
      { path: '/reports/weekly', label: 'Weekly Report', shortLabel: 'Weekly', icon: 'date_range' },
      { path: '/reports/monthly', label: 'Monthly Report', shortLabel: 'Monthly', icon: 'calendar_month' },
      { path: '/reports/doctor', label: 'Doctor Report', shortLabel: 'Doctor', icon: 'description' },
    ]
  },
  { path: '/ai-assistant', label: 'AI Assistant', shortLabel: 'AI', icon: 'smart_toy' },
  { path: '/alerts', label: 'Notifications & Alerts', shortLabel: 'Alerts', icon: 'notifications', badge: '3' },
  {
    label: 'Health',
    icon: 'favorite',
    shortLabel: 'Health',
    children: [
      { path: '/tracker', label: 'Fasting & Medication', shortLabel: 'Track', icon: 'timer' },
      { path: '/fasting', label: 'Fasting Timer', shortLabel: 'Fast', icon: 'timer' },
      { path: '/medications', label: 'Medication', shortLabel: 'Meds', icon: 'medication' },
      { path: '/patterns', label: 'Patterns', shortLabel: 'Pattern', icon: 'insights' },
    ]
  },
  { path: '/family', label: 'Family / Caregiver', shortLabel: 'Family', icon: 'family_restroom' },
  { path: '/reminders', label: 'Reminders', shortLabel: 'Remind', icon: 'alarm' },
  { path: '/emergency', label: 'Emergency Contacts', shortLabel: 'SOS', icon: 'emergency' },
  { path: '/settings/profile', label: 'Settings', shortLabel: 'Settings', icon: 'settings' },
]

const NAV: NavLink[] = NAV_GROUPS.flatMap(g => 'children' in g ? g.children : [g]).filter(n => !('children' in n)) as NavLink[]
NAV.push({ path: '/settings/delete', label: 'Delete Account', shortLabel: 'Privacy', icon: 'delete', visible: false })
NAV.push({ path: '/measurements/senior', label: 'Senior Mode', shortLabel: 'Senior', icon: 'elderly', visible: false })
NAV.push({ path: '/telegram', label: 'Telegram', shortLabel: 'Telegram', icon: 'send', visible: false })
NAV.push({ path: '/admin/configs', label: 'Admin', shortLabel: 'Admin', icon: 'admin_panel_settings', adminOnly: true })

const ALLOWED_PATHS = new Set(NAV.map(n => n.path).concat(['/kb']))
const MOBILE_NAV_PATHS = new Set(['/dashboard', '/measurements/new', '/measurements/history', '/alerts', '/ai-assistant', '/emergency'])

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

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`.trim()} aria-hidden="true">
      {name}
    </span>
  )
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
          setError(body.error?.message ?? 'Failed to load history.')
          return
        }
        setSessions(body.data?.sessions ?? [])
      } catch {
        setError('Could not connect to server.')
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
          <h2 id="history-title">Measurement History</h2>
          <p>Comprehensive log of all patient vitals and raw data inputs.</p>
        </div>
        <span className="status-chip">{sessions.length} sessions</span>
      </div>

      {loading ? <p>Loading history...</p> : null}
      {error ? <p className="form-message error" role="status">{error}</p> : null}
      {!loading && sessions.length === 0 ? <p>No measurement history yet.</p> : null}

      {sessions.length > 0 ? (
        <table className="report-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Metric</th>
              <th>Result Value</th>
              <th>Status</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {sessions.flatMap((session) =>
              session.values.map((value, idx) => {
                const attachment = session.attachments.find(a => a.metricCode === value.metricCode)
                return (
                  <tr key={`${session.id}-${value.id}`}>
                    {idx === 0 ? (
                      <td rowSpan={session.values.length} style={{ verticalAlign: 'middle', borderRight: '1px solid var(--colorBorder)' }}>
                        <strong>{formatIndonesianDate(session.measuredAt)}</strong>
                      </td>
                    ) : null}
                    <td>
                      <span className="metric-code-badge">{value.metricCode}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '1.1em' }}>{value.finalValue}</strong> <span className="meta">{value.unit}</span>
                      {value.manualOverride === 1 ? <span className="badge-override">Manual</span> : null}
                    </td>
                    <td>
                      <span className={`badge-status badge-${value.status}`}>
                        <span className="status-dot" />{value.status}
                      </span>
                    </td>
                    <td>
                      {attachment ? (
                        <button className="evidence-btn" onClick={() => setSelectedAttachment(attachment)} type="button">
                          <Icon name="photo_camera" /> View
                        </button>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.85em' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Halo. Saya bisa membantu merangkum data vital terbaru dan memberi edukasi gaya hidup umum yang aman.'
    }
  ])
  const [vitals, setVitals] = useState<VitalSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) return

    setLoading(true)
    setError(null)
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedQuestion
    }
    setMessages((prev) => [...prev, userMessage])
    setQuestion('')
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmedQuestion })
      })
      const body = (await res.json()) as AiAssistantResponse
      if (!res.ok || !body.success || !body.data) {
        setError(body.error?.message ?? 'AI assistant failed to respond.')
        return
      }
      setVitals(body.data.vitals)
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: body.data?.reply ?? '',
          model: body.data?.model,
          usedFallback: body.data?.usedFallback
        }
      ])
    } catch {
      setError('Could not connect to server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="settings-panel ai-assistant-panel" aria-labelledby="ai-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">AI Assistant</p>
          <h2 id="ai-title">Safe Health Chat</h2>
          <p>LLM uses latest vital context, but does not provide diagnosis or medication dosage.</p>
        </div>
        <span className="status-chip">Rule-first</span>
      </div>

      <div className="ai-context-banner">
        <div>
          <p className="eyebrow">Current Health Context</p>
          <h3>{vitals.length > 0 ? `${vitals.length} latest vitals injected` : 'Vitals context ready'}</h3>
          <p>Responses use this context only for education. Medical status still follows the rule engine.</p>
        </div>
        {vitals.length === 0 ? <span className="status-chip">No vitals yet</span> : (
          <div className="vital-strip" aria-label="Latest vitals">
            {vitals.map((value) => (
              <span key={`${value.metricCode}-${value.finalValue}`}>
                <span className={`badge-status badge-${value.severity}`}><span className="status-dot" />{value.metricCode}</span>: {value.finalValue} {value.unit}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="ai-safety-note" role="note">
        AI hanya memberi edukasi umum. AI tidak membuat diagnosis, tidak menentukan tingkat keparahan, dan tidak mengubah dosis obat.
      </div>

      <div className="ai-chat-window" aria-live="polite">
        {messages.map((message) => (
          <article className={`chat-bubble ${message.role}`} key={message.id}>
            <div className="chat-meta">
              <span>{message.role === 'user' ? 'You' : 'HL AI'}</span>
              {message.model ? <span>{message.usedFallback ? 'fallback' : message.model}</span> : null}
            </div>
            <p>{message.content}</p>
          </article>
        ))}
        {loading ? (
          <article className="chat-bubble assistant typing">
            <div className="chat-meta"><span>HL AI</span><span>typing</span></div>
            <p>Menyiapkan jawaban aman...</p>
          </article>
        ) : null}
      </div>

      <div className="settings-card ai-compose-card">
        <label>
          Question
          <textarea
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                void ask()
              }
            }}
            rows={4}
            value={question}
          />
        </label>
        <button disabled={loading || !question.trim()} onClick={() => void ask()} type="button">
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}
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
  const sosTimerRef = useRef<number | null>(null)

  function clearSosTimer() {
    if (sosTimerRef.current !== null) {
      window.clearTimeout(sosTimerRef.current)
      sosTimerRef.current = null
    }
  }

  function longPressStart() {
    clearSosTimer()
    sosTimerRef.current = window.setTimeout(() => {
      sosTimerRef.current = null
      setSosPressed(true)
    }, 900)
  }

  function longPressEnd() {
    clearSosTimer()
  }

  useEffect(() => () => clearSosTimer(), [])

  return (
    <main className="senior-shell">
      <nav className="senior-tabs" aria-label="Senior navigation">
        <button className={seniorPath === '/dashboard' ? 'active' : ''} onClick={() => navigate('/dashboard')} type="button">
          Home
        </button>
        <button className={seniorPath === '/measurements/new' ? 'active' : ''} onClick={() => navigate('/measurements/new')} type="button">
          Add Data
        </button>
        <button className={seniorPath === '/emergency' ? 'active' : ''} onClick={() => navigate('/emergency')} type="button">
          Emergency
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
              onMouseUp={longPressEnd}
              onMouseLeave={longPressEnd}
              onTouchStart={longPressStart}
              onTouchEnd={longPressEnd}
              onTouchCancel={longPressEnd}
              type="button"
            >
              SOS BUTTON
            </button>
            {sosPressed ? <p className="form-message success">SOS long-press detected. Contact emergency services or local medical assistance.</p> : null}
            <EmergencyContactsPage />
          </div>
        ) : null}
      </section>
    </main>
  )
}

function renderRoute(appPath: string, onNavigate?: (path: string) => void) {
  if (appPath === '/dashboard') return <TodayDashboard onNavigateTab={onNavigate} />
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
  const [liveTime, setLiveTime] = useState(new Date())
  const [notifOpen, setNotifOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('hl-sidebar-collapsed') === 'true' } catch { return false }
  })
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NavLink[]>([])
  const searchWrapRef = useRef<HTMLDivElement | null>(null)
  const notifRef = useRef<HTMLDivElement | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Dashboard', 'Reports']))

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('hl-sidebar-collapsed', String(next)) } catch { /* ignore */ }
      return next
    })
  }

  async function handleLogout() {
    setUserMenuOpen(false)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch { /* ignore */ }
    navigate('/login')
  }

  useEffect(() => {
    function handlePopState() { setCurrentPath(normalizePath(window.location.pathname)) }
    window.addEventListener('popstate', handlePopState)
    const timer = setInterval(() => setLiveTime(new Date()), 1000)
    function handleDocClick(event: MouseEvent) {
      const target = event.target as Node
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) {
        setSearchResults([])
        setSearchQuery('')
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleDocClick)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      clearInterval(timer)
      document.removeEventListener('mousedown', handleDocClick)
    }
  }, [])

  function showAuthView(view: 'login' | 'register') {
    const path = view === 'login' ? '/login' : '/register'
    window.history.pushState(null, '', path)
    setCurrentPath(path)
    setAuthView(view)
  }

  function navigate(path: string) {
    setNotifOpen(false)
    setUserMenuOpen(false)
    setSearchQuery('')
    window.history.pushState(null, '', path)
    setCurrentPath(normalizePath(path))
  }

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

  function formatClock(d: Date) {
    const day = dayNames[d.getDay()]
    const date = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
    const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return { dateStr: `${day}, ${date}`, timeStr: time }
  }

  if (loading) {
    return (
      <main className="auth-page">
        <p className="loading-text">Checking session...</p>
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

  const SEARCH_EXTRA: NavLink[] = [
    { path: '/kb', label: 'Knowledge Base', shortLabel: 'KB', icon: 'menu_book' }
  ]

  function handleSearch(query: string) {
    setSearchQuery(query)
    const q = query.trim().toLowerCase()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    const pool: NavLink[] = [...visibleNav]
    if (!pool.some(n => n.path === '/kb')) pool.push(...SEARCH_EXTRA)
    const matches = pool.filter(link =>
      link.label.toLowerCase().includes(q) ||
      link.shortLabel.toLowerCase().includes(q) ||
      link.path.toLowerCase().includes(q)
    )
    setSearchResults(matches.slice(0, 8))
  }

  function selectSearchResult(path: string) {
    setSearchQuery('')
    setSearchResults([])
    navigate(path)
  }
  const visibleNavGroups = NAV_GROUPS.filter(g => {
    if ('children' in g) {
      return g.children.some(c => !c.adminOnly || isAdmin)
    }
    return (!g.adminOnly || isAdmin) && g.visible !== false
  }) as (NavGroup | NavLink)[]
  const currentLink = visibleNav.find(link => link.path === appPath)
  const PAGE_LABELS: Record<string, string> = { '/kb': 'Knowledge Base', '/tracker': 'Fasting & Medication', '/caregiver': 'Caregiver Dashboard' }
  const firstName = user.displayName.split(' ').filter(Boolean)[0] ?? 'there'
  const headerTitle = appPath === '/dashboard' ? `Good Morning, ${firstName}` : PAGE_LABELS[appPath] ?? currentLink?.label ?? 'Dashboard'
  const headerSubtitle = appPath === '/dashboard'
    ? 'Here is your daily health summary.'
    : 'Here is your clinical overview for today.'
  const clock = formatClock(liveTime)
  const currentTheme = profile?.theme ?? 'light'

  function toggleGroup(label: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  function setTheme(next: string) {
    document.documentElement.dataset.theme = next
    fetch('/api/profile', {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next, timezone: profile?.timezone ?? 'Asia/Jakarta', heightCm: profile?.heightCm ?? 170, accessibilityMode: profile?.accessibilityMode ?? 'normal' })
    }).catch(() => {})
  }

  return (
    <main className={`app-page ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="app-sidebar" aria-label="App navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            <span className="sidebar-brand-icon" aria-hidden="true">
              <Icon name="local_hospital" className="fill" />
            </span>
            {!sidebarCollapsed && <div>
              <h1>HealthSync Pro</h1>
              <p>Enterprise Health</p>
            </div>}
          </div>
          <button className="sidebar-collapse-btn" onClick={toggleSidebar} type="button" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name={sidebarCollapsed ? 'chevron_right' : 'chevron_left'} />
          </button>
          {!sidebarCollapsed && (
            <button className="emergency-support-btn" onClick={() => navigate('/emergency')} type="button">
              <Icon name="emergency" />
              Emergency Support
            </button>
          )}
        </div>

        <div className="sidebar-nav-scroll">
          <nav className="sidebar-nav" aria-label="Main navigation">
            {visibleNavGroups.map((item) => {
              if ('children' in item) {
                const isExpanded = expandedGroups.has(item.label)
                const hasActiveChild = item.children.some(c => c.path === appPath)
                return (
                  <div key={item.label} className={`nav-group ${hasActiveChild ? 'has-active' : ''}`}>
                    <button
                      className={`nav-group-toggle ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleGroup(item.label)}
                      type="button"
                    >
                      <Icon name={item.icon} className="nav-icon" />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                      {!sidebarCollapsed && <Icon name="expand_more" className="nav-group-chevron" />}
                    </button>
                    {!sidebarCollapsed && isExpanded && (
                      <div className="nav-group-children">
                        {item.children.map((child) => (
                          <button
                            key={child.path}
                            className={`nav-btn nav-child ${appPath === child.path ? 'active' : ''}`}
                            onClick={() => navigate(child.path)}
                            type="button"
                          >
                            <Icon name={child.icon} className="nav-icon" />
                            <span>{child.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <button
                  key={item.path}
                  className={appPath === item.path ? 'nav-btn active' : 'nav-btn'}
                  onClick={() => navigate(item.path)}
                  title={sidebarCollapsed ? item.label : undefined}
                  type="button"
                >
                  <Icon name={item.icon} className="nav-icon" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                  {!sidebarCollapsed && item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button onClick={() => navigate('/kb')} type="button" title={sidebarCollapsed ? 'Help Center' : undefined}>
            <Icon name="help" />
            {!sidebarCollapsed && <span>Help Center</span>}
          </button>
          <button onClick={handleLogout} type="button" title={sidebarCollapsed ? 'Logout' : undefined}>
            <Icon name="logout" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="app-main">
        <div className="mobile-topbar">
          <div className="mobile-topbar-brand">
            <span className="sidebar-brand-icon mobile-brand-icon" aria-hidden="true">
              <Icon name="health_and_safety" className="fill" />
            </span>
            <h1>HealthSync Pro</h1>
          </div>
          <div className="mobile-topbar-actions">
            <button type="button" aria-label="Buka notifikasi" onClick={() => setNotifOpen(o => !o)}>
              <Icon name="notifications" />
            </button>
            <button type="button" aria-label="Buka menu pengguna" className="mobile-topbar-avatar" onClick={() => setUserMenuOpen(o => !o)}>
              {getInitials(user.displayName)}
            </button>
          </div>
        </div>
        <div className="app-topbar">
          <div className="topbar-search-wrap" ref={searchWrapRef}>
            <label className="topbar-search">
              <Icon name="search" className="search-icon" />
              <span className="visually-hidden-file">Search</span>
              <input
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('')
                    setSearchResults([])
                  } else if (e.key === 'Enter' && searchResults[0]) {
                    e.preventDefault()
                    selectSearchResult(searchResults[0].path)
                  }
                }}
                placeholder="Cari pengukuran, laporan, atau KB..."
                type="search"
                value={searchQuery}
              />
            </label>
            {searchQuery.trim().length >= 2 ? (
              <div className="search-dropdown" role="listbox">
                {searchResults.length === 0 ? (
                  <div className="search-empty">Tidak ada hasil untuk "{searchQuery}"</div>
                ) : (
                  searchResults.map((link) => (
                    <button
                      className="search-result-item"
                      key={link.path}
                      onClick={() => selectSearchResult(link.path)}
                      type="button"
                    >
                      <Icon name={link.icon} className="nav-icon" />
                      <span className="search-result-label">{link.label}</span>
                      <span className="search-result-path">{link.path}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <div className="topbar-actions" aria-label="Workspace actions">
            <div className="topbar-clock hidden xl:flex flex-col items-end border-r border-outline-variant pr-6 mr-6">
              <span className="clock-date">{clock.dateStr}</span>
              <span className="clock-time">{clock.timeStr}</span>
            </div>
            <div className="topbar-theme-switch">
              <button className={currentTheme === 'light' ? 'active' : ''} onClick={() => setTheme('light')} type="button" aria-label="Light mode"><Icon name="light_mode" /></button>
              <button className={currentTheme === 'warm' ? 'active' : ''} onClick={() => setTheme('warm')} type="button" aria-label="Warm mode"><Icon name="wb_sunny" /></button>
              <button className={currentTheme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')} type="button" aria-label="Dark mode"><Icon name="dark_mode" /></button>
            </div>
            <button className="topbar-icon-btn" onClick={() => navigate('/kb')} type="button" aria-label="Knowledge Base"><Icon name="menu_book" /></button>
            <div className="topbar-notif-wrap" ref={notifRef}>
              <button className="topbar-icon-btn has-alert" onClick={() => setNotifOpen(o => !o)} type="button" aria-label="Notifications"><Icon name="notifications" /></button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">Notifications</div>
                  <div className="notif-empty">No new notifications</div>
                </div>
              )}
            </div>
            <div className="topbar-user-wrap" ref={userMenuRef}>
              <button className="topbar-user" onClick={() => setUserMenuOpen(o => !o)} type="button" aria-label={`User menu for ${user.displayName}`}>
                <strong>{user.displayName}</strong>
                <span className="topbar-user-avatar">{getInitials(user.displayName)}</span>
              </button>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <button onClick={() => { setUserMenuOpen(false); navigate('/settings/profile') }} type="button">
                    <Icon name="person" /> Profile & Settings
                  </button>
                  <button onClick={() => { setUserMenuOpen(false); navigate('/reports/daily') }} type="button">
                    <Icon name="assessment" /> My Reports
                  </button>
                  <hr />
                  <button onClick={handleLogout} type="button" className="user-dropdown-logout">
                    <Icon name="logout" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="app-content-area">
          <header className="app-header">
            <div>
              <h1>{headerTitle}</h1>
              <p>{headerSubtitle}</p>
            </div>
          </header>

          <section className="app-content">{renderRoute(appPath, navigate)}</section>
        </div>
      </div>

      <button className="mobile-add-fab" onClick={() => navigate('/measurements/new')} type="button" aria-label="Add measurement">
        <Icon name="add" />
      </button>

      <button className="ai-fab" onClick={() => navigate('/ai-assistant')} type="button" aria-label="AI Assistant">
        <Icon name="smart_toy" />
      </button>

      <nav className="app-bottom-nav" aria-label="Quick navigation">
        {visibleNav.filter(link => MOBILE_NAV_PATHS.has(link.path)).map((link) => (
          <button
            aria-current={appPath === link.path ? 'page' : undefined}
            className={appPath === link.path ? 'bottom-nav-btn active' : 'bottom-nav-btn'}
            key={link.path}
            onClick={() => navigate(link.path)}
            type="button"
          >
            <Icon name={link.icon} />
            <span>{link.shortLabel}</span>
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
