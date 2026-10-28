/**
 * PDF 產生（瀏覽器端）。整個資料夾以動態 import 載入，平常不會下載。
 * - 字型：/fonts/NotoSansTC-Regular.ttf（SIL OFL），第一次使用時下載並由 Service Worker 快取
 * - 子集化：HarfBuzz WebAssembly
 */
import wasmUrl from 'harfbuzzjs/dist/harfbuzz-subset.wasm?url'
import { makeContractPdf, type ContractPdfData } from './contractPdf'
import { makeQuotePdf, type QuotePdfData } from './quotePdf'
import { createSubsetter } from './subset'
import type { PdfAssets } from './writer'

export type { ContractPdfData, QuotePdfData }

const FONT_URL = '/fonts/NotoSansTC-Regular.ttf'
let assetsP: Promise<PdfAssets> | null = null

async function fetchBytes(url: string, what: string): Promise<Uint8Array<ArrayBuffer>> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error(`無法下載${what}（第一次產生 PDF 需要連線，之後可離線使用）`)
  }
  if (!res.ok) throw new Error(`無法下載${what}（HTTP ${res.status}）`)
  return new Uint8Array(await res.arrayBuffer())
}

export function loadPdfAssets(): Promise<PdfAssets> {
  assetsP ??= (async () => {
    const [font, wasm] = await Promise.all([fetchBytes(FONT_URL, '中文字型'), fetchBytes(wasmUrl, '字型處理元件')])
    return { font, subset: await createSubsetter(wasm) }
  })().catch((e) => {
    assetsP = null
    throw e
  })
  return assetsP
}

export async function quotePdf(d: QuotePdfData): Promise<Blob> {
  const bytes = await makeQuotePdf(await loadPdfAssets(), d)
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export async function contractPdf(d: ContractPdfData): Promise<Blob> {
  const bytes = await makeContractPdf(await loadPdfAssets(), d)
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** 觸發下載；檔名移除 Windows 不允許的字元 */
export function downloadBlob(blob: Blob, fileName: string) {
  const name = fileName.replace(/[\\/:*?"<>|]+/g, '_')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
