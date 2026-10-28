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

describe('全域搜尋排序', async () => {
  const { searchEntries, snippet } = await import('./search')
  const entries = [
    { key: 'page:/', group: '頁面' as const, title: '總覽' },
    { key: 'page:/clients', group: '頁面' as const, title: '客戶', text: 'clients' },
    { key: 'c1', group: '客戶' as const, title: '日日好食', subtitle: 'C001' },
    { key: 'c2', group: '客戶' as const, title: '好食光', subtitle: 'C002' },
    { key: 'c3', group: '客戶' as const, title: '山海咖啡', subtitle: 'C003', text: '好食 推薦' },
    { key: 'p1', group: '專案' as const, title: '日日好食 包裝插畫' },
    { key: 'n1', group: '筆記' as const, title: '開會紀錄', text: '日日好食想要春季包裝' },
  ]
  it('空查詢只列頁面', () => {
    expect(searchEntries(entries, '').map((s) => s.group)).toEqual(['頁面'])
  })
  it('依群組順序、群組內依相關度（開頭 > 包含 > 副標 > 其他欄位）', () => {
    const r = searchEntries(entries, '好食')
    expect(r.map((s) => s.group)).toEqual(['專案', '客戶', '筆記'])
    expect(r.find((s) => s.group === '客戶')!.items.map((e) => e.key)).toEqual(['c2', 'c1', 'c3'])
  })
  it('多關鍵字全部符合', () => {
    expect(searchEntries(entries, '日日 包裝').flatMap((s) => s.items.map((e) => e.key))).toEqual(['p1', 'n1'])
  })
  it('副標與隱藏文字可搜尋（客戶編號、英文別名）', () => {
    expect(searchEntries(entries, 'c003')[0]!.items[0]!.key).toBe('c3')
    expect(searchEntries(entries, 'CLIENTS')[0]!.items[0]!.key).toBe('page:/clients')
  })
  it('每群組上限與剩餘筆數', () => {
    const r = searchEntries(entries, '好食', 2).find((s) => s.group === '客戶')!
    expect(r.items).toHaveLength(2)
    expect(r.more).toBe(1)
  })
  it('snippet 擷取關鍵字附近', () => {
    expect(snippet('一二三四五六七八九十日日好食想要春季包裝ABCDEFGHIJ', '好食', 4)).toBe('…九十日日好食想要春季…')
    expect(snippet('短文字', '沒有')).toBe('短文字')
  })
})
