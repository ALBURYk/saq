import { motion } from 'motion/react'

// Кольцевая шкала 0–100 (риск в проверке, балл в «Прививке»).
export default function Ring({ value, color, bg, label, suffix = '', size = 'h-28 w-28' }: { value: number; color: string; bg: string; label: string; suffix?: string; size?: string }) {
  const C = 276.5
  return (
    <div className={`relative grid shrink-0 place-items-center rounded-full ${size}`} style={{ background: bg }} role="img" aria-label={`${label}: ${value}${suffix}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
        <motion.circle
          cx="50"
          cy="50"
          r="44"
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - value / 100) }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="text-center">
        <div className="font-display text-3xl font-bold" style={{ color }}>
          {value}
          {suffix}
        </div>
        <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      </div>
    </div>
  )
}
