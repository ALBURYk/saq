import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import Glass from './Glass'
import { SIM_SCHEMES, SIM_SCRIPTS, type SimScheme } from '../data/examples'
import { simStep, type SimEnd, type SimMsg } from '../lib/api'

const CATCH_MSG = 'Это мошенник! Я ничего не буду сообщать и сам перезвоню по официальному номеру.'

// Офлайн-разбор, если ИИ недоступен: по скрипту и ответам пользователя.
function offlineEnd(id: SimScheme['id'], msgs: SimMsg[], caught: boolean): SimEnd {
  const script = SIM_SCRIPTS[id]
  const shown = msgs.filter((m) => m.role === 'assistant').length
  const seen = script.slice(0, shown).map((s) => s.flag)
  const leaked = msgs.some((m) => m.role === 'user' && /\d{4,}|cvv|cvc|перевел|перевела|отправил|отправила/i.test(m.content))
  if (caught && !leaked) {
    return {
      done: true,
      score: Math.max(40, 100 - (shown - 1) * 12),
      caught: seen,
      missed: [],
      tip: 'Отлично! Правило одно: положите трубку и перезвоните сами по официальному номеру.',
    }
  }
  return {
    done: true,
    score: leaked ? 5 : 20,
    caught: caught ? seen.slice(0, 1) : [],
    missed: [...(leaked ? ['Вы сообщили цифры/данные — мошенник получил бы доступ'] : []), ...seen],
    tip: 'Если просят код, перевод или секретность — это всегда обман. Прервите разговор.',
  }
}

export default function Sim() {
  const [scheme, setScheme] = useState<SimScheme | null>(null)
  const [msgs, setMsgs] = useState<SimMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [end, setEnd] = useState<SimEnd | null>(null)
  const [offline, setOffline] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [msgs, loading, end])

  const start = async (s: SimScheme) => {
    setScheme(s)
    setMsgs([])
    setEnd(null)
    setLoading(true)
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
    if (offline) await new Promise((res) => setTimeout(res, 700))
    setLoading(false)
    if (r) {
      if (r.done) setEnd(r)
      else setMsgs([...next, { role: 'assistant', content: r.reply }])
      return
    }
    // офлайн-режим
    setOffline(true)
    const shown = next.filter((m) => m.role === 'assistant').length
    const script = SIM_SCRIPTS[scheme.id]
    if (finish) return setEnd(offlineEnd(scheme.id, next, true))
    if (shown >= script.length) return setEnd(offlineEnd(scheme.id, next, false))
    setMsgs([...next, { role: 'assistant', content: script[shown].line }])
  }

  if (!scheme) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <Glass refract className="p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">Прививка от мошенников</h2>
          <p className="mt-2 max-w-2xl text-white/70">
            ИИ безопасно сыграет мошенника по реальной схеме. Ваша задача — распознать обман и нажать «Это мошенник!».
            В конце — разбор: какие красные флаги вы заметили и какие пропустили. Никаких настоящих номеров и ссылок.
          </p>
        </Glass>
        <div className="grid gap-4 sm:grid-cols-3">
          {SIM_SCHEMES.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              onClick={() => start(s)}
              className="text-left"
            >
              <Glass className="h-full p-5 transition hover:bg-white/10">
                <div className="text-4xl">{s.emoji}</div>
                <div className="mt-3 font-display text-lg font-semibold">{s.title}</div>
                <div className="mt-1 text-sm text-white/60">{s.desc}</div>
                <div className="mt-4 text-sm font-semibold text-teal-300">Начать тренировку →</div>
              </Glass>
            </motion.button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Glass className="flex flex-col p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">{scheme.emoji} {scheme.title}</div>
          <div className="text-xs text-white/45">Учебный диалог · собеседник — ИИ-мошенник{offline ? ' (офлайн-сценарий)' : ''}</div>
        </div>
        <button onClick={() => setScheme(null)} className="rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/10">
          ← Схемы
        </button>
      </div>

      <div className="flex max-h-[52vh] min-h-[260px] flex-col gap-3 overflow-y-auto rounded-2xl bg-black/25 p-3 sm:p-4">
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
              {m.role === 'assistant' && <div className="mb-0.5 text-[11px] font-semibold text-red-300/80">{scheme.who}</div>}
              {m.content}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && <div className="self-start rounded-2xl bg-white/10 px-4 py-2.5 text-white/50">печатает…</div>}
        <div ref={bottom} />
      </div>

      {!end ? (
        <div className="mt-3 grid gap-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 500))}
              placeholder="Ваш ответ…"
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base focus:border-teal-300/60 focus:outline-none"
            />
            <button disabled={loading} className="rounded-2xl bg-white/12 px-5 font-semibold hover:bg-white/20 disabled:opacity-50">
              ➤
            </button>
          </form>
          <button
            onClick={() => send(CATCH_MSG, true)}
            disabled={loading || msgs.length === 0}
            className="rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 font-display text-lg font-bold text-white shadow-[0_10px_40px_-10px_rgba(239,68,68,0.9)] transition hover:brightness-110 disabled:opacity-50"
          >
            🚨 Это мошенник!
          </button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid gap-4">
          <div className="flex items-center gap-4">
            <div
              className="font-display text-5xl font-bold"
              style={{ color: end.score >= 70 ? '#4ade80' : end.score >= 40 ? '#fbbf24' : '#f87171' }}
            >
              {end.score}
            </div>
            <div className="text-white/70">
              баллов из 100
              <div className="text-sm text-white/45">{end.score >= 70 ? 'Иммунитет есть 💪' : end.score >= 40 ? 'Неплохо, но было рискованно' : 'Мошенник бы победил — тренируемся ещё'}</div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-green-500/10 p-4">
              <div className="mb-2 font-semibold text-green-300">✓ Вы заметили</div>
              <ul className="grid gap-1 text-sm text-white/80">
                {end.caught.length ? end.caught.map((c, i) => <li key={i}>• {c}</li>) : <li className="text-white/45">—</li>}
              </ul>
            </div>
            <div className="rounded-2xl bg-red-500/10 p-4">
              <div className="mb-2 font-semibold text-red-300">✗ Пропустили</div>
              <ul className="grid gap-1 text-sm text-white/80">
                {end.missed.length ? end.missed.map((c, i) => <li key={i}>• {c}</li>) : <li className="text-white/45">—</li>}
              </ul>
            </div>
          </div>
          {end.tip && <div className="rounded-2xl bg-white/6 p-4 text-white/85">💡 {end.tip}</div>}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => start(scheme)} className="rounded-2xl bg-white/12 px-5 py-3 font-semibold hover:bg-white/20">
              Ещё раз
            </button>
            <button onClick={() => setScheme(null)} className="rounded-2xl bg-white/6 px-5 py-3 font-semibold hover:bg-white/12">
              Другая схема
            </button>
          </div>
        </motion.div>
      )}
    </Glass>
  )
}
