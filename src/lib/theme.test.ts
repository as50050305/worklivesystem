import { describe, expect, it } from 'vitest'
import { parseSeries } from './theme'

describe('UI 系列', () => {
  it('只接受認得的系列，其餘回到預設', () => {
    expect(parseSeries('eva')).toBe('eva')
    expect(parseSeries('default')).toBe('default')
    expect(parseSeries('EVA')).toBe('default')
    expect(parseSeries(undefined)).toBe('default')
    expect(parseSeries(null)).toBe('default')
    expect(parseSeries(1)).toBe('default')
  })
})
