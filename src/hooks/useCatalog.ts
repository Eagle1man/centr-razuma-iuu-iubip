import { useEffect, useState } from 'react'
import { getBooks } from '@/lib/api'
import type { Book } from '@/lib/api'

export interface UseCatalogResult {
  books: Book[]
  loading: boolean
  error: Error | null
}

/* Каталог только из API: T-1039 убрал статический демо-каталог, поэтому
   стартовый список пуст, а при недоступности бэкенда остаётся пустым. */
export function useCatalog(): UseCatalogResult {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getBooks()
      .then((list) => {
        if (cancelled) return
        setBooks(list)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { books, loading, error }
}

export type { Book }
