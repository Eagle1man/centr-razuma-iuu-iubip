/* Короткий живой ответ героя для озвучки (T-1045).
 *
 * Зачем: модель отдаёт простыни на 1000+ символов, и голос читал их подряд —
 * получалось «как робот» и «читает всё подряд». Здесь ответ сжимается до
 * короткой устной реплики (2-4 предложения), а полный текст остаётся в
 * карточке на экране. Плюс убираем служебные обороты («Источники: [1]»,
 * «Вот ответ:», «- »), которые вслух звучат как шум.
 */

const SENTENCE_SPLIT = /(?<=[.!?…])\s+/

/** Обороты, которые не нужно произносить вслух. */
const SPOKEN_NOISE = [
  /^вот (мой )?ответ[:.]?\s*/i,
  /^вот (краткий )?ответ[:.]?\s*/i,
  /^ответ[:.]?\s*/i,
  /^источники[:.]?\s*/i,
  /^список источников[:.]?\s*/i,
  /^книги[:.]?\s*/i,
  /^вот (краткий )?перечень[:.]?\s*/i,
  /^-\s*/gm,
  /^\s*[•*]\s*/gm,
  /\[\d+\]/g,               // ссылки на источники вида [1], [2, 3]
  /\bИсточники:\s*$/i,
]

/** Убирает служебный шум и приводит текст к устной речи. */
export function toSpoken(text: string): string {
  let out = (text || '').trim()
  for (const rule of SPOKEN_NOISE) {
    out = out.replace(rule, ' ')
  }
  // Двойные пробелы и пробел перед знаком препинания
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1')
  // Списки-нумеровки вида «1. Название» — в устной речи они лишние
  out = out.replace(/^\s*\d+[.)]\s*/gm, '')
  return out.replace(/\s{2,}/g, ' ').trim()
}

/**
 * Короткая устная версия: первые 2-4 предложения, до ~320 символов и
 * заканчивается целой мыслью (не режет предложение посередине).
 */
export function shortSpoken(text: string, maxChars = 320, maxSentences = 4): string {
  const clean = toSpoken(text)
  if (!clean) return ''
  if (clean.length <= maxChars) return clean

  const sentences = clean.split(SENTENCE_SPLIT).filter(Boolean)
  const picked: string[] = []
  let length = 0
  for (const sentence of sentences) {
    if (picked.length >= maxSentences) break
    if (length + sentence.length > maxChars && picked.length > 0) break
    picked.push(sentence)
    length += sentence.length + 1
    // Две-три короткие фразы — достаточно: герой не должен тараторить
    if (picked.length >= 2 && length >= 120) break
  }
  const result = picked.join(' ').trim()
  return result || clean.slice(0, maxChars).trim() + '…'
}

/**
 * Промпт-подсказка для модели: отвечать коротко и по-человечески, без
 * служебных оборотов. Подставляется в запрос к /ask-books.
 */
export const SPOKEN_STYLE_HINT =
  'Отвечай КОРОТКО: 2-4 предложения, живым человеческим языком, как студенту-ассистент. ' +
  'Без вступлений вроде «Вот ответ», без списков и заголовков, без ссылок вида [1]. ' +
  'Называй 2-3 конкретные книги, которые нашёл в каталоге, и на что в них смотреть.'
