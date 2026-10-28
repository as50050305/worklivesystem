import { ACCENT, CONTENT_W, FAINT, LINE, MARGIN_X, MUTED, PdfWriter, SOFT, type PdfAssets } from './writer'

export interface QuotePdfParty {
  name: string
  lines: string[]
}

export interface QuotePdfData {
  number: string
  issuedOn: string
  title: string | null
  projectName: string | null
  currency: string
  me: QuotePdfParty
  client: QuotePdfParty | null
  lines: { name: string; quantity: string; unitPrice: string; subtotal: string }[]
  /** [標籤, 金額]；最後一列以外為一般列 */
  summary: { label: string; value: string; strong?: boolean }[]
  terms: { label: string; value: string }[]
  bank: string | null
  note: string | null
}

/** 品項表欄位寬度（pt） */
const COL = { no: 26, qty: 54, price: 92, sub: 100 }
const NAME_W = CONTENT_W - COL.no - COL.qty - COL.price - COL.sub

function allText(d: QuotePdfData): string {
  return [
    d.number, d.issuedOn, d.title, d.projectName, d.currency, d.me.name, ...d.me.lines,
    d.client?.name, ...(d.client?.lines ?? []),
    ...d.lines.flatMap((l) => [l.name, l.quantity, l.unitPrice, l.subtotal]),
    ...d.summary.flatMap((s) => [s.label, s.value]), ...d.terms.flatMap((t) => [t.label, t.value]),
    d.bank, d.note,
    'QUOTATION 報價單 報價單號 日期 專案 客戶 報價方 品項 數量 單價 小計 條款 匯款資訊 備註 續 幣別 本報價單',
  ].filter(Boolean).join('')
}

function party(w: PdfWriter, label: string, p: QuotePdfParty, x: number, width: number, top: number): number {
  w.y = top
  w.y -= 10
  w.text(label, { x, size: 8, color: ACCENT })
  for (const l of w.wrap(p.name, width, 12.5)) {
    w.y -= 18
    w.text(l, { x, size: 12.5 })
  }
  for (const line of p.lines.filter(Boolean)) {
    for (const l of w.wrap(line, width, 9)) {
      w.y -= 14
      w.text(l, { x, size: 9, color: MUTED })
    }
  }
  return w.y
}

function tableHeader(w: PdfWriter) {
  w.gap(6)
  w.hr({ thickness: 0.9 })
  w.y -= 15
  const s = { size: 8.5, color: MUTED }
  let x = MARGIN_X
  w.text('#', { ...s, x: x + 2 })
  x += COL.no
  w.text('品項', { ...s, x })
  x += NAME_W
  w.text('數量', { ...s, x, align: 'right', width: COL.qty })
  x += COL.qty
  w.text('單價', { ...s, x, align: 'right', width: COL.price })
  x += COL.price
  w.text('小計', { ...s, x, align: 'right', width: COL.sub })
  w.y -= 8
  w.hr({ thickness: 0.6 })
}

export async function makeQuotePdf(assets: PdfAssets, d: QuotePdfData): Promise<Uint8Array> {
  const w = await PdfWriter.create(assets, allText(d), { title: `報價單 ${d.number}`, author: d.me.name })

  /* ---- 抬頭 ---- */
  w.y -= 4
  w.text('QUOTATION', { size: 8.5, color: ACCENT })
  w.text(`報價單號  ${d.number}`, { size: 9, color: MUTED, align: 'right' })
  w.y -= 30
  w.text('報價單', { size: 26 })
  w.text(`日期  ${d.issuedOn}`, { size: 9, color: MUTED, align: 'right' })
  w.y -= 16
  w.text(`幣別  ${d.currency}`, { size: 9, color: MUTED, align: 'right' })
  w.y -= 12
  w.hr({ thickness: 1.2 })

  /* ---- 雙方 ---- */
  const half = (CONTENT_W - 24) / 2
  const top = w.y - 6
  const yA = d.client ? party(w, '客戶', d.client, MARGIN_X, half, top) : top
  const yB = party(w, '報價方', d.me, MARGIN_X + half + 24, half, top)
  w.y = Math.min(yA, yB) - 16

  if (d.title || d.projectName) {
    w.hr({ dashed: true, color: SOFT })
    if (d.title) w.paragraph(d.title, { size: 11 })
    if (d.projectName) w.paragraph(`專案：${d.projectName}`, { size: 9, color: MUTED, lineHeight: 15 })
    w.gap(6)
  }

  /* ---- 品項表 ---- */
  w.ensure(60)
  tableHeader(w)
  w.setPageHeader((pw) => {
    pw.y -= 4
    pw.text(`報價單 ${d.number}（續）`, { size: 9, color: MUTED })
    pw.y -= 6
    tableHeader(pw)
  })
  d.lines.forEach((l, i) => {
    const nameLines = w.wrap(l.name || '—', NAME_W - 10, 10)
    const lh = 15
    w.ensure(nameLines.length * lh + 12)
    w.y -= 18
    const rowTop = w.y
    let x = MARGIN_X
    w.text(String(i + 1), { x: x + 2, size: 9, color: FAINT })
    x += COL.no
    nameLines.forEach((nl, j) => {
      w.y = rowTop - j * lh
      w.text(nl, { x, size: 10 })
    })
    w.y = rowTop
    x += NAME_W
    w.text(l.quantity, { x, size: 10, align: 'right', width: COL.qty })
    x += COL.qty
    w.text(l.unitPrice, { x, size: 10, align: 'right', width: COL.price })
    x += COL.price
    w.text(l.subtotal, { x, size: 10, align: 'right', width: COL.sub })
    w.y = rowTop - (nameLines.length - 1) * lh - 9
    w.hr({ dashed: true, color: SOFT })
  })
  if (!d.lines.length) {
    w.y -= 18
    w.text('（尚無品項）', { x: MARGIN_X + COL.no, size: 10, color: FAINT })
    w.y -= 9
  }
  w.setPageHeader(undefined)

  /* ---- 合計 ---- */
  const boxW = 230
  const boxX = MARGIN_X + CONTENT_W - boxW
  w.ensure(d.summary.length * 20 + 20)
  w.gap(6)
  for (const s of d.summary) {
    if (s.strong) {
      w.y -= 8
      w.hr({ x: boxX, width: boxW, thickness: 0.9 })
      w.y -= 20
      w.text(s.label, { x: boxX, size: 11 })
      w.text(s.value, { x: boxX, width: boxW, size: 15, color: ACCENT, align: 'right' })
      w.y -= 10
      w.hr({ x: boxX, width: boxW, thickness: 0.9 })
    } else {
      w.y -= 18
      w.text(s.label, { x: boxX, size: 9.5, color: MUTED })
      w.text(s.value, { x: boxX, width: boxW, size: 10, align: 'right' })
    }
  }
  w.gap(18)

  /* ---- 條款 ---- */
  const terms = d.terms.filter((t) => t.value.trim())
  if (terms.length) {
    w.ensure(50)
    w.y -= 6
    w.text('條款', { size: 8.5, color: ACCENT })
    w.y -= 8
    w.hr({ color: LINE, thickness: 0.6 })
    const labelW = 72
    for (const t of terms) {
      const lines = w.wrap(t.value, CONTENT_W - labelW, 9.5)
      w.ensure(lines.length * 15 + 8)
      w.y -= 17
      const top2 = w.y
      w.text(t.label, { size: 9, color: MUTED })
      lines.forEach((l, i) => {
        w.y = top2 - i * 15
        if (l) w.text(l, { x: MARGIN_X + labelW, size: 9.5 })
      })
      w.y -= 6
      w.hr({ dashed: true, color: SOFT })
    }
    w.gap(12)
  }

  for (const [label, body] of [
    ['匯款資訊', d.bank],
    ['備註', d.note],
  ] as const) {
    if (!body?.trim()) continue
    w.ensure(50)
    w.y -= 6
    w.text(label, { size: 8.5, color: ACCENT })
    w.y -= 4
    w.paragraph(body, { size: 9.5, lineHeight: 15 })
    w.gap(12)
  }

  return w.finish(`${d.me.name}　報價單 ${d.number}`)
}
