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
  refreshSettings: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

/** 免登入單人模式：開啟 App 時建立預設資料（冪等）並讀取設定 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      await settingsRepo.bootstrap()
      setSettings(await settingsRepo.get())
      setSetupError(null)
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSupabaseConfigured) void load()
  }, [load])

  const value: AppState = {
    configured: isSupabaseConfigured,
    loading,
    settings,
    setupError,
    refreshSettings: async () => setSettings(await settingsRepo.get()),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppState(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppState 必須在 <AppStateProvider> 內使用')
  return v
}
