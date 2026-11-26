import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import Glass from './Glass'
import Icon from './Icon'
import Verdict, { riskTone } from './Verdict'
import { EXAMPLES } from '../data/examples'
import { checkMessage, compressImage, type CheckResult } from '../lib/api'

type Img = { base64: string; mime: string; preview: string }
type Hist = { at: number; r: CheckResult; text: string; image?: boolean }
const HKEY = 'saq-history-v2'
const MAX = 4000

const loadHist = (): Hist[] => {
  try {
    const h = JSON.parse(localStorage.getItem(HKEY) || '[]')
    return Array.isArray(h) ? h.filter((x) => x && x.r && typeof x.r.risk === 'number') : []
  } catch {
    return []
  }
}
const saveHist = (h: Hist[]) => {
  try {
    localStorage.setItem(HKEY, JSON.stringify(h))
  } catch {
    /* storage may be blocked */
  }
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ч назад`
  return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// Пошаговый индикатор: пока ИИ думает, человек видит, что именно происходит.
function Progress({ image }: { image: boolean }) {
  const steps = [image ? 'Читаю текст на скриншоте' : 'Читаю сообщение', 'Ищу приёмы давления', 'Сверяю с известными схемами']
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 1200)
    return () => clearInterval(t)
  }, [steps.length])
  return (
    <Glass className="p-5 sm:p-6" aria-live="polite" aria-busy="true">
      <div className="mb-4 flex items-center gap-3 font-display text-lg font-semibold">
        <Icon name="shield" className="h-6 w-6 text-teal-300" /> Проверяю…
      </div>
      <ol className="grid gap-3">
        {steps.map((s, k) => (
          <li key={s} className={`flex items-center gap-3 transition ${k > i ? 'text-white/30' : 'text-white/85'}`}>
            {k < i ? (
              <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-300 text-[#04211f]">
                <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            ) : k === i ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
            ) : (
              <span className="h-6 w-6 rounded-full border-2 border-white/15" />
            )}
            {s}
          </li>
        ))}
      </ol>
    </Glass>
  )
}

export default function Checker({ onRisk }: { onRisk: (r: number | null) => void }) {
  const [text, setText] = useState('')
  const [img, setImg] = useState<Img | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ id: number; r: CheckResult; text: string; image?: string } | null>(null)
  const [hist, setHist] = useState<Hist[]>(loadHist)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)
  const SR = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null

  const toResult = () => setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)

  // Голосовой ввод: «опишите звонок своими словами» — удобно пожилым.
  const toggleMic = () => {
    if (!SR) return
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new SR()
    rec.lang = 'ru-RU'
    rec.interimResults = false
    rec.continuous = true
    const base = text ? text.trimEnd() + ' ' : ''
    rec.onresult = (e: any) => {
      const said = Array.from(e.results as ArrayLike<any>).map((r) => r[0].transcript).join(' ')
      setText((base + said).slice(0, MAX))
    }
    rec.onerror = (e: any) => {
      setListening(false)
      if (e?.error === 'not-allowed') setError('Разрешите доступ к микрофону в настройках браузера')
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  const run = async (t = text, image = img) => {
    if (!t.trim() && !image) {
      setError('Вставьте текст сообщения, добавьте скриншот или расскажите голосом')
      areaRef.current?.focus()
      return
    }
    recRef.current?.stop()
    setError('')
    setLoading(true)
    setResult(null)
    toResult()
    try {
      const r = await checkMessage({ text: t.trim() || undefined, imageBase64: image?.base64, mime: image?.mime })
      setResult({ id: Date.now(), r, text: t.trim(), image: image?.preview })
      onRisk(r.risk)
      const h = [{ at: Date.now(), r, text: t.trim(), image: !!image }, ...hist].slice(0, 8)
      setHist(h)
      saveHist(h)
      toResult()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onFile = async (f?: File | null) => {
    if (!f) return
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setError('Нужен скриншот в формате JPG, PNG или WebP')
    try {
      setImg(await compressImage(f))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const reset = () => {
    setResult(null)
    setText('')
    setImg(null)
    setError('')
    onRisk(null)
    window.scrollTo({ top: (areaRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 140, behavior: 'smooth' })
    setTimeout(() => areaRef.current?.focus({ preventScroll: true }), 300)
  }

  const open = (h: Hist) => {
    setResult({ id: Date.now(), r: h.r, text: h.text })
    onRisk(h.r.risk)
    toResult()
  }

  const empty = !text.trim() && !img

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Glass
        refract
        className="p-5 sm:p-7"
        onDragOver={(e) => {
          if ([...e.dataTransfer.types].includes('Files')) {
            e.preventDefault()
            setDrag(true)
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          onFile(e.dataTransfer.files?.[0])
        }}
      >
        <h2 className="font-display text-xl font-semibold sm:text-2xl">Что вам написали или сказали?</h2>
        <p className="mt-1 text-sm text-white/55">Вставьте текст, добавьте скриншот переписки или расскажите про звонок голосом.</p>

        <div
          className={`relative mt-4 rounded-2xl border bg-black/30 transition focus-within:border-teal-300/60 ${
            drag ? 'border-teal-300 bg-teal-300/5' : 'border-white/10'
          }`}
        >
          <label htmlFor="msg" className="sr-only">
            Текст сообщения
          </label>
          <textarea
            id="msg"
            ref={areaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            onPaste={(e) => {
              const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith('image/'))
              if (f) {
                e.preventDefault()
                onFile(f)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run()
            }}
            placeholder="Например: «Здравствуйте, служба безопасности банка. Продиктуйте код из СМС…»"
            rows={5}
            className="block w-full resize-y rounded-t-2xl bg-transparent p-4 text-lg leading-relaxed text-white placeholder:text-white/30 focus:outline-none"
          />

          {img && (
            <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-white/6 p-2">
              <img src={img.preview} alt="Добавленный скриншот" className="h-14 w-14 rounded-lg object-cover" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-medium text-white/85">Скриншот добавлен</div>
                <div className="text-white/45">Сжат, метаданные удалены</div>
              </div>
              <button onClick={() => setImg(null)} aria-label="Убрать скриншот" className="grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/10">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1 border-t border-white/8 px-2 py-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/75 transition hover:bg-white/8 hover:text-white"
            >
              <Icon name="image" className="h-5 w-5" /> Скриншот
            </button>
            {SR && (
              <button
                onClick={toggleMic}
                aria-pressed={listening}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  listening ? 'bg-red-500/20 text-red-100' : 'text-white/75 hover:bg-white/8 hover:text-white'
                }`}
              >
                {listening ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>
                    Слушаю — нажмите, чтобы остановить
                  </>
                ) : (
                  <>
                    <Icon name="mic" className="h-5 w-5" /> Голосом
                  </>
                )}
              </button>
            )}
            <div className="ml-auto flex items-center gap-1">
              <span className={`px-2 text-xs ${text.length > MAX - 200 ? 'text-amber-300' : 'text-white/35'}`}>
                {text.length}/{MAX}
              </span>
              {!empty && (
                <button
                  onClick={() => {
                    setText('')
                    setImg(null)
                    areaRef.current?.focus()
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-white/55 transition hover:bg-white/8 hover:text-white"
                >
                  <Icon name="trash" className="h-4 w-4" /> Очистить
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {drag && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-[#05070d]/85 text-teal-200"
              >
                <div className="flex flex-col items-center gap-2 font-semibold">
                  <Icon name="upload" className="h-8 w-8" />
                  Отпустите, чтобы добавить скриншот
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              role="alert"
              className="mt-3 flex items-center gap-2 overflow-hidden rounded-xl bg-red-500/15 px-4 py-2.5 text-sm text-red-100"
            >
              <Icon name="alertTriangle" className="h-4 w-4 text-red-300" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => run()}
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-teal-300 to-cyan-300 px-8 py-4 font-display text-lg font-bold text-[#05201f] shadow-[0_10px_40px_-10px_rgba(45,212,191,0.8)] transition hover:brightness-110 disabled:opacity-60 sm:flex-none"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#05201f] border-t-transparent" />
            ) : (
              <Icon name="shieldCheck" className="h-6 w-6" />
            )}
            {loading ? 'Проверяю…' : 'Проверить'}
          </button>
          <span className="hidden text-xs text-white/35 sm:inline">Ctrl + Enter · скриншот можно перетащить или вставить</span>
        </div>

        <div className="mt-7">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div className="text-sm font-semibold text-white/60">Или попробуйте на примере</div>
            <div className="text-xs text-white/35">учебные сообщения</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                disabled={loading}
                onClick={() => {
                  setText(ex.text)
                  setImg(null)
                  run(ex.text, null)
                }}
                className={`group flex min-w-0 flex-col gap-2 rounded-2xl border p-3 text-left transition disabled:opacity-50 ${
                  ex.safe ? 'border-green-400/20 bg-green-400/5 hover:bg-green-400/10' : 'border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/8'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${ex.safe ? 'bg-green-400/15 text-green-300' : 'bg-white/8 text-teal-200'}`}>
                    <Icon name={ex.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 text-sm font-semibold leading-tight text-white/90">{ex.label}</span>
                </div>
                <span className="line-clamp-2 text-xs leading-snug text-white/45">{ex.text}</span>
              </button>
            ))}
          </div>
        </div>
      </Glass>

      <div ref={resultRef} className="scroll-mt-20">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Progress image={!!img} />
            </motion.div>
          )}
          {result && !loading && <Verdict key={result.id} result={result.r} text={result.text} image={result.image} onReset={reset} />}
        </AnimatePresence>
      </div>

      {hist.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white/60">
              <Icon name="history" className="h-4 w-4" /> Последние проверки
              <span className="font-normal text-white/35">· только на этом устройстве</span>
            </h3>
            <button
              onClick={() => {
                setHist([])
                saveHist([])
              }}
              className="rounded-lg px-2 py-1 text-xs text-white/40 hover:bg-white/8 hover:text-white/70"
            >
              Очистить
            </button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {hist.map((h) => {
              const t = riskTone(h.r.risk)
              return (
                <button
                  key={h.at}
                  onClick={() => open(h)}
                  className="flex min-w-0 items-center gap-3 rounded-xl bg-white/4 px-4 py-2.5 text-left text-sm transition hover:bg-white/8"
                >
                  <Icon name={t.icon} className="h-5 w-5" style={{ color: t.color }} />
                  <span className="w-10 shrink-0 font-bold" style={{ color: t.color }}>
                    {h.r.risk}%
                  </span>
                  <span className="min-w-0 flex-1 truncate text-white/70">
                    {h.r.scheme} <span className="text-white/40">— {h.text ? h.text.slice(0, 80) : 'скриншот'}</span>
                  </span>
                  <span className="hidden shrink-0 text-xs text-white/35 sm:inline">{ago(h.at)}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
