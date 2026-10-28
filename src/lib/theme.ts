import type { ThemeName } from '@/data/types'

const KEY = 'wls.theme'

/** 本機記住主題（避免開啟時閃爍）；雲端 app_settings.theme 為跨裝置來源 */
export function readLocalTheme(): ThemeName {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', theme === 'light' ? '#E3E8DE' : '#1E2220')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* 私密模式等情況下忽略 */
  }
}
