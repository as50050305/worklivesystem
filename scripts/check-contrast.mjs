// 檢查設計 token 的 WCAG 對比度：node scripts/check-contrast.mjs
const L = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

const themes = {
  dark: {
    bg: '#1E2220', surface: '#303633', surface2: '#3A413D',
    text: '#E8EEEA', text2: '#AFB9B4', line: '#8C9792',
    primary: '#8BE8CB', onPrimary: '#16201C', primaryInk: '#8BE8CB',
    steelInk: '#9DBEC5', lavenderInk: '#AEB2CB', mauveInk: '#C6A6C0',
    danger: '#F28B7D', warning: '#E9C46A',
  },
  light: {
    bg: '#E3E8DE', surface: '#EEF1E9', surface2: '#E2E7DB',
    text: '#1E2321', text2: '#4C5551', line: '#2B302D',
    primary: '#8BE8CB', onPrimary: '#16201C', primaryInk: '#13735A',
    steelInk: '#3B6670', lavenderInk: '#50567A', mauveInk: '#6D4B68',
    danger: '#B23A2E', warning: '#7F5B0A',
  },
  // 初號機配色（data-series="eva"）
  'eva-dark': {
    bg: '#120E1A', surface: '#221A33', surface2: '#2E2445',
    text: '#EEEAF7', text2: '#B9AFD2', line: '#9B88C8',
    primary: '#A6E22E', onPrimary: '#121A04', primaryInk: '#A6E22E',
    steelInk: '#8FD3E0', lavenderInk: '#B9AEF0', mauveInk: '#E0A5D6',
    danger: '#FF7B6E', warning: '#FF9D3C',
  },
  'eva-light': {
    bg: '#E4DFF0', surface: '#F1EEF8', surface2: '#E3DCF1',
    text: '#1C1430', text2: '#4C4268', line: '#2C1F4A',
    primary: '#A6E22E', onPrimary: '#121A04', primaryInk: '#5A2EA6',
    steelInk: '#1F6373', lavenderInk: '#4B3F8F', mauveInk: '#7A3A6E',
    danger: '#B3261E', warning: '#8A4B00',
  },
}
let fail = 0
for (const [name, t] of Object.entries(themes)) {
  const checks = [
    ['text / surface', t.text, t.surface, 4.5], ['text / bg', t.text, t.bg, 4.5],
    ['text2 / surface', t.text2, t.surface, 4.5], ['text2 / bg', t.text2, t.bg, 4.5],
    ['text2 / surface2', t.text2, t.surface2, 4.5],
    ['onPrimary / primary', t.onPrimary, t.primary, 4.5],
    ['primaryInk / surface', t.primaryInk, t.surface, 4.5],
    ['steelInk / surface', t.steelInk, t.surface, 4.5],
    ['lavenderInk / surface', t.lavenderInk, t.surface, 4.5],
    ['mauveInk / surface', t.mauveInk, t.surface, 4.5],
    ['danger / surface', t.danger, t.surface, 4.5],
    ['warning / surface', t.warning, t.surface, 4.5],
    ['line / surface (非文字 3:1)', t.line, t.surface, 3], ['line / bg (非文字 3:1)', t.line, t.bg, 3],
  ]
  console.log(`\n[${name}]`)
  for (const [label, a, b, min] of checks) {
    const r = ratio(a, b); const ok = r >= min; if (!ok) fail++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}  ≥${min}  ${label}`)
  }
}
// 原始品牌色作為文字在 Gunmetal 上（供參考）
console.log('\n[參考：原色當文字放在 #303633 上]')
for (const c of ['#8BE8CB', '#7EA2AA', '#888DA7', '#9C7A97']) console.log(c, ratio(c, '#303633').toFixed(2))
process.exit(fail ? 1 : 0)
