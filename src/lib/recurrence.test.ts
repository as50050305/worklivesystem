import { describe, expect, it } from 'vitest'
import { describeRecurrence, nextOccurrenceDate } from './recurrence'

describe('規則 D：下一筆日期（以原定日期推算）', () => {
  it('不重複 → null', () => expect(nextOccurrenceDate('2026-10-28', { recurrence: 'none' })).toBeNull())
  it('每週', () => expect(nextOccurrenceDate('2026-10-28', { recurrence: 'weekly' })).toBe('2026-11-04'))
  it('每週跨年', () => expect(nextOccurrenceDate('2026-12-30', { recurrence: 'weekly' })).toBe('2027-01-06'))
  it('每月', () => expect(nextOccurrenceDate('2026-10-15', { recurrence: 'monthly' })).toBe('2026-11-15'))
  it('每月 1/31 → 2/28（平年）', () => expect(nextOccurrenceDate('2027-01-31', { recurrence: 'monthly' })).toBe('2027-02-28'))
  it('每月 1/31 → 2/29（閏年）', () => expect(nextOccurrenceDate('2028-01-31', { recurrence: 'monthly' })).toBe('2028-02-29'))
  it('每月保留原本的 31 號：2/28 → 3/31', () =>
    expect(nextOccurrenceDate('2027-02-28', { recurrence: 'monthly' }, '2027-01-31')).toBe('2027-03-31'))
  it('每月跨年', () => expect(nextOccurrenceDate('2026-12-05', { recurrence: 'monthly' })).toBe('2027-01-05'))
  it('每兩月', () => expect(nextOccurrenceDate('2026-11-30', { recurrence: 'bimonthly' })).toBe('2027-01-30'))
  it('每兩月 12/31 → 2/28', () => expect(nextOccurrenceDate('2026-12-31', { recurrence: 'bimonthly' })).toBe('2027-02-28'))
  it('自訂每 3 天', () =>
    expect(nextOccurrenceDate('2026-10-30', { recurrence: 'custom', recurrence_interval: 3, recurrence_unit: 'day' })).toBe('2026-11-02'))
  it('自訂每 2 週', () =>
    expect(nextOccurrenceDate('2026-10-28', { recurrence: 'custom', recurrence_interval: 2, recurrence_unit: 'week' })).toBe('2026-11-11'))
  it('自訂每 3 個月（保留幾號）', () =>
    expect(nextOccurrenceDate('2027-02-28', { recurrence: 'custom', recurrence_interval: 3, recurrence_unit: 'month' }, '2026-11-30')).toBe('2027-05-30'))
  it('自訂設定不完整 → null', () =>
    expect(nextOccurrenceDate('2026-10-28', { recurrence: 'custom', recurrence_interval: null, recurrence_unit: 'day' })).toBeNull())
  it('與完成日無關：逾期完成仍從原定日推算', () => {
    // 原定 10/01 的每週項目，就算 10/20 才勾，下一筆仍是 10/08
    expect(nextOccurrenceDate('2026-10-01', { recurrence: 'weekly' })).toBe('2026-10-08')
  })
})

describe('describeRecurrence', () => {
  it('文字', () => {
    expect(describeRecurrence({ recurrence: 'bimonthly' })).toBe('每兩月')
    expect(describeRecurrence({ recurrence: 'custom', recurrence_interval: 10, recurrence_unit: 'day' })).toBe('每 10 天')
    expect(describeRecurrence({ recurrence: 'custom', recurrence_interval: 2, recurrence_unit: 'month' })).toBe('每 2 個月')
  })
})
