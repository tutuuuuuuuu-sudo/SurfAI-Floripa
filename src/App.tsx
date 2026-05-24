import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PWAInstallBanner } from './components/PWAInstallBanner'
import Home from './pages/Home'
import SpotDetails from './pages/SpotDetails'
import LoginPage from './pages/LoginPage'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Favorites from './pages/Favorites'
import NavigationPage from './pages/Navigation'
import PremiumPage from './pages/Premium'
import ComparePage from './pages/Compare'
import HistoryPage from './pages/History'
import SurfLog from './pages/SurfLog'
import ContentStudio from './pages/ContentStudio'
import Landing from './pages/Landing'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'
import { BottomNav } from './components/BottomNav'

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(r => r.unregister()))
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

// Garante dark mode como padrão apenas se o usuário não tiver preferência salva
function useDefaultDark() {
  useEffect(() => {
    const html = document.documentElement
    const savedTheme = (() => { try { return localStorage.getItem('theme') } catch { return null } })()
    if (!savedTheme) {
      html.classList.add('dark')
    } else {
      html.classList.toggle('dark', savedTheme === 'dark')
      html.classList.toggle('light', savedTheme === 'light')
    }
  }, [])
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
  const { user, loading } = useAuth()
  useDefaultDark()
  useEffect(() => { registerServiceWorker() }, [])

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-primary text-sm">Carregando...</div>
    </div>
  )

  return (
    <>
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={user ? <ProtectedRoute><Home /></ProtectedRoute> : <Navigate to="/landing" replace />} />
        <Route path="/spot/:id" element={<ProtectedRoute><SpotDetails /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
        <Route path="/navigation" element={<ProtectedRoute><NavigationPage /></ProtectedRoute>} />
        <Route path="/premium" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
        <Route path="/compare" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/history/:id" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/surf-log" element={<ProtectedRoute><SurfLog /></ProtectedRoute>} />
        <Route path="/content-studio" element={<ProtectedRoute><ContentStudio /></ProtectedRoute>} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-center" />
      <PWAInstallBanner />
      <BottomNav />
    </>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
