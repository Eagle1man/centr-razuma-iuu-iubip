/* Говорящие аватары: вопрос -> ответ по РЕАЛЬНЫМ книгам фонда ЭБС.
   Контракт бэкенда (T-1035):
     POST {base}/ask-books {"question": "...", "topic": "право", "top_k": 4}
     -> 200 {"answer": "...", "sources": [{gost,title,authors,year,url,ebbs_label,annotation}],
             "found": N}
   Правило: если источников нет — герой честно говорит об этом и НЕ выдумывает
   книги. Ответ озвучивается голосом и показывается с библиографией по ГОСТ. */

import type { EbsSource } from './searchApi'
import { SPOKEN_STYLE_HINT } from './spokenStyle'

export interface HeroAnswer {
  /** Короткая устная реплика — её озвучивает герой. */
  answer: string
  /** Развёрнутый текст без библиографии; пусто, если ответ и так короткий. */
  answerFull: string
  sources: EbsSource[]
  found: number
}

/** Сколько символов ответа показывать в карточке до «читать полностью». */
const PREVIEW_LIMIT = 260

export function preview(text: string): string {
  const clean = (text || '').trim()
  if (clean.length <= PREVIEW_LIMIT) return clean
  return `${clean.slice(0, PREVIEW_LIMIT).trimEnd()}…`
}

/**
 * Спросить героя. topic — направление героя (например «право»): если по
 * самому вопросу в фонде ничего нет, поиск идёт по теме направления.
 * Возвращает null только при недоступном бэкенде.
 */
export async function askHero(
  question: string,
  topic?: string,
  timeoutMs = 180000,
  character?: string,
): Promise<HeroAnswer | null> {
  const q = question.trim()
  if (!q) return null
  const base = baseUrl()
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/ask-books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        question: q,
        topic: topic || undefined,
        top_k: 4,
        style: 'spoken',
        character: character || undefined,
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<{
      answer: string
      answer_full?: string
      sources: EbsSource[]
      found: number
    }>
    if (!data || typeof data.answer !== 'string') return null
    return {
      answer: data.answer,
      answerFull: typeof data.answer_full === 'string' ? data.answer_full : '',
      sources: Array.isArray(data.sources) ? (data.sources as EbsSource[]) : [],
      found: typeof data.found === 'number' ? data.found : (data.sources?.length ?? 0),
    }
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

function baseUrl(): string {
  if (typeof window !== 'undefined') {
    const cfg = window.__APP_CONFIG__ as
      | { searchApi?: string; libraryApi?: string }
      | undefined
    const raw = cfg?.searchApi ?? cfg?.libraryApi ?? ''
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim().replace(/\/+$/, '')
    }
  }
  return ''
}
