/**
 * 日期工具（純函式，無 UI 依賴）
 * - 一律以 Asia/Taipei 為準
 * - 「日期」以 PlainDate 字串 'YYYY-MM-DD' 表示（與 Postgres date 欄位相同），避免時區位移
 * - 顯示格式 YYYY/MM/DD；週一為一週第一天
 */

export const TIME_ZONE = 'Asia/Taipei'

/** 'YYYY-MM-DD' */
export type PlainDate = string

const WEEKDAYS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** 取得某個時間點在台北的年月日時分秒 */
export function taipeiParts(now: Date = new Date()) {
  const map: Record<string, string> = {}
  for (const p of partsFormatter.formatToParts(now)) map[p.type] = p.value
  return {
    date: `${map.year}-${map.month}-${map.day}` as PlainDate,
    time: `${map.hour}:${map.minute}:${map.second}`,
    hour: Number(map.hour),
    minute: Number(map.minute),
  }
}

/** 台北的「今天」 */
export function todayTaipei(now: Date = new Date()): PlainDate {
  return taipeiParts(now).date
}

function parse(d: PlainDate): { y: number; m: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) throw new Error(`無效的日期：${d}`)
  return { y: Number(m[1]), m: Number(m[2]), day: Number(m[3]) }
}

function toUtcMs(d: PlainDate): number {
  const { y, m, day } = parse(d)
  return Date.UTC(y, m - 1, day)
}

function fromUtcMs(ms: number): PlainDate {
  const dt = new Date(ms)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function makeDate(year: number, month: number, day: number): PlainDate {
  return fromUtcMs(Date.UTC(year, month - 1, day))
}

/** 顯示用：YYYY/MM/DD */
export function formatDate(d: PlainDate | null | undefined): string {
  if (!d) return ''
  return d.replaceAll('-', '/')
}

/** 週幾（中文） */
export function weekdayZh(d: PlainDate): string {
  return WEEKDAYS_ZH[new Date(toUtcMs(d)).getUTCDay()]!
}

export function addDays(d: PlainDate, n: number): PlainDate {
  return fromUtcMs(toUtcMs(d) + n * 86_400_000)
}

/** 加月份；日數超過該月時取月底（1/31 + 1 個月 = 2/28 或 2/29） */
export function addMonths(d: PlainDate, n: number): PlainDate {
  const { y, m, day } = parse(d)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return makeDate(ny, nm, Math.min(day, lastDay))
}

/** b − a 的天數（b 較晚為正） */
export function diffDays(a: PlainDate, b: PlainDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000)
}

/** 該週週一 */
export function startOfWeek(d: PlainDate): PlainDate {
  const dow = new Date(toUtcMs(d)).getUTCDay() // 0=日
  const offset = dow === 0 ? -6 : 1 - dow
  return addDays(d, offset)
}

export interface Quarter {
  year: number
  quarter: 1 | 2 | 3 | 4
}

export function quarterOf(d: PlainDate): Quarter {
  const { y, m } = parse(d)
  return { year: y, quarter: (Math.floor((m - 1) / 3) + 1) as Quarter['quarter'] }
}

export function isSameQuarter(a: PlainDate, b: PlainDate): boolean {
  const qa = quarterOf(a)
  const qb = quarterOf(b)
  return qa.year === qb.year && qa.quarter === qb.quarter
}

/** 下一季第一天：Q1→4/1、Q2→7/1、Q3→10/1、Q4→隔年 1/1 */
export function nextQuarterStart(d: PlainDate): PlainDate {
  const { year, quarter } = quarterOf(d)
  if (quarter === 4) return makeDate(year + 1, 1, 1)
  return makeDate(year, quarter * 3 + 1, 1)
}

export type CountdownKind = 'today' | 'future' | 'past'

export interface Countdown {
  kind: CountdownKind
  days: number // 永遠為非負
  label: string
}

/** 倒數：今天→「今天」；未來→「N 天」；已過→「已過 N 天」 */
export function countdown(target: PlainDate, today: PlainDate): Countdown {
  const n = diffDays(today, target)
  if (n === 0) return { kind: 'today', days: 0, label: '今天' }
  if (n > 0) return { kind: 'future', days: n, label: `${n} 天` }
  return { kind: 'past', days: -n, label: `已過 ${-n} 天` }
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** 時間戳（ISO 字串或 Date）→ 台北時間「YYYY/MM/DD HH:mm」 */
export function formatDateTime(ts: string | Date | null | undefined): string {
  if (!ts) return ''
  const d = typeof ts === 'string' ? new Date(ts) : ts
  if (Number.isNaN(d.getTime())) return ''
  const m: Record<string, string> = {}
  for (const p of dateTimeFormatter.formatToParts(d)) m[p.type] = p.value
  return `${m.year}/${m.month}/${m.day} ${m.hour}:${m.minute}`
}
