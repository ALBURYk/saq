import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import Glass from './Glass'
import Icon, { type IconName } from './Icon'
import Ring from './Ring'
import ShareButton from './Share'
import { kindOf } from '../lib/kinds'
import type { CheckResult } from '../lib/api'

export function riskTone(risk: number): { color: string; bg: string; ring: string; icon: IconName } {
  if (risk >= 70) return { color: '#f87171', bg: 'rgba(239,68,68,0.16)', ring: 'rgba(239,68,68,0.5)', icon: 'octagonAlert' }
  if (risk >= 35) return { color: '#fbbf24', bg: 'rgba(250,204,21,0.14)', ring: 'rgba(250,204,21,0.45)', icon: 'alertTriangle' }
  return { color: '#4ade80', bg: 'rgba(34,197,94,0.14)', ring: 'rgba(34,197,94,0.45)', icon: 'shieldCheck' }
}

export const EMERGENCY = [
  { icon: 'creditCard' as IconName, t: 'Позвоните в банк', d: 'По номеру на обороте карты или в официальном приложении — попросите заблокировать карту и операции.' },
  { icon: 'key' as IconName, t: 'Смените пароли', d: 'Если называли код или вводили данные — смените пароль банка и eGov, выйдите со всех устройств.' },
  { icon: 'shield' as IconName, t: 'Заявление в полицию — 102', d: 'Чем раньше, тем больше шансов остановить перевод.' },
  { icon: 'fileText' as IconName, t: 'Сохраните доказательства', d: 'Скриншоты переписки, номер, чеки и время звонка.' },
]

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

export default function Verdict({
  result,
  text,
  image,
  onReset,
}: {
  result: CheckResult
  text: string
  image?: string
  onReset: () => void
}) {
  const tone = riskTone(result.risk)
  const danger = result.risk >= 35
  const [active, setActive] = useState<number | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [done, setDone] = useState<boolean[]>(() => result.actions.map(() => false))
  const [sos, setSos] = useState(false)
  const items = useRef<(HTMLLIElement | null)[]>([])
  const segs = useMemo(() => segment(text, result.flags.map((f) => f.quote)), [text, result])

  // Флаги, сгруппированные по типу приёма (порядок — как встретились).
  const groups = useMemo(() => {
    const m = new Map<string, number[]>()
    result.flags.forEach((f, i) => {
      const k = kindOf(f.kind).label
      m.set(k, [...(m.get(k) ?? []), i])
    })
    return [...m.entries()].map(([label, idx]) => ({ label, idx, meta: kindOf(result.flags[idx[0]].kind) }))
  }, [result])

  const pick = (i: number) => {
    setActive(i)
    items.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const title = result.verdict[0].toUpperCase() + result.verdict.slice(1)

  const speak = () => {
    if (!('speechSynthesis' in window)) return
    if (speaking) {
      speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const u = new SpeechSynthesisUtterance(
      `${title}. ${result.simple} Что делать: ${result.actions.map((a, i) => `${i + 1}. ${a}`).join('. ')}`,
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

  const shareText = [
    `Saq проверил сообщение: ${title.toLowerCase()} (риск ${result.risk}%).`,
    `Схема: ${result.scheme}`,
    result.simple,
    groups.length ? `Приёмы: ${groups.map((g) => g.label.toLowerCase()).join(', ')}.` : '',
    `Что делать:\n${result.actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
      <Glass className="p-5 sm:p-7" style={{ boxShadow: `0 0 0 1px ${tone.ring}, 0 30px 80px -30px ${tone.ring}` }}>
        {/* Итог */}
        <div className="flex flex-wrap items-center gap-5" aria-live="polite">
          <Ring value={result.risk} suffix="%" color={tone.color} bg={tone.bg} label="риск" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 font-display text-2xl font-bold sm:text-3xl" style={{ color: tone.color }}>
              <Icon name={tone.icon} className="h-7 w-7 sm:h-8 sm:w-8" />
              {title}
            </div>
            <div className="mt-1.5 text-lg font-medium text-white/90">{result.scheme}</div>
            <p className="mt-1.5 text-white/70">{result.simple}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {result.fallback ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-white/60">
                  <Icon name="info" className="h-3.5 w-3.5" /> Офлайн-режим: проверка по правилам, без ИИ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-300/10 px-3 py-1 text-teal-100/80">
                  <Icon name="sparkles" className="h-3.5 w-3.5" /> Проверено ИИ
                </span>
              )}
              {result.flags.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/12 px-3 py-1 text-red-200/90">
                  Найдено приёмов: {result.flags.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Что делать */}
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-white/55">Что делать прямо сейчас</h3>
          <ol className="grid gap-2">
            {result.actions.map((a, i) => (
              <li key={i}>
                <button
                  onClick={() => setDone(done.map((d, j) => (j === i ? !d : d)))}
                  aria-pressed={done[i]}
                  className={`flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition ${done[i] ? 'bg-white/3' : 'bg-white/6 hover:bg-white/9'}`}
                >
                  <span
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition"
                    style={done[i] ? { background: tone.color, borderColor: tone.color, color: '#05070d' } : { borderColor: tone.color, color: tone.color }}
                  >
                    {done[i] ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`text-white/90 ${done[i] ? 'text-white/45 line-through' : ''}`}>{a}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        {/* Если уже поздно */}
        {danger && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-red-400/25 bg-red-500/8">
            <button
              onClick={() => setSos(!sos)}
              aria-expanded={sos}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-semibold text-red-100"
            >
              <Icon name="siren" className="h-5 w-5 text-red-300" />
              <span className="flex-1">Уже перевели деньги или назвали код?</span>
              <Icon name="chevronDown" className={`h-5 w-5 text-red-200/70 transition ${sos ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {sos && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <ol className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
                    {EMERGENCY.map((s, i) => (
                      <li key={i} className="flex gap-3 rounded-xl bg-black/20 p-3">
                        <Icon name={s.icon} className="mt-0.5 h-5 w-5 text-red-300" />
                        <div>
                          <div className="font-semibold text-white/90">
                            {i + 1}. {s.t}
                          </div>
                          <div className="text-sm text-white/60">{s.d}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Текст с подсветкой */}
        {(text || image) && (
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-white/55">
              {text && result.flags.length ? 'Сообщение — нажмите на подсвеченную фразу' : image && !text ? 'Скриншот' : 'Сообщение'}
            </h3>
            <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
              {image && <img src={image} alt="Проверенный скриншот" className="max-h-56 w-auto max-w-full rounded-2xl border border-white/10 object-contain sm:max-w-[180px]" />}
              {text && (
                <div className="rounded-2xl bg-black/25 p-4 leading-relaxed text-white/85">
                  {segs.map((s, k) =>
                    s.flag === undefined ? (
                      <span key={k}>{s.text}</span>
                    ) : (
                      <mark
                        key={k}
                        role="button"
                        tabIndex={0}
                        className={`flag ${active === s.flag ? 'active' : ''}`}
                        onMouseEnter={() => setActive(s.flag!)}
                        onClick={() => pick(s.flag!)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(s.flag!))}
                      >
                        {s.text}
                      </mark>
                    ),
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Приёмы по типам */}
        {groups.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-white/55">Какие приёмы на вас используют</h3>
            <ul className="grid gap-2">
              {groups.flatMap((g) =>
                g.idx.map((i) => (
                  <li
                    key={i}
                    ref={(el) => {
                      items.current[i] = el
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`flex gap-3 rounded-2xl p-3 transition ${active === i ? 'bg-red-500/18 ring-1 ring-red-400/40' : 'bg-white/4'}`}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-200" title={g.label}>
                      <Icon name={g.meta.icon} className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 text-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-red-200/70">{g.label}</div>
                      <div className="mt-0.5">
                        <span className="font-semibold text-red-100">«{result.flags[i].quote}»</span>
                        <span className="text-white/65"> — {result.flags[i].why}</span>
                      </div>
                    </div>
                  </li>
                )),
              )}
            </ul>
          </section>
        )}

        {/* Действия */}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-white/8 pt-5">
          <button
            onClick={speak}
            aria-pressed={speaking}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-base font-semibold transition hover:bg-white/18"
          >
            <Icon name={speaking ? 'stop' : 'volume'} className="h-5 w-5" />
            {speaking ? 'Остановить' : 'Прочитать вслух'}
          </button>
          <ShareButton title="Saq — проверка сообщения" text={shareText} className="bg-teal-300 text-[#04211f] hover:brightness-110" />
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-base font-semibold text-white/75 transition hover:bg-white/8 sm:ml-auto"
          >
            <Icon name="refresh" className="h-5 w-5" />
            Новая проверка
          </button>
        </div>
      </Glass>
    </motion.div>
  )
}
