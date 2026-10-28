/**
 * 離線瀏覽：把 React Query 的快取存到 IndexedDB。
 * 下次開啟（即使沒有網路）會先顯示上次同步的資料，連線後再自動更新。
 * 只存在這台裝置的瀏覽器裡，不會上傳到其他地方。
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'

/** 資料結構有不相容變更時改這個值，舊快取就會被丟棄 */
export const CACHE_BUSTER = 'wls-cache-1'
/** 快取最多保留 7 天 */
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000

const KEY = 'wls.query-cache'

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (k: string) => {
      try {
        return (await get<string>(k)) ?? null
      } catch {
        return null
      }
    },
    setItem: async (k: string, v: string) => {
      try {
        await set(k, v)
      } catch {
        /* 無痕模式或空間不足時略過 */
      }
    },
    removeItem: async (k: string) => {
      try {
        await del(k)
      } catch {
        /* ignore */
      }
    },
  },
  key: KEY,
  throttleTime: 1000,
})
