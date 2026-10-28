/**
 * 以 HarfBuzz（WebAssembly）把中文字型切成「只含用到的字」的子集。
 * pdf-lib 內建的子集化對中文字型會掉字，所以先在這裡切好，再以 subset:false 嵌入。
 * 7MB 的字型切完通常只剩數十 KB。
 */

interface HbExports {
  memory: WebAssembly.Memory
  malloc(n: number): number
  free(p: number): void
  hb_blob_create(data: number, len: number, mode: number, user: number, destroy: number): number
  hb_blob_destroy(b: number): void
  hb_blob_get_data(b: number, lenPtr: number): number
  hb_blob_get_length(b: number): number
  hb_face_create(blob: number, index: number): number
  hb_face_destroy(f: number): void
  hb_face_reference_blob(f: number): number
  hb_subset_input_create_or_fail(): number
  hb_subset_input_unicode_set(input: number): number
  hb_subset_input_destroy(input: number): void
  hb_set_add(set: number, cp: number): void
  hb_subset_input_set(input: number, which: number): number
  hb_subset_or_fail(face: number, input: number): number
}

const tagOf = (t: string) => ((t.charCodeAt(0) << 24) | (t.charCodeAt(1) << 16) | (t.charCodeAt(2) << 8) | t.charCodeAt(3)) >>> 0

export type Subsetter = (font: Uint8Array, text: string) => Uint8Array

export async function createSubsetter(wasm: BufferSource): Promise<Subsetter> {
  const mod = await WebAssembly.compile(wasm)
  // 目前版本不需要任何 import；保險起見提供空函式
  const stub = () => 0
  const imports: WebAssembly.Imports = {}
  for (const imp of WebAssembly.Module.imports(mod)) {
    imports[imp.module] ??= {}
    if (imp.kind === 'function') (imports[imp.module] as Record<string, unknown>)[imp.name] = stub
  }
  const instance = await WebAssembly.instantiate(mod, imports)
  const hb = instance.exports as unknown as HbExports

  return (font, text) => {
    const heap = () => new Uint8Array(hb.memory.buffer)
    const fp = hb.malloc(font.byteLength)
    if (!fp) throw new Error('字型處理失敗：記憶體不足')
    heap().set(font, fp)
    const blob = hb.hb_blob_create(fp, font.byteLength, 2 /* writable */, 0, 0)
    const face = hb.hb_face_create(blob, 0)
    hb.hb_blob_destroy(blob)
    const input = hb.hb_subset_input_create_or_fail()
    const set = hb.hb_subset_input_unicode_set(input)
    for (const ch of new Set(text)) hb.hb_set_add(set, ch.codePointAt(0)!)
    // 移除 GSUB／GPOS：PDF 只用橫排基本字形；保留的話 fontkit 會對英數套用替代字形，
    // 造成 PDF 寬度表與字形不符（例如「C001」字距變寬）
    const drop = hb.hb_subset_input_set(input, 3 /* HB_SUBSET_SETS_DROP_TABLE_TAG */)
    for (const tag of ['GSUB', 'GPOS']) hb.hb_set_add(drop, tagOf(tag))
    const sub = hb.hb_subset_or_fail(face, input)
    hb.hb_subset_input_destroy(input)
    if (!sub) {
      hb.hb_face_destroy(face)
      hb.free(fp)
      throw new Error('字型處理失敗')
    }
    const rb = hb.hb_face_reference_blob(sub)
    const off = hb.hb_blob_get_data(rb, 0)
    const len = hb.hb_blob_get_length(rb)
    const out = heap().slice(off, off + len)
    hb.hb_blob_destroy(rb)
    hb.hb_face_destroy(sub)
    hb.hb_face_destroy(face)
    hb.free(fp)
    return out
  }
}
