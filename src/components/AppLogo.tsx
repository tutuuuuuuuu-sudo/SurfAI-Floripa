interface AppLogoProps {
  size?: number
  className?: string
  variant?: 'full' | 'icon'
}

export function AppLogo({ size = 40, className = '', variant = 'icon' }: AppLogoProps) {
  const id = `logo-${size}`

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={variant === 'icon' ? className : ''}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#08111f" />
          <stop offset="100%" stopColor="#040c17" />
        </linearGradient>
        <linearGradient id={`${id}-wave`} x1="8" y1="32" x2="56" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={`${id}-arc`} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#818cf8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-dot`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" />
          <stop offset="40%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${id}-glow-sm`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id={`${id}-clip`}>
          <rect width="64" height="64" rx="16" />
        </clipPath>
      </defs>

      {/* Fundo */}
      <rect width="64" height="64" rx="16" fill={`url(#${id}-bg)`} />

      {/* Arco de radar — trecho iluminado no canto superior esquerdo */}
      <circle
        cx="32" cy="32" r="26"
        stroke={`url(#${id}-arc)`}
        strokeWidth="1"
        strokeDasharray="42 122"
        strokeDashoffset="8"
        fill="none"
        strokeLinecap="round"
        filter={`url(#${id}-glow-sm)`}
      />

      {/* Anel interno sutil */}
      <circle cx="32" cy="32" r="20" stroke="#06b6d4" strokeWidth="0.5" strokeOpacity="0.1" fill="none" />

      {/* Barras de frequência — simétricas, 3 de cada lado */}
      {/* Esquerda: baixa, média, alta */}
      <rect x="10" y="38" width="4" height="10" rx="2" fill={`url(#${id}-bar)`} opacity="0.5" />
      <rect x="17" y="32" width="4" height="16" rx="2" fill={`url(#${id}-bar)`} opacity="0.75" />
      <rect x="24" y="25" width="4" height="23" rx="2" fill={`url(#${id}-bar)`} opacity="0.95" />
      {/* Direita: alta, média, baixa */}
      <rect x="36" y="25" width="4" height="23" rx="2" fill={`url(#${id}-bar)`} opacity="0.95" />
      <rect x="43" y="32" width="4" height="16" rx="2" fill={`url(#${id}-bar)`} opacity="0.75" />
      <rect x="50" y="38" width="4" height="10" rx="2" fill={`url(#${id}-bar)`} opacity="0.5" />

      {/* Onda cortando as barras */}
      <path
        d="M8 32 C16 22, 24 42, 32 32 C40 22, 48 42, 56 32"
        stroke={`url(#${id}-wave)`}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        filter={`url(#${id}-glow)`}
      />

      {/* Ponto central — pico da onda */}
      <circle cx="32" cy="32" r="5" fill={`url(#${id}-dot)`} filter={`url(#${id}-glow)`} />
      <circle cx="32" cy="32" r="2" fill="white" fillOpacity="0.98" />
    </svg>
  )

  if (variant === 'icon') return icon

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {icon}
      <div className="flex flex-col leading-none gap-0.5">
        <span
          style={{
            fontSize: size * 0.38,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(120deg, #06b6d4 0%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Surf AI
        </span>
        <span
          style={{
            fontSize: size * 0.175,
            fontWeight: 500,
            letterSpacing: '0.12em',
            color: 'oklch(0.55 0.02 230)',
            textTransform: 'uppercase',
          }}
        >
          Florianópolis
        </span>
      </div>
    </div>
  )
}
