/** 全文搜尋：以空白分隔的多個關鍵字需全部出現在文字中（不分大小寫） */
export function matchesAll(haystack: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const h = haystack.toLowerCase()
  return words.every((w) => h.includes(w))
}

/* ---------------- 全域搜尋（Ctrl／⌘ + K） ---------------- */

export const SEARCH_GROUPS = ['頁面', '專案', '客戶', '報價單', '人脈', '收藏', '時間軸', '筆記'] as const
export type SearchGroup = (typeof SEARCH_GROUPS)[number]

export interface SearchEntry {
  /** 全域唯一（例如 project:uuid） */
  key: string
  group: SearchGroup
  title: string
  subtitle?: string
  /** 其他可被搜尋但不顯示的文字（例如備註、品項名稱） */
  text?: string
}

export interface SearchSection<E extends SearchEntry> {
  group: SearchGroup
  items: E[]
  /** 符合但沒顯示的筆數 */
  more: number
}

function score(e: SearchEntry, words: string[]): number {
  const title = e.title.toLowerCase()
  const sub = (e.subtitle ?? '').toLowerCase()
  const all = `${title}\n${sub}\n${(e.text ?? '').toLowerCase()}`
  let s = 0
  for (const w of words) {
    if (!all.includes(w)) return -1
    if (title === w) s += 100
    else if (title.startsWith(w)) s += 60
    else if (title.includes(w)) s += 40
    else if (sub.includes(w)) s += 15
    else s += 5
  }
  return s
}

/**
 * 以空白分隔的關鍵字全部符合才列出；依群組固定順序，群組內依相關度排序。
 * 查詢為空時只回傳「頁面」群組。
 */
export function searchEntries<E extends SearchEntry>(entries: E[], query: string, perGroup = 5): SearchSection<E>[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const buckets = new Map<SearchGroup, { e: E; s: number }[]>()
  for (const e of entries) {
    if (!words.length && e.group !== '頁面') continue
    const s = words.length ? score(e, words) : 0
    if (s < 0) continue
    const b = buckets.get(e.group) ?? []
    b.push({ e, s })
    buckets.set(e.group, b)
  }
  const out: SearchSection<E>[] = []
  for (const g of SEARCH_GROUPS) {
    const b = buckets.get(g)
    if (!b?.length) continue
    b.sort((a, c) => c.s - a.s || a.e.title.length - c.e.title.length)
    const limit = !words.length ? Infinity : perGroup
    out.push({ group: g, items: b.slice(0, limit).map((x) => x.e), more: Math.max(0, b.length - limit) })
  }
  return out
}

/** 長文字中擷取關鍵字附近的片段（顯示筆記內容用） */
export function snippet(text: string, query: string, radius = 24): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const w = query.toLowerCase().split(/\s+/).filter(Boolean)[0]
  const i = w ? flat.toLowerCase().indexOf(w) : -1
  if (i < 0) return flat.length > radius * 2 ? flat.slice(0, radius * 2) + '…' : flat
  const start = Math.max(0, i - radius)
  const end = Math.min(flat.length, i + w!.length + radius)
  return (start > 0 ? '…' : '') + flat.slice(start, end) + (end < flat.length ? '…' : '')
}
