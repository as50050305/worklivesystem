import { describe, expect, it } from 'vitest'
import { lineSubtotal, missingVariables, quoteNumber, quoteTotals, renderContract, roundMoney, wonProjectName } from './quotes'
import { wrapText } from './textWrap'

const L = (quantity: number, unit_price: number, manual?: number) => ({ quantity, unit_price, subtotal: manual ?? 0, subtotal_is_manual: manual !== undefined })

describe('報價計算', () => {
  it('TWD 取整數、USD 兩位小數', () => {
    expect(roundMoney(1234.5, 'TWD')).toBe(1235)
    expect(roundMoney(0.1 + 0.2, 'USD')).toBe(0.3)
  })
  it('小計 = 數量 × 單價；手動覆寫沿用', () => {
    expect(lineSubtotal(L(3, 1500), 'TWD')).toBe(4500)
    expect(lineSubtotal(L(3, 1500, 4000), 'TWD')).toBe(4000)
    expect(lineSubtotal({ quantity: '2.5', unit_price: '99.99', subtotal: 0, subtotal_is_manual: false }, 'USD')).toBe(249.98)
  })
  it('總額 = 小計合計 + 稅；訂金與尾款', () => {
    const t = quoteTotals({ currency: 'TWD', tax_percent: 5, deposit_percent: 30, total: 0, total_is_manual: false }, [L(1, 30000), L(2, 7500), L(1, 0, 5000)])
    expect(t).toEqual({ itemsSum: 50000, tax: 2500, autoTotal: 52500, total: 52500, deposit: 15750, balance: 36750 })
  })
  it('總額手動覆寫：訂金依手動總額計算', () => {
    const t = quoteTotals({ currency: 'TWD', tax_percent: 5, deposit_percent: 50, total: 50000, total_is_manual: true }, [L(1, 30000)])
    expect(t.autoTotal).toBe(31500)
    expect(t.total).toBe(50000)
    expect(t.deposit).toBe(25000)
  })
  it('無品項', () => expect(quoteTotals({ currency: 'TWD', tax_percent: 0, deposit_percent: null, total: 0, total_is_manual: false }, []).total).toBe(0))
  it('報價單號', () => expect(quoteNumber('C001', 2)).toBe('C001-V2'))
})

describe('合約變數', () => {
  const tpl = '委託方：{{客戶名稱}}\n總額 {{ 總額 }} 元，訂金 {{訂金比例}}%，授權：{{授權範圍}}'
  it('取代變數（允許空白）', () => {
    expect(renderContract(tpl, { 客戶名稱: '日日好食', 總額: '52,500', 訂金比例: '30', 授權範圍: '包裝使用 3 年' })).toBe('委託方：日日好食\n總額 52,500 元，訂金 30%，授權：包裝使用 3 年')
  })
  it('缺少的變數保留原樣並列出', () => {
    expect(renderContract(tpl, { 客戶名稱: 'A' })).toContain('{{ 總額 }}')
    expect(missingVariables(tpl, { 客戶名稱: 'A', 總額: '' })).toEqual(['總額', '訂金比例', '授權範圍'])
  })
})

describe('A-7 自動建立專案名稱', () => {
  it('品牌＋品項', () => expect(wonProjectName('日日好食', ['包裝插畫'])).toBe('日日好食 包裝插畫'))
  it('多品項取第一個加「等」', () => expect(wonProjectName('日日好食', ['包裝插畫', '社群圖'])).toBe('日日好食 包裝插畫 等'))
  it('沒有品項只用品牌', () => expect(wonProjectName('日日好食', ['  '])).toBe('日日好食'))
})

describe('PDF 換行', () => {
  const m = (s: string) => [...s].length // 每字寬 1
  it('中文逐字斷行', () => expect(wrapText('一二三四五六七', 3, m)).toEqual(['一二三', '四五六', '七']))
  it('英文以單字斷行', () => expect(wrapText('hello world foo', 11, m)).toEqual(['hello world', 'foo']))
  it('避頭標點黏在上一行', () => expect(wrapText('一二三。四五', 3, m)).toEqual(['一二三。', '四五']))
  it('保留換行與空行', () => expect(wrapText('甲\n\n乙', 5, m)).toEqual(['甲', '', '乙']))
  it('過長單字逐字切', () => expect(wrapText('abcdefgh', 3, m)).toEqual(['abc', 'def', 'gh']))
})

describe('報價方資料與合約變數', () => {
  it('businessFrom 補預設值、轉數字', async () => {
    const { businessFrom } = await import('./quotes')
    const b = businessFrom({ business: { name: '小明', default_tax_percent: '0', default_revision_count: '' } })
    expect(b.name).toBe('小明')
    expect(b.default_tax_percent).toBe(0)
    expect(b.default_revision_count).toBeNull()
    expect(b.default_deposit_percent).toBe(30)
    expect(businessFrom(undefined).default_currency).toBe('TWD')
  })
  it('contractValues：金額格式、空值不代入', async () => {
    const { contractValues, renderContract } = await import('./quotes')
    const v = contractValues({
      clientName: '日日好食', quoteNumber: 'C001-V2', version: 2, currency: 'TWD', total: 52500, deposit: 15750, depositPercent: 30,
      licenseScope: ' ', revisionCount: 2, deliveryTerms: null, myName: '', today: '2026-10-28',
    })
    expect(v.總額).toBe('52,500')
    expect(v.今天).toBe('2026/10/28')
    expect(renderContract('{{客戶名稱}} {{總額}} {{授權範圍}} {{我的名稱}} {{訂金比例}}%', v)).toBe('日日好食 52,500 {{授權範圍}} {{我的名稱}} 30%')
  })
})
