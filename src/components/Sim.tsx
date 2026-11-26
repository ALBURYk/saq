import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import Glass from './Glass'
import Icon from './Icon'
import Ring from './Ring'
import ShareButton from './Share'
import { SIM_SCHEMES, SIM_SCRIPTS, type SimId, type SimScheme } from '../data/examples'
import { simStep, type SimEnd, type SimMsg } from '../lib/api'

const CATCH_MSG = 'Это мошенник! Я ничего не буду сообщать и сам перезвоню по официальному номеру.'
const TURNS = 6
const BKEY = 'saq-sim-best'

const loadBest = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(BKEY) || '{}') || {}
  } catch {
    return {}
  }
}

const scoreTone = (s: number) =>
  s >= 70
    ? { color: '#4ade80', bg: 'rgba(34,197,94,0.14)', title: 'Иммунитет есть', note: 'Вы распознали обман и ничего не сообщили.' }
    : s >= 40
      ? { color: '#fbbf24', bg: 'rgba(250,204,21,0.14)', title: 'Почти получилось', note: 'Обман заметили, но было рискованно.' }
      : { color: '#f87171', bg: 'rgba(239,68,68,0.16)', title: 'Мошенник бы победил', note: 'Не страшно — для этого и тренировка. Попробуйте ещё раз.' }

// Офлайн-разбор, если ИИ недоступен: по скрипту и ответам пользователя.
function offlineEnd(id: SimId, msgs: SimMsg[], caught: boolean): SimEnd {
  const script = SIM_SCRIPTS[id]
  const shown = msgs.filter((m) => m.role === 'assistant').length
  const seen = script.slice(0, shown).map((s) => s.flag)
  const leaked = msgs.some((m) => m.role === 'user' && /\d{4,}|cvv|cvc|перевел|перевела|отправил|отправила|перешлю|скину/i.test(m.content))
  if (caught && !leaked) {
    return {
      done: true,
      score: Math.max(40, 100 - (shown - 1) * 12),
      caught: seen,
      missed: [],
      tip: 'Отлично! Правило одно: прервите разговор и перезвоните сами по официальному номеру.',
    }
  }
  return {
    done: true,
    score: leaked ? 5 : 20,
    caught: caught ? seen.slice(0, 1) : [],
    missed: [...(leaked ? ['Вы согласились сообщить данные — мошенник получил бы доступ'] : []), ...seen],
    tip: 'Если просят код, перевод или секретность — это всегда обман. Прервите разговор.',
  }
}

function Typing() {
  return (
    <div className="flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-white/10 px-4 py-3.5" aria-label="Собеседник печатает">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot h-2 w-2 rounded-full bg-white/60" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

export default function Sim() {
  const [scheme, setScheme] = useState<SimScheme | null>(null)
  const [msgs, setMsgs] = useState<SimMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [end, setEnd] = useState<SimEnd | null>(null)
  const [offline, setOffline] = useState(false)
  const [best, setBest] = useState<Record<string, number>>(loadBest)
  const chat = useRef<HTMLDivElement>(null)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = chat.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, loading])

  const finishWith = (r: SimEnd) => {
    setEnd(r)
    if (!scheme) return
    const b = { ...best, [scheme.id]: Math.max(best[scheme.id] ?? 0, r.score) }
    setBest(b)
    try {
      localStorage.setItem(BKEY, JSON.stringify(b))
    } catch {
      /* storage may be blocked */
    }
  }

  const start = async (s: SimScheme) => {
    setScheme(s)
    setMsgs([])
    setEnd(null)
    setInput('')
    setLoading(true)
    setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    const r = await simStep(s.id, [])
    setLoading(false)
    if (r && !r.done) {
      setOffline(false)
      setMsgs([{ role: 'assistant', content: r.reply }])
    } else {
      setOffline(true)
      setMsgs([{ role: 'assistant', content: SIM_SCRIPTS[s.id][0].line }])
    }
  }

  const send = async (content: string, finish = false) => {
    if (!scheme || loading || end || !content.trim()) return
    const next: SimMsg[] = [...msgs, { role: 'user', content: content.trim() }]
    setMsgs(next)
    setInput('')
    setLoading(true)
    const r = offline ? null : await simStep(scheme.id, next, finish)
    if (offline) await new Promise((res) => setTimeout(res, 800))
    setLoading(false)
    if (r) {
      if (r.done) {
        // ИИ иногда возвращает пустые списки — подставляем приёмы, которые человек уже увидел в диалоге
        const seen = SIM_SCRIPTS[scheme.id].slice(0, Math.max(2, next.filter((m) => m.role === 'assistant').length)).map((x) => x.flag)
        finishWith(r.caught.length || r.missed.length ? r : { ...r, caught: r.score >= 50 ? seen : [], missed: r.score >= 50 ? [] : seen })
      } else setMsgs([...next, { role: 'assistant', content: r.reply }])
      return
    }
    // офлайн-режим
    setOffline(true)
    const shown = next.filter((m) => m.role === 'assistant').length
    const script = SIM_SCRIPTS[scheme.id]
    if (finish) return finishWith(offlineEnd(scheme.id, next, true))
    if (shown >= script.length) return finishWith(offlineEnd(scheme.id, next, false))
    setMsgs([...next, { role: 'assistant', content: script[shown].line }])
  }

  if (!scheme) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <Glass refract className="p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-300/15 text-teal-200 sm:grid">
              <Icon name="syringe" className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold sm:text-2xl">Прививка от мошенников</h2>
              <p className="mt-2 max-w-2xl text-white/70">
                ИИ безопасно сыграет мошенника по реальной схеме. Отвечайте как в жизни, а когда поймёте, что это обман, нажмите
                «Это мошенник!». В конце будет разбор: что вы заметили и что пропустили.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/50">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="clock" className="h-4 w-4" /> 2–3 минуты
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="eyeOff" className="h-4 w-4" /> Без настоящих номеров и ссылок
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="message" className="h-4 w-4" /> До {TURNS} реплик
                </span>
              </div>
            </div>
          </div>
        </Glass>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SIM_SCHEMES.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              onClick={() => start(s)}
              className="rounded-[28px] text-left"
            >
              <Glass className="flex h-full flex-col p-5 transition hover:bg-white/10">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-teal-200">
                    <Icon name={s.icon} className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-medium text-white/50">{s.channel}</span>
                </div>
                <div className="mt-3 font-display text-base font-semibold leading-snug">{s.title}</div>
                <div className="mt-1 flex-1 text-sm text-white/55">{s.desc}</div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-teal-300">
                    Начать <Icon name="arrowRight" className="h-4 w-4" />
                  </span>
                  {best[s.id] !== undefined && (
                    <span className="text-xs text-white/45">
                      Лучший результат: <b style={{ color: scoreTone(best[s.id]).color }}>{best[s.id]}</b>
                    </span>
                  )}
                </div>
              </Glass>
            </motion.button>
          ))}
        </div>
      </div>
    )
  }

  const turn = msgs.filter((m) => m.role === 'assistant').length
  const tone = end ? scoreTone(end.score) : null
  const lastIsBot = msgs.at(-1)?.role === 'assistant'

  return (
    <div ref={top} className="scroll-mt-20">
      <Glass className="flex flex-col p-3 sm:p-5">
        {/* Шапка чата */}
        <div className="flex items-center gap-3 px-1 pb-3">
          <button onClick={() => setScheme(null)} aria-label="К списку схем" className="grid h-10 w-10 place-items-center rounded-xl text-white/60 hover:bg-white/10">
            <Icon name="arrowLeft" className="h-5 w-5" />
          </button>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-200">
            <Icon name={scheme.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">«{scheme.who}»</div>
            <div className="truncate text-xs text-white/45">
              {end ? 'Тренировка завершена' : loading ? 'печатает…' : `${scheme.channel} · учебный ИИ-мошенник${offline ? ' · офлайн-сценарий' : ''}`}
            </div>
          </div>
          {!end && (
            <div className="hidden text-right text-xs text-white/45 sm:block">
              Реплика {Math.max(1, turn)} из {TURNS}
            </div>
          )}
        </div>
        {!end && (
          <div className="mx-1 mb-3 h-1 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuemin={0} aria-valuemax={TURNS} aria-valuenow={turn}>
            <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-red-400" animate={{ width: `${(Math.max(1, turn) / TURNS) * 100}%` }} />
          </div>
        )}

        {/* Переписка */}
        <div ref={chat} className="flex max-h-[55vh] min-h-[280px] flex-col gap-2.5 overflow-y-auto rounded-2xl bg-black/25 p-3 sm:p-4" aria-live="polite">
          <div className="mx-auto mb-1 rounded-full bg-white/6 px-3 py-1 text-[11px] text-white/40">Учебный диалог — это не настоящий человек</div>
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                  m.role === 'assistant' ? 'self-start rounded-bl-md bg-white/10 text-white/90' : 'self-end rounded-br-md bg-teal-400/85 text-[#04211f]'
                }`}
              >
                {m.content}
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && <Typing />}
        </div>

        {!end ? (
          <div className="mt-3 grid gap-3">
            {lastIsBot && !loading && (
              <div className="flex flex-wrap gap-2" aria-label="Быстрые ответы">
                {scheme.quick.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border border-white/12 bg-white/5 px-3.5 py-2 text-sm text-white/80 transition hover:bg-white/12"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
            >
              <label htmlFor="sim-input" className="sr-only">
                Ваш ответ
              </label>
              <input
                id="sim-input"
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 500))}
                placeholder="Напишите ответ…"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base focus:border-teal-300/60 focus:outline-none"
              />
              <button
                disabled={loading || !input.trim()}
                aria-label="Отправить"
                className="grid w-14 place-items-center rounded-2xl bg-white/12 transition hover:bg-white/20 disabled:opacity-40"
              >
                <Icon name="send" className="h-5 w-5" />
              </button>
            </form>
            <button
              onClick={() => send(CATCH_MSG, true)}
              disabled={loading || msgs.length === 0}
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 font-display text-lg font-bold text-white shadow-[0_10px_40px_-10px_rgba(239,68,68,0.9)] transition hover:brightness-110 disabled:opacity-50"
            >
              <Icon name="siren" className="h-6 w-6" />
              Это мошенник!
            </button>
          </div>
        ) : (
          tone && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid gap-4 px-1">
              <div className="flex flex-wrap items-center gap-5">
                <Ring value={end.score} color={tone.color} bg={tone.bg} label="баллов" />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xl font-bold sm:text-2xl" style={{ color: tone.color }}>
                    {tone.title}
                  </div>
                  <p className="mt-1 text-white/65">{tone.note}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-green-500/8 p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-green-300">
                    <Icon name="checkCircle" className="h-5 w-5" /> Вы заметили
                  </div>
                  <ul className="grid gap-1.5 text-sm text-white/80">
                    {end.caught.length ? end.caught.map((c, i) => <li key={i}>{c}</li>) : <li className="text-white/40">Пока ничего — в следующий раз получится</li>}
                  </ul>
                </div>
                <div className="rounded-2xl bg-red-500/8 p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-red-300">
                    <Icon name="xCircle" className="h-5 w-5" /> Пропустили
                  </div>
                  <ul className="grid gap-1.5 text-sm text-white/80">
                    {end.missed.length ? end.missed.map((c, i) => <li key={i}>{c}</li>) : <li className="text-white/40">Ничего не пропустили</li>}
                  </ul>
                </div>
              </div>
              {end.tip && (
                <div className="flex gap-3 rounded-2xl bg-white/6 p-4 text-white/85">
                  <Icon name="lightbulb" className="mt-0.5 h-5 w-5 text-amber-300" />
                  {end.tip}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button onClick={() => start(scheme)} className="inline-flex items-center gap-2 rounded-2xl bg-white/12 px-5 py-3 font-semibold hover:bg-white/20">
                  <Icon name="refresh" className="h-5 w-5" /> Ещё раз
                </button>
                <button onClick={() => setScheme(null)} className="inline-flex items-center gap-2 rounded-2xl bg-white/6 px-5 py-3 font-semibold hover:bg-white/12">
                  <Icon name="arrowLeft" className="h-5 w-5" /> Другая схема
                </button>
                <ShareButton
                  title="Saq — тренажёр «Прививка»"
                  label="Поделиться результатом"
                  text={`Мой результат в тренажёре Saq «${scheme.title}»: ${end.score} из 100. Попробуйте распознать мошенника — это бесплатно и безопасно.`}
                  className="bg-teal-300 text-[#04211f] hover:brightness-110"
                />
              </div>
            </motion.div>
          )
        )}
      </Glass>
    </div>
  )
}
