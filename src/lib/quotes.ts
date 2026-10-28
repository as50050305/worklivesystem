/**
 * 報價單與合約（純函式）
 * - 小計 = 數量 × 單價（可手動覆寫）
 * - 總額 = 小計合計 + 稅（可手動覆寫）
 * - TWD／JPY 取整數，其餘幣別取到小數 2 位
 * - 合約變數 {{客戶名稱}} {{總額}} …
 */

export function decimalsOf(currency: string): number {
  return currency === 'TWD' || currency === 'JPY' ? 0 : 2
}

export function roundMoney(n: number, currency: string): number {
  const f = 10 ** decimalsOf(currency)
  return Math.round((n + Number.EPSILON) * f) / f
}

export interface LineLike {
  quantity: number | string
  unit_price: number | string
  subtotal: number | string
  subtotal_is_manual: boolean
}

/** 單一品項小計（手動覆寫時沿用已存的值） */
export function lineSubtotal(l: LineLike, currency: string): number {
  if (l.subtotal_is_manual) return Number(l.subtotal)
  return roundMoney(Number(l.quantity) * Number(l.unit_price), currency)
}

export interface QuoteLike {
  currency: string
  tax_percent: number | string
  deposit_percent: number | string | null
  total: number | string
  total_is_manual: boolean
}

export interface QuoteTotals {
  itemsSum: number
  tax: number
  autoTotal: number
  /** 實際總額（手動覆寫時為手動值） */
  total: number
  deposit: number
  balance: number
}

export function quoteTotals(q: QuoteLike, lines: LineLike[]): QuoteTotals {
  const c = q.currency
  const itemsSum = roundMoney(lines.reduce((s, l) => s + lineSubtotal(l, c), 0), c)
  const tax = roundMoney((itemsSum * Number(q.tax_percent || 0)) / 100, c)
  const autoTotal = roundMoney(itemsSum + tax, c)
  const total = q.total_is_manual ? Number(q.total) : autoTotal
  const deposit = roundMoney((total * Number(q.deposit_percent || 0)) / 100, c)
  return { itemsSum, tax, autoTotal, total, deposit, balance: roundMoney(total - deposit, c) }
}

export function formatAmount(n: number, currency: string): string {
  const d = decimalsOf(currency)
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** 報價單編號：客戶編號-V版本，例如 C001-V2 */
export function quoteNumber(clientCode: string | null | undefined, version: number): string {
  return `${clientCode || 'Q'}-V${version}`
}

/* ---------------- 合約 ---------------- */

export const CONTRACT_VARIABLES = ['客戶名稱', '總額', '授權範圍', '修改次數', '交期', '訂金比例', '訂金金額', '報價版本', '報價單號', '我的名稱', '今天'] as const
export type ContractVariable = (typeof CONTRACT_VARIABLES)[number]

/** 以 {{變數}} 取代；未提供的變數保留原樣，方便使用者看出缺什麼 */
export function renderContract(template: string, values: Partial<Record<ContractVariable, string>>): string {
  return template.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (all, name: string) => {
    const v = values[name as ContractVariable]
    return v === undefined || v === '' ? all : v
  })
}

/** 範本中尚未有值的變數（預覽時提示） */
export function missingVariables(template: string, values: Partial<Record<ContractVariable, string>>): string[] {
  const out = new Set<string>()
  for (const m of template.matchAll(/\{\{\s*([^{}\s]+)\s*\}\}/g)) {
    const v = values[m[1] as ContractVariable]
    if (v === undefined || v === '') out.add(m[1]!)
  }
  return [...out]
}

/* ---------------- 規則 A-7 ---------------- */

/** 成交自動建立專案的名稱：「品牌名稱 品項」；多個品項時取第一個並加「等」 */
export function wonProjectName(brand: string, itemNames: string[]): string {
  const items = itemNames.map((s) => s.trim()).filter(Boolean)
  if (!items.length) return brand
  return `${brand} ${items[0]}${items.length > 1 ? ' 等' : ''}`
}

/* ---------------- 報價方資料 ---------------- */

export interface BusinessProfileLike {
  name: string
  email: string
  phone: string
  address: string
  bank: string
  default_currency: string
  default_tax_percent: number
  default_deposit_percent: number
  default_revision_count: number | null
  default_license_scope: string
  default_delivery_terms: string
  default_note: string
}

export const DEFAULT_BUSINESS: BusinessProfileLike = {
  name: '',
  email: '',
  phone: '',
  address: '',
  bank: '',
  default_currency: 'TWD',
  default_tax_percent: 5,
  default_deposit_percent: 30,
  default_revision_count: 2,
  default_license_scope: '',
  default_delivery_terms: '',
  default_note: '本報價單有效期限 30 天。',
}

/** 從 app_settings.preferences 取出報價方資料，缺的欄位補預設值 */
export function businessFrom(preferences: Record<string, unknown> | null | undefined): BusinessProfileLike {
  const raw = (preferences?.business ?? {}) as Partial<BusinessProfileLike>
  const out = { ...DEFAULT_BUSINESS }
  for (const k of Object.keys(DEFAULT_BUSINESS) as (keyof BusinessProfileLike)[]) {
    const v = raw[k]
    if (v === undefined) continue
    if (k === 'default_revision_count') {
      const n = Number(v)
      out.default_revision_count = v === null || v === '' || !Number.isFinite(n) ? null : n
    } else if (typeof DEFAULT_BUSINESS[k] === 'number') {
      const n = Number(v)
      if (Number.isFinite(n)) (out as Record<string, unknown>)[k] = n
    } else {
      ;(out as Record<string, unknown>)[k] = String(v ?? '')
    }
  }
  return out
}

/* ---------------- 合約變數值 ---------------- */

export interface ContractSource {
  clientName: string | null
  quoteNumber: string
  version: number
  currency: string
  total: number
  deposit: number
  depositPercent: number | null
  licenseScope: string | null
  revisionCount: number | null
  deliveryTerms: string | null
  myName: string
  today: string
}

/** 由報價單產生合約變數值（金額依幣別格式化，日期 YYYY/MM/DD） */
export function contractValues(s: ContractSource): Partial<Record<ContractVariable, string>> {
  const v: Partial<Record<ContractVariable, string>> = {
    總額: formatAmount(s.total, s.currency),
    訂金金額: formatAmount(s.deposit, s.currency),
    報價版本: `V${s.version}`,
    報價單號: s.quoteNumber,
    今天: s.today.replaceAll('-', '/'),
  }
  if (s.clientName) v.客戶名稱 = s.clientName
  if (s.depositPercent !== null) v.訂金比例 = String(Number(s.depositPercent))
  if (s.licenseScope?.trim()) v.授權範圍 = s.licenseScope.trim()
  if (s.revisionCount !== null) v.修改次數 = String(s.revisionCount)
  if (s.deliveryTerms?.trim()) v.交期 = s.deliveryTerms.trim()
  if (s.myName.trim()) v.我的名稱 = s.myName.trim()
  return v
}
