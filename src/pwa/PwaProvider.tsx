import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaState {
  /** Service Worker 偵測到新版本，等待使用者點擊更新 */
  needRefresh: boolean
  applyUpdate: () => void
  /** 手動檢查更新 */
  checkForUpdate: () => void
  /** 瀏覽器可顯示安裝提示（Chrome／Edge） */
  canInstall: boolean
  promptInstall: () => Promise<void>
  /** 目前是否以已安裝的 App 形式開啟 */
  isStandalone: boolean
}

const PwaContext = createContext<PwaState | null>(null)

const UPDATE_INTERVAL_MS = 15 * 60 * 1000

export function PwaProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (r) setRegistration(r)
    },
  })

  // 定期與回到前景時檢查新版本
  useEffect(() => {
    if (!registration) return
    const check = () => {
      if (navigator.onLine) registration.update().catch(() => {})
    }
    const id = window.setInterval(check, UPDATE_INTERVAL_MS)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', check)
    }
  }, [registration])

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstallEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true)

  const value: PwaState = {
    needRefresh,
    applyUpdate: () => {
      void updateServiceWorker(true) // 啟用新 SW 並重新載入
    },
    checkForUpdate: () => {
      registration?.update().catch(() => {})
    },
    canInstall: installEvent !== null,
    promptInstall: async () => {
      if (!installEvent) return
      await installEvent.prompt()
      await installEvent.userChoice
      setInstallEvent(null)
    },
    isStandalone,
  }
  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>
}

export function usePwa(): PwaState {
  const ctx = useContext(PwaContext)
  if (!ctx) throw new Error('usePwa 必須在 <PwaProvider> 內使用')
  return ctx
}
