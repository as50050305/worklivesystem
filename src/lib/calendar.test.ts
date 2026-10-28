import { describe, expect, it } from 'vitest'
import { compareItems, groupByDate, monthGrid, parseDateInput, parseTimeInput, shiftAnchor, viewRange, viewTitle, weekDays } from './calendar'

describe('週與月網格（週一開頭）', () => {
  it('weekDays 從週一到週日', () => {
    expect(weekDays('2026-10-28')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
  })
  it('2026 年 10 月：從 9/28（週一）到 11/1（週日），5 列', () => {
    const g = monthGrid('2026-10-15')
    expect(g.length).toBe(5)
    expect(g[0]![0]).toBe('2026-09-28')
    expect(g[4]![6]).toBe('2026-11-01')
  })
  it('2026 年 2 月 1 日是週日 → 第一列從 1/26 開始', () => {
    const g = monthGrid('2026-02-10')
    expect(g[0]![0]).toBe('2026-01-26')
    expect(g[0]![6]).toBe('2026-02-01')
  })
  it('viewRange', () => {
    expect(viewRange('day', '2026-10-28')).toEqual({ from: '2026-10-28', to: '2026-10-28' })
    expect(viewRange('week', '2026-10-28')).toEqual({ from: '2026-10-26', to: '2026-11-01' })
    expect(viewRange('month', '2026-10-28')).toEqual({ from: '2026-09-28', to: '2026-11-01' })
  })
  it('shiftAnchor', () => {
    expect(shiftAnchor('day', '2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftAnchor('week', '2026-10-28', -1)).toBe('2026-10-21')
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftAnchor('month', '2026-01-15', -1)).toBe('2025-12-01')
  })
  it('viewTitle', () => {
    expect(viewTitle('day', '2026-10-28')).toBe('2026/10/28 週三')
    expect(viewTitle('week', '2026-10-28')).toBe('2026/10/26 – 11/01')
    expect(viewTitle('week', '2026-12-30')).toBe('2026/12/28 – 2027/01/03')
    expect(viewTitle('month', '2026-10-28')).toBe('2026 年 10 月')
  })
})

describe('排序', () => {
  const base = { item_date: '2026-10-28', sort_order: 0, created_at: '2026-10-01T00:00:00Z' }
  it('整天在前，再依時間', () => {
    const items = [
      { ...base, id: 'b', item_time: '14:00:00' },
      { ...base, id: 'a', item_time: null },
      { ...base, id: 'c', item_time: '09:30:00' },
    ]
    expect([...items].sort(compareItems).map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })
  it('groupByDate', () => {
    const g = groupByDate([
      { ...base, item_date: '2026-10-29', item_time: null },
      { ...base, item_time: null },
    ])
    expect([...g.keys()]).toEqual(['2026-10-28', '2026-10-29'])
  })
})

describe('輸入解析', () => {
  it('時間', () => {
    expect(parseTimeInput('9:5')).toBeUndefined()
    expect(parseTimeInput('9')).toBe('09:00')
    expect(parseTimeInput('0930')).toBe('09:30')
    expect(parseTimeInput('14：30')).toBe('14:30')
    expect(parseTimeInput('24:00')).toBeUndefined()
    expect(parseTimeInput('')).toBeNull()
  })
  it('日期', () => {
    expect(parseDateInput('2026/10/28')).toBe('2026-10-28')
    expect(parseDateInput('2026-1-5')).toBe('2026-01-05')
    expect(parseDateInput('20261028')).toBe('2026-10-28')
    expect(parseDateInput('2026/02/30')).toBeNull()
    expect(parseDateInput('abc')).toBeNull()
  })
})
