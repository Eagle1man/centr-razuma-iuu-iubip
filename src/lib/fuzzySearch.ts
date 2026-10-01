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

/* --- Корректор опечаток -------------------------------------------------
   Fuse.js опечатки терпит, но векторный поиск на бэкенде — нет: «медецина»
   уходит в эмбеддинги как есть и находит не то. Поэтому перед отправкой
   запроса чиним слова по словарю дисциплин: одно слово отличается на
   одну-две буквы — значит почти наверняка опечатка («медецина» →
   «медицина», «фармаколгя» → «фармакология»). */
const DOMAIN_WORDS = [
  'медицина', 'фармация', 'фармакология', 'фармакогнозия', 'рецептура',
  'терапия', 'хирургия', 'анатомия', 'физиология', 'микробиология',
  'иммунология', 'патология', 'педиатрия', 'кардиология', 'онкология',
  'стоматология', 'сестринское', 'психология', 'социология', 'философия',
  'экономика', 'менеджмент', 'маркетинг', 'логистика', 'финансы', 'бухгалтерия',
  'бухучёт', 'аудит', 'налоги', 'право', 'правоведение', 'юриспруденция',
  'государственное', 'муниципальное', 'гражданское', 'уголовное', 'административное',
  'семейное', 'трудовое', 'конституционное', 'уголовный', 'гражданский',
  'программирование', 'информатика', 'информационные', 'технологии', 'алгоритмы',
  'базы', 'данных', 'кибербезопасность', 'криптография', 'машинное', 'обучение',
  'туризм', 'гостеприимство', 'реклама', 'дизайн', 'литература', 'языки',
  'история', 'география', 'биология', 'химия', 'физика', 'математика',
  'статистика', 'логика', 'философская', 'культурология', 'лингвистика',
  'педагогика', 'педагогический', 'методика', 'преподавание', 'социология труда',
]

/** Расстояние Левенштейна с ранним выходом: бывает на каждом слове запроса. */
function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev = new Array<number>(b.length + 1)
  const cur = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j += 1) prev[j] = j
  for (let i = 1; i <= a.length; i += 1) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > max) return max + 1
    for (let j = 0; j <= b.length; j += 1) prev[j] = cur[j]
  }
  return prev[b.length]
}

/**
 * Чинит очевидные опечатки в запросе по словарю дисциплин.
 * Слова короче 5 букв не трогаем: «право»/«права» отличаются на одну букву,
 * и «исправление» там скорее навредит. Возвращает исходную строку, если
 * менять нечего, — чтобы вызывающий мог сравнить и решить.
 */
export function fixTypos(query: string, extraWords: string[] = []): string {
  const words = query.split(/\s+/)
  let changed = false
  const fixed = words.map((word) => {
    const w = normalize(word)
    if (w.length < 5 || DOMAIN_WORDS.includes(w) || extraWords.includes(w)) return word
    // Допускаем 1 замену для 5-8 букв и 2 — для более длинных слов.
    const max = w.length >= 9 ? 2 : 1
    let best = ''
    let bestDist = max + 1
    for (const candidate of [...DOMAIN_WORDS, ...extraWords]) {
      const c = normalize(candidate)
      if (!c || c.length < 5) continue
      const d = levenshtein(w, c, max)
      if (d < bestDist) {
        bestDist = d
        best = c
      }
    }
    if (best && bestDist <= max) {
      changed = true
      return best
    }
    return word
  })
  return changed ? fixed.join(' ') : query
}

/** Мгновенный поиск по карточкам направлений: MiniSearch (префикс) + Fuse.js (опечатки). */
export function searchDirections(directions: Direction[], query: string, limit = 12): Direction[] {
  const q = normalize(fixTypos(query, directions.flatMap((d) => d.tags).flatMap((t) => t.split(' '))))
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
