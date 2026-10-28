import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { businessFrom, type BusinessProfileLike } from '@/lib/quotes'
import { idOf } from './clientRules'
import { useOptions } from './projectHooks'
import { invalidateTable } from './queryClient'
import { quotesRepo } from './repositories/quotesRepo'
import { settingsRepo } from './repositories/settingsRepo'
import type { Quote, QuoteInput, QuoteLine, QuoteLineInput } from './types'
import { syncQuoteWon } from './wonSync'

export function useQuotes() {
  return useQuery({ queryKey: ['quotes', 'list'], queryFn: quotesRepo.list })
}
export function useQuote(id: string | undefined) {
  return useQuery({ queryKey: ['quotes', 'one', id], queryFn: () => quotesRepo.get(id!), enabled: Boolean(id) })
}
export function useQuoteLines(id: string | undefined) {
  return useQuery({ queryKey: ['quotes', 'lines', id], queryFn: () => quotesRepo.listLines(id!), enabled: Boolean(id) })
}
export function useQuoteLineNames() {
  return useQuery({ queryKey: ['quotes', 'line-names'], queryFn: quotesRepo.lineNamesByQuote })
}
export function useQuoteItems() {
  return useQuery({ queryKey: ['quote_items'], queryFn: quotesRepo.listItems })
}
export function useContractTemplates() {
  return useQuery({ queryKey: ['contract_templates'], queryFn: quotesRepo.listTemplates })
}
export function useContracts(quoteId: string | undefined) {
  return useQuery({ queryKey: ['contracts', quoteId], queryFn: () => quotesRepo.listContracts(quoteId!), enabled: Boolean(quoteId) })
}
export function useAppSettings() {
  return useQuery({ queryKey: ['settings', 'app'], queryFn: settingsRepo.get })
}
export function useBusinessProfile(): { profile: BusinessProfileLike; isLoading: boolean } {
  const q = useAppSettings()
  return { profile: businessFrom(q.data?.preferences), isLoading: q.isLoading }
}

export function useBusinessMutation() {
  return useMutation({
    mutationFn: (b: BusinessProfileLike) => settingsRepo.mergePreferences({ business: b }),
    onSettled: () => invalidateTable('app_settings'),
  })
}

export function useQuoteMutations() {
  const qc = useQueryClient()
  const { data: options = [] } = useOptions()
  const after = () => invalidateTable('quotes')
  const optimistic = (id: string, patch: QuoteInput) => {
    qc.setQueryData<Quote | null>(['quotes', 'one', id], (old) => (old ? { ...old, ...patch } : old))
    qc.setQueryData<Quote[]>(['quotes', 'list'], (old) => old?.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }
  const optimisticLine = (quoteId: string, id: string, patch: QuoteLineInput) =>
    qc.setQueryData<QuoteLine[]>(['quotes', 'lines', quoteId], (old) => old?.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  return {
    create: useMutation({ mutationFn: (input: QuoteInput) => quotesRepo.create(input), onSettled: after }),
    /** 更新欄位；影響金額時重算未手動覆寫的小計／總額 */
    update: useMutation({
      mutationFn: async (v: { id: string; patch: QuoteInput; recalc?: boolean }) => {
        await quotesRepo.update(v.id, v.patch)
        if (v.recalc) await quotesRepo.recalc(v.id)
      },
      onMutate: (v) => optimistic(v.id, v.patch),
      onSettled: after,
    }),
    remove: useMutation({ mutationFn: (id: string) => quotesRepo.remove(id), onSettled: after }),
    copy: useMutation({
      mutationFn: (v: { id: string; today: string }) => quotesRepo.copyAsNewVersion(v.id, v.today, idOf(options, 'quote_status', 'draft')),
      onSettled: after,
    }),
    /** A-7：標記成交並同步客戶與專案 */
    markWon: useMutation({
      mutationFn: (quote: Quote) => syncQuoteWon(quote, options),
      onSettled: () => {
        after()
        invalidateTable('clients')
        invalidateTable('projects')
        invalidateTable('timeline_items')
      },
    }),
    addLine: useMutation({
      mutationFn: async (v: { quoteId: string; line: QuoteLineInput & { item_name: string } }) => {
        await quotesRepo.addLine(v.quoteId, v.line)
        await quotesRepo.recalc(v.quoteId)
      },
      onSettled: after,
    }),
    updateLine: useMutation({
      mutationFn: async (v: { quoteId: string; id: string; patch: QuoteLineInput }) => {
        await quotesRepo.updateLine(v.id, v.patch)
        await quotesRepo.recalc(v.quoteId)
      },
      onMutate: (v) => optimisticLine(v.quoteId, v.id, v.patch),
      onSettled: after,
    }),
    removeLine: useMutation({
      mutationFn: async (v: { quoteId: string; id: string }) => {
        await quotesRepo.removeLine(v.id)
        await quotesRepo.recalc(v.quoteId)
      },
      onSettled: after,
    }),
    reorderLines: useMutation({ mutationFn: (v: { quoteId: string; ids: string[] }) => quotesRepo.reorderLines(v.ids), onSettled: after }),
  }
}

export function useQuoteItemMutations() {
  const after = () => invalidateTable('quote_item_library')
  return {
    create: useMutation({ mutationFn: quotesRepo.createItem, onSettled: after }),
    update: useMutation({ mutationFn: (v: { id: string; patch: { name?: string; unit_price?: number; note?: string | null } }) => quotesRepo.updateItem(v.id, v.patch), onSettled: after }),
    remove: useMutation({ mutationFn: (id: string) => quotesRepo.removeItem(id), onSettled: after }),
    reorder: useMutation({ mutationFn: (ids: string[]) => quotesRepo.reorderItems(ids), onSettled: after }),
  }
}

export function useContractTemplateMutations() {
  const after = () => invalidateTable('contract_templates')
  return {
    create: useMutation({ mutationFn: quotesRepo.createTemplate, onSettled: after }),
    update: useMutation({ mutationFn: (v: { id: string; patch: { name?: string; body?: string } }) => quotesRepo.updateTemplate(v.id, v.patch), onSettled: after }),
    setDefault: useMutation({ mutationFn: (id: string) => quotesRepo.setDefaultTemplate(id), onSettled: after }),
    remove: useMutation({ mutationFn: (id: string) => quotesRepo.removeTemplate(id), onSettled: after }),
  }
}

export function useContractMutations() {
  const after = () => invalidateTable('contracts')
  return {
    create: useMutation({ mutationFn: quotesRepo.createContract, onSettled: after }),
    update: useMutation({ mutationFn: (v: { id: string; patch: { title?: string; body?: string } }) => quotesRepo.updateContract(v.id, v.patch), onSettled: after }),
    remove: useMutation({ mutationFn: (id: string) => quotesRepo.removeContract(id), onSettled: after }),
  }
}
