/**
 * PDF 文字換行（與字型無關，傳入量測函式）
 * - 中日韓文字逐字可斷行
 * - 英數以單字為單位，單字過長才逐字切
 * - 行首避頭標點（，。、；：！？）」』）會往上一行黏
 * - 保留使用者的換行與空行
 */
const NO_LINE_START = new Set('，。、；：！？）」』】》,.;:!?)%'.split(''))

function tokenize(line: string): string[] {
  const tokens: string[] = []
  const re = /[A-Za-z0-9@#$%&+\-_/.:'"]+|\s+|./gsu
  for (const m of line.matchAll(re)) tokens.push(m[0])
  return tokens
}

export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = []
  for (const para of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (para === '') {
      out.push('')
      continue
    }
    let line = ''
    for (const tok of tokenize(para)) {
      const candidate = line + tok
      if (measure(candidate) <= maxWidth) {
        line = candidate
        continue
      }
      // 避頭標點：直接黏在上一行
      if (tok.length === 1 && NO_LINE_START.has(tok) && line) {
        line = candidate
        continue
      }
      if (/^\s+$/.test(tok)) {
        out.push(line)
        line = ''
        continue
      }
      if (line) out.push(line.trimEnd())
      // 單一 token 比整行還寬：逐字切
      if (measure(tok) > maxWidth) {
        let chunk = ''
        for (const ch of tok) {
          if (measure(chunk + ch) > maxWidth && chunk) {
            out.push(chunk)
            chunk = ch
          } else chunk += ch
        }
        line = chunk
      } else {
        line = tok
      }
    }
    out.push(line.trimEnd())
  }
  return out
}
