// Vercel function: «Прививка» — ИИ безопасно играет мошенника в учебном чате.
// Никаких реальных номеров/ссылок/реквизитов. Максимум 6 реплик, затем разбор.
type VercelRequest = { method?: string; body?: any }
type VercelResponse = { status: (c: number) => { json: (b: unknown) => void } }

const MODEL = 'claude-haiku-5-5'
const MAX_TURNS = 6

const SCHEMES: Record<string, string> = {
  bank: 'ложный звонок «службы безопасности банка»: «на вас оформляют кредит / подозрительная операция», просьба назвать код из СМС или перевести деньги на «безопасный счёт»',
  olx: 'фейковый покупатель на OLX: «я уже оплатил через доставку», ссылка на поддельную страницу получения денег, просьба ввести данные карты',
  mom: '«мама, я в беде»: пишет «сын/дочь» с чужого номера, телефон разбился, срочно нужны деньги, просит никому не говорить',
}

type Msg = { role: 'assistant' | 'user'; content: string }

function extractJson(s: string): any {
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
  const scheme = typeof body.scheme === 'string' && SCHEMES[body.scheme] ? body.scheme : null
  if (!scheme) return res.status(400).json({ error: 'Неизвестная схема' })
  const messages: Msg[] = Array.isArray(body.messages)
    ? body.messages
        .filter((m: Msg) => m && (m.role === 'assistant' || m.role === 'user') && typeof m.content === 'string')
        .slice(-20)
        .map((m: Msg) => ({ role: m.role, content: m.content.slice(0, 1000) }))
    : []
  const finish = body.finish === true
  const turns = messages.filter((m) => m.role === 'assistant').length

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(503).json({ error: 'no key', fallback: true })

  const mustFinish = finish || turns >= MAX_TURNS
  const system = `Ты — учебный тренажёр Saq «Прививка». Ты играешь мошенника по схеме: ${SCHEMES[scheme]}.
Цель — научить человека распознавать обман. Играй реалистично, по-русски, коротко (1–3 предложения), используй типичные приёмы: давление временем, авторитет, страх, секретность, жалость.
ЗАПРЕЩЕНО: реальные номера телефонов, реальные ссылки и домены, реальные реквизиты и номера карт, реальные названия банков — используй обезличенное («ваш банк», «ссылка [учебная]», «карта ****»).
Если пользователь распознал обман (назвал мошенником, отказался и собирается перезвонить в банк/родным) или ход ${MAX_TURNS} уже прошёл — заверши.
Отвечай СТРОГО одним JSON без markdown:
- продолжение: {"done": false, "reply": "твоя реплика мошенника"}
- завершение: {"done": true, "score": 0-100, "caught": ["красные флаги, которые человек заметил"], "missed": ["красные флаги, которые человек пропустил или на которые повёлся"], "tip": "один совет на будущее"}
Балл: высокий, если человек рано распознал обман и ничего не сообщил; низкий, если назвал код/данные/согласился перевести.`

  const apiMessages = [
    { role: 'user', content: '[Начни учебный диалог первой репликой мошенника.]' },
    ...messages,
  ]
  if (mustFinish) {
    apiMessages.push({
      role: 'user',
      content: (messages.at(-1)?.role === 'user' ? '' : '') + '[Тренировка окончена. Верни только JSON-разбор с done:true.]',
    })
  }
  // Anthropic требует чередование ролей — склеиваем подряд идущие user-сообщения.
  const merged: { role: string; content: string }[] = []
  for (const m of apiMessages) {
    const last = merged.at(-1)
    if (last && last.role === m.role) last.content += '\n' + m.content
    else merged.push({ ...m })
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages: merged }),
    })
    if (!r.ok) throw new Error(`anthropic ${r.status}`)
    const data = (await r.json()) as { content?: { type: string; text?: string }[] }
    const out = data.content?.find((c) => c.type === 'text')?.text ?? ''
    const j = extractJson(out)
    if (j && j.done === true) {
      const list = (x: unknown) => (Array.isArray(x) ? x.filter((s) => typeof s === 'string').slice(0, 6) : [])
      return res.status(200).json({
        done: true,
        score: Math.max(0, Math.min(100, Math.round(Number(j.score) || 0))),
        caught: list(j.caught),
        missed: list(j.missed),
        tip: typeof j.tip === 'string' ? j.tip.slice(0, 300) : '',
      })
    }
    if (j && typeof j.reply === 'string' && !mustFinish) return res.status(200).json({ done: false, reply: j.reply.slice(0, 600) })
    if (!j && out && !mustFinish) return res.status(200).json({ done: false, reply: out.slice(0, 600) })
    throw new Error('bad json')
  } catch (e) {
    console.warn('sim error:', (e as Error).message)
    return res.status(502).json({ error: 'ai unavailable', fallback: true })
  }
}
