export interface SystemConfig {
  apiUrl: string
  projectId: string
  apiToken: string
  /** Название сайта: подставляется в <title> и og-мета (см. usePageMeta). */
  siteName?: string
  /** Base URL библиотечного бэкенда (новый роутер /api). */
  libraryApi?: string
  /** Токен записи в каталог (заголовок X-Ingest-Token для POST/PATCH /api/books). */
  ingestToken?: string
  /** Поиск ЭБС на сайте; по умолчанию берётся libraryApi. */
  searchApi?: string
}

/* T-1034: AuthUser и SupabaseClientConfig удалены вместе с авторизацией. */

declare global {
  interface Window {
    __APP_CONFIG__?: SystemConfig
  }
}