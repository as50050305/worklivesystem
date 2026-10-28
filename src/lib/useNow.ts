import { useEffect, useState } from 'react'

/** 每秒更新的目前時間（對齊整秒） */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let id: number | undefined
    const tick = () => {
      setNow(new Date())
      id = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs))
    }
    id = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs))
    return () => window.clearTimeout(id)
  }, [intervalMs])
  return now
}
