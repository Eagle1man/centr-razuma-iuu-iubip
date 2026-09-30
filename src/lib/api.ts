/* API-клиент библиотеки: GET /api/books, GET /api/books/{id}.
   Base URL — window.__APP_CONFIG__.libraryApi, default '/api'.
   T-1039: тихий fallback на статический демо-каталог УДАЛЁН — при
   недоступности бэкенда возвращаем пустой список, а не выдуманные книги. */

export interface Book {
  id: string
  title: string
  author: string
  year: number
  categoryId: string
  /** Краткая аннотация для карточки. */
  annotation: string
  /** Ключевые слова/дисциплины для поиска. */
  tags: string[]
  /** Объём в страницах. */
  pages: number
  /** Подпись времени чтения, например «6 ч чтения». */
  readTime?: string
  /** Показывать в избранном. */
  featured?: boolean
  /** Обложка. */
  cover: string
  /** Текст книги в markdown. */
  content: string
}

/** Сырая книга от бэкенда /api (поля — надмножество Book, лишнее отбрасываем в fromApiBook). */
export interface ApiBook {
  id: string
  title: string
  author: string
  year: number
  categoryId: string
  annotation: string
  tags: string[]
  pages: number
  cover: string
  readTime?: string
  featured?: boolean
  content: string
  [key: string]: unknown
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const raw = (window.__APP_CONFIG__ as { libraryApi?: string } | undefined)?.libraryApi
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim().replace(/\/+$/, '')
    }
  }
  return '/api'
}

/** Привести сырую запись API к типу Book (категория — как есть, роуты фильтруют по строкам). */
export function fromApiBook(api: ApiBook): Book {
  return {
    id: api.id,
    title: api.title,
    author: api.author,
    year: api.year,
    categoryId: api.categoryId as Book['categoryId'],
    annotation: api.annotation,
    tags: Array.isArray(api.tags) ? (api.tags as string[]) : [],
    pages: api.pages,
    readTime: api.readTime,
    featured: api.featured,
    cover: api.cover,
    content: api.content,
  }
}

async function fetchJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    return (await res.json()) as unknown
  } catch {
    return null
  }
}

/** Список книг: бэкенд или пустой список. Демо-каталога больше нет. */
export async function getBooks(): Promise<Book[]> {
  const data = await fetchJson('/books')
  if (Array.isArray(data)) {
    try {
      return (data as ApiBook[]).map(fromApiBook)
    } catch {
      return []
    }
  }
  return []
}

/** Одна книга по id: бэкенд или undefined (выдумывать нечего). */
export async function getBookById(id: string): Promise<Book | undefined> {
  const data = await fetchJson(`/books/${encodeURIComponent(id)}`)
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    try {
      return fromApiBook(data as ApiBook)
    } catch {
      /* бэкенд ответил мусором — считаем, что книги нет */
    }
  }
  return undefined
}
