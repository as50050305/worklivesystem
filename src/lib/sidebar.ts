/** 側邊欄的篩選規則（純函式） */
import { countdown, type Countdown, type PlainDate } from './dates'
import { compareItems, type SortableItem } from './calendar'

export interface SidebarItem extends SortableItem {
  id: string
  is_done: boolean
  color_tag_id: string | null
}

/** 今日排程：今天的時間軸項目（生活代辦另外列在「生活代辦」，避免重複） */
export function todaySchedule<T extends SidebarItem>(items: T[], today: PlainDate, lifeTagIds: Set<string>): T[] {
  return items
    .filter((i) => i.item_date === today && !(i.color_tag_id && lifeTagIds.has(i.color_tag_id)))
    .sort(compareItems)
}

/** 生活代辦：今天到期的（含已勾選）＋逾期未完成的；逾期在前 */
export function lifeTodos<T extends SidebarItem>(items: T[], today: PlainDate, lifeTagIds: Set<string>): T[] {
  return items
    .filter((i) => i.color_tag_id !== null && lifeTagIds.has(i.color_tag_id))
    .filter((i) => i.item_date === today || (i.item_date < today && !i.is_done))
    .sort(compareItems)
}

export interface ProjectDates {
  id: string
  name: string
  apply_deadline_on: PlainDate | null
  event_start_on: PlainDate | null
}

export interface CountdownEntry<P extends ProjectDates = ProjectDates> {
  project: P
  kind: 'apply_deadline' | 'event_start'
  label: '申請截止' | '活動開始'
  date: PlainDate
  countdown: Countdown
}

/**
 * 規則 E＋側邊欄：最近 n 個申請截止日／活動開始日（今天或之後），
 * 傳入的 projects 應已篩選為「進行中」。
 */
export function nearestCountdowns<P extends ProjectDates>(projects: P[], today: PlainDate, n = 3): CountdownEntry<P>[] {
  const entries: CountdownEntry<P>[] = []
  for (const p of projects) {
    if (p.apply_deadline_on && p.apply_deadline_on >= today)
      entries.push({ project: p, kind: 'apply_deadline', label: '申請截止', date: p.apply_deadline_on, countdown: countdown(p.apply_deadline_on, today) })
    if (p.event_start_on && p.event_start_on >= today)
      entries.push({ project: p, kind: 'event_start', label: '活動開始', date: p.event_start_on, countdown: countdown(p.event_start_on, today) })
  }
  return entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === 'apply_deadline' ? -1 : 1)).slice(0, n)
}
