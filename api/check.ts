// Vercel function: анализ сообщения на мошенничество через Google Gemini (текст + vision), запасной — Anthropic.
// Ключи только в env. Ничего не храним. При ошибке — фолбэк по правилам.
type VercelRequest = { method?: string; body?: any }
type VercelResponse = { status: (c: number) => { json: (b: unknown) => void } }

const MODEL = 'claude-haiku-5-5'
const MAX_TEXT = 4000
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MIMES = ['image/jpeg', 'image/png', 'image/webp']
const KINDS = ['code', 'money', 'urgency', 'authority', 'secrecy', 'link', 'emotion', 'bait']

type Flag = { quote: string; why: string; kind?: string }
type Result = {
  risk: number
  verdict: 'опасно' | 'подозрительно' | 'похоже безопасно'
  scheme: string
  flags: Flag[]
  actions: string[]
  simple: string
  fallback?: boolean
}

const SYSTEM = `Ты — Saq, ИИ-эксперт по защите от мошенников в Казахстане. Анализируешь сообщение, скриншот переписки или описание звонка.
Известные схемы РК: ложный звонок «службы безопасности банка» / «Нацбанка» / «полиции», фейк-магазин и фейк-доставка (OLX, объявления), лжеинвестиции, «мама, я в беде», взлом WhatsApp / просьба переслать код, фейковые госвыплаты и eGov, оформление кредита «на тебя», фейковые розыгрыши.
Ответь СТРОГО одним JSON-объектом без пояснений и без markdown:
{"risk": число 0-100,
 "verdict": "опасно" | "подозрительно" | "похоже безопасно",
 "scheme": "название схемы по-русски (или «Обычное сообщение»)",
 "flags": [{"quote": "ТОЧНАЯ фраза из сообщения, дословно", "why": "почему это манипуляция, 1 предложение", "kind": "code | money | urgency | authority | secrecy | link | emotion | bait"}],
 "actions": ["3 коротких шага, что делать прямо сейчас"],
 "simple": "одно предложение простыми словами для пожилого человека"}
kind: code — просят код из СМС, PIN, CVV, данные карты или документов; money — просят перевести или вложить деньги; urgency — давление временем; authority — представляются банком, полицией, госорганом, родственником; secrecy — просят никому не говорить; link — ссылка или приложение; emotion — страх, жалость, вина; bait — выигрыш, выплата, высокий доход.
Правила: risk ≥70 → "опасно", 35–69 → "подозрительно", <35 → "похоже безопасно". quote копируй из текста дословно и коротко (2–8 слов; для скриншота — из распознанного текста). Не выдумывай флаги в безопасном сообщении. Пиши по-русски.`

const RULES: { re: RegExp; why: string; w: number; k: string; s?: string }[] = [
  { re: /код[а-я]*\s*(из|в)?\s*(смс|sms)|смс[- ]?код|продиктуйте код|назовите код|перешли[а-я]* код/i, why: 'Код из СМС не просит ни один банк или госорган — это ключ к вашему счёту или аккаунту.', w: 40, k: 'code' },
  { re: /служб[а-я]* безопасности|нацбанк|национальн[а-я]* банк/i, why: 'Мошенники часто представляются службой безопасности или Нацбанком.', w: 30, k: 'authority', s: 'bank' },
  { re: /переведи|переведите|перевод[а-я]* на|безопасный сч[её]т|вложи/i, why: 'Просьба перевести деньги — главная цель мошенника.', w: 25, k: 'money' },
  { re: /срочно|немедленно|в течение \d+ минут|действует \d+ минут|осталось \d+ мест|до конца дня/i, why: 'Давление временем мешает подумать и посоветоваться.', w: 15, k: 'urgency' },
  { re: /инвестиц|пассивн[а-я]* доход|\d+\s*% в месяц|гарантированн[а-я]* доход/i, why: 'Гарантированный высокий доход — признак финансовой пирамиды.', w: 30, k: 'bait', s: 'invest' },
  { re: /выплат[а-я]*|вы выиграли|розыгрыш|ваш приз|получите приз/i, why: 'Неожиданная выплата или выигрыш — приманка, чтобы выманить данные.', w: 20, k: 'bait', s: 'egov' },
  { re: /egov|е-?гов|портал[а-я]* госуслуг|подтвердите личность/i, why: 'Госорганы не просят подтверждать личность по ссылке из сообщения.', w: 20, k: 'authority', s: 'egov' },
  { re: /ссылк|https?:\/\/|\[\.\]|\.top\b|\.click\b/i, why: 'Ссылка может вести на поддельный сайт, который крадёт данные карты.', w: 20, k: 'link', s: 'shop' },
  { re: /оплатил[а-я]* через|получить деньги|olx доставк|доставк[а-я]* оплачен/i, why: '«Я уже оплатил, получите деньги по ссылке» — схема фейкового покупателя.', w: 25, k: 'bait', s: 'shop' },
  { re: /данные карты|cvv|cvc|номер карты/i, why: 'Данные карты нельзя вводить по ссылке из переписки.', w: 30, k: 'code', s: 'shop' },
  { re: /никому не говори|папе не говори|маме не говори|не сообщайте|не говорите/i, why: 'Просьба держать в секрете — чтобы вас некому было остановить.', w: 20, k: 'secrecy' },
  { re: /с чужого номера|телефон разбился|я в беде|попала? в неприятност/i, why: 'Классика «мама, я в беде»: перезвоните родному на его старый номер.', w: 30, k: 'emotion', s: 'mom' },
  { re: /по ошибке|случайно (отправил|указал)/i, why: '«Код пришёл по ошибке, перешли» — так угоняют WhatsApp и другие аккаунты.', w: 25, k: 'code', s: 'whatsapp' },
  { re: /кредит/i, why: 'Тема «на вас оформляют кредит» — частый повод для паники.', w: 15, k: 'emotion', s: 'bank' },
]

const SCHEME_NAMES: Record<string, string> = {
  bank: 'Ложный звонок «службы безопасности банка»',
  shop: 'Фейк-покупатель / поддельная ссылка на оплату',
  invest: 'Лжеинвестиции (финансовая пирамида)',
  mom: '«Мама, я в беде» — выманивание денег у родных',
  egov: 'Фейковая госвыплата / поддельный eGov',
  whatsapp: 'Угон аккаунта через код из СМС',
}

export function fallbackCheck(text: string): Result {
  const flags: Flag[] = []
  const by: Record<string, number> = {}
  let score = 0
  for (const r of RULES) {
    const m = text.match(r.re)
    if (m) {
      score += r.w
      if (r.s) by[r.s] = (by[r.s] ?? 0) + r.w
      if (!flags.some((f) => f.quote.toLowerCase() === m[0].toLowerCase())) flags.push({ quote: m[0], why: r.why, kind: r.k })
    }
  }
  const risk = Math.min(98, score)
  const verdict = risk >= 70 ? 'опасно' : risk >= 35 ? 'подозрительно' : 'похоже безопасно'
  const danger = risk >= 35
  return {
    risk,
    verdict,
    scheme: danger ? SCHEME_NAMES[Object.entries(by).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''] ?? 'Возможное мошенничество' : 'Обычное сообщение',
    flags,
    actions: danger
      ? ['Ничего не переводите и не называйте коды', 'Прервите разговор и перезвоните в банк по номеру на обороте карты', 'Покажите сообщение близким']
      : ['Признаков обмана не найдено', 'Всё равно не сообщайте коды из СМС', 'Сомневаетесь — спросите близких'],
    simple: danger ? 'Похоже на обман: ничего не переводите и посоветуйтесь с близкими.' : 'Похоже на обычное сообщение, но коды из СМС никому не говорите.',
    fallback: true,
  }
}

function validate(x: unknown): Result | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const risk = Math.max(0, Math.min(100, Math.round(Number(o.risk))))
  if (!Number.isFinite(risk)) return null
  const verdicts = ['опасно', 'подозрительно', 'похоже безопасно'] as const
  const verdict = verdicts.includes(o.verdict as never)
    ? (o.verdict as Result['verdict'])
    : risk >= 70 ? 'опасно' : risk >= 35 ? 'подозрительно' : 'похоже безопасно'
  const flags = Array.isArray(o.flags)
    ? o.flags
        .filter((f): f is Flag => !!f && typeof f.quote === 'string' && typeof f.why === 'string')
        .slice(0, 8)
        .map((f) => ({ quote: f.quote.slice(0, 300), why: f.why.slice(0, 300), kind: KINDS.includes(String(f.kind)) ? f.kind : undefined }))
    : []
  const actions = Array.isArray(o.actions) ? o.actions.filter((a) => typeof a === 'string').slice(0, 3) : []
  if (typeof o.scheme !== 'string' || typeof o.simple !== 'string' || actions.length === 0) return null
  return { risk, verdict, scheme: o.scheme.slice(0, 120), flags, actions, simple: o.simple.slice(0, 400) }
}

// Google Gemini (generateContent). Модель из env GEMINI_MODEL, иначе пробуем по списку (404 → следующая).
async function gemini(key: string, system: string, contents: unknown[], temperature: number): Promise<string> {
  const models = [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'].filter(Boolean) as string[]
  let last = 'no model'
  for (const m of models) {
    let r: Response
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      signal: AbortSignal.timeout(12000),
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', temperature, maxOutputTokens: 4096, ...(m.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
      }),
    })
    } catch {
      last += ` | ${m} timeout`
      continue
    }
    if (r.status === 404 || r.status === 429 || r.status >= 500) {
      last += ` | ${m} ${r.status}`
      continue
    }
    if (!r.ok) throw new Error(`gemini ${m} ${r.status}`)
    const d = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    return d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  }
  throw new Error(last)
}

function extractJson(s: string): unknown {
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a < 0 || b < a) return null
  try {
    return JSON.parse(s.slice(a, b + 1))
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {}
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : ''
  const mime = typeof body.mime === 'string' ? body.mime : 'image/jpeg'

  if (!text && !imageBase64) return res.status(400).json({ error: 'Нужен текст или скриншот' })
  if (text.length > MAX_TEXT) return res.status(400).json({ error: `Текст длиннее ${MAX_TEXT} символов` })
  if (imageBase64) {
    if (!MIMES.includes(mime)) return res.status(400).json({ error: 'Формат картинки: jpeg, png или webp' })
    if (Math.floor((imageBase64.length * 3) / 4) > MAX_IMAGE_BYTES) return res.status(400).json({ error: 'Картинка больше 4 МБ' })
  }

  const gKey = process.env.GEMINI_API_KEY
  const aKey = process.env.ANTHROPIC_API_KEY
  if (!gKey && !aKey) return res.status(200).json(fallbackCheck(text))
  const prompt = text ? `Сообщение для проверки:\n"""${text}"""` : 'Проверь переписку на скриншоте.'

  try {
    let out = ''
    if (gKey) {
      const parts: unknown[] = []
      if (imageBase64) parts.push({ inlineData: { mimeType: mime, data: imageBase64 } })
      parts.push({ text: prompt })
      out = await gemini(gKey, SYSTEM, [{ role: 'user', parts }], 0.2)
    } else {
      const content: unknown[] = []
      if (imageBase64) content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: imageBase64 } })
      content.push({ type: 'text', text: prompt })
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': aKey!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: SYSTEM, messages: [{ role: 'user', content }] }),
      })
      if (!r.ok) throw new Error(`anthropic ${r.status}`)
      const data = (await r.json()) as { content?: { type: string; text?: string }[] }
      out = data.content?.find((c) => c.type === 'text')?.text ?? ''
    }
    const parsed = validate(extractJson(out))
    if (!parsed) throw new Error('bad json')
    return res.status(200).json(parsed)
  } catch (e) {
    console.warn('check fallback:', (e as Error).message)
    return res.status(200).json(fallbackCheck(text))
  }
}
