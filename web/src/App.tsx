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
import { UpgradePrompt } from './components/UpgradePrompt'
import { WelcomeWizard } from './components/WelcomeWizard'
import { ToastProvider } from './components/Toast'
import { LanguageSwitcher } from './components/i18n/LanguageSwitcher'
import { I18nProvider, useI18n } from './i18n'
import './i18n/locales/common'
import './i18n/locales/errors'
import './i18n/locales/auth'
import './i18n/locales/billing'
import './i18n/locales/ai'
import './i18n/locales/dashboard'
import './i18n/locales/hydration'
import './i18n/locales/symptom'
import './i18n/locales/cycle'
import './i18n/locales/admin'
import './i18n/locales/settings'
import './i18n/locales/kb'
import './i18n/locales/nav'
import { TodayDashboard } from './pages/dashboard/TodayDashboard'
import { WeeklyDashboard } from './pages/dashboard/WeeklyDashboard'
import { MonthlyDashboard } from './pages/dashboard/MonthlyDashboard'
import { DailyHealthHubPage } from "./pages/dashboard/DailyHealthHubPage"
import { SymptomPage } from "./pages/symptoms/SymptomPage"
import { HydrationPage } from "./pages/hydration/HydrationPage"
import { HydrationHistoryPage } from "./pages/hydration/HydrationHistoryPage"
import { HydrationSettingsPage } from "./pages/hydration/HydrationSettingsPage"
import { CyclePage } from "./pages/cycle/CyclePage"
import { AiMemorySettingsPage } from "./pages/ai/AiMemorySettingsPage"
import { HistoryTimelinePage } from "./pages/history/HistoryTimelinePage"
import { SelectMetricPage } from './pages/measurement/SelectMetricPage'
import { DailyReportPage } from './pages/reports/DailyReportPage'
import { WeeklyReportPage } from './pages/reports/WeeklyReportPage'
import { MonthlyReportPage } from './pages/reports/MonthlyReportPage'
import { DoctorReportPage } from './pages/reports/DoctorReportPage'
import { KnowledgeBasePage } from './pages/kb/KnowledgeBasePage'
import { FaqPage } from './pages/kb/FaqPage'
import { UserManualPage } from './pages/kb/UserManualPage'
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
import { AppSettingsPage } from './pages/settings/AppSettingsPage'
import { ProfileDeletePage } from './pages/settings/ProfileDeletePage'
import { AdminPage } from './pages/admin/AdminPage'
import { SeniorMeasurementFlow } from './pages/measurement/SeniorMeasurementFlow'
import { PremiumUpgradePage } from './pages/premium/PremiumUpgradePage'
import { BillingSuccessPage } from './pages/billing/BillingSuccessPage'
import { BillingCancelPage } from './pages/billing/BillingCancelPage'
import { MockCheckoutPage } from './pages/billing/MockCheckoutPage'
import { BillingSettingsPage } from './pages/billing/BillingSettingsPage'
import './App.css'
import { useEntitlements } from './hooks/useEntitlements'
import { formatDateTimeShort } from './utils/dateFormat'

/* ---- Navigation config ---- */

type NavLink = { path: string; label: string; labelKey?: string; shortLabel: string; icon: string; adminOnly?: boolean; visible?: boolean; badge?: string; featureCode?: string; paidOnly?: boolean }
type NavGroup = { label: string; labelKey?: string; icon: string; shortLabel: string; children: NavLink[] }

const NAV_GROUPS: (NavGroup | NavLink)[] = [
  { label: 'Dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', shortLabel: 'Dash', children: [
    { path: '/dashboard', label: 'Today', labelKey: 'nav.today', shortLabel: 'Today', icon: 'dashboard' },
    { path: '/dashboard/week', label: 'Weekly View', labelKey: 'nav.weeklyView', shortLabel: 'Week', icon: 'date_range' },
    { path: '/dashboard/month', label: 'Monthly Summary', labelKey: 'nav.monthlySummary', shortLabel: 'Month', icon: 'calendar_month' },
  ]},
  { label: 'Measurements', labelKey: 'nav.measurements', icon: 'monitor_heart', shortLabel: 'Meas', children: [
    { path: '/measurements/new', label: 'New Measurement', labelKey: 'nav.newMeasurement', shortLabel: 'New', icon: 'add_circle' },
    { path: '/measurements/history', label: 'Measurement History', labelKey: 'nav.measurementHistory', shortLabel: 'History', icon: 'history' },
    { path: '/daily-health', label: 'Daily Health Hub', labelKey: 'nav.dailyHealthHub', shortLabel: 'Health', icon: 'monitoring' },
    { path: '/history', label: 'Unified Health Timeline', labelKey: 'nav.unifiedTimeline', shortLabel: 'Timeline', icon: 'timeline', featureCode: 'feature.advancedHistory.use' },
  ]},
  { label: 'Reports', labelKey: 'nav.reports', icon: 'assessment', shortLabel: 'Rpts', children: [
    { path: '/reports/daily', label: 'Daily Report', labelKey: 'nav.dailyReport', shortLabel: 'Daily', icon: 'today' },
    { path: '/reports/weekly', label: 'Weekly Report', labelKey: 'nav.weeklyReport', shortLabel: 'Weekly', icon: 'date_range' },
    { path: '/reports/monthly', label: 'Monthly Report', labelKey: 'nav.monthlyReport', shortLabel: 'Monthly', icon: 'calendar_month' },
    { path: '/reports/doctor', label: 'Doctor Report', labelKey: 'nav.doctorReport', shortLabel: 'Doctor', icon: 'description', paidOnly: true },
  ]},
  { label: 'Health Tracking', labelKey: 'nav.healthTracking', icon: 'favorite', shortLabel: 'Health', children: [
    { path: '/symptoms', label: 'Symptoms', labelKey: 'nav.symptoms', shortLabel: 'Symptoms', icon: 'sick', featureCode: 'feature.symptomLog.use' },
    { path: '/hydration', label: 'Hydration', labelKey: 'nav.hydration', shortLabel: 'Hydrate', icon: 'water_drop', featureCode: 'feature.hydration.use' },
    { path: '/hydration/history', label: 'Hydration History', labelKey: 'nav.hydrationHistory', shortLabel: 'HydrHist', icon: 'history', visible: false },
    { path: '/hydration/settings', label: 'Hydration Settings', labelKey: 'nav.hydrationSettings', shortLabel: 'HydrSet', icon: 'water_drop', visible: false },
    { path: '/cycle', label: 'Cycle Tracking', labelKey: 'nav.cycleTracking', shortLabel: 'Cycle', icon: 'cycle', featureCode: 'feature.cycleTracking.use', paidOnly: true },
  ]},
  { label: 'Lifestyle', labelKey: 'nav.lifestyle', icon: 'health_and_safety', shortLabel: 'Life', children: [
    { path: '/tracker', label: 'Fasting & Medication', labelKey: 'nav.fastingMedication', shortLabel: 'Track', icon: 'timer' },
    { path: '/fasting', label: 'Fasting Timer', labelKey: 'nav.fastingTimer', shortLabel: 'Fast', icon: 'timer' },
    { path: '/medications', label: 'Medication', labelKey: 'nav.medication', shortLabel: 'Meds', icon: 'medication' },
    { path: '/patterns', label: 'Patterns', labelKey: 'nav.patterns', shortLabel: 'Pattern', icon: 'insights' },
    { path: '/reminders', label: 'Reminders', labelKey: 'nav.reminders', shortLabel: 'Remind', icon: 'alarm' },
  ]},
  { label: 'AI & Insights', labelKey: 'nav.aiInsights', icon: 'psychology', shortLabel: 'AI', children: [
    { path: '/ai-assistant', label: 'AI Assistant', labelKey: 'nav.aiAssistant', shortLabel: 'AI', icon: 'smart_toy', featureCode: 'feature.aiAssistant.use' },
    { path: '/ai-memory', label: 'AI Memory', labelKey: 'nav.aiMemory', shortLabel: 'Memory', icon: 'memory', visible: false, featureCode: 'feature.vectorMemory.use', paidOnly: true },
  ]},
  { label: 'Family & Safety', labelKey: 'nav.familySafety', icon: 'family_restroom', shortLabel: 'Family', children: [
    { path: '/family', label: 'Family / Caregiver', labelKey: 'nav.familyCaregiver', shortLabel: 'Family', icon: 'family_restroom', featureCode: 'feature.familyDashboard.use', paidOnly: true },
    { path: '/emergency', label: 'Emergency Contacts', labelKey: 'nav.emergencyContacts', shortLabel: 'SOS', icon: 'emergency' },
    { path: '/alerts', label: 'Notifications & Alerts', labelKey: 'nav.notificationsAlerts', shortLabel: 'Alerts', icon: 'notifications' },
  ]},
  { label: 'Education', labelKey: 'nav.education', icon: 'school', shortLabel: 'Edu', children: [
    { path: '/kb', label: 'Knowledge Base', labelKey: 'nav.knowledgeBase', shortLabel: 'KB', icon: 'menu_book' },
    { path: '/faq', label: 'FAQ', labelKey: 'nav.faq', shortLabel: 'FAQ', icon: 'quiz' },
    { path: '/manual', label: 'User Manual', labelKey: 'nav.userManual', shortLabel: 'Manual', icon: 'description' },
  ]},
  { label: 'Settings', labelKey: 'nav.settings', icon: 'settings', shortLabel: 'Settings', children: [
    { path: '/settings/profile', label: 'Profile', labelKey: 'nav.profile', shortLabel: 'Profile', icon: 'person' },
    { path: '/settings/app', label: 'App Settings', labelKey: 'nav.appSettings', shortLabel: 'App', icon: 'tune' },
    { path: '/settings/billing', label: 'Billing', labelKey: 'nav.billing', shortLabel: 'Billing', icon: 'credit_card' },
    { path: '/telegram', label: 'Telegram', labelKey: 'nav.telegram', shortLabel: 'Telegram', icon: 'send', visible: false, featureCode: 'feature.telegramReminder.use', paidOnly: true },
  ]},
  { label: 'Admin Panel', labelKey: 'nav.adminPanel', icon: 'admin_panel_settings', shortLabel: 'Admin', children: [
    { path: '/admin', label: 'Admin Dashboard', labelKey: 'nav.adminDashboard', shortLabel: 'Admin', icon: 'admin_panel_settings', adminOnly: true },
    { path: '/ai-memory', label: 'AI Memory', labelKey: 'nav.aiMemory', shortLabel: 'AI Memory', icon: 'psychology', adminOnly: true },
  ]},
]

const NAV: NavLink[] = NAV_GROUPS.flatMap(g => 'children' in g ? g.children : [g]).filter(n => !('children' in n)) as NavLink[]
NAV.push(
  { path: '/settings/delete', label: 'Delete Account', shortLabel: 'Privacy', icon: 'delete', visible: false },
  { path: '/measurements/senior', label: 'Senior Mode', shortLabel: 'Senior', icon: 'elderly', visible: false },
  { path: '/telegram', label: 'Telegram', shortLabel: 'Telegram', icon: 'send', visible: false, featureCode: 'feature.telegramReminder.use', paidOnly: true },
  { path: '/ai-memory', label: 'AI Memory', shortLabel: 'AI Memory', icon: 'psychology', visible: false, featureCode: 'feature.vectorMemory.use', paidOnly: true },
  { path: '/admin', label: 'Admin', shortLabel: 'Admin', icon: 'admin_panel_settings', adminOnly: true },
)

const ALLOWED_PATHS = new Set(NAV.map(n => n.path).concat(['/kb', '/faq', '/manual', '/premium/upgrade', '/symptoms/new', '/caregiver', '/onboarding', '/billing/success', '/billing/cancel', '/billing/mock-checkout', '/settings/billing', '/settings/app']))
const NEVER_BLOCK_PATHS = new Set(['/premium/upgrade', '/billing/success', '/billing/cancel', '/billing/mock-checkout'])
const MOBILE_NAV_PATHS = new Set(['/dashboard', '/measurements/new', '/measurements/history', '/alerts', '/ai-assistant', '/emergency'])

/* ---- Helpers ---- */

function normalizePath(path: string) {
  if (path === '/auth/register') return '/register'
  if (path === '/auth/login' || path === '/auth') return '/login'
  return path
}

function getInitials(name?: string) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'HL'
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
    case '/history': return <HistoryTimelinePage />
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
    case '/faq': return <FaqPage onNavigate={onNavigate} />
    case '/manual': return <UserManualPage onNavigate={onNavigate} />
    case '/daily-health': return <DailyHealthHubPage />
    case '/symptoms': return <SymptomPage onNavigate={onNavigate} />
    case '/symptoms/new': return <SymptomPage onNavigate={onNavigate} />
    case '/hydration': return <HydrationPage />
    case '/hydration/settings': return <HydrationSettingsPage />
    case '/hydration/history': return <HydrationHistoryPage />
    case '/cycle': return <CyclePage />
    case '/ai-memory': return <AiMemorySettingsPage />
    case '/settings/profile': return <ProfileSettingsPage />
    case '/settings/app': return <AppSettingsPage onNavigate={onNavigate} />
    case '/settings/delete': return <ProfileDeletePage />
    case '/premium/upgrade': return <PremiumUpgradePage onNavigate={onNavigate} />
    case '/billing/success': return <BillingSuccessPage onNavigate={onNavigate} />
    case '/billing/cancel': return <BillingCancelPage onNavigate={onNavigate} />
    case '/billing/mock-checkout': return <MockCheckoutPage />
    case '/settings/billing': return <BillingSettingsPage onNavigate={onNavigate} />
    case '/admin': return <AdminPage />
    default: return <TodayDashboard />
  }
}

/* ---- Main layout ---- */

function AppRoutes() {
  const { loading, user, profile, requiresOnboarding, roles, permissions, logout, refresh } = useAuth()
  const { loading: entitlementsLoading, isEnabled, entitlements } = useEntitlements()
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
  const [notifData, setNotifData] = useState<any[]>([])
  const notifCount = notifData.filter(a => !a.acknowledged).length
  const searchWrapRef = useRef<HTMLDivElement | null>(null)
  const notifRef = useRef<HTMLDivElement | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['nav.dashboard', 'nav.reports', 'nav.healthTracking']))
  const [showWizard, setShowWizard] = useState(() => { try { return localStorage.getItem('hl-welcome-seen') !== 'true' } catch { return false } })
  const { t } = useI18n()

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('hl-sidebar-collapsed', String(next)) } catch { /* ignore */ }
      return next
    })
  }

  async function handleLogout() {
    setUserMenuOpen(false)
    await logout()
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
  if (loading) return <main className="auth-page"><p className="loading-text">{t('nav.checkingSession')}</p></main>

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
  if (!ALLOWED_PATHS.has(currentPath))
    window.history.replaceState(null, '', '/dashboard')

  /* ---- Senior shell ---- */
  if (profile?.accessibilityMode === 'senior')
    return <SeniorAppShell activePath={appPath} navigate={navigate} />

  /* ---- Desktop / Mobile shell ---- */
  const isAdmin = (permissions || []).includes('admin.access') || (roles || []).includes('superAdmin')
  const currentPlanCode = entitlements?.planCode || 'free'
  const visibleNav = NAV.filter(link => {
    if (link.adminOnly && !isAdmin) return false
    if (link.visible === false) return false
    if (!entitlementsLoading && link.featureCode && !isEnabled(link.featureCode)) return false
    return true
  })
  const currentNavLink = NAV.find(link => link.path === appPath)
  const routeBlocked = !NEVER_BLOCK_PATHS.has(appPath) && !entitlementsLoading && currentNavLink?.featureCode && !isEnabled(currentNavLink.featureCode)
  const clock = formatClock(liveTime)
  const firstName = (user.displayName || '').split(' ').filter(Boolean)[0] ?? t('nav.goodMorning')
  const currentLink = visibleNav.find(link => link.path === appPath)
  const headerTitle = appPath === '/dashboard' ? `${t('nav.goodMorning')}, ${firstName}` : (currentLink?.labelKey ? t(currentLink.labelKey) : currentLink?.label) ?? t('nav.dashboard')

  return (
    <main className={`app-page ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ---- Sidebar ---- */}
      <aside className="app-sidebar" aria-label="App navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            <span className="sidebar-brand-icon"><Icon name="local_hospital" className="fill" /></span>
            {!sidebarCollapsed && <div><h1>HealthSync Pro</h1></div>}
          </div>
          <button className="sidebar-collapse-btn" onClick={toggleSidebar} type="button" aria-label={sidebarCollapsed ? t('nav.expand') : t('nav.collapse')}>
            <Icon name={sidebarCollapsed ? 'chevron_right' : 'chevron_left'} />
          </button>
          {!sidebarCollapsed && (
            <button className="emergency-support-btn" onClick={() => navigate('/emergency')} type="button">
              <Icon name="emergency" /> {t('nav.emergencySupport')}
            </button>
          )}
        </div>
        <div className="sidebar-nav-scroll">
          <nav className="sidebar-nav" aria-label="Main navigation">
            {NAV_GROUPS.map((item) => {
              if ('children' in item) {
                const isExpanded = expandedGroups.has(item.labelKey || item.label)
                return (
                  <div key={item.label} className={`nav-group ${item.children.some(c => c.path === appPath) ? 'has-active' : ''}`}>
                    <button className={`nav-group-toggle ${isExpanded ? 'expanded' : ''}`} onClick={() => setExpandedGroups(prev => {
                      const n = new Set(prev)
                      const key = item.labelKey || item.label
                      if (n.has(key)) {
                        n.delete(key)
                      } else {
                        n.add(key)
                      }
                      return n
                    })} type="button">
                      <Icon name={item.icon} className="nav-icon" />
                      {!sidebarCollapsed && <span>{item.labelKey ? t(item.labelKey) : item.label}</span>}
                      {!sidebarCollapsed && <Icon name="expand_more" className="nav-group-chevron" />}
                    </button>
                    {!sidebarCollapsed && isExpanded && (
                      <div className="nav-group-children">
                        {item.children.map(child => (
                          <button key={child.path} className={`nav-btn nav-child ${appPath === child.path ? 'active' : ''}`} onClick={() => navigate(child.path)} type="button">
                            <Icon name={child.icon} className="nav-icon" /><span>{child.labelKey ? t(child.labelKey) : child.label}</span>
                            {child.paidOnly && currentPlanCode === 'free' ? <span className="nav-badge pro-badge">PRO</span> : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <button key={item.path} className={appPath === item.path ? 'nav-btn active' : 'nav-btn'} onClick={() => navigate(item.path)} title={sidebarCollapsed ? (item.labelKey ? t(item.labelKey) : item.label) : undefined} type="button">
                  <Icon name={item.icon} className="nav-icon" />
                  {!sidebarCollapsed && <span>{item.labelKey ? t(item.labelKey) : item.label}</span>}
                  {!sidebarCollapsed && item.paidOnly && currentPlanCode === 'free' ? <span className="nav-badge pro-badge">PRO</span> : null}
                  {!sidebarCollapsed && item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="sidebar-footer">
          <LanguageSwitcher compact={sidebarCollapsed} />
          <button onClick={() => { try { localStorage.removeItem('hl-welcome-seen') } catch { /* ignore */ } setShowWizard(true) }} type="button" title={t('nav.appTour')}><Icon name="tour" />{!sidebarCollapsed && <span>{t('nav.appTour')}</span>}</button>
          <button onClick={() => navigate('/kb')} type="button"><Icon name="help" />{!sidebarCollapsed && <span>{t('nav.helpCenter')}</span>}</button>
          <button onClick={handleLogout} type="button"><Icon name="logout" />{!sidebarCollapsed && <span>{t('nav.logout')}</span>}</button>
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
              <input onChange={e => { setSearchQuery(e.target.value); const q = e.target.value.trim().toLowerCase(); if (q.length < 2) { setSearchResults([]); return }; const pool = [...visibleNav];              if (!pool.some(n => n.path === '/kb')) pool.push({ path: '/kb', label: 'Knowledge Base', labelKey: 'nav.knowledgeBase', shortLabel: 'KB', icon: 'menu_book' } as NavLink); setSearchResults(pool.filter(l => (l.labelKey ? t(l.labelKey) : l.label).toLowerCase().includes(q) || l.shortLabel.toLowerCase().includes(q) || l.path.toLowerCase().includes(q)).slice(0, 8)) }}              placeholder={t('nav.search')} type="search" value={searchQuery} />
            </label>
            {searchResults.length > 0 && (
              <div className="search-dropdown" role="listbox">
                {searchResults.map(link => (
                  <button className="search-result-item" key={link.path} onClick={() => { setSearchQuery(''); setSearchResults([]); navigate(link.path) }} type="button">
                    <Icon name={link.icon} className="nav-icon" /><span className="search-result-label">{link.labelKey ? t(link.labelKey) : link.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <div className="topbar-clock"><span className="clock-date">{clock.dateStr}</span><span className="clock-time">{clock.timeStr}</span></div>
            <div className="topbar-theme-switch">
              {['light', 'warm', 'dark'].map(thm => (
                <button key={thm} className={profile?.theme === thm ? 'active' : ''} onClick={() => { document.documentElement.dataset.theme = thm; fetch('/api/profile', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: thm, timezone: profile?.timezone ?? 'Asia/Jakarta', heightCm: profile?.heightCm ?? 170, accessibilityMode: profile?.accessibilityMode ?? 'normal' }) }).then(r => { if (r.ok) void refresh() }).catch(() => {}) }} type="button" aria-label={`${thm} mode`}><Icon name={thm === 'light' ? 'light_mode' : thm === 'warm' ? 'wb_sunny' : 'dark_mode'} /></button>
              ))}
            </div>
            <div className="topbar-display-mode">
              {(['normal', 'senior', 'highContrast'] as const).map(m => (
                <button key={m} className={profile?.accessibilityMode === m || (!profile?.accessibilityMode && m === 'normal') ? 'active' : ''} onClick={() => { document.documentElement.dataset.accessibility = m; fetch('/api/profile', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: profile?.theme ?? 'light', timezone: profile?.timezone ?? 'Asia/Jakarta', heightCm: profile?.heightCm ?? 170, accessibilityMode: m }) }).then(r => { if (r.ok) void refresh() }).catch(() => {}) }} type="button" aria-label={m}><Icon name={m === 'normal' ? 'desktop_windows' : m === 'senior' ? 'elderly' : 'contrast'} /></button>
              ))}
            </div>
            <div className="topbar-notif-wrap" ref={notifRef}>
              <button className="topbar-icon-btn has-alert" onClick={() => { setNotifOpen(o => !o); if (!notifOpen) void (async () => { try { const r = await fetch('/api/alerts?limit=5', { credentials: 'include' }); const j = await r.json(); if (j.success) setNotifData(j.data?.alerts || []); } catch { /* ignore */ } })() }} type="button"><Icon name="notifications" />{notifCount > 0 && <span className="notif-badge">{notifCount}</span>}</button>
              {notifOpen && <div className="notif-dropdown"><div className="notif-header">{t('nav.notifLatest')}</div>{notifData.length === 0 ? <div className="notif-empty">{t('nav.notifEmpty')}</div> : <div className="notif-list">{notifData.map((a) => { const dt = formatDateTimeShort(a.createdAt); return <div key={a.id} className={`notif-item severity-${a.severity}`}><span className="material-symbols-outlined notif-icon">{a.severity === 'critical' ? 'error' : 'warning'}</span><div><strong>{a.metricCode}</strong><p>{a.message}</p><small>{dt.date} {dt.time}</small></div></div> })}</div>}</div>}
            </div>
            <div className="topbar-user-wrap" ref={userMenuRef}>
              <button className="topbar-user" onClick={() => setUserMenuOpen(o => !o)} type="button" aria-label={`User menu for ${user.displayName}`}>
                <strong>{user.displayName}</strong>
                <span className="topbar-user-avatar">{getInitials(user.displayName)}</span>
              </button>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <button onClick={() => { setUserMenuOpen(false); navigate('/settings/profile') }} type="button"><Icon name="person" /> {t('nav.profileSettings')}</button>
                  <button onClick={() => { setUserMenuOpen(false); navigate('/reports/daily') }} type="button"><Icon name="assessment" /> {t('nav.myReports')}</button>
                  <button onClick={() => { setUserMenuOpen(false); (async () => { try { const r = await fetch('/api/auth/forgot-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email }) }); const b = await r.json(); window.alert(b.success ? t('nav.resetSent') : 'Gagal: ' + (b.error?.message ?? '')) } catch { window.alert(t('common.connError')) } })() }} type="button"><Icon name="lock_reset" /> {t('nav.resetPassword')}</button>
                  <hr /><button onClick={handleLogout} type="button" className="user-dropdown-logout"><Icon name="logout" /> Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="app-content-area">
          <header className="app-header"><div><h1>{headerTitle}</h1><p>{t('nav.clinicalOverview')}</p></div></header>
          <section className="app-content">
            {routeBlocked ? (
              <UpgradePrompt feature={currentNavLink?.labelKey ? t(currentNavLink.labelKey) : (currentNavLink?.label ?? t('nav.dashboard'))} onNavigate={navigate} />
            ) : (
              renderRoute(appPath, navigate)
            )}
          </section>
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

      {showWizard && (
        <WelcomeWizard
          onClose={() => { try { localStorage.setItem('hl-welcome-seen', 'true') } catch { /* ignore */ } setShowWizard(false) }}
          onNavigate={navigate}
        />
      )}
    </main>
  )
}

function App() {
  return <ErrorBoundary><AuthProvider><I18nProvider><ToastProvider><AppRoutes /></ToastProvider></I18nProvider></AuthProvider></ErrorBoundary>
}

export default App
