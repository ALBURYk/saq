import { motion } from 'motion/react'
import Glass from './Glass'
import Icon, { type IconName } from './Icon'
import ShareButton from './Share'
import { EMERGENCY } from './Verdict'

const RULES: { icon: IconName; t: string; d: string }[] = [
  { icon: 'key', t: 'Коды никому не называйте', d: 'Код из СМС, PIN и три цифры на обороте карты не спрашивает ни банк, ни полиция, ни eGov.' },
  { icon: 'phone', t: 'Звонят «из банка» — кладите трубку', d: 'Перезвоните сами по номеру на обороте карты или в приложении банка.' },
  { icon: 'wallet', t: '«Безопасного счёта» не существует', d: 'Любая просьба перевести деньги «для защиты» — это обман.' },
  { icon: 'clock', t: 'Торопят — значит, обманывают', d: '«Срочно», «осталось 10 минут», «никому не говорите» — повод остановиться и посоветоваться.' },
  { icon: 'messageAlert', t: 'Родные просят деньги с чужого номера', d: 'Позвоните им на старый номер или задайте вопрос, ответ на который знаете только вы.' },
  { icon: 'link', t: 'Не открывайте ссылки «получить оплату»', d: 'Покупателю не нужны данные вашей карты, чтобы заплатить. Встречайтесь лично или пользуйтесь официальным приложением.' },
  { icon: 'trendingUp', t: 'Гарантированный доход — это пирамида', d: '30% в месяц не бывает. Проверяйте лицензию компании на сайте регулятора.' },
]

const SHARE_TEXT = `7 правил, как не попасться мошенникам:\n${RULES.map((r, i) => `${i + 1}. ${r.t}. ${r.d}`).join('\n')}\n\nЕсли уже перевели: сразу звоните в банк по номеру на карте и в полицию — 102.`

export default function Memo() {
  return (
    <div id="memo" className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Glass refract className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="font-display text-xl font-semibold sm:text-2xl">Памятка: 7 правил</h2>
            <p className="mt-2 text-white/65">
              Распечатайте и повесьте у телефона или отправьте родителям. Этих правил достаточно, чтобы не попасться на большинство схем.
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-semibold transition hover:bg-white/18"
            >
              <Icon name="printer" className="h-5 w-5" /> Распечатать
            </button>
            <ShareButton title="Saq — памятка" text={SHARE_TEXT} className="bg-teal-300 text-[#04211f] hover:brightness-110" />
          </div>
        </div>
      </Glass>

      <ol className="grid gap-3 sm:grid-cols-2">
        {RULES.map((r, i) => (
          <motion.li
            key={r.t}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={i === RULES.length - 1 ? 'sm:col-span-2' : ''}
          >
            <Glass className="memo-card flex h-full gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-300/12 text-teal-200">
                <Icon name={r.icon} className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-base font-semibold leading-snug">
                  <span className="text-teal-300">{i + 1}.</span> {r.t}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{r.d}</p>
              </div>
            </Glass>
          </motion.li>
        ))}
      </ol>

      <Glass className="memo-card border-red-400/25 p-5 sm:p-6">
        <div className="flex items-center gap-2 font-display text-lg font-semibold text-red-200">
          <Icon name="siren" className="h-5 w-5" /> Если уже перевели деньги или назвали код
        </div>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {EMERGENCY.map((s, i) => (
            <li key={s.t} className="flex gap-3 rounded-xl bg-black/20 p-3">
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
        <p className="mt-3 text-xs text-white/40">Номер банка берите только с карты или из официального приложения — не из сообщения и не со слов звонящего.</p>
      </Glass>
    </div>
  )
}
