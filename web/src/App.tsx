import { useEffect, useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/auth'
import { LoginPage } from './pages/auth/LoginPage'
import { SelectMetricPage } from './pages/measurement/SelectMetricPage'
import { OnboardingPage } from './pages/onboarding/OnboardingPage'
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import './App.css'

function AppRoutes() {
  const { loading, user, requiresOnboarding } = useAuth()
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [authView, setAuthView] = useState<'login' | 'register'>(() =>
    window.location.pathname === '/register' ? 'register' : 'login'
  )

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  function showAuthView(view: 'login' | 'register') {
    const path = view === 'login' ? '/login' : '/register'
    window.history.pushState(null, '', path)
    setCurrentPath(path)
    setAuthView(view)
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

  const appPath = currentPath
  const allowedAppPaths = ['/dashboard', '/measurements/new', '/settings/profile']
  const effectiveAppPath = allowedAppPaths.includes(appPath) ? appPath : '/dashboard'

  if (!allowedAppPaths.includes(appPath)) {
    window.history.replaceState(null, '', '/dashboard')
  }

  function navigate(path: string) {
    window.history.pushState(null, '', path)
    setCurrentPath(path)
  }

  return (
    <main className="app-page">
      <section className="status-panel" aria-labelledby="dashboard-title">
        <p className="eyebrow">Sesi aktif</p>
        <h1 id="dashboard-title">Dashboard siap dibuka</h1>
        <p>Selamat datang kembali, {user.displayName}.</p>
        <div className="app-actions" aria-label="Navigasi utama">
          <button onClick={() => navigate('/dashboard')} type="button">
            Dashboard
          </button>
          <button onClick={() => navigate('/measurements/new')} type="button">
            Tambah Pengukuran
          </button>
          <button onClick={() => navigate('/settings/profile')} type="button">
            Profil
          </button>
        </div>
      </section>
      {effectiveAppPath === '/measurements/new' ? <SelectMetricPage /> : null}
      {effectiveAppPath === '/settings/profile' ? <ProfileSettingsPage /> : null}
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
