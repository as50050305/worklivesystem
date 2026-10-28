/** 讀取前端環境變數。只允許 anon / publishable key；service_role 絕不能出現在前端。 */
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''

/** 本機模式：資料庫與網頁由同一個本機程式（local/server.mjs）提供，不連任何雲端服務 */
export const isLocalMode = import.meta.env.VITE_LOCAL_MODE === '1'

export const env = {
  // 'same-origin'：API 與網頁同一個網址（本機模式用，換連接埠也不必重新建置）
  supabaseUrl: rawUrl === 'same-origin' && typeof location !== 'undefined' ? location.origin : rawUrl,
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
}

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)

export const appVersion = __APP_VERSION__
export const buildTime = __BUILD_TIME__
