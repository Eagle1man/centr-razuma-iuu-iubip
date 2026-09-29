import { useEffect, useState } from 'react'
import type { Book } from '@/lib/libraryData'
import { CATALOG_BOOKS } from '@/lib/catalog'
import { getBooks } from '@/lib/api'

export interface UseCatalogResult {
  books: Book[]
  loading: boolean
  error: Error | null
}

/* Каталог через API с тихим fallback: начальное состояние — статический
   каталог, поэтому без бэкенда поведение страниц не меняется. */
export function useCatalog(): UseCatalogResult {
  const [books, setBooks] = useState<Book[]>(() => [...CATALOG_BOOKS])
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
