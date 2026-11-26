import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import Glass from './Glass'
import type { CheckResult } from '../lib/api'

export function riskTone(risk: number) {
  if (risk >= 70) return { color: '#f87171', bg: 'rgba(239,68,68,0.16)', ring: 'rgba(239,68,68,0.5)', icon: '⛔' }
  if (risk >= 35) return { color: '#fbbf24', bg: 'rgba(250,204,21,0.14)', ring: 'rgba(250,204,21,0.45)', icon: '⚠️' }
  return { color: '#4ade80', bg: 'rgba(34,197,94,0.14)', ring: 'rgba(34,197,94,0.45)', icon: '✅' }
}

type Seg = { text: string; flag?: number }

// Разбивает текст на куски, подсвечивая точные фразы-манипуляции (без пересечений).
function segment(text: string, quotes: string[]): Seg[] {
  const lower = text.toLowerCase()
  const ranges: { a: number; b: number; i: number }[] = []
  quotes.forEach((q, i) => {
    const t = q.trim().replace(/^["«»]+|["«»]+$/g, '')
    if (t.length < 2) return
    const a = lower.indexOf(t.toLowerCase())
    if (a < 0) return
    const b = a + t.length
    if (!ranges.some((r) => a < r.b && b > r.a)) ranges.push({ a, b, i })
  })
  ranges.sort((x, y) => x.a - y.a)
  const out: Seg[] = []
  let pos = 0
  for (const r of ranges) {
    if (r.a > pos) out.push({ text: text.slice(pos, r.a) })
    out.push({ text: text.slice(r.a, r.b), flag: r.i })
    pos = r.b
  }
  if (pos < text.length) out.push({ text: text.slice(pos) })
  return out
}

export default function Verdict({ result, text }: { result: CheckResult; text: string }) {
  const tone = riskTone(result.risk)
  const [active, setActive] = useState<number | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const segs = useMemo(() => segment(text, result.flags.map((f) => f.quote)), [text, result])

  const speak = () => {
    if (!('speechSynthesis' in window)) return
    if (speaking) {
      speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const u = new SpeechSynthesisUtterance(
      `${result.verdict}. ${result.simple} Что делать: ${result.actions.map((a, i) => `${i + 1}. ${a}`).join('. ')}`,
    )
    u.lang = 'ru-RU'
    u.rate = 0.92
    const ru = speechSynthesis.getVoices().find((v) => v.lang.startsWith('ru'))
    if (ru) u.voice = ru
    u.onend = () => setSpeaking(false)
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
    setSpeaking(true)
  }

  const share = () => {
    const msg = `🛡 Saq проверил сообщение: ${result.verdict.toUpperCase()} (риск ${result.risk}%)\nСхема: ${result.scheme}\n${result.simple}\n\nЧто делать:\n${result.actions.map((a) => `• ${a}`).join('\n')}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
  }

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
      <Glass className="p-5 sm:p-7" style={{ boxShadow: `0 0 0 1px ${tone.ring}, 0 30px 80px -30px ${tone.ring}` }}>
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: tone.bg }}>
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
              <motion.circle
                cx="50" cy="50" r="44" stroke={tone.color} strokeWidth="8" fill="none" strokeLinecap="round"
                strokeDasharray={276.5}
                initial={{ strokeDashoffset: 276.5 }}
                animate={{ strokeDashoffset: 276.5 * (1 - result.risk / 100) }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />
            </svg>
            <div className="text-center">
              <div className="font-display text-3xl font-bold" style={{ color: tone.color }}>{result.risk}%</div>
              <div className="text-[11px] uppercase tracking-wider text-white/50">риск</div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl font-bold sm:text-3xl" style={{ color: tone.color }}>
              {tone.icon} {result.verdict[0].toUpperCase() + result.verdict.slice(1)}
            </div>
            <div className="mt-1 text-lg text-white/85">{result.scheme}</div>
            <p className="mt-2 text-white/70">{result.simple}</p>
            {result.fallback && (
              <div className="mt-2 inline-block rounded-full bg-white/8 px-3 py-1 text-xs text-white/55">
                Офлайн-режим: проверка по правилам, без ИИ
              </div>
            )}
          </div>
        </div>

        {text && (
          <div className="mt-6">
            <div className="mb-2 text-sm font-medium text-white/50">
              {result.flags.length ? 'Фразы-манипуляции — нажмите, чтобы узнать почему' : 'Исходный текст'}
            </div>
            <div className="rounded-2xl bg-black/25 p-4 leading-relaxed text-white/85">
              {segs.map((s, k) =>
                s.flag === undefined ? (
                  <span key={k}>{s.text}</span>
                ) : (
                  <mark
                    key={k}
                    className={`flag ${active === s.flag ? 'active' : ''}`}
                    onMouseEnter={() => setActive(s.flag!)}
                    onClick={() => setActive(active === s.flag ? null : s.flag!)}
                  >
                    {s.text}
                  </mark>
                ),
              )}
            </div>
          </div>
        )}

        {result.flags.length > 0 && (
          <ul className="mt-4 grid gap-2">
            {result.flags.map((f, i) => (
              <li
                key={i}
                onMouseEnter={() => setActive(i)}
                className={`rounded-xl px-4 py-2.5 text-sm transition ${active === i ? 'bg-red-500/20' : 'bg-white/5'}`}
              >
                <span className="font-semibold text-red-300">«{f.quote}»</span>
                <span className="text-white/70"> — {f.why}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <div className="mb-2 text-sm font-medium text-white/50">Что делать прямо сейчас</div>
          <ol className="grid gap-2">
            {result.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-black" style={{ background: tone.color }}>
                  {i + 1}
                </span>
                <span className="text-white/90">{a}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={speak} className="rounded-2xl bg-white/10 px-5 py-3 text-base font-semibold transition hover:bg-white/20">
            {speaking ? '⏹ Остановить' : '🔊 Прочитать вслух'}
          </button>
          <button onClick={share} className="rounded-2xl bg-[#25D366] px-5 py-3 text-base font-semibold text-black transition hover:brightness-110">
            💬 Отправить внуку
          </button>
        </div>
      </Glass>
    </motion.div>
  )
}
