import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SurfDataProvider } from './contexts/SurfDataContext'
import { PWAInstallBanner } from './components/PWAInstallBanner'
import Landing from './pages/Landing'
import LoginPage from './pages/LoginPage'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'
import ResetPassword from './pages/ResetPassword'
import { BottomNav } from './components/BottomNav'
import { CookieConsent } from './components/CookieConsent'

// Lazy — só quem já tem conta (ou está criando) baixa o código dessas páginas.
// Landing (a página que decide se alguém vira usuário ou não) não carrega
// mais o bundle inteiro do app autenticado de cara.
const Home = lazy(() => import('./pages/Home'))
const SpotDetails = lazy(() => import('./pages/SpotDetails'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
const Favorites = lazy(() => import('./pages/Favorites'))
const NavigationPage = lazy(() => import('./pages/Navigation'))
const PremiumPage = lazy(() => import('./pages/Premium'))
const ComparePage = lazy(() => import('./pages/Compare'))
const ForecastPage = lazy(() => import('./pages/History'))
const SurfLog = lazy(() => import('./pages/SurfLog'))
const ContentStudio = lazy(() => import('./pages/ContentStudio'))

function RouteLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary text-sm">Carregando...</div>
    </div>
  )
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    // skipWaiting() no sw.js garante que versões novas assumem sem precisar desregistrar
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

// Reseta o scroll pro topo a cada troca de rota — sem isso, a posição de scroll da
// página anterior "gruda" na página nova (comportamento padrão do navegador em SPAs).
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary text-sm">Carregando...</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading, isPasswordRecovery } = useAuth()
  useEffect(() => { registerServiceWorker() }, [])

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary text-sm">Carregando...</div>
    </div>
  )

  if (isPasswordRecovery) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/reset-password" replace />} />
      </Routes>
    )
  }

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/" element={user ? <ProtectedRoute><Home /></ProtectedRoute> : <Navigate to="/landing" replace />} />
          <Route path="/spot/:id" element={<SpotDetails />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
          <Route path="/navigation" element={<ProtectedRoute><NavigationPage /></ProtectedRoute>} />
          <Route path="/premium" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
          <Route path="/compare" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
          <Route path="/forecast" element={<ProtectedRoute><ForecastPage /></ProtectedRoute>} />
          <Route path="/forecast/:id" element={<ProtectedRoute><ForecastPage /></ProtectedRoute>} />
          <Route path="/surf-log" element={<ProtectedRoute><SurfLog /></ProtectedRoute>} />
          <Route path="/content-studio" element={<ProtectedRoute><ContentStudio /></ProtectedRoute>} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster position="top-center" />
      <PWAInstallBanner />
      <BottomNav />
      <CookieConsent />
    </>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SurfDataProvider>
          <AppRoutes />
        </SurfDataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
