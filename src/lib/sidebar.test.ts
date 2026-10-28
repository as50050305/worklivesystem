import { describe, expect, it } from 'vitest'
import { lifeTodos, nearestCountdowns, todaySchedule } from './sidebar'

const T = '2026-10-28'
const LIFE = new Set(['life'])
const mk = (id: string, item_date: string, color_tag_id: string | null, is_done = false, item_time: string | null = null) => ({
  id, item_date, color_tag_id, is_done, item_time, sort_order: 0, created_at: '2026-10-01T00:00:00Z',
})

describe('側邊欄', () => {
  const items = [
    mk('work-today', T, 'work', false, '14:00:00'),
    mk('work-today-allday', T, null),
    mk('life-today', T, 'life'),
    mk('life-today-done', T, 'life', true),
    mk('life-overdue', '2026-10-20', 'life'),
    mk('life-overdue-done', '2026-10-21', 'life', true),
    mk('life-future', '2026-10-30', 'life'),
    mk('work-overdue', '2026-10-20', 'work'),
  ]
  it('今日排程：今天、排除生活代辦、整天在前', () => {
    expect(todaySchedule(items, T, LIFE).map((i) => i.id)).toEqual(['work-today-allday', 'work-today'])
  })
  it('生活代辦：今天（含已勾）＋逾期未完成，逾期在前', () => {
    expect(lifeTodos(items, T, LIFE).map((i) => i.id)).toEqual(['life-overdue', 'life-today', 'life-today-done'])
  })
})

describe('規則 E：最近 3 個倒數', () => {
  const ps = [
    { id: 'a', name: 'A', apply_deadline_on: '2026-11-10', event_start_on: '2027-03-01' },
    { id: 'b', name: 'B', apply_deadline_on: '2026-10-28', event_start_on: null },
    { id: 'c', name: 'C', apply_deadline_on: '2026-10-01', event_start_on: '2026-11-01' },
    { id: 'd', name: 'D', apply_deadline_on: null, event_start_on: null },
  ]
  it('只取今天以後、依日期排序、最多 3 筆', () => {
    const r = nearestCountdowns(ps, T)
    expect(r.map((e) => `${e.project.id}:${e.kind}`)).toEqual(['b:apply_deadline', 'c:event_start', 'a:apply_deadline'])
    expect(r[0]!.countdown.label).toBe('今天')
    expect(r[1]!.countdown.label).toBe('4 天')
  })
})
