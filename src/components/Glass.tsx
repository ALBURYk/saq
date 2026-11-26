import type { HTMLAttributes, ReactNode } from 'react'

// Liquid glass: blur + saturate + inset-блик. В Chromium — SVG-преломление (feTurbulence + feDisplacementMap).
const isChromium = typeof navigator !== 'undefined' && /Chrome\//.test(navigator.userAgent)
export function GlassFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <filter id="saq-refract" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}

export default function Glass({
  children,
  className = '',
  refract = false,
  ...rest
}: { children: ReactNode; className?: string; refract?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`glass ${refract && isChromium ? 'glass-refract' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}
