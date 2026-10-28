import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { wrapText } from '@/lib/textWrap'
import type { Subsetter } from './subset'

export interface PdfAssets {
  /** 完整字型（Noto Sans TC） */
  font: Uint8Array
  subset: Subsetter
}

/** A4（pt） */
export const PAGE_W = 595.28
export const PAGE_H = 841.89
export const MARGIN_X = 56
export const MARGIN_TOP = 60
export const MARGIN_BOTTOM = 64
export const CONTENT_W = PAGE_W - MARGIN_X * 2

/** 列印用色：深墨＋細線，強調色用淺色主題的主色深綠 */
export const INK = rgb(0.118, 0.137, 0.129)
export const MUTED = rgb(0.3, 0.333, 0.318)
export const FAINT = rgb(0.54, 0.576, 0.553)
export const ACCENT = rgb(0.075, 0.451, 0.353)
export const LINE = rgb(0.17, 0.19, 0.18)
export const SOFT = rgb(0.71, 0.737, 0.694)

/** 永遠放進字型子集的字：英數、常用標點、頁碼 */
const BASE_CHARS =
  Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') + '，。、；：！？（）「」『』【】《》—–…・／％＋－×＝　＿頁第共'

export interface TextOpts {
  size?: number
  color?: RGB
  x?: number
  align?: 'left' | 'right' | 'center'
  /** align 為 right／center 時的對齊寬度 */
  width?: number
}

export interface ParagraphOpts {
  size?: number
  color?: RGB
  x?: number
  width?: number
  lineHeight?: number
}

const clean = (s: string) => s.replace(/\t/g, '    ').replace(/[\u0000-\u0008\u000b-\u001f]/g, '')

/**
 * 簡易排版器：由上往下排，空間不足自動換頁，結束時補頁碼
 * charset：會出現在文件裡的所有文字（用來切字型子集）
 */
export class PdfWriter {
  readonly doc: PDFDocument
  readonly font: PDFFont
  page!: PDFPage
  y = 0
  private onNewPage?: (w: PdfWriter) => void

  private constructor(doc: PDFDocument, font: PDFFont) {
    this.doc = doc
    this.font = font
  }

  static async create(assets: PdfAssets, charset: string, meta: { title: string; author?: string }): Promise<PdfWriter> {
    const doc = await PDFDocument.create()
    doc.registerFontkit(fontkit)
    const subset = assets.subset(assets.font, BASE_CHARS + clean(charset))
    const font = await doc.embedFont(subset, { subset: false })
    doc.setTitle(meta.title)
    if (meta.author) doc.setAuthor(meta.author)
    doc.setCreator('工作生活規劃')
    doc.setProducer('工作生活規劃')
    doc.setLanguage('zh-TW')
    const w = new PdfWriter(doc, font)
    w.newPage()
    return w
  }

  /** 每頁開頭要畫的東西（例如續頁表頭） */
  setPageHeader(fn: ((w: PdfWriter) => void) | undefined) {
    this.onNewPage = fn
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.y = PAGE_H - MARGIN_TOP
    this.onNewPage?.(this)
  }

  /** 剩餘空間不足 h 時換頁 */
  ensure(h: number) {
    if (this.y - h < MARGIN_BOTTOM) this.newPage()
  }

  measure(s: string, size: number) {
    return this.font.widthOfTextAtSize(clean(s), size)
  }

  /** 在目前 y（基線）畫一行字，不移動 y */
  text(s: string, o: TextOpts = {}) {
    const size = o.size ?? 10
    const str = clean(s)
    let x = o.x ?? MARGIN_X
    if (o.align && o.align !== 'left') {
      const w = this.measure(str, size)
      const box = o.width ?? CONTENT_W
      x = o.align === 'right' ? x + box - w : x + (box - w) / 2
    }
    this.page.drawText(str, { x, y: this.y, size, font: this.font, color: o.color ?? INK })
  }

  /** 自動換行段落，逐行換頁；回傳使用的行數 */
  paragraph(s: string, o: ParagraphOpts = {}): number {
    const size = o.size ?? 10
    const lh = o.lineHeight ?? size * 1.7
    const x = o.x ?? MARGIN_X
    const width = o.width ?? CONTENT_W - (x - MARGIN_X)
    const lines = this.wrap(s, width, size)
    for (const line of lines) {
      this.ensure(lh)
      this.y -= lh
      if (line) this.text(line, { size, color: o.color, x })
    }
    return lines.length
  }

  wrap(s: string, width: number, size: number): string[] {
    return wrapText(clean(s), width, (t) => this.measure(t, size))
  }

  gap(h: number) {
    this.y -= h
  }

  hr(o: { color?: RGB; dashed?: boolean; thickness?: number; x?: number; width?: number } = {}) {
    const x = o.x ?? MARGIN_X
    this.page.drawLine({
      start: { x, y: this.y },
      end: { x: x + (o.width ?? CONTENT_W), y: this.y },
      thickness: o.thickness ?? 0.6,
      color: o.color ?? LINE,
      dashArray: o.dashed ? [2, 2] : undefined,
    })
  }

  rect(x: number, y: number, w: number, h: number, o: { border?: RGB; fill?: RGB; thickness?: number } = {}) {
    this.page.drawRectangle({ x, y, width: w, height: h, borderColor: o.border, borderWidth: o.border ? (o.thickness ?? 0.6) : 0, color: o.fill })
  }

  /** 每頁底部：左側文字＋右側頁碼「1 / 3」 */
  async finish(footerLeft: string): Promise<Uint8Array> {
    const pages = this.doc.getPages()
    pages.forEach((p, i) => {
      const y = MARGIN_BOTTOM - 28
      p.drawLine({ start: { x: MARGIN_X, y: y + 12 }, end: { x: PAGE_W - MARGIN_X, y: y + 12 }, thickness: 0.4, color: SOFT })
      p.drawText(clean(footerLeft), { x: MARGIN_X, y, size: 7.5, font: this.font, color: FAINT })
      const num = `${i + 1} / ${pages.length}`
      p.drawText(num, { x: PAGE_W - MARGIN_X - this.measure(num, 7.5), y, size: 7.5, font: this.font, color: FAINT })
    })
    return this.doc.save()
  }
}
