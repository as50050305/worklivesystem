import { lineSubtotal, quoteTotals } from '@/lib/quotes'
import { getSupabase } from '@/lib/supabase'
import type { Contract, ContractTemplate, Quote, QuoteInput, QuoteItem, QuoteLine, QuoteLineInput } from '../types'

const num = <T extends object>(row: T, keys: (keyof T)[]): T => {
  const out = { ...row }
  for (const k of keys) if (out[k] !== null && out[k] !== undefined) (out as Record<keyof T, unknown>)[k] = Number(out[k])
  return out
}
const toQuote = (r: Quote) => num(r, ['total', 'tax_percent', 'deposit_percent'])
const toLine = (r: QuoteLine) => num(r, ['quantity', 'unit_price', 'subtotal'])

export const quotesRepo = {
  async list(): Promise<Quote[]> {
    const { data, error } = await getSupabase().from('quotes').select('*').order('issued_on', { ascending: false }).order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as Quote[]).map(toQuote)
  },
  async get(id: string): Promise<Quote | null> {
    const { data, error } = await getSupabase().from('quotes').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? toQuote(data as Quote) : null
  },
  /** 版本由資料庫依「客戶＋專案」自動遞增 */
  async create(input: QuoteInput): Promise<Quote> {
    const { data, error } = await getSupabase().from('quotes').insert(input).select().single()
    if (error) throw error
    return toQuote(data as Quote)
  },
  async update(id: string, patch: QuoteInput): Promise<Quote> {
    const { data, error } = await getSupabase().from('quotes').update(patch).eq('id', id).select().single()
    if (error) throw error
    return toQuote(data as Quote)
  },
  async remove(id: string): Promise<void> {
    const { error } = await getSupabase().from('quotes').delete().eq('id', id)
    if (error) throw error
  },

  /** 複製為新版本：條件與品項全部帶過去，狀態改回草稿、日期改為今天 */
  async copyAsNewVersion(id: string, today: string, draftStatusId: string | null): Promise<Quote> {
    const src = await quotesRepo.get(id)
    if (!src) throw new Error('找不到原報價單')
    const lines = await quotesRepo.listLines(id)
    const { id: _id, user_id: _u, version: _v, created_at: _c, updated_at: _up, ...rest } = src
    const copy = await quotesRepo.create({ ...rest, copied_from_id: id, issued_on: today, status_id: draftStatusId })
    if (lines.length) {
      const { error } = await getSupabase()
        .from('quote_lines')
        .insert(lines.map((l) => ({ quote_id: copy.id, item_name: l.item_name, quantity: l.quantity, unit_price: l.unit_price, subtotal: l.subtotal, subtotal_is_manual: l.subtotal_is_manual, sort_order: l.sort_order })))
      if (error) throw error
    }
    return copy
  },

  /* ---------- 品項 ---------- */
  async listLines(quoteId: string): Promise<QuoteLine[]> {
    const { data, error } = await getSupabase().from('quote_lines').select('*').eq('quote_id', quoteId).order('sort_order').order('created_at')
    if (error) throw error
    return ((data ?? []) as QuoteLine[]).map(toLine)
  },
  async addLine(quoteId: string, line: QuoteLineInput & { item_name: string }): Promise<void> {
    const { error } = await getSupabase().from('quote_lines').insert({ quote_id: quoteId, ...line })
    if (error) throw error
  },
  async updateLine(id: string, patch: QuoteLineInput): Promise<void> {
    const { error } = await getSupabase().from('quote_lines').update(patch).eq('id', id)
    if (error) throw error
  },
  async removeLine(id: string): Promise<void> {
    const { error } = await getSupabase().from('quote_lines').delete().eq('id', id)
    if (error) throw error
  },
  async reorderLines(ids: string[]): Promise<void> {
    const sb = getSupabase()
    for (const [i, id] of ids.entries()) {
      const { error } = await sb.from('quote_lines').update({ sort_order: i + 1 }).eq('id', id)
      if (error) throw error
    }
  },

  /**
   * 重算並存回：未手動覆寫的小計、未手動覆寫的總額。
   * 手動值一律不動（規格：自動化不得覆蓋手動值）。
   */
  async recalc(quoteId: string): Promise<void> {
    const sb = getSupabase()
    const q = await quotesRepo.get(quoteId)
    if (!q) return
    const lines = await quotesRepo.listLines(quoteId)
    for (const l of lines) {
      if (l.subtotal_is_manual) continue
      const s = lineSubtotal(l, q.currency)
      if (s !== l.subtotal) {
        const { error } = await sb.from('quote_lines').update({ subtotal: s }).eq('id', l.id).eq('subtotal_is_manual', false)
        if (error) throw error
      }
    }
    if (q.total_is_manual) return
    const t = quoteTotals(q, lines).autoTotal
    if (t !== q.total) {
      const { error } = await sb.from('quotes').update({ total: t }).eq('id', quoteId).eq('total_is_manual', false)
      if (error) throw error
    }
  },

  /** 每張報價單的品項名稱（列表與成交建立專案用） */
  async lineNamesByQuote(): Promise<Record<string, string[]>> {
    const { data, error } = await getSupabase().from('quote_lines').select('quote_id,item_name,sort_order').order('sort_order')
    if (error) throw error
    const out: Record<string, string[]> = {}
    for (const r of (data ?? []) as { quote_id: string; item_name: string }[]) (out[r.quote_id] ??= []).push(r.item_name)
    return out
  },

  /* ---------- 品項庫 ---------- */
  async listItems(): Promise<QuoteItem[]> {
    const { data, error } = await getSupabase().from('quote_item_library').select('*').order('sort_order').order('created_at')
    if (error) throw error
    return ((data ?? []) as QuoteItem[]).map((r) => num(r, ['unit_price']))
  },
  async createItem(input: { name: string; unit_price: number; note: string | null; sort_order: number }): Promise<void> {
    const { error } = await getSupabase().from('quote_item_library').insert(input)
    if (error) throw error
  },
  async updateItem(id: string, patch: Partial<Pick<QuoteItem, 'name' | 'unit_price' | 'note'>>): Promise<void> {
    const { error } = await getSupabase().from('quote_item_library').update(patch).eq('id', id)
    if (error) throw error
  },
  async removeItem(id: string): Promise<void> {
    const { error } = await getSupabase().from('quote_item_library').delete().eq('id', id)
    if (error) throw error
  },
  async reorderItems(ids: string[]): Promise<void> {
    const sb = getSupabase()
    for (const [i, id] of ids.entries()) {
      const { error } = await sb.from('quote_item_library').update({ sort_order: i + 1 }).eq('id', id)
      if (error) throw error
    }
  },

  /* ---------- 合約模板 ---------- */
  async listTemplates(): Promise<ContractTemplate[]> {
    const { data, error } = await getSupabase().from('contract_templates').select('*').order('sort_order').order('created_at')
    if (error) throw error
    return (data ?? []) as ContractTemplate[]
  },
  async createTemplate(input: { name: string; body: string; sort_order: number }): Promise<ContractTemplate> {
    const { data, error } = await getSupabase().from('contract_templates').insert(input).select().single()
    if (error) throw error
    return data as ContractTemplate
  },
  async updateTemplate(id: string, patch: Partial<Pick<ContractTemplate, 'name' | 'body'>>): Promise<void> {
    const { error } = await getSupabase().from('contract_templates').update(patch).eq('id', id)
    if (error) throw error
  },
  /** 設為預設：其他模板取消預設 */
  async setDefaultTemplate(id: string): Promise<void> {
    const sb = getSupabase()
    const { error: e1 } = await sb.from('contract_templates').update({ is_default: false }).neq('id', id).eq('is_default', true)
    if (e1) throw e1
    const { error } = await sb.from('contract_templates').update({ is_default: true }).eq('id', id)
    if (error) throw error
  },
  async removeTemplate(id: string): Promise<void> {
    const { error } = await getSupabase().from('contract_templates').delete().eq('id', id)
    if (error) throw error
  },

  /* ---------- 合約 ---------- */
  async listContracts(quoteId: string): Promise<Contract[]> {
    const { data, error } = await getSupabase().from('contracts').select('*').eq('quote_id', quoteId).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Contract[]
  },
  async getContract(id: string): Promise<Contract | null> {
    const { data, error } = await getSupabase().from('contracts').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data as Contract | null
  },
  async createContract(input: { quote_id: string; template_id: string | null; title: string; body: string }): Promise<Contract> {
    const { data, error } = await getSupabase().from('contracts').insert(input).select().single()
    if (error) throw error
    return data as Contract
  },
  async updateContract(id: string, patch: Partial<Pick<Contract, 'title' | 'body'>>): Promise<void> {
    const { error } = await getSupabase().from('contracts').update(patch).eq('id', id)
    if (error) throw error
  },
  async removeContract(id: string): Promise<void> {
    const { error } = await getSupabase().from('contracts').delete().eq('id', id)
    if (error) throw error
  },
}
