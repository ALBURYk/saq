import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import Glass from './Glass'
import Verdict, { riskTone } from './Verdict'
import { EXAMPLES } from '../data/examples'
import { checkMessage, compressImage, type CheckResult } from '../lib/api'

type Hist = { at: number; risk: number; scheme: string; snippet: string }
const HKEY = 'saq-history'
const loadHist = (): Hist[] => {
  try {
    return JSON.parse(localStorage.getItem(HKEY) || '[]')
  } catch {
    return []
  }
}

export default function Checker({ onRisk }: { onRisk: (r: number | null) => void }) {
  const [text, setText] = useState('')
  const [img, setImg] = useState<{ base64: string; mime: string; preview: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ r: CheckResult; text: string } | null>(null)
  const [hist, setHist] = useState<Hist[]>(loadHist)
  const fileRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const run = async (t = text, image = img) => {
    if (!t.trim() && !image) return setError('Вставьте текст сообщения или загрузите скриншот')
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const r = await checkMessage({ text: t.trim() || undefined, imageBase64: image?.base64, mime: image?.mime })
      setResult({ r, text: t.trim() })
      onRisk(r.risk)
      const h = [{ at: Date.now(), risk: r.risk, scheme: r.scheme, snippet: (t.trim() || 'Скриншот').slice(0, 60) }, ...hist].slice(0, 5)
      setHist(h)
      try {
        localStorage.setItem(HKEY, JSON.stringify(h))
      } catch {
        /* storage may be blocked */
      }
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onFile = async (f?: File) => {
    if (!f) return
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setError('Нужен скриншот в формате JPG, PNG или WebP')
    try {
      setImg(await compressImage(f))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="grid gap-6">
      <Glass refract className="p-5 sm:p-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">Что вам написали или сказали?</h2>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 4000))}
          onPaste={(e) => {
            const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith('image/'))
            if (f) onFile(f)
          }}
          placeholder="Вставьте сообщение, скриншот (Ctrl+V) или опишите звонок своими словами…"
          rows={5}
          className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-4 text-lg leading-relaxed text-white placeholder:text-white/35 focus:border-teal-300/60 focus:outline-none"
        />
        <div className="mt-1 text-right text-xs text-white/35">{text.length}/4000</div>

        {img && (
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white/5 p-2">
            <img src={img.preview} alt="Скриншот" className="h-16 w-16 rounded-xl object-cover" />
            <span className="flex-1 text-sm text-white/70">Скриншот сжат, метаданные удалены</span>
            <button onClick={() => setImg(null)} className="rounded-xl px-3 py-1 text-sm text-white/60 hover:bg-white/10">
              Убрать
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            onClick={() => run()}
            disabled={loading}
            className="flex-1 rounded-2xl bg-gradient-to-r from-teal-300 to-cyan-300 px-6 py-4 font-display text-lg font-bold text-[#05201f] shadow-[0_10px_40px_-10px_rgba(45,212,191,0.8)] transition hover:brightness-110 disabled:opacity-60 sm:flex-none"
          >
            {loading ? 'Проверяю…' : '🛡 Проверить'}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 font-semibold text-white/85 transition hover:bg-white/10"
          >
            📷 Скриншот
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {error && <div className="mt-3 rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-200">{error}</div>}

        <div className="mt-6">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">Попробуйте пример (учебные сообщения)</div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                onClick={() => {
                  setText(ex.text)
                  setImg(null)
                  run(ex.text, null)
                }}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  ex.safe ? 'border-green-400/30 bg-green-400/10 hover:bg-green-400/20' : 'border-white/12 bg-white/6 hover:bg-white/14'
                }`}
              >
                {ex.emoji} {ex.label}
              </button>
            ))}
          </div>
        </div>
      </Glass>

      <div ref={resultRef} className="scroll-mt-6">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Glass className="flex items-center gap-4 p-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
                <span className="text-white/75">Ищу приёмы манипуляции…</span>
              </Glass>
            </motion.div>
          )}
          {result && !loading && <Verdict key="v" result={result.r} text={result.text} />}
        </AnimatePresence>
      </div>

      {hist.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">Последние проверки (только на этом устройстве)</div>
          <div className="grid gap-2">
            {hist.map((h) => (
              <div key={h.at} className="flex items-center gap-3 rounded-xl bg-white/4 px-4 py-2 text-sm">
                <span className="font-bold" style={{ color: riskTone(h.risk).color }}>{h.risk}%</span>
                <span className="truncate text-white/60">{h.scheme} — {h.snippet}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
