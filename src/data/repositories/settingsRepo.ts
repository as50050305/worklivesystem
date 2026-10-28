import { getSupabase } from '@/lib/supabase'
import { OWNER_ID } from '../owner'
import type { AppSettings, ThemeName } from '../types'

/** 使用者設定與系統狀態 */
export const settingsRepo = {
  /** 首次開啟時建立預設資料；已建立過則什麼都不做（冪等） */
  async bootstrap(): Promise<boolean> {
    const { data, error } = await getSupabase().rpc('bootstrap_defaults')
    if (error) throw error
    return Boolean(data)
  },

  async get(): Promise<AppSettings | null> {
    const { data, error } = await getSupabase().from('app_settings').select('*').maybeSingle()
    if (error) throw error
    return data as AppSettings | null
  },

  async setTheme(theme: ThemeName): Promise<void> {
    const { error } = await getSupabase().from('app_settings').update({ theme }).eq('user_id', OWNER_ID)
    if (error) throw error
  },

  /** 每日檢查宣告：今天第一次呼叫的裝置回傳 true（P2／P5 使用） */
  async claimDailyCheck(today: string): Promise<boolean> {
    const { data, error } = await getSupabase().rpc('claim_daily_check', { p_today: today })
    if (error) throw error
    return Boolean(data)
  },

  /** 每日檢查失敗時釋放今天的宣告，讓下次觸發可重試 */
  async releaseDailyCheck(today: string): Promise<void> {
    const { error } = await getSupabase()
      .from('app_settings')
      .update({ last_daily_check: null })
      .eq('user_id', OWNER_ID)
      .eq('last_daily_check', today)
    if (error) throw error
  },
}
