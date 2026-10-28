import type { Client, Project, Quote, QuoteLine } from '@/data/types'
import { formatDate } from '@/lib/dates'
import { formatAmount, lineSubtotal, quoteTotals, type BusinessProfileLike } from '@/lib/quotes'
import type { QuotePdfData } from '@/pdf'
import { quoteNo } from './shared'

const pct = (n: number | null) => `${Number(n ?? 0)}%`

export function buildQuotePdfData(q: Quote, lines: QuoteLine[], client: Client | null, project: Project | null, me: BusinessProfileLike): QuotePdfData {
  const c = q.currency
  const t = quoteTotals(q, lines)
  const summary: QuotePdfData['summary'] = [{ label: '小計', value: formatAmount(t.itemsSum, c) }]
  if (Number(q.tax_percent)) summary.push({ label: `稅 ${pct(q.tax_percent)}`, value: formatAmount(t.tax, c) })
  summary.push({ label: '總額', value: `${c === 'TWD' ? 'NT$' : c} ${formatAmount(t.total, c)}`, strong: true })
  if (q.deposit_percent !== null && Number(q.deposit_percent) > 0) {
    summary.push({ label: `訂金 ${pct(q.deposit_percent)}`, value: formatAmount(t.deposit, c) })
    summary.push({ label: '尾款', value: formatAmount(t.balance, c) })
  }
  return {
    number: quoteNo(q, client),
    issuedOn: formatDate(q.issued_on),
    title: q.title,
    projectName: project?.name ?? null,
    currency: c,
    me: { name: me.name || '（請到 設定 → 報價與合約 填寫名稱）', lines: [me.email, me.phone, me.address] },
    client: client ? { name: client.name, lines: [client.code, client.email ?? '', client.phone ?? ''] } : null,
    lines: lines.map((l) => ({
      name: l.item_name,
      quantity: String(Number(l.quantity)),
      unitPrice: formatAmount(Number(l.unit_price), c),
      subtotal: formatAmount(lineSubtotal(l, c), c),
    })),
    summary,
    terms: [
      { label: '授權範圍', value: q.license_scope ?? '' },
      { label: '修改次數', value: q.revision_count !== null ? `${q.revision_count} 次` : '' },
      { label: '交期', value: q.delivery_terms ?? '' },
    ],
    bank: me.bank || null,
    note: q.note,
  }
}

export function quoteFileName(q: Quote, client: Client | null, kind: '報價單' | '合約'): string {
  return `${kind}_${quoteNo(q, client)}${client ? `_${client.name}` : ''}.pdf`
}
