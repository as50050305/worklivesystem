/**
 * 規則 D：重複代辦（純函式）
 * - 勾選完成後產生下一筆，日期以「原定日期」推算，不是以完成日推算
 * - 每月／每兩月／每 N 月：保留系列起始日的「幾號」（1/31 → 2/28 → 3/31）
 */
import { addDays, makeDate, type PlainDate } from './dates'

export type RecurrenceKind = 'none' | 'weekly' | 'monthly' | 'bimonthly' | 'custom'
export type RecurrenceUnit = 'day' | 'week' | 'month'

export interface RecurrenceRule {
  recurrence: RecurrenceKind
  recurrence_interval?: number | null
  recurrence_unit?: RecurrenceUnit | null
}

function dayOf(d: PlainDate): number {
  return Number(d.slice(8, 10))
}

/** 往後 n 個月，日期取 anchorDay（超過該月天數則取月底） */
export function addMonthsAnchored(d: PlainDate, n: number, anchorDay: number): PlainDate {
  const y = Number(d.slice(0, 4))
  const m = Number(d.slice(5, 7))
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return makeDate(ny, nm, Math.min(anchorDay, last))
}

export function isValidRule(rule: RecurrenceRule): boolean {
  if (rule.recurrence !== 'custom') return true
  return Boolean(rule.recurrence_unit) && Number.isInteger(rule.recurrence_interval) && (rule.recurrence_interval ?? 0) > 0
}

/**
 * 下一次的日期。
 * @param itemDate    這一筆的原定日期
 * @param rule        重複規則
 * @param seriesStart 系列起始日（每月類保留「幾號」用；沒有就用 itemDate）
 */
export function nextOccurrenceDate(itemDate: PlainDate, rule: RecurrenceRule, seriesStart?: PlainDate | null): PlainDate | null {
  const anchorDay = dayOf(seriesStart ?? itemDate)
  switch (rule.recurrence) {
    case 'none':
      return null
    case 'weekly':
      return addDays(itemDate, 7)
    case 'monthly':
      return addMonthsAnchored(itemDate, 1, anchorDay)
    case 'bimonthly':
      return addMonthsAnchored(itemDate, 2, anchorDay)
    case 'custom': {
      if (!isValidRule(rule)) return null
      const n = rule.recurrence_interval!
      if (rule.recurrence_unit === 'day') return addDays(itemDate, n)
      if (rule.recurrence_unit === 'week') return addDays(itemDate, 7 * n)
      return addMonthsAnchored(itemDate, n, anchorDay)
    }
  }
}

const UNIT_LABEL: Record<RecurrenceUnit, string> = { day: '天', week: '週', month: '個月' }

/** 顯示用文字 */
export function describeRecurrence(rule: RecurrenceRule): string {
  switch (rule.recurrence) {
    case 'none':
      return '不重複'
    case 'weekly':
      return '每週'
    case 'monthly':
      return '每月'
    case 'bimonthly':
      return '每兩月'
    case 'custom':
      return isValidRule(rule) ? `每 ${rule.recurrence_interval} ${UNIT_LABEL[rule.recurrence_unit!]}` : '自訂（未完成設定）'
  }
}
