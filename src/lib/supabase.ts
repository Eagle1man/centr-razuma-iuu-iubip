import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClientConfig } from '../types'

/* ВОССТАНОВЛЕНО по контракту из бандла: initSupabase() вызывается в main.tsx
   до рендера, getSupabase() использует useAuth.
   Настройки приходят из window.__APP_CONFIG__ (инжектит билдер Wuna). */

// Схема приходит из конфига как string, поэтому обобщаем клиент соответствующе
type DbClient = SupabaseClient<any, any, string, any, any>

let client: DbClient | null = null

function readConfig(): SupabaseClientConfig | undefined {
  if (typeof window === 'undefined') return undefined
  return window.__APP_CONFIG__?.supabase
}

/** Инициализирует клиент один раз. Возвращает null, если конфига нет. */
export function initSupabase(): DbClient | null {
  if (client) return client

  const config = readConfig()
  if (!config?.url || !config?.publishableKey) return null

  client = createClient(config.url, config.publishableKey, {
    db: { schema: config.schema },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `sb-${config.schema}-auth-token`,
    },
  })

  return client
}

/** Клиент или null, если сайт запущен без базы данных. */
export function getSupabase(): DbClient | null {
  return client ?? initSupabase()
}

/** true, если база данных подключена. */
export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null
}