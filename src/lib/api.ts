import { fallbackCheck, type CheckResult } from './rules'
export type { CheckResult }

export async function checkMessage(input: { text?: string; imageBase64?: string; mime?: string }): Promise<CheckResult> {
  try {
    const r = await fetch('/api/check', {
      signal: AbortSignal.timeout(40000),
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (r.status === 400) {
      const e = await r.json().catch(() => ({}))
      throw Object.assign(new Error(e.error || 'Ошибка запроса'), { user: true })
    }
    if (!r.ok) throw new Error(`http ${r.status}`)
    return (await r.json()) as CheckResult
  } catch (e) {
    if ((e as { user?: boolean }).user) throw e
    console.warn('api/check unavailable, local fallback')
    return fallbackCheck(input.text ?? '')
  }
}

export type SimMsg = { role: 'assistant' | 'user'; content: string }
export type SimEnd = { done: true; score: number; caught: string[]; missed: string[]; tip: string }
export type SimReply = { done: false; reply: string } | SimEnd

export async function simStep(scheme: string, messages: SimMsg[], finish = false): Promise<SimReply | null> {
  try {
    const r = await fetch('/api/sim', {
      signal: AbortSignal.timeout(25000),
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scheme, messages, finish }),
    })
    if (!r.ok) return null
    return (await r.json()) as SimReply
  } catch {
    return null
  }
}

// Сжатие скрина: canvas до 1280px, JPEG — заодно удаляет EXIF/метаданные.
export function compressImage(file: File): Promise<{ base64: string; mime: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      const dataUrl = c.toDataURL('image/jpeg', 0.85)
      resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg', preview: dataUrl })
    }
    img.onerror = () => reject(new Error('Не удалось прочитать картинку'))
    img.src = url
  })
}
