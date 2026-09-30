/* Нечёткий клиентский поиск по каталогу направлений и по результатам ЭБС.
   - MiniSearch: мгновенный поиск «на лету» по мере ввода (префиксы + нечёткость).
   - Fuse.js: опечатки и неполные фразы, без внешних зависимостей.
   Приём: нормализация (ё→е, регистр, пунктуация) + короткий запрос (<2 символов)
   не ищет, а показывает все карточки; ранжирование двумя движками, дедуп по id. */

import Fuse from 'fuse.js'
import MiniSearch from 'minisearch'

export interface Direction {
  id: string
  academy: string
  title: string
  text: string
  tags: string[]
  query: string
  icon: string
}

export interface FuzzyHit<T> {
  item: T
  score: number
}

/** Нормализация: регистр, ё→е, пунктуация, лишние пробелы. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Огрубление окончаний: достаточно для склейки «право» → «правоведение». */
export function stem(word: string): string {
  const w = normalize(word)
  if (w.length < 5) return w
  return w.replace(/(ами|ями|ого|его|ому|ему|ыми|ими|ая|яя|ое|ее|ые|ие|ов|ев|ей|ой|ый|ая|ую|ью|ия|ие|а)$/u, '')
}

function searchable(d: Direction): string {
  return `${d.title} ${d.text} ${d.tags.join(' ')} ${d.query}`
}

const MIN_LEN = 2

/** Мгновенный поиск по карточкам направлений: MiniSearch (префикс) + Fuse.js (опечатки). */
export function searchDirections(directions: Direction[], query: string, limit = 12): Direction[] {
  const q = normalize(query)
  if (q.length < MIN_LEN) return directions.slice(0, limit)

  interface Doc extends Omit<Direction, 'tags'> {
    tags: string
  }
  const mini = new MiniSearch<Doc>({
    fields: ['title', 'text', 'tags', 'query'],
    storeFields: ['id'],
    searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.2 },
  })
  mini.addAll(
    directions.map((d) => ({
      id: d.id,
      title: d.title,
      text: d.text,
      tags: d.tags.join(' '),
      query: d.query,
      academy: d.academy,
      icon: d.icon,
    })),
  )

  const seen = new Set<string>()
  const out: Direction[] = []

  for (const r of mini.search(stem(q))) {
    const item = directions.find((d) => d.id === String(r.id))
    if (item && !seen.has(item.id)) {
      seen.add(item.id)
      out.push(item)
    }
  }

  const fuse = new Fuse(directions, {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'tags', weight: 2 },
      { name: 'text', weight: 1 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
    includeScore: true,
  })
  for (const hit of fuse.search(q).slice(0, limit)) {
    if (!seen.has(hit.item.id)) {
      seen.add(hit.item.id)
      out.push(hit.item)
    }
    if (out.length >= limit) break
  }

  return out.slice(0, limit)
}

/** Переранжирование результатов ЭБС: опечатки в запросе не теряют выдачу. */
export function rankSources<T extends { title?: string; authors?: string; annotation?: string; gost?: string; url?: string }>(
  query: string,
  sources: T[],
): T[] {
  const q = normalize(query)
  if (sources.length <= 1 || q.length < MIN_LEN) return sources
  const fuse = new Fuse(sources, {
    keys: [
      { name: 'title', weight: 4 },
      { name: 'authors', weight: 2 },
      { name: 'annotation', weight: 1 },
      { name: 'gost', weight: 1 },
    ],
    threshold: 0.45,
    ignoreLocation: true,
    includeScore: true,
  })
  const ranked = fuse.search(q)
  if (ranked.length === 0) return sources
  const order = new Map(ranked.map((r, i) => [r.item, i]))
  return [...sources].sort((a, b) => (order.get(a) ?? 10_000) - (order.get(b) ?? 10_000))
}

/** Подсказки «возможно, ищете» из корпуса направлений. */
export function suggestDirections(directions: Direction[], query: string, limit = 3): string[] {
  return searchDirections(directions, query, limit).map((d) => d.title)
}
