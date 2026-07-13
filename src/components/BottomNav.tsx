import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Heart, History, User, BookOpen } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/',           label: 'Início',    Icon: Home },
  { path: '/favorites',  label: 'Favoritas', Icon: Heart },
  { path: '/surf-log',   label: 'Log',       Icon: BookOpen },
  { path: '/forecast',   label: 'Previsão',  Icon: History },
  { path: '/profile',    label: 'Perfil',    Icon: User },
]

const HIDDEN_PATHS = ['/landing', '/login', '/reset-password']

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  if (HIDDEN_PATHS.some(p => location.pathname.startsWith(p))) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-md border-t border-border/50 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const active = path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path)
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px] ${
                active
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'fill-primary/20' : ''}`} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-medium leading-none ${active ? 'text-primary' : ''}`}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
