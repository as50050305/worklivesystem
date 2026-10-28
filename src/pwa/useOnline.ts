import { useSyncExternalStore } from 'react'
import { isLocalMode } from '@/lib/env'

function subscribe(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** 是否在線。離線時頁首顯示「離線中」，並禁止編輯（P7 完整處理） */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    // 本機模式：資料就在這台電腦，沒有網路也能編輯
    () => isLocalMode || navigator.onLine,
    () => true,
  )
}
