import { useEffect, useRef, useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/auth'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { OnboardingPage } from './pages/onboarding/OnboardingPage'
import { HistoryPage } from './pages/measurement/HistoryPage'
import { AiAssistantPage } from './pages/ai/AiAssistantPage'
import { TrackerPage } from './pages/tracker/TrackerPage'
import { SeniorAppShell } from './components/SeniorAppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TodayDashboard } from './pages/dashboard/TodayDashboard'
import { WeeklyDashboard } from './pages/dashboard/WeeklyDashboard'
import { MonthlyDashboard } from './pages/dashboard/MonthlyDashboard'
import { SelectMetricPage } from './pages/measurement/SelectMetricPage'
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
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage'
import { ProfileDeletePage } from './pages/settings/ProfileDeletePage'
import { ConfigDashboardPage } from './pages/admin/ConfigDashboardPage'
import { SeniorMeasurementFlow } from './pages/measurement/SeniorMeasurementFlow'
import './App.css'

/* ---- Navigation config ---- */

type NavLink = { path: string; label: string; shortLabel: string; icon: string; adminOnly?: boolean; visible?: boolean; badge?: string }
type NavGroup = { label: string; icon: string; shortLabel: string; children: NavLink[] }

const NAV_GROUPS: (NavGroup | NavLink)[] = [
  { label: 'Dashboard', icon: 'dashboard', shortLabel: 'Dash', children: [
    { path: '/dashboard', label: 'Today', shortLabel: 'Today', icon: 'dashboard' },
    { path: '/dashboard/week', label: 'Weekly View', shortLabel: 'Week', icon: 'date_range' },
    { path: '/dashboard/month', label: 'Monthly Summary', shortLabel: 'Month', icon: 'calendar_month' },
  ]},
  { path: '/measurements/new', label: 'New Measurement', shortLabel: 'New', icon: 'add_circle' },
  { path: '/measurements/history', label: 'History', shortLabel: 'History', icon: 'history' },
  { label: 'Reports', icon: 'assessment', shortLabel: 'Rpts', children: [
    { path: '/reports/daily', label: 'Daily Report', shortLabel: 'Daily', icon: 'today' },
    { path: '/reports/weekly', label: 'Weekly Report', shortLabel: 'Weekly', icon: 'date_range' },
    { path: '/reports/monthly', label: 'Monthly Report', shortLabel: 'Monthly', icon: 'calendar_month' },
    { path: '/reports/doctor', label: 'Doctor Report', shortLabel: 'Doctor', icon: 'description' },
  ]},
  { path: '/ai-assistant', label: 'AI Assistant', shortLabel: 'AI', icon: 'smart_toy' },
  { path: '/alerts', label: 'Notifications & Alerts', shortLabel: 'Alerts', icon: 'notifications', badge: '3' },
  { label: 'Health', icon: 'favorite', shortLabel: 'Health', children: [
    { path: '/tracker', label: 'Fasting & Medication', shortLabel: 'Track', icon: 'timer' },
    { path: '/fasting', label: 'Fasting Timer', shortLabel: 'Fast', icon: 'timer' },
    { path: '/medications', label: 'Medication', shortLabel: 'Meds', icon: 'medication' },
    { path: '/patterns', label: 'Patterns', shortLabel: 'Pattern', icon: 'insights' },
  ]},
  { path: '/family', label: 'Family / Caregiver', shortLabel: 'Family', icon: 'family_restroom' },
  { path: '/reminders', label: 'Reminders', shortLabel: 'Remind', icon: 'alarm' },
  { path: '/emergency', label: 'Emergency Contacts', shortLabel: 'SOS', icon: 'emergency' },
  { path: '/settings/profile', label: 'Settings', shortLabel: 'Settings', icon: 'settings' },
]

const NAV: NavLink[] = NAV_GROUPS.flatMap(g => 'children' in g ? g.children : [g]).filter(n => !('children' in n)) as NavLink[]
NAV.push(
  { path: '/settings/delete', label: 'Delete Account', shortLabel: 'Privacy', icon: 'delete', visible: false },
  { path: '/measurements/senior', label: 'Senior Mode', shortLabel: 'Senior', icon: 'elderly', visible: false },
  { path: '/telegram', label: 'Telegram', shortLabel: 'Telegram', icon: 'send', visible: false },
  { path: '/admin/configs', label: 'Admin', shortLabel: 'Admin', icon: 'admin_panel_settings', adminOnly: true },
)

const ALLOWED_PATHS = new Set(NAV.map(n => n.path).concat(['/kb']))
const MOBILE_NAV_PATHS = new Set(['/dashboard', '/measurements/new', '/measurements/history', '/alerts', '/ai-assistant', '/emergency'])

/* ---- Helpers ---- */

function normalizePath(path: string) {
  if (path === '/auth/register') return '/register'
  if (path === '/auth/login' || path === '/auth') return '/login'
  return path
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'HL'
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`.trim()} aria-hidden="true">{name}</span>
}

/* ---- Route renderer ---- */

function renderRoute(appPath: string, onNavigate?: (path: string) => void) {
  switch (appPath) {
    case '/dashboard': return <TodayDashboard onNavigateTab={onNavigate} />
    case '/dashboard/week': return <WeeklyDashboard />
    case '/dashboard/month': return <MonthlyDashboard />
    case '/measurements/new': return <SelectMetricPage />
    case '/measurements/history': return <HistoryPage />
    case '/measurements/senior': return <SeniorMeasurementFlow />
    case '/tracker': return <TrackerPage />
    case '/ai-assistant': return <AiAssistantPage />
    case '/reports/daily': return <DailyReportPage />
    case '/reports/weekly': return <WeeklyReportPage />
    case '/reports/monthly': return <MonthlyReportPage />
    case '/reports/doctor': return <DoctorReportPage />
    case '/reminders': return <RemindersPage />
    case '/medications': return <MedicationsPage />
    case '/family': return <FamilyPage />
    case '/caregiver': return <CaregiverDashboardPage />
    case '/fasting': return <FastingPage />
    case '/emergency': return <EmergencyContactsPage />
    case '/telegram': return <TelegramSettingsPage />
    case '/alerts': return <AlertsPage />
    case '/patterns': return <PatternsPage />
    case '/kb': return <KnowledgeBasePage />
    case '/settings/profile': return <ProfileSettingsPage />
    case '/settings/delete': return <ProfileDeletePage />
    case '/admin/configs': return <ConfigDashboardPage />
    default: return <TodayDashboard />
  }
}

/* ---- Main layout ---- */

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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Dashboard', 'Reports', 'Health']))

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('hl-sidebar-collapsed', String(next)) } catch { /* ignore */ }
      return next
    })
  }

  async function handleLogout() {
    setUserMenuOpen(false)
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } catch { /* ignore */ }
    navigate('/login')
  }

  useEffect(() => {
    function handlePopState() { setCurrentPath(normalizePath(window.location.pathname)) }
    window.addEventListener('popstate', handlePopState)
    const timer = setInterval(() => setLiveTime(new Date()), 1000)
    function handleDocClick(event: MouseEvent) {
      const target = event.target as Node
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) { setSearchResults([]); setSearchQuery('') }
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false)
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
    setNotifOpen(false); setUserMenuOpen(false); setSearchQuery('')
    window.history.pushState(null, '', path)
    setCurrentPath(normalizePath(path))
  }

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

  function formatClock(d: Date) {
    const day = dayNames[d.getDay()]
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      dateStr: `${day}, ${pad(d.getDate())} ${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      timeStr: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }
  }

  /* ---- Auth / Loading / Onboarding gates ---- */
  if (loading) return <main className="auth-page"><p className="loading-text">Checking session...</p></main>

  if (!user) {
    const authPath = normalizePath(window.location.pathname)
    if (!['/login', '/register'].includes(authPath)) window.history.replaceState(null, '', '/login')
    const view = authPath === '/register' ? 'register' : authView
    return view === 'login'
      ? <LoginPage onShowRegister={() => showAuthView('register')} />
      : <RegisterPage onShowLogin={() => showAuthView('login')} />
  }

  if (requiresOnboarding) {
    if (window.location.pathname !== '/onboarding') window.history.replaceState(null, '', '/onboarding')
    return <OnboardingPage />
  }

  const appPath = ALLOWED_PATHS.has(currentPath) ? currentPath : '/dashboard'
  if (!ALLOWED_PATHS.has(currentPath) || normalizePath(window.location.pathname) === '/onboarding')
    window.history.replaceState(null, '', '/dashboard')

  /* ---- Senior shell ---- */
  if (profile?.accessibilityMode === 'senior')
    return <SeniorAppShell activePath={appPath} navigate={navigate} />

  /* ---- Desktop / Mobile shell ---- */
  const isAdmin = user.email === 'admin@homesungai.com'
  const visibleNav = NAV.filter(link => (!link.adminOnly || isAdmin) && link.visible !== false)
  const clock = formatClock(liveTime)
  const firstName = user.displayName.split(' ').filter(Boolean)[0] ?? 'there'
  const currentLink = visibleNav.find(link => link.path === appPath)
  const headerTitle = appPath === '/dashboard' ? `Good Morning, ${firstName}` : currentLink?.label ?? 'Dashboard'

  return (
    <main className={`app-page ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ---- Sidebar ---- */}
      <aside className="app-sidebar" aria-label="App navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            <span className="sidebar-brand-icon"><Icon name="local_hospital" className="fill" /></span>
            {!sidebarCollapsed && <div><h1>HealthSync Pro</h1><p>Enterprise Health</p></div>}
          </div>
          <button className="sidebar-collapse-btn" onClick={toggleSidebar} type="button" aria-label={sidebarCollapsed ? 'Expand' : 'Collapse'}>
            <Icon name={sidebarCollapsed ? 'chevron_right' : 'chevron_left'} />
          </button>
          {!sidebarCollapsed && (
            <button className="emergency-support-btn" onClick={() => navigate('/emergency')} type="button">
              <Icon name="emergency" /> Emergency Support
            </button>
          )}
        </div>
        <div className="sidebar-nav-scroll">
          <nav className="sidebar-nav" aria-label="Main navigation">
            {NAV_GROUPS.map((item) => {
              if ('children' in item) {
                const isExpanded = expandedGroups.has(item.label)
                return (
                  <div key={item.label} className={`nav-group ${item.children.some(c => c.path === appPath) ? 'has-active' : ''}`}>
                    <button className={`nav-group-toggle ${isExpanded ? 'expanded' : ''}`} onClick={() => setExpandedGroups(prev => { const n = new Set(prev); n.has(item.label) ? n.delete(item.label) : n.add(item.label); return n })} type="button">
                      <Icon name={item.icon} className="nav-icon" />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                      {!sidebarCollapsed && <Icon name="expand_more" className="nav-group-chevron" />}
                    </button>
                    {!sidebarCollapsed && isExpanded && (
                      <div className="nav-group-children">
                        {item.children.map(child => (
                          <button key={child.path} className={`nav-btn nav-child ${appPath === child.path ? 'active' : ''}`} onClick={() => navigate(child.path)} type="button">
                            <Icon name={child.icon} className="nav-icon" /><span>{child.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <button key={item.path} className={appPath === item.path ? 'nav-btn active' : 'nav-btn'} onClick={() => navigate(item.path)} title={sidebarCollapsed ? item.label : undefined} type="button">
                  <Icon name={item.icon} className="nav-icon" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                  {!sidebarCollapsed && item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="sidebar-footer">
          <button onClick={() => navigate('/kb')} type="button"><Icon name="help" />{!sidebarCollapsed && <span>Help Center</span>}</button>
          <button onClick={handleLogout} type="button"><Icon name="logout" />{!sidebarCollapsed && <span>Logout</span>}</button>
        </div>
      </aside>

      {/* ---- Main ---- */}
      <div className="app-main">
        {/* Mobile topbar */}
        <div className="mobile-topbar">
          <div className="mobile-topbar-brand">
            <span className="sidebar-brand-icon mobile-brand-icon"><Icon name="health_and_safety" className="fill" /></span>
            <h1>HealthSync Pro</h1>
          </div>
          <div className="mobile-topbar-actions">
            <button type="button" aria-label="Notifications" onClick={() => setNotifOpen(o => !o)}><Icon name="notifications" /></button>
            <button type="button" aria-label="User menu" className="mobile-topbar-avatar" onClick={() => setUserMenuOpen(o => !o)}>{getInitials(user.displayName)}</button>
          </div>
        </div>

        {/* Desktop topbar */}
        <div className="app-topbar">
          <div className="topbar-search-wrap" ref={searchWrapRef}>
            <label className="topbar-search">
              <Icon name="search" className="search-icon" />
              <input onChange={e => { setSearchQuery(e.target.value); const q = e.target.value.trim().toLowerCase(); if (q.length < 2) { setSearchResults([]); return }; const pool = [...visibleNav]; if (!pool.some(n => n.path === '/kb')) pool.push({ path: '/kb', label: 'Knowledge Base', shortLabel: 'KB', icon: 'menu_book' } as NavLink); setSearchResults(pool.filter(l => l.label.toLowerCase().includes(q) || l.shortLabel.toLowerCase().includes(q) || l.path.toLowerCase().includes(q)).slice(0, 8)) }} placeholder="Cari..." type="search" value={searchQuery} />
            </label>
            {searchResults.length > 0 && (
              <div className="search-dropdown" role="listbox">
                {searchResults.map(link => (
                  <button className="search-result-item" key={link.path} onClick={() => { setSearchQuery(''); setSearchResults([]); navigate(link.path) }} type="button">
                    <Icon name={link.icon} className="nav-icon" /><span className="search-result-label">{link.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <div className="topbar-clock"><span className="clock-date">{clock.dateStr}</span><span className="clock-time">{clock.timeStr}</span></div>
            <div className="topbar-theme-switch">
              {['light', 'warm', 'dark'].map(t => (
                <button key={t} className={profile?.theme === t ? 'active' : ''} onClick={() => { document.documentElement.dataset.theme = t; fetch('/api/profile', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: t, timezone: profile?.timezone ?? 'Asia/Jakarta', heightCm: profile?.heightCm ?? 170, accessibilityMode: profile?.accessibilityMode ?? 'normal' }) }).catch(() => {}) }} type="button" aria-label={`${t} mode`}><Icon name={t === 'light' ? 'light_mode' : t === 'warm' ? 'wb_sunny' : 'dark_mode'} /></button>
              ))}
            </div>
            <div className="topbar-display-mode">
              {(['normal', 'senior', 'highContrast'] as const).map(m => (
                <button key={m} className={profile?.accessibilityMode === m || (!profile?.accessibilityMode && m === 'normal') ? 'active' : ''} onClick={() => { document.documentElement.dataset.accessibility = m; fetch('/api/profile', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: profile?.theme ?? 'light', timezone: profile?.timezone ?? 'Asia/Jakarta', heightCm: profile?.heightCm ?? 170, accessibilityMode: m }) }).catch(() => {}) }} type="button" aria-label={m}><Icon name={m === 'normal' ? 'desktop_windows' : m === 'senior' ? 'elderly' : 'contrast'} /></button>
              ))}
            </div>
            <div className="topbar-notif-wrap" ref={notifRef}>
              <button className="topbar-icon-btn has-alert" onClick={() => setNotifOpen(o => !o)} type="button"><Icon name="notifications" /></button>
              {notifOpen && <div className="notif-dropdown"><div className="notif-header">Notifications</div><div className="notif-empty">No new notifications</div></div>}
            </div>
            <div className="topbar-user-wrap" ref={userMenuRef}>
              <button className="topbar-user" onClick={() => setUserMenuOpen(o => !o)} type="button" aria-label={`User menu for ${user.displayName}`}>
                <strong>{user.displayName}</strong>
                <span className="topbar-user-avatar">{getInitials(user.displayName)}</span>
              </button>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <button onClick={() => { setUserMenuOpen(false); navigate('/settings/profile') }} type="button"><Icon name="person" /> Profile & Settings</button>
                  <button onClick={() => { setUserMenuOpen(false); navigate('/reports/daily') }} type="button"><Icon name="assessment" /> My Reports</button>
                  <button onClick={() => { setUserMenuOpen(false); (async () => { try { const r = await fetch('/api/auth/forgot-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email }) }); const b = await r.json(); window.alert(b.success ? 'Link reset password sudah dikirim ke email Anda.' : 'Gagal: ' + (b.error?.message ?? '')) } catch { window.alert('Tidak bisa terhubung ke server.') } })() }} type="button"><Icon name="lock_reset" /> Reset Password</button>
                  <hr /><button onClick={handleLogout} type="button" className="user-dropdown-logout"><Icon name="logout" /> Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="app-content-area">
          <header className="app-header"><div><h1>{headerTitle}</h1><p>Here is your clinical overview for today.</p></div></header>
          <section className="app-content">{renderRoute(appPath, navigate)}</section>
        </div>
      </div>

      <button className="mobile-add-fab" onClick={() => navigate('/measurements/new')} type="button" aria-label="Add measurement"><Icon name="add" /></button>
      <button className="ai-fab" onClick={() => navigate('/ai-assistant')} type="button" aria-label="AI Assistant"><Icon name="smart_toy" /></button>
      <nav className="app-bottom-nav" aria-label="Quick navigation">
        {visibleNav.filter(link => MOBILE_NAV_PATHS.has(link.path)).map(link => (
          <button key={link.path} aria-current={appPath === link.path ? 'page' : undefined} className={appPath === link.path ? 'bottom-nav-btn active' : 'bottom-nav-btn'} onClick={() => navigate(link.path)} type="button">
            <Icon name={link.icon} /><span>{link.shortLabel}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}

function App() {
  return <ErrorBoundary><AuthProvider><AppRoutes /></AuthProvider></ErrorBoundary>
}

export default App
