// Logo "A Vida Não Colabora" — coração contornado minimalista com pequena folha
// (cuidado + crescimento). Usa currentColor para se adaptar ao fundo (claro/escuro).

export function LogoIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M16 25.5C16 25.5 6 19 6 12.4C6 9.1 8.5 6.6 11.6 6.6C13.6 6.6 15.2 7.7 16 9.2C16.8 7.7 18.4 6.6 20.4 6.6C23.5 6.6 26 9.1 26 12.4C26 19 16 25.5 16 25.5Z"
        stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"
      />
      <path d="M16 21C16 17.7 17.6 15.2 20.4 14.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M21 14C19.3 14.6 18 16 17.5 17.8C19.3 17.2 20.6 15.8 21 14Z" fill="currentColor" />
    </svg>
  )
}

interface LogoProps {
  onClick?: () => void
  compact?: boolean
  className?: string
}

export default function Logo({ onClick, compact = false, className = '' }: LogoProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 flex-shrink-0 group ${className}`}
      aria-label="A Vida Não Colabora — página inicial"
    >
      <LogoIcon className="w-7 h-7 text-forest-800 group-hover:text-forest-900 transition-colors" />
      <span className={`font-serif text-forest-900 leading-none ${compact ? 'text-lg hidden sm:inline' : 'text-xl'}`}>
        A Vida Não Colabora
      </span>
    </button>
  )
}
