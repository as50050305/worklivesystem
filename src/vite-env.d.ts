/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** '1' = 本機模式（local/server.mjs） */
  readonly VITE_LOCAL_MODE?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
