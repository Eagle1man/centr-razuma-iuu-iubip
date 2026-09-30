/* Клиент поиска ЭБС: POST /search бэкенда lecture-ai (карточки + ГОСТ).
   Ответ бэкенда: { query, sources: [{title, authors, year, publisher,
   url, annotation, ebbs, ebbs_label, gost, ...}], message, lista_literatury }.
   Бэкенд читаем только здесь (fetch). При недоступности — возвращаем null,
   страница показывает заглушку «поиск станет доступен после деплоя»
   и обязана собираться для GitHub Pages. */

export interface EbsSource {
  title: string
  authors: string
  year: string
  publisher: string
  edition: string
  url: string
  annotation: string
  ebbs: string
  ebbs_label: string
  gost: string
}

export interface SearchResponse {
  query: string
  sources: EbsSource[]
  message: string
  lista_literatury: string[]
  expanded_from?: string
  expanded_terms?: string[]
}

function getSearchBaseUrl(): string {
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

/** Запрос к бэкенду. null — бэкенд недоступен (показываем заглушку). */
export async function searchCatalog(
  query: string,
  topK = 10,
  expandMode: 'fast' | 'llm' | 'off' = 'fast',
): Promise<SearchResponse | null> {
  const q = query.trim()
  if (!q) return null
  const controller = new AbortController()
  const timer = window.setTimeout(
    () => controller.abort(),
    expandMode === 'llm' ? 180000 : 15000,
  )
  try {
    const res = await fetch(`${getSearchBaseUrl()}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: q, top_k: topK, expand_mode: expandMode }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<SearchResponse>
    if (!data || !Array.isArray(data.sources)) return null
    return {
      query: typeof data.query === 'string' ? data.query : q,
      sources: data.sources as EbsSource[],
      message: typeof data.message === 'string' ? data.message : '',
      lista_literatury: Array.isArray(data.lista_literatury)
        ? (data.lista_literatury as string[])
        : [],
      expanded_from: typeof data.expanded_from === 'string' ? data.expanded_from : q,
      expanded_terms: Array.isArray(data.expanded_terms)
        ? (data.expanded_terms as string[])
        : [],
    }
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

/** Запрос к LLM-фолбэку. null — бэкенд недоступен или ответа нет.
 * Контракт стабилен: POST {base}/ask {"question": ...} -> 200 {"answer": "..."}.
 * Без авторизации, только Content-Type/Accept. Cold-ответ ~56с, таймаут 3 мин. */
export async function askModel(question: string): Promise<string | null> {
  const q = question.trim()
  if (!q) return null
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 180000)
  try {
    const res = await fetch(`${getSearchBaseUrl()}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ question: q }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<{ answer: string }>
    if (!data || typeof data.answer !== 'string' || !data.answer.trim()) return null
    return data.answer
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}
/* Уточнение неоднозначного запроса: «пра» -> «Вы имели в виду: право,
   правоведение...?». Варианты берутся из реального фонда, модель — опционально. */
export interface ClarifyCandidate {
  term: string
  source: string
}

export interface ClarifyResponse {
  query: string
  need_clarify: boolean
  candidates: ClarifyCandidate[]
  message: string
}

/** POST /clarify — мгновенно (fast) или через модель (llm). */
export async function clarifyQuery(
  query: string,
  expandMode: 'fast' | 'llm' = 'fast',
): Promise<ClarifyResponse | null> {
  const q = query.trim()
  if (q.length < 2) return null
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), expandMode === 'llm' ? 180000 : 15000)
  try {
    const res = await fetch(`${getSearchBaseUrl()}/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: q, expand_mode: expandMode }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<ClarifyResponse>
    if (!data || !Array.isArray(data.candidates)) return null
    return {
      query: typeof data.query === 'string' ? data.query : q,
      need_clarify: Boolean(data.need_clarify),
      candidates: data.candidates as ClarifyCandidate[],
      message: typeof data.message === 'string' ? data.message : '',
    }
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

/** Копирование текста: Clipboard API, fallback через textarea для http/Pages. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}
