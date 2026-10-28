import { useEffect, useState } from 'react'
import { todayTaipei, type PlainDate } from './dates'

/** 台北的「今天」；跨過午夜或從背景回到前景時自動更新 */
export function useToday(): PlainDate {
  const [today, setToday] = useState(todayTaipei)
  useEffect(() => {
    const check = () => setToday((prev) => {
      const t = todayTaipei()
      return t === prev ? prev : t
    })
    const id = window.setInterval(check, 30_000)
    const onVis = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', check)
    }
  }, [])
  return today
}
