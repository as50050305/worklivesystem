import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAppState } from '@/app/AppStateProvider'
import { settingsRepo } from '@/data/repositories/settingsRepo'
import type { ThemeName } from '@/data/types'
import { applyTheme, readLocalTheme } from './theme'

interface ThemeState {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppState()
  const [theme, setThemeState] = useState<ThemeName>(readLocalTheme)

  useEffect(() => applyTheme(theme), [theme])

  // 登入後以雲端設定為準（跨裝置一致）
  useEffect(() => {
    if (settings?.theme) setThemeState(settings.theme)
  }, [settings?.theme])

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t)
    settingsRepo.setTheme(t).catch(() => {
      /* 未登入或離線時僅存在本機 */
    })
  }, [])

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [setTheme, theme])

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必須在 <ThemeProvider> 內使用')
  return ctx
}
