import { describe, expect, it } from 'vitest'
import { matchesAll } from './search'

describe('全文搜尋', () => {
  const text = '王小明 日日好食 行銷經理 0912-345-678 ming@hibi.example 轉介：陳大華'
  it('單一關鍵字', () => expect(matchesAll(text, '行銷')).toBe(true))
  it('多個關鍵字全部符合', () => expect(matchesAll(text, '日日 經理')).toBe(true))
  it('任一不符合則否', () => expect(matchesAll(text, '日日 設計師')).toBe(false))
  it('不分大小寫', () => expect(matchesAll(text, 'MING@HIBI')).toBe(true))
  it('空字串全部符合', () => expect(matchesAll(text, '  ')).toBe(true))
})
