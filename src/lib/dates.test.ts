import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  countdown,
  diffDays,
  formatDate,
  formatDateTime,
  isSameQuarter,
  nextQuarterStart,
  quarterOf,
  startOfWeek,
  todayTaipei,
  weekdayZh,
} from './dates'

describe('todayTaipei', () => {
  it('UTC 16:00 已是台北隔天', () => {
    expect(todayTaipei(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01')
  })
  it('UTC 15:59 仍是台北當天', () => {
    expect(todayTaipei(new Date('2026-12-31T15:59:59Z'))).toBe('2026-12-31')
  })
})

describe('格式與加減', () => {
  it('formatDate 用斜線', () => expect(formatDate('2026-03-05')).toBe('2026/03/05'))
  it('weekdayZh', () => expect(weekdayZh('2026-10-28')).toBe('週三'))
  it('addDays 跨年', () => expect(addDays('2026-12-25', 7)).toBe('2027-01-01'))
  it('addDays 負數', () => expect(addDays('2026-03-01', -14)).toBe('2026-02-15'))
  it('addMonths 月底取最後一天（平年）', () => expect(addMonths('2027-01-31', 1)).toBe('2027-02-28'))
  it('addMonths 月底取最後一天（閏年）', () => expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'))
  it('addMonths 跨年', () => expect(addMonths('2026-11-15', 2)).toBe('2027-01-15'))
  it('diffDays', () => expect(diffDays('2026-10-28', '2026-11-04')).toBe(7))
})

describe('週一為一週開始', () => {
  it('週三 → 週一', () => expect(startOfWeek('2026-10-28')).toBe('2026-10-26'))
  it('週日 → 前一個週一', () => expect(startOfWeek('2026-11-01')).toBe('2026-10-26'))
  it('週一 → 自己', () => expect(startOfWeek('2026-10-26')).toBe('2026-10-26'))
})

describe('季度', () => {
  it('quarterOf', () => {
    expect(quarterOf('2026-01-01')).toEqual({ year: 2026, quarter: 1 })
    expect(quarterOf('2026-03-31')).toEqual({ year: 2026, quarter: 1 })
    expect(quarterOf('2026-04-01')).toEqual({ year: 2026, quarter: 2 })
    expect(quarterOf('2026-12-31')).toEqual({ year: 2026, quarter: 4 })
  })
  it('季度邊界：3/31 與 4/1 不同季', () => expect(isSameQuarter('2026-03-31', '2026-04-01')).toBe(false))
  it('不同年同一季不算同季', () => expect(isSameQuarter('2025-02-01', '2026-02-01')).toBe(false))
  it('nextQuarterStart', () => {
    expect(nextQuarterStart('2026-02-14')).toBe('2026-04-01')
    expect(nextQuarterStart('2026-06-30')).toBe('2026-07-01')
    expect(nextQuarterStart('2026-09-01')).toBe('2026-10-01')
    expect(nextQuarterStart('2026-10-01')).toBe('2027-01-01')
    expect(nextQuarterStart('2026-12-31')).toBe('2027-01-01')
  })
})

describe('倒數', () => {
  it('今天', () => expect(countdown('2026-10-28', '2026-10-28').label).toBe('今天'))
  it('未來', () => expect(countdown('2026-11-04', '2026-10-28')).toEqual({ kind: 'future', days: 7, label: '7 天' }))
  it('已過', () => expect(countdown('2026-10-25', '2026-10-28')).toEqual({ kind: 'past', days: 3, label: '已過 3 天' }))
})

describe('formatDateTime', () => {
  it('UTC → 台北 24 小時制', () => expect(formatDateTime('2026-10-28T08:05:00Z')).toBe('2026/10/28 16:05'))
  it('跨日', () => expect(formatDateTime('2026-12-31T16:30:00Z')).toBe('2027/01/01 00:30'))
  it('空值', () => expect(formatDateTime(null)).toBe(''))
})
