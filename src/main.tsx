import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.tsx'
import { initMonitoring } from './lib/monitoring'
import { ErrorBoundary } from './components/error-boundary'

initMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="theme">
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
