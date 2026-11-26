import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Glass, { GlassFilter } from './components/Glass'
import Icon, { type IconName } from './components/Icon'
import Checker from './components/Checker'
import Sim from './components/Sim'
import Memo from './components/Memo'

const Orb = lazy(() => import('./components/Orb'))

type Tab = 'check' | 'sim' | 'memo'
const TABS: [Tab, string, IconName][] = [
  ['check', 'Проверка', 'shieldCheck'],
  ['sim', 'Прививка', 'syringe'],
  ['memo', 'Памятка', 'book'],
]

export default function App() {
  const [tab, setTab] = useState<Tab>('check')
  const [risk, setRisk] = useState<number | null>(null)
  const tool = useRef<HTMLDivElement>(null)
  const [big, setBig] = useState(() => {
    try {
      return localStorage.getItem('saq-big') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    document.documentElement.style.fontSize = big ? '19px' : ''
    try {
      localStorage.setItem('saq-big', big ? '1' : '0')
    } catch {
      /* storage may be blocked */
    }
  }, [big])

  const go = (t: Tab) => {
    setTab(t)
    setTimeout(() => tool.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <GlassFilter />
      <a href="#tool" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-teal-300 focus:px-4 focus:py-2 focus:text-[#04211f]">
        Перейти к проверке
      </a>

      <nav className="no-print sticky top-0 z-50 border-b border-white/6 bg-[#05070d]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <button onClick={() => go('check')} className="flex items-center gap-2 rounded-xl py-1 pr-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-300 text-[#04211f]">
              <Icon name="shield" className="h-4.5 w-4.5" strokeWidth={2.4} />
            </span>
            Saq
          </button>
          <div className="ml-auto flex items-center gap-1">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => go(id)}
                className={`hidden rounded-xl px-3 py-2 text-sm font-medium transition md:block ${tab === id ? 'text-white' : 'text-white/55 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setBig(!big)}
              aria-pressed={big}
              className={`ml-1 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                big ? 'border-teal-300/60 bg-teal-300 text-[#04211f]' : 'border-white/12 text-white/80 hover:bg-white/8'
              }`}
            >
              <Icon name="type" className="h-4 w-4" />
              {big ? 'Обычный шрифт' : 'Крупный шрифт'}
            </button>
          </div>
        </div>
      </nav>

      <header className="no-print relative mx-auto grid max-w-6xl items-center gap-2 px-4 pt-8 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pt-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1 text-xs font-medium text-teal-200">
            <Icon name="shield" className="h-3.5 w-3.5" /> ИИ-щит от мошенников · Казахстан
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Проверь, прежде
            <br />
            чем <span className="text-teal-300">перевести</span>.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/65 sm:text-lg">
            Банки ловят перевод. Saq ловит момент, когда вас ещё уговаривают: покажет приёмы манипуляции прямо в тексте, скажет, что делать, и
            научит распознавать обман заранее.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => go('check')}
              className="inline-flex items-center gap-2 rounded-2xl bg-teal-300 px-5 py-3 font-semibold text-[#04211f] transition hover:brightness-110"
            >
              <Icon name="shieldCheck" className="h-5 w-5" /> Проверить сообщение
            </button>
            <button
              onClick={() => go('sim')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white/85 transition hover:bg-white/8"
            >
              <Icon name="syringe" className="h-5 w-5" /> Потренироваться
            </button>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/50">
            {(
              [
                ['zap', 'Ответ за секунды'],
                ['user', 'Без регистрации'],
                ['eyeOff', 'Ничего не храним'],
              ] as [IconName, string][]
            ).map(([i, t]) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Icon name={i} className="h-4 w-4 text-teal-300/80" /> {t}
              </li>
            ))}
          </ul>
        </motion.div>
        <div className="pointer-events-none absolute -right-24 top-4 h-[300px] w-[300px] opacity-50 md:relative md:right-auto md:top-0 md:h-[440px] md:w-auto md:opacity-100" aria-hidden>
          <Suspense fallback={null}>
            <Orb risk={tab === 'check' ? risk : null} />
          </Suspense>
        </div>
      </header>

      <main className="relative z-10 mx-auto mt-10 max-w-4xl px-4 pb-16 sm:px-6 md:mt-2">
        <div id="tool" ref={tool} className="scroll-mt-20" />
        <Glass className="no-print mx-auto mb-6 flex w-full max-w-lg gap-1 p-1.5" role="tablist" aria-label="Разделы">
          {TABS.map(([id, label, icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-[22px] px-3 py-3 font-semibold transition ${
                tab === id ? 'text-[#04211f]' : 'text-white/70 hover:text-white'
              }`}
            >
              {tab === id && <motion.span layoutId="tab" className="absolute inset-0 rounded-[22px] bg-teal-300" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />}
              <Icon name={icon} className="relative hidden h-5 w-5 sm:block" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </Glass>

        <AnimatePresence mode="wait">
          <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            {tab === 'check' ? <Checker onRisk={setRisk} /> : tab === 'sim' ? <Sim /> : <Memo />}
          </motion.div>
        </AnimatePresence>

        <section className="no-print mt-20">
          <h2 className="mb-6 text-center font-display text-2xl font-semibold sm:text-3xl">Как это работает</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['image', 'Покажите', 'Вставьте сообщение, добавьте скриншот переписки или расскажите про звонок голосом.'],
                ['sparkles', 'Saq объясняет', 'ИИ находит приёмы давления — срочность, «код из СМС», секретность — и подсвечивает их прямо в тексте.'],
                ['shieldCheck', 'Вы защищены', 'Понятные шаги, озвучка для пожилых и «Поделиться» с близкими. А «Прививка» тренирует заранее.'],
              ] as [IconName, string, string][]
            ).map(([icon, t, d], i) => (
              <motion.div key={t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Glass className="h-full p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-300/12 text-teal-200">
                      <Icon name={icon} className="h-5 w-5" />
                    </span>
                    <span className="font-display text-sm font-bold text-white/20">0{i + 1}</span>
                  </div>
                  <div className="mt-4 font-display text-lg font-semibold">{t}</div>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">{d}</p>
                </Glass>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Glass className="flex gap-4 p-5">
              <Icon name="users" className="mt-0.5 h-6 w-6 text-teal-300" />
              <div>
                <div className="font-semibold text-white/90">Для людей — бесплатно</div>
                <p className="mt-1 text-sm text-white/60">Пожилые, подростки, продавцы на маркетплейсах — все, кому звонят «из банка».</p>
              </div>
            </Glass>
            <Glass className="flex gap-4 p-5">
              <Icon name="landmark" className="mt-0.5 h-6 w-6 text-teal-300" />
              <div>
                <div className="font-semibold text-white/90">Для банков, операторов и школ</div>
                <p className="mt-1 text-sm text-white/60">White-label и API, «Прививка» для уроков финграмотности: предотвратить обман дешевле, чем разбирать последствия.</p>
              </div>
            </Glass>
          </div>
        </section>

        <footer className="no-print mt-14 grid gap-3 border-t border-white/6 pt-8 text-center text-xs leading-relaxed text-white/40">
          <p>В 2025 году в РК зарегистрировано 28 851 случай интернет-мошенничества, ущерб — 12,2 млрд ₸ (данные Генпрокуратуры РК и СМИ).</p>
          <p>
            Saq не хранит ваши сообщения: текст и скриншот отправляются на анализ и сразу забываются. Примеры в приложении — учебные. Saq помогает
            распознать обман, но не заменяет банк и полицию: при сомнениях звоните по номеру на обороте карты или 102.
          </p>
          <p className="flex items-center justify-center gap-2">
            <a className="inline-flex items-center gap-1.5 underline-offset-2 hover:text-white/70 hover:underline" href="https://github.com/ALBURYk/saq" target="_blank" rel="noreferrer">
              <Icon name="github" className="h-3.5 w-3.5" /> Открытый код
            </a>
            <span>· Google Gemini · Vercel · three.js</span>
          </p>
        </footer>
      </main>
    </div>
  )
}
