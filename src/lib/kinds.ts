import type { IconName } from '../components/Icon'

// Типы приёмов манипуляции — по ним группируются красные флаги в вердикте.
export const KINDS: Record<string, { label: string; icon: IconName }> = {
  code: { label: 'Коды и данные карты', icon: 'key' },
  money: { label: 'Перевод денег', icon: 'wallet' },
  urgency: { label: 'Срочность', icon: 'clock' },
  authority: { label: 'Чужой авторитет', icon: 'landmark' },
  secrecy: { label: 'Секретность', icon: 'lock' },
  link: { label: 'Ссылка', icon: 'link' },
  emotion: { label: 'Давление на чувства', icon: 'heart' },
  bait: { label: 'Приманка', icon: 'gift' },
  other: { label: 'Другой приём', icon: 'alertTriangle' },
}

export const kindOf = (k?: string) => KINDS[k && KINDS[k] ? k : 'other']
