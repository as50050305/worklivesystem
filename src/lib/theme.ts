import type { ThemeName, UiSeries } from '@/data/types'

const KEY = 'wls.theme'
const SERIES_KEY = 'wls.series'

/** 瀏覽器分頁／狀態列顏色（＝各主題的頁面底色）；index.html 的啟動腳本有一份相同的對照 */
const THEME_COLOR: Record<UiSeries, Record<ThemeName, string>> = {
  default: { dark: '#1E2220', light: '#E3E8DE' },
  eva: { dark: '#1D1A2F', light: '#E6E1F2' },
}

/** 本機記住主題（避免開啟時閃爍）；雲端 app_settings.theme 為跨裝置來源 */
export function readLocalTheme(): ThemeName {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** 本機記住 UI 系列；跨裝置來源是 app_settings.preferences.ui_series */
export function readLocalSeries(): UiSeries {
  try {
    return parseSeries(localStorage.getItem(SERIES_KEY))
  } catch {
    return 'default'
  }
}

/** 不認得的值一律當成預設系列 */
export function parseSeries(v: unknown): UiSeries {
  return v === 'eva' ? 'eva' : 'default'
}

export function applyTheme(theme: ThemeName, series: UiSeries = 'default'): void {
  const root = document.documentElement
  root.dataset.theme = theme
  if (series === 'default') delete root.dataset.series
  else root.dataset.series = series
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', THEME_COLOR[series][theme])
  try {
    localStorage.setItem(KEY, theme)
    localStorage.setItem(SERIES_KEY, series)
  } catch {
    /* 私密模式等情況下忽略 */
  }
}
