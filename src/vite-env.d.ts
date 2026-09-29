/// <reference types="vite/client" />

// Unified __APP_CONFIG__ type declaration (used by supabase.ts)
interface SupabaseClientConfig {
  url: string
  publishableKey: string
  schema: string
}

interface SystemConfig {
  apiUrl: string
  projectId: string
  apiToken: string
  /** Название сайта: подставляется в <title> и og-мета (см. usePageMeta). */
  siteName?: string
  /** Base URL библиотечного бэкенда (новый роутер /api). */
  libraryApi?: string
  supabase?: SupabaseClientConfig
}

declare global {
  interface Window {
    __APP_CONFIG__?: SystemConfig
  }
}

export {}