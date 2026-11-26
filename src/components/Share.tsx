import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

const SITE = 'https://saq-alburyks-projects.vercel.app'

export async function copyText(s: string) {
  try {
    await navigator.clipboard.writeText(s)
    return true
  } catch {
    const t = document.createElement('textarea')
    t.value = s
    t.style.position = 'fixed'
    t.style.opacity = '0'
    document.body.appendChild(t)
    t.select()
    const ok = document.execCommand('copy')
    t.remove()
    return ok
  }
}

// «Поделиться»: на телефоне — системное меню (Web Share API), иначе своё меню: WhatsApp, Telegram, копирование.
export default function ShareButton({
  title,
  text,
  label = 'Поделиться',
  className = '',
}: {
  title: string
  text: string
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const url = typeof location !== 'undefined' && location.origin.startsWith('http') ? location.origin : SITE
  const full = `${text}\n\nSaq — проверь, прежде чем перевести: ${url}`
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', off)
    return () => {
      document.removeEventListener('mousedown', off)
      document.removeEventListener('keydown', off)
    }
  }, [open])

  const native = async () => {
    try {
      await navigator.share({ title, text: full })
      setOpen(false)
    } catch {
      /* cancelled */
    }
  }

  const click = () => {
    // На сенсорных устройствах сразу открываем системное меню — там все мессенджеры человека.
    if (canNative && matchMedia('(pointer: coarse)').matches) return void native()
    setOpen((o) => !o)
  }

  const flash = (s: string) => {
    setDone(s)
    setTimeout(() => setDone(''), 1800)
  }

  const items: { id: string; label: string; icon: Parameters<typeof Icon>[0]['name']; tint: string; run: () => void }[] = [
    {
      id: 'wa',
      label: 'WhatsApp',
      icon: 'message',
      tint: 'bg-[#25D366]/20 text-[#4ade80]',
      run: () => window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, '_blank', 'noopener'),
    },
    {
      id: 'tg',
      label: 'Telegram',
      icon: 'send',
      tint: 'bg-sky-400/20 text-sky-300',
      run: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener'),
    },
    {
      id: 'copy',
      label: 'Скопировать текст',
      icon: 'copy',
      tint: 'bg-white/10 text-white/80',
      run: async () => flash((await copyText(full)) ? 'Текст скопирован' : 'Не удалось скопировать'),
    },
    {
      id: 'link',
      label: 'Скопировать ссылку на Saq',
      icon: 'link',
      tint: 'bg-white/10 text-white/80',
      run: async () => flash((await copyText(url)) ? 'Ссылка скопирована' : 'Не удалось скопировать'),
    },
    ...(canNative
      ? [{ id: 'more', label: 'Другие приложения', icon: 'share' as const, tint: 'bg-teal-300/15 text-teal-200', run: native }]
      : []),
  ]

  return (
    <div ref={box} className="relative">
      <button
        onClick={click}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-base font-semibold transition ${className}`}
      >
        <Icon name="share" className="h-5 w-5" />
        {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 z-40 mb-2 w-64 overflow-hidden rounded-2xl border border-white/12 bg-[#0b1118]/95 p-1.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="px-3 pb-1 pt-2 text-xs font-medium text-white/45">Отправить близким или сохранить</div>
            {items.map((it) => (
              <button
                key={it.id}
                role="menuitem"
                onClick={() => {
                  it.run()
                  if (it.id === 'wa' || it.id === 'tg') setOpen(false)
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/90 transition hover:bg-white/8"
              >
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${it.tint}`}>
                  <Icon name={it.icon} className="h-4 w-4" />
                </span>
                {it.label}
              </button>
            ))}
            <AnimatePresence>
              {done && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="m-1 flex items-center gap-2 rounded-lg bg-teal-300/15 px-3 py-2 text-xs font-medium text-teal-100"
                  role="status"
                >
                  <Icon name="check" className="h-4 w-4" />
                  {done}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
