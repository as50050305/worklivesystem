/** 時間軸檢視用的日期網格與排序（純函式） */
import { addDays, addMonths, diffDays, formatDate, makeDate, startOfWeek, weekdayZh, type PlainDate } from './dates'

export type TimelineView = 'day' | 'week' | 'month'

export const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'] as const

/** 從週一開始的 7 天 */
export function weekDays(anchor: PlainDate): PlainDate[] {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** 月曆網格：每列 7 天、週一開頭，含前後月補位；列數 4～6 */
export function monthGrid(anchor: PlainDate): PlainDate[][] {
  const first = makeDate(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 1)
  const last = addDays(addMonths(first, 1), -1)
  const start = startOfWeek(first)
  const end = addDays(startOfWeek(last), 6)
  const weeks: PlainDate[][] = []
  for (let d = start; diffDays(d, end) >= 0; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)))
  }
  return weeks
}

export function isSameMonth(a: PlainDate, b: PlainDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/** 某檢視需要載入的日期範圍（含） */
export function viewRange(view: TimelineView, anchor: PlainDate): { from: PlainDate; to: PlainDate } {
  if (view === 'day') return { from: anchor, to: anchor }
  if (view === 'week') {
    const days = weekDays(anchor)
    return { from: days[0]!, to: days[6]! }
  }
  const grid = monthGrid(anchor)
  return { from: grid[0]![0]!, to: grid[grid.length - 1]![6]! }
}

/** 上一頁／下一頁 */
export function shiftAnchor(view: TimelineView, anchor: PlainDate, dir: -1 | 1): PlainDate {
  if (view === 'day') return addDays(anchor, dir)
  if (view === 'week') return addDays(anchor, 7 * dir)
  return addMonths(makeDate(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 1), dir)
}

export function viewTitle(view: TimelineView, anchor: PlainDate): string {
  if (view === 'day') return `${formatDate(anchor)} ${weekdayZh(anchor)}`
  if (view === 'week') {
    const d = weekDays(anchor)
    const a = d[0]!
    const b = d[6]!
    return a.slice(0, 4) === b.slice(0, 4) ? `${formatDate(a)} – ${formatDate(b).slice(5)}` : `${formatDate(a)} – ${formatDate(b)}`
  }
  return `${anchor.slice(0, 4)} 年 ${Number(anchor.slice(5, 7))} 月`
}

export interface SortableItem {
  item_date: PlainDate
  item_time: string | null
  sort_order: number
  created_at: string
}

/** 排序：整天在前 → 依時間 → sort_order → 建立時間 */
export function compareItems(a: SortableItem, b: SortableItem): number {
  if (a.item_date !== b.item_date) return a.item_date < b.item_date ? -1 : 1
  if ((a.item_time === null) !== (b.item_time === null)) return a.item_time === null ? -1 : 1
  if (a.item_time && b.item_time && a.item_time !== b.item_time) return a.item_time < b.item_time ? -1 : 1
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
}

export function groupByDate<T extends SortableItem>(items: T[]): Map<PlainDate, T[]> {
  const map = new Map<PlainDate, T[]>()
  for (const it of [...items].sort(compareItems)) {
    const list = map.get(it.item_date)
    if (list) list.push(it)
    else map.set(it.item_date, [it])
  }
  return map
}

/** 'HH:MM:SS' → 'HH:MM' */
export function formatTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : ''
}

/** 使用者輸入的時間 → 'HH:MM'；空字串回傳 null；格式錯誤回傳 undefined */
export function parseTimeInput(v: string): string | null | undefined {
  const s = v.trim().replace('：', ':')
  if (!s) return null
  const m = /^(\d{1,2})(?::?(\d{2}))?$/.exec(s)
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2] ?? '0')
  if (h > 23 || min > 59) return undefined
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** 使用者輸入的日期（2026/10/28、2026-10-28、20261028）→ PlainDate；錯誤回傳 null */
export function parseDateInput(v: string): PlainDate | null {
  const s = v.trim()
  const m = /^(\d{4})[/\-.]?(\d{1,2})[/\-.]?(\d{1,2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1) return null
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  if (d > last) return null
  return makeDate(y, mo, d)
}
