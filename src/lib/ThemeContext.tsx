import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAppState } from '@/app/AppStateProvider'
import { invalidateTable } from '@/data/queryClient'
import { settingsRepo } from '@/data/repositories/settingsRepo'
import type { ThemeName, UiSeries } from '@/data/types'
import { applyTheme, parseSeries, readLocalSeries, readLocalTheme } from './theme'

interface ThemeState {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
  toggle: () => void
  /** UI 系列（預設／初號機配色），可與深色、淺色任意搭配 */
  series: UiSeries
  setSeries: (s: UiSeries) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppState()
  const [theme, setThemeState] = useState<ThemeName>(readLocalTheme)
  const [series, setSeriesState] = useState<UiSeries>(readLocalSeries)

  useEffect(() => applyTheme(theme, series), [theme, series])

  // 登入後以雲端設定為準（跨裝置一致）
  useEffect(() => {
    if (settings?.theme) setThemeState(settings.theme)
  }, [settings?.theme])
  const savedSeries = settings?.preferences?.ui_series
  useEffect(() => {
    if (savedSeries !== undefined) setSeriesState(parseSeries(savedSeries))
  }, [savedSeries])

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t)
    settingsRepo.setTheme(t).catch(() => {
      /* 未登入或離線時僅存在本機 */
    })
  }, [])

  const setSeries = useCallback((s: UiSeries) => {
    setSeriesState(s)
    settingsRepo
      .mergePreferences({ ui_series: s })
      .then(() => invalidateTable('app_settings'))
      .catch(() => {
        /* 離線時僅存在本機 */
      })
  }, [])

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [setTheme, theme])

  return <ThemeContext.Provider value={{ theme, setTheme, toggle, series, setSeries }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必須在 <ThemeProvider> 內使用')
  return ctx
}
