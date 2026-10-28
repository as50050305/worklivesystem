/** 讀取前端環境變數。只允許 anon / publishable key；service_role 絕不能出現在前端。 */
export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
}

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)

export const appVersion = __APP_VERSION__
export const buildTime = __BUILD_TIME__
