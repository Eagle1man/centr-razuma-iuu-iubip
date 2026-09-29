/* API-клиент библиотеки: GET /api/books, GET /api/books/{id}.
   Base URL — window.__APP_CONFIG__.libraryApi, default '/api'.
   При недоступности бэкенда (или сборке для GitHub Pages) — ТИХИЙ
   fallback на статический каталог CATALOG_BOOKS, без проброса ошибок. */

import type { Book } from './libraryData'
import { CATALOG_BOOKS } from './catalog'

export type { Book }

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

/** Список книг: сначала бэкенд, при любой проблеме — тихий fallback на CATALOG_BOOKS. */
export async function getBooks(): Promise<Book[]> {
  const data = await fetchJson('/books')
  if (Array.isArray(data)) {
    try {
      return (data as ApiBook[]).map(fromApiBook)
    } catch {
      return [...CATALOG_BOOKS]
    }
  }
  return [...CATALOG_BOOKS]
}

/** Одна книга по id: сначала бэкенд, иначе — тихий fallback на CATALOG_BOOKS. */
export async function getBookById(id: string): Promise<Book | undefined> {
  const data = await fetchJson(`/books/${encodeURIComponent(id)}`)
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    try {
      return fromApiBook(data as ApiBook)
    } catch {
      /* ниже — fallback */
    }
  }
  return CATALOG_BOOKS.find((book) => book.id === id)
}
