/// <reference types="node" />
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { makeContractPdf } from './contractPdf'
import { makeQuotePdf } from './quotePdf'
import { createSubsetter } from './subset'

const fontPath = 'public/fonts/NotoSansTC-Regular.ttf'
const wasmPath = 'node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm'
const out = process.env.PDF_OUT_DIR

async function assets() {
  return { font: new Uint8Array(readFileSync(fontPath)), subset: await createSubsetter(readFileSync(wasmPath)) }
}

describe.skipIf(!existsSync(fontPath))('中文 PDF', () => {
  it('字型子集化：只保留用到的字，大小大幅縮小', async () => {
    const a = await assets()
    const sub = a.subset(a.font, '報價單 ABC 123')
    expect(sub.byteLength).toBeGreaterThan(1000)
    expect(sub.byteLength).toBeLessThan(a.font.byteLength / 50)
  })

  it('報價單：多品項自動換頁，含頁碼', async () => {
    const lines = Array.from({ length: 40 }, (_, i) => ({ name: i === 3 ? '包裝插畫（主視覺＋三款口味延伸，含印刷前完稿與色彩校正）' : `品項 ${i + 1}`, quantity: '1', unitPrice: '12,000', subtotal: '12,000' }))
    const bytes = await makeQuotePdf(await assets(), {
      number: 'C001-V2', issuedOn: '2026/10/28', title: '日日好食 2027 春季包裝', projectName: null, currency: 'TWD',
      me: { name: '王小明插畫工作室', lines: ['hello@example.com', '0912-345-678'] },
      client: { name: '日日好食', lines: ['C001', 'contact@daily.tw'] },
      lines,
      summary: [{ label: '小計', value: '480,000' }, { label: '稅 5%', value: '24,000' }, { label: '總額', value: 'NT$ 504,000', strong: true }, { label: '訂金 30%', value: '151,200' }, { label: '尾款', value: '352,800' }],
      terms: [{ label: '授權範圍', value: '台灣地區包裝與電商使用，授權期間兩年；不含電視廣告。' }, { label: '修改次數', value: '2 次' }, { label: '交期', value: '簽約後 4 週交付初稿' }],
      bank: '台灣銀行 004　帳號 000-000-000000　戶名 王小明', note: '本報價單有效期限 30 天。',
    })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2)
    expect(bytes.byteLength).toBeLessThan(200_000)
    if (out) writeFileSync(`${out}/quote.pdf`, bytes)
  })

  it('合約：標題置中、長內文換頁', async () => {
    const body = '插畫委託合約書\n\n委託方：日日好食（以下簡稱甲方）\n\n一、委託內容\n' + '甲方委託乙方繪製插畫，品項明細詳見報價單。'.repeat(150) + '\n\n二、費用\n1. 本案總額為新臺幣 52,500 元（含稅）。'
    const bytes = await makeContractPdf(await assets(), { title: '插畫委託合約', body, footer: 'C001-V2 插畫委託合約' })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2)
    if (out) writeFileSync(`${out}/contract.pdf`, bytes)
  })
})
