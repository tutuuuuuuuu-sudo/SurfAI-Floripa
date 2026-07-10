import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.tsx'
import { initMonitoring } from './lib/monitoring'

initMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
)
