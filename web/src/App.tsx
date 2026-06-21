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
}

const NAV: NavLink[] = [
  { path: '/dashboard', label: 'Hari Ini', shortLabel: 'Hari Ini', section: 'overview' },
  { path: '/dashboard/week', label: 'Mingguan', shortLabel: 'Minggu', section: 'overview' },
  { path: '/dashboard/month', label: 'Bulanan', shortLabel: 'Bulan', section: 'overview' },
  { path: '/measurements/new', label: 'Pengukuran', shortLabel: 'Input', section: 'capture' },
  { path: '/measurements/senior', label: 'Mode Lansia', shortLabel: 'Lansia', section: 'capture' },
  { path: '/reports/daily', label: 'Laporan Harian', shortLabel: 'Harian', section: 'overview' },
  { path: '/reports/weekly', label: 'Laporan Mingguan', shortLabel: 'Minggu', section: 'overview' },
  { path: '/reports/monthly', label: 'Laporan Bulanan', shortLabel: 'Bulan', section: 'overview' },
  { path: '/reports/doctor', label: 'Laporan Dokter', shortLabel: 'Dokter', section: 'overview' },
  { path: '/reminders', label: 'Pengingat', shortLabel: 'Ingat', section: 'care' },
  { path: '/medications', label: 'Obat', shortLabel: 'Obat', section: 'care' },
  { path: '/family', label: 'Keluarga', shortLabel: 'Keluarga', section: 'care' },
  { path: '/caregiver', label: 'Caregiver', shortLabel: 'Care', section: 'care' },
  { path: '/fasting', label: 'Puasa', shortLabel: 'Puasa', section: 'care' },
  { path: '/emergency', label: 'Kontak Darurat', shortLabel: 'Darurat', section: 'care' },
  { path: '/telegram', label: 'Telegram', shortLabel: 'Telegram', section: 'system' },
  { path: '/alerts', label: 'Peringatan', shortLabel: 'Alert', section: 'system' },
  { path: '/patterns', label: 'Pola', shortLabel: 'Pola', section: 'system' },
  { path: '/kb', label: 'Pengetahuan', shortLabel: 'KB', section: 'system' },
  { path: '/settings/profile', label: 'Profil', shortLabel: 'Profil', section: 'system' },
  { path: '/settings/delete', label: 'Hapus Akun', shortLabel: 'Privasi', section: 'system' },
  { path: '/admin/configs', label: 'Admin', shortLabel: 'Admin', section: 'system', adminOnly: true }
]

const ALLOWED_PATHS = new Set(NAV.map(n => n.path))
const MOBILE_NAV_PATHS = new Set(['/dashboard', '/measurements/new', '/reports/doctor', '/alerts', '/settings/profile'])
const SECTION_LABELS: Record<NavLink['section'], string> = {
  overview: 'Overview',
  capture: 'Capture',
  care: 'Care Network',
  system: 'System'
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'HL'
}

function AppRoutes() {
  const { loading, user, requiresOnboarding } = useAuth()
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [authView, setAuthView] = useState<'login' | 'register'>(() =>
    window.location.pathname === '/register' ? 'register' : 'login'
  )

  useEffect(() => {
    function handlePopState() { setCurrentPath(window.location.pathname) }
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
    setCurrentPath(path)
  }

  if (loading) {
    return (
      <main className="auth-page">
        <p className="loading-text">Memeriksa sesi...</p>
      </main>
    )
  }

  if (!user) {
    if (!['/login', '/register'].includes(window.location.pathname)) {
      window.history.replaceState(null, '', '/login')
    }
    return authView === 'login' ? (
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
  if (!ALLOWED_PATHS.has(currentPath)) {
    window.history.replaceState(null, '', '/dashboard')
  }

  const isAdmin = !!user.email && ['admin@homesungai.com'].includes(user.email)
  const visibleNav = NAV.filter(link => !link.adminOnly || isAdmin)
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
          <span className="brand-mark" aria-hidden="true">HL</span>
          <div>
            <strong>HL Health</strong>
            <span>Clinical Precision</span>
          </div>
        </div>

        <nav className="app-nav" aria-label="Navigasi utama">
          {navSections.map(({ section, title, links }) => links.length > 0 ? (
            <div className="nav-section" key={section}>
              <p>{title}</p>
              {links.map((link) => (
                <button
                  aria-current={appPath === link.path ? 'page' : undefined}
                  className={appPath === link.path ? 'nav-btn active' : 'nav-btn'}
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  type="button"
                >
                  <span className="nav-dot" aria-hidden="true" />
                  {link.label}
                </button>
              ))}
            </div>
          ) : null)}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div>
            <p className="eyebrow">HealthSync Pro</p>
            <h1>{currentLink?.label ?? 'Dashboard'}</h1>
            <p>Halo, {user.displayName}. Pantau data kesehatan dengan alur rule-based.</p>
          </div>
          <div className="user-chip" aria-label={`User aktif ${user.displayName}`}>
            <span>{getInitials(user.displayName)}</span>
            <div>
              <strong>{user.displayName}</strong>
              <small>Personal workspace</small>
            </div>
          </div>
        </header>

        <section className="app-content">
          {appPath === '/dashboard' ? <TodayDashboard /> : null}
          {appPath === '/dashboard/week' ? <WeeklyDashboard /> : null}
          {appPath === '/dashboard/month' ? <MonthlyDashboard /> : null}
          {appPath === '/measurements/new' ? <SelectMetricPage /> : null}
          {appPath === '/measurements/senior' ? <SeniorMeasurementFlow /> : null}
          {appPath === '/reports/daily' ? <DailyReportPage /> : null}
          {appPath === '/reports/weekly' ? <WeeklyReportPage /> : null}
          {appPath === '/reports/monthly' ? <MonthlyReportPage /> : null}
          {appPath === '/reports/doctor' ? <DoctorReportPage /> : null}
          {appPath === '/reminders' ? <RemindersPage /> : null}
          {appPath === '/medications' ? <MedicationsPage /> : null}
          {appPath === '/family' ? <FamilyPage /> : null}
          {appPath === '/caregiver' ? <CaregiverDashboardPage /> : null}
          {appPath === '/fasting' ? <FastingPage /> : null}
          {appPath === '/emergency' ? <EmergencyContactsPage /> : null}
          {appPath === '/telegram' ? <TelegramSettingsPage /> : null}
          {appPath === '/alerts' ? <AlertsPage /> : null}
          {appPath === '/patterns' ? <PatternsPage /> : null}
          {appPath === '/kb' ? <KnowledgeBasePage /> : null}
          {appPath === '/settings/profile' ? <ProfileSettingsPage /> : null}
          {appPath === '/settings/delete' ? <ProfileDeletePage /> : null}
          {appPath === '/admin/configs' ? <ConfigDashboardPage /> : null}
        </section>
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
