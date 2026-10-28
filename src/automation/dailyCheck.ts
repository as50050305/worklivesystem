/**
 * 每日檢查（規格第 5 節）
 * - App 開啟、跨過午夜、從背景回到前景時觸發（由 useToday 的日期變化＋可見性驅動）
 * - 先向資料庫宣告今天（claim_daily_check），同一天只有一台裝置會執行
 * - 任務失敗時釋放宣告，下次觸發會重試
 * - 各任務本身也必須冪等（例如解凍只處理「冷卻中且冷卻至 ≤ 今天」的客戶）
 */
import { settingsRepo } from '@/data/repositories/settingsRepo'
import type { PlainDate } from '@/lib/dates'

export type DailyTask = { name: string; run: (today: PlainDate) => Promise<void> }

/** 各階段在此註冊任務（P5：客戶冷卻解凍） */
const tasks: DailyTask[] = []

export function registerDailyTask(task: DailyTask): void {
  if (!tasks.some((t) => t.name === task.name)) tasks.push(task)
}

let running: Promise<void> | null = null

export function runDailyCheck(today: PlainDate): Promise<void> {
  if (running) return running
  running = (async () => {
    const claimed = await settingsRepo.claimDailyCheck(today)
    if (!claimed) return
    try {
      for (const t of tasks) await t.run(today)
    } catch (e) {
      await settingsRepo.releaseDailyCheck(today).catch(() => {})
      throw e
    }
  })().finally(() => {
    running = null
  })
  return running
}
