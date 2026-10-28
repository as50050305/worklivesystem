import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from './env'

/**
 * Supabase 用戶端（單例）。
 * 只供 repository 層（src/data）與 auth 使用；UI 元件不得直接 import。
 */
let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('尚未設定 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      // 免登入單人模式：不使用 Supabase Auth，一律以 anon 角色存取（RLS 限定固定擁有者）
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return client
}
