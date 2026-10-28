import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { settingsRepo } from '@/data/repositories/settingsRepo'
import type { AppSettings } from '@/data/types'
import { isSupabaseConfigured } from '@/lib/env'

interface AppState {
  /** 是否已設定 Supabase 環境變數 */
  configured: boolean
  /** 首次開啟時建立預設資料、讀取設定中 */
  loading: boolean
  settings: AppSettings | null
  /** 例如 migration 尚未套用、無法連線 */
  setupError: string | null
  /** 離線開啟：使用上次儲存在這台裝置的設定 */
  usingCachedSettings: boolean
  refreshSettings: () => Promise<void>
}

const SETTINGS_KEY = 'wls.settings.v1'

function readCachedSettings(): AppSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? (JSON.parse(raw) as AppSettings) : null
  } catch {
    return null
  }
}

function cacheSettings(s: AppSettings | null) {
  try {
    if (s) localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

const isNetworkError = (e: unknown) => !navigator.onLine || /failed to fetch|network|load failed/i.test(e instanceof Error ? e.message : String(e))

const Ctx = createContext<AppState | null>(null)

/** 免登入單人模式：開啟 App 時建立預設資料（冪等）並讀取設定 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [usingCachedSettings, setUsingCached] = useState(false)

  const load = useCallback(async () => {
    try {
      await settingsRepo.bootstrap()
      const s = await settingsRepo.get()
      setSettings(s)
      cacheSettings(s)
      setUsingCached(false)
      setSetupError(null)
    } catch (e) {
      // 離線開啟 App：改用這台裝置上次的設定，畫面用快取資料顯示
      const cached = isNetworkError(e) ? readCachedSettings() : null
      if (cached) {
        setSettings((cur) => cur ?? cached)
        setUsingCached(true)
        setSetupError(null)
      } else {
        setSetupError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSupabaseConfigured) void load()
  }, [load])

  // 恢復連線時，若之前是用快取或發生錯誤，重新載入
  useEffect(() => {
    if (!isSupabaseConfigured || (!usingCachedSettings && !setupError)) return
    const onOnline = () => void load()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [load, usingCachedSettings, setupError])

  const value: AppState = {
    configured: isSupabaseConfigured,
    loading,
    settings,
    setupError,
    usingCachedSettings,
    refreshSettings: async () => {
      const s = await settingsRepo.get()
      setSettings(s)
      cacheSettings(s)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppState(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppState 必須在 <AppStateProvider> 內使用')
  return v
}
