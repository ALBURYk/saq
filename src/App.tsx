import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useEffect, useState } from 'react'
import Glass, { GlassFilter } from './components/Glass'
import Checker from './components/Checker'
import Sim from './components/Sim'

const Orb = lazy(() => import('./components/Orb'))

type Tab = 'check' | 'sim'

export default function App() {
  const [tab, setTab] = useState<Tab>('check')
  const [risk, setRisk] = useState<number | null>(null)
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

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <GlassFilter />
      <button
        onClick={() => setBig(!big)}
        aria-pressed={big}
        className={`fixed right-3 top-3 z-50 rounded-full border px-3 py-1.5 text-sm font-semibold backdrop-blur-md transition ${
          big ? 'border-teal-300/60 bg-teal-300 text-[#04211f]' : 'border-white/15 bg-black/40 text-white/80 hover:bg-white/10'
        }`}
      >
        Aa {big ? 'Обычный шрифт' : 'Крупный шрифт'}
      </button>

      <header className="relative mx-auto grid max-w-6xl items-center gap-2 px-4 pt-8 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pt-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1 text-xs font-medium text-teal-200">
            🛡 ИИ-щит от мошенников · Казахстан
          </div>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
            Saq<span className="text-teal-300">.</span>
          </h1>
          <p className="mt-3 font-display text-2xl font-medium leading-tight text-white/90 sm:text-4xl">
            Проверь, прежде чем перевести.
          </p>
          <p className="mt-4 max-w-xl text-base text-white/60 sm:text-lg">
            Банки ловят перевод. Saq ловит момент, когда вас ещё уговаривают: покажет приёмы манипуляции, скажет что делать — и
            натренирует распознавать обман заранее.
          </p>
          <p className="mt-2 text-sm text-white/40">«Сақ» по-казахски — бдительный.</p>
        </motion.div>
        <div className="pointer-events-none absolute -right-20 top-0 h-[300px] w-[300px] opacity-70 md:relative md:right-auto md:h-[440px] md:w-auto md:opacity-100">
          <Suspense fallback={null}>
            <Orb risk={tab === 'check' ? risk : null} />
          </Suspense>
        </div>
      </header>

      <main className="relative z-10 mx-auto mt-8 max-w-4xl px-4 pb-16 sm:px-6 md:mt-0">
        <Glass className="mx-auto mb-6 flex w-full max-w-md gap-1 p-1.5">
          {(
            [
              ['check', '🔍 Проверка'],
              ['sim', '💉 Прививка'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`relative flex-1 rounded-[22px] px-4 py-3 font-semibold transition ${tab === id ? 'text-[#04211f]' : 'text-white/70 hover:text-white'}`}
            >
              {tab === id && (
                <motion.span layoutId="tab" className="absolute inset-0 rounded-[22px] bg-teal-300" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </Glass>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {tab === 'check' ? <Checker onRisk={setRisk} /> : <Sim />}
          </motion.div>
        </AnimatePresence>

        <section className="mt-16">
          <h2 className="mb-5 text-center font-display text-2xl font-semibold sm:text-3xl">Как это работает</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['1', 'Покажите', 'Вставьте сообщение, загрузите скриншот или расскажите про звонок голосом.'],
              ['2', 'Saq объясняет', 'ИИ находит приёмы давления — срочность, «код из СМС», секретность — и подсвечивает их прямо в тексте.'],
              ['3', 'Вы защищены', 'Три понятных шага, озвучка для пожилых и кнопка «Отправить внуку». А «Прививка» тренирует заранее.'],
            ].map(([n, t, d], i) => (
              <motion.div key={n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Glass className="h-full p-5">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-teal-300 font-display font-bold text-[#04211f]">{n}</div>
                  <div className="mt-3 font-display text-lg font-semibold">{t}</div>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">{d}</p>
                </Glass>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Glass className="p-5">
              <div className="font-semibold text-teal-200">Для людей — бесплатно</div>
              <p className="mt-1 text-sm text-white/60">Пожилые, подростки, продавцы на маркетплейсах — все, кому звонят «из банка».</p>
            </Glass>
            <Glass className="p-5">
              <div className="font-semibold text-teal-200">Для банков и операторов</div>
              <p className="mt-1 text-sm text-white/60">White-label и API: предотвратить обман дешевле, чем разбирать последствия.</p>
            </Glass>
          </div>
        </section>

        <footer className="mt-14 grid gap-2 text-center text-xs leading-relaxed text-white/40">
          <p>
            В 2025 году в РК зарегистрировано 28 851 случай интернет-мошенничества, ущерб — 12,2 млрд ₸ (данные Генпрокуратуры РК и СМИ).
          </p>
          <p>
            Saq не хранит ваши сообщения: текст и скриншот отправляются на анализ и сразу забываются. Примеры в приложении — учебные.
            Saq помогает распознать обман, но не заменяет банк и полицию: при сомнениях звоните по номеру на обороте карты или 102.
          </p>
          <p>
            <a className="underline hover:text-white/70" href="https://github.com/ALBURYk/saq" target="_blank" rel="noreferrer">
              Открытый код
            </a>{' '}
            · Anthropic Claude · Vercel · three.js
          </p>
        </footer>
      </main>
    </div>
  )
}
