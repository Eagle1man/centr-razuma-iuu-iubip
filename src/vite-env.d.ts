/// <reference types="vite/client" />

// Unified __APP_CONFIG__ type declaration.
// T-1034: Supabase удалён вместе с авторизацией, остались только адреса API.
interface SystemConfig {
  apiUrl: string
  projectId: string
  apiToken: string
  /** Название сайта: подставляется в <title> и og-мета (см. usePageMeta). */
  siteName?: string
  /** Base URL библиотечного бэкенда (новый роутер /api). */
  libraryApi?: string
  /** Поиск ЭБС; по умолчанию берётся libraryApi. */
  searchApi?: string
  /** Токен записи в каталог. */
  ingestToken?: string
}

declare global {
  interface Window {
    __APP_CONFIG__?: SystemConfig
  }
}

export {}