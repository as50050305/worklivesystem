import { ACCENT, CONTENT_W, MARGIN_X, MUTED, PdfWriter, type PdfAssets } from './writer'

export interface ContractPdfData {
  title: string
  body: string
  /** 頁尾左側文字，例如「C001-V2 插畫委託合約」 */
  footer: string
  author?: string
}

/** 「一、」「二、」開頭的行視為條款標題 */
const SECTION = /^[一二三四五六七八九十百]+、/

/**
 * 合約 PDF：內文第一個非空行當標題（置中放大），其餘依原文換行排版
 * 內文已是使用者確認過的最終文字（變數已代入）
 */
export async function makeContractPdf(assets: PdfAssets, d: ContractPdfData): Promise<Uint8Array> {
  const w = await PdfWriter.create(assets, d.title + d.body + d.footer, { title: d.title, author: d.author })
  const lines = d.body.replace(/\r\n?/g, '\n').split('\n')
  const firstIdx = lines.findIndex((l) => l.trim())
  const heading = firstIdx >= 0 ? lines[firstIdx]!.trim() : d.title
  const rest = firstIdx >= 0 ? lines.slice(firstIdx + 1) : lines

  w.y -= 8
  w.text('CONTRACT', { size: 8, color: ACCENT, align: 'center' })
  for (const l of w.wrap(heading, CONTENT_W, 19)) {
    w.y -= 30
    w.text(l, { size: 19, align: 'center' })
  }
  w.y -= 14
  w.hr({ thickness: 1.1, x: MARGIN_X + CONTENT_W / 2 - 60, width: 120 })
  w.gap(14)

  // 移除開頭空行
  while (rest.length && !rest[0]!.trim()) rest.shift()
  for (const raw of rest) {
    const line = raw.replace(/\s+$/, '')
    if (!line) {
      w.gap(8)
      continue
    }
    if (SECTION.test(line.trim())) {
      w.ensure(48)
      w.gap(6)
      w.paragraph(line.trim(), { size: 11.5, lineHeight: 22 })
      continue
    }
    w.paragraph(line, { size: 10.5, lineHeight: 19, color: line.startsWith('（') ? MUTED : undefined })
  }
  return w.finish(d.footer)
}
