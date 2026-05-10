interface AppLogoProps {
  size?: number
  className?: string
  variant?: 'full' | 'icon'
}

export function AppLogo({ size = 40, className = '', variant = 'icon' }: AppLogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <linearGradient id="logo-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0d1f35" />
            <stop offset="100%" stopColor="#071828" />
          </linearGradient>
          <linearGradient id="logo-wave1" x1="0" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="logo-wave2" x1="0" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="logo-dot" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <filter id="logo-glow">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Fundo com bordas arredondadas */}
        <rect width="40" height="40" rx="10" fill="url(#logo-bg)" />

        {/* Borda sutil */}
        <rect width="40" height="40" rx="10" fill="none" stroke="#06b6d4" strokeWidth="0.5" strokeOpacity="0.3" />

        {/* Grade de pontos decorativa */}
        {[14, 19, 24].map(cx =>
          [13, 18, 23].map(cy => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.6" fill="#06b6d4" fillOpacity="0.12" />
          ))
        )}

        {/* Onda principal — curva suave e precisa */}
        <path
          d="M6 22 C10 16, 15 26, 20 20 C25 14, 30 24, 34 18"
          stroke="url(#logo-wave1)"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
          filter="url(#logo-glow)"
        />

        {/* Onda secundária — mais suave e transparente */}
        <path
          d="M6 26 C10 22, 15 30, 20 25 C25 20, 30 28, 34 23"
          stroke="url(#logo-wave2)"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Ponto de destaque — "AI dot" no pico da onda */}
        <circle cx="20" cy="20" r="2.5" fill="url(#logo-dot)" filter="url(#logo-glow)" />
        <circle cx="20" cy="20" r="1.2" fill="white" fillOpacity="0.9" />

        {/* Linha vertical sutil ligando ao ponto */}
        <line x1="20" y1="10" x2="20" y2="17.5" stroke="#06b6d4" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="1.5 2" />

        {/* "AI" label minúsculo no topo */}
        <text x="20" y="9.5" textAnchor="middle" fontSize="4.5" fontWeight="700" fill="#06b6d4" fillOpacity="0.8" fontFamily="system-ui, sans-serif" letterSpacing="0.5">AI</text>
      </svg>
    )
  }

  // Variant "full" — ícone + texto
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <AppLogo size={size} variant="icon" />
      <div className="flex flex-col leading-none">
        <span
          className="font-black tracking-tight"
          style={{
            fontSize: size * 0.45,
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Surf AI
        </span>
        <span
          className="text-muted-foreground font-medium tracking-wider uppercase"
          style={{ fontSize: size * 0.2 }}
        >
          Florianópolis
        </span>
      </div>
    </div>
  )
}
