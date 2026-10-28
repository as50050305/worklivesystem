/** 全文搜尋：以空白分隔的多個關鍵字需全部出現在文字中（不分大小寫） */
export function matchesAll(haystack: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const h = haystack.toLowerCase()
  return words.every((w) => h.includes(w))
}
