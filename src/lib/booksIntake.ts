/* Клиент окна приёма книг поверх роутера /api/books (см. backend/books_api.py).
   Только fetch; при недоступности бэкенда возвращаем null —
   страница показывает заглушку и обязана собираться для GitHub Pages. */

export interface ImportStatus {
  state: string
  imported: number
  total: number
  filename: string
  error: string
  faiss_reindexed: boolean
  detail: string
}

export interface AcceptedBook {
  id: number | string
  title: string
  author?: string
  year?: number | null
}

export interface ManualBookInput {
  title: string
  author: string
  year?: number | null
  isbn: string
  url: string
  ebbs: string
  annotation: string
}

function getLibraryBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const cfg = window.__APP_CONFIG__ as
      | { libraryApi?: string; searchApi?: string }
      | undefined
    const raw = cfg?.libraryApi ?? ''
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim().replace(/\/+$/, '')
    }
  }
  return ''
}

function getIngestToken(): string {
  if (typeof window !== 'undefined') {
    const cfg = window.__APP_CONFIG__ as { ingestToken?: string } | undefined
    const raw = cfg?.ingestToken
    if (typeof raw === 'string' && raw.length > 0) return raw
  }
  return ''
}

function ingestHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getIngestToken()
  if (token) return { 'X-Ingest-Token': token, ...extra }
  return extra
}

/** POST /api/books/import (multipart, поле file). 202 accepted + фоновая задача. */
export async function uploadImportFile(file: File): Promise<{ status: string; filename?: string } | null> {
  try {
    const form = new FormData()
    form.append('file', file, file.name)
    const res = await fetch(`${getLibraryBaseUrl()}/api/books/import`, {
      method: 'POST',
      headers: ingestHeaders(),
      body: form,
    })
    if (!res.ok) return null
    return (await res.json()) as { status: string; filename?: string }
  } catch {
    return null
  }
}

/** GET /api/books/import/status — агрегат бэкенда: state/imported/total/error/detail. */
export async function fetchImportStatus(): Promise<ImportStatus | null> {
  try {
    const res = await fetch(`${getLibraryBaseUrl()}/api/books/import/status`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    return (await res.json()) as ImportStatus
  } catch {
    return null
  }
}

/** GET /api/books/import/template — скачивание xlsx-шаблона. */
export async function downloadImportTemplate(): Promise<boolean> {
  try {
    const res = await fetch(`${getLibraryBaseUrl()}/api/books/import/template`)
    if (!res.ok) return false
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Shablon_katalog_EBS.xlsx'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 5000)
    return true
  } catch {
    return false
  }
}

/** POST /api/books — ручной ввод одной книги. */
export async function createBookManual(input: ManualBookInput): Promise<AcceptedBook | null> {
  try {
    const res = await fetch(`${getLibraryBaseUrl()}/api/books`, {
      method: 'POST',
      headers: ingestHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify({
        title: input.title,
        author: input.author,
        year: input.year ?? null,
        isbn: input.isbn,
        url: input.url,
        ebbs: input.ebbs,
        annotation: input.annotation,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const id = data['id']
    return {
      id: typeof id === 'number' || typeof id === 'string' ? id : Date.now(),
      title: typeof data['title'] === 'string' ? (data['title'] as string) : input.title,
      author: typeof data['author'] === 'string' ? (data['author'] as string) : input.author,
      year: typeof data['year'] === 'number' ? (data['year'] as number) : (input.year ?? null),
    }
  } catch {
    return null
  }
}

/** GET /api/books — таблица принятых (последние). */
export async function listAcceptedBooks(limit = 20): Promise<AcceptedBook[] | null> {
  try {
    const res = await fetch(`${getLibraryBaseUrl()}/api/books?limit=${limit}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<Record<string, unknown>>
    if (!Array.isArray(data)) return null
    return data.map((b, i) => ({
      id: typeof b['id'] === 'number' || typeof b['id'] === 'string' ? (b['id'] as number | string) : i,
      title: typeof b['title'] === 'string' ? (b['title'] as string) : 'Без названия',
      author: typeof b['author'] === 'string' ? (b['author'] as string) : '',
      year: typeof b['year'] === 'number' ? (b['year'] as number) : null,
    }))
  } catch {
    return null
  }
}
