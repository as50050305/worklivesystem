import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { markNoShow, markWon, recordFollowup, setMismatch, startNewRound, type RuleResult } from '@/lib/followup'
import { idOf, keyOf, stateOf, toDbPatch } from './clientRules'
import { useOptions } from './projectHooks'
import { clientsRepo } from './repositories/clientsRepo'
import { contactsRepo } from './repositories/contactsRepo'
import { invalidateTable } from './queryClient'
import type { Client, ClientInput, ContactInput } from './types'

export function useClients() {
  return useQuery({ queryKey: ['clients', 'list'], queryFn: clientsRepo.list })
}
export function useClient(id: string | undefined) {
  return useQuery({ queryKey: ['clients', 'one', id], queryFn: () => clientsRepo.get(id!), enabled: Boolean(id) })
}
export function useClientFollowups(id: string) {
  return useQuery({ queryKey: ['clients', 'followups', id], queryFn: () => clientsRepo.listFollowups(id) })
}
export function useClientMeetings(id: string) {
  return useQuery({ queryKey: ['clients', 'meetings', id], queryFn: () => clientsRepo.listMeetings(id) })
}
export function useClientNotes(id: string) {
  return useQuery({ queryKey: ['clients', 'notes', id], queryFn: () => clientsRepo.listNotes(id) })
}
export function useClientLinks() {
  return useQuery({ queryKey: ['clients', 'links'], queryFn: clientsRepo.listLinks })
}
export function useContacts() {
  return useQuery({ queryKey: ['contacts'], queryFn: contactsRepo.list })
}

/** 規則 A 的操作：先用純函式算出結果，再寫入資料庫 */
export function useClientActions() {
  const qc = useQueryClient()
  const { data: options = [] } = useOptions()
  const after = () => invalidateTable('clients')
  const optimistic = (id: string, patch: ClientInput) => {
    qc.setQueryData<Client | null>(['clients', 'one', id], (old) => (old ? { ...old, ...patch } : old))
    qc.setQueryData<Client[]>(['clients', 'list'], (old) => old?.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const applyMut = useMutation({
    mutationFn: async (v: { client: Client; result: RuleResult & { ok: true }; extra?: ClientInput; methodId?: string | null }) =>
      clientsRepo.applyRule(v.client.id, { ...toDbPatch(v.result.patch, options), ...v.extra }, v.result.log && { ...v.result.log, method_id: v.methodId }),
    onMutate: (v) => optimistic(v.client.id, { ...toDbPatch(v.result.patch, options), ...v.extra }),
    onSettled: after,
  })
  const update = useMutation({
    mutationFn: (v: { id: string; patch: ClientInput }) => clientsRepo.update(v.id, v.patch),
    onMutate: (v) => optimistic(v.id, v.patch),
    onSettled: after,
  })

  /** 執行規則並回傳結果（失敗時回傳原因，不寫入） */
  const run = async (client: Client, result: RuleResult, extra?: ClientInput, methodId?: string | null): Promise<RuleResult> => {
    if (!result.ok) return result
    await applyMut.mutateAsync({ client, result, extra, methodId })
    return result
  }

  return {
    pending: applyMut.isPending || update.isPending,
    update,
    /** A-1 */
    startRound: (c: Client, today: string) => run(c, startNewRound(stateOf(c, options), today)),
    /** A-2（含 A-4） */
    record: (c: Client, today: string, note: string, methodId: string | null) => run(c, recordFollowup(stateOf(c, options), today, note), undefined, methodId),
    /** 改銷售流程：No show（A-3）、成交（A-7 無報價單）、其他直接更新 */
    changeSalesStage: async (c: Client, stageId: string | null, today: string): Promise<RuleResult> => {
      const key = keyOf(options, stageId)
      if (key === 'no_show') return run(c, markNoShow(stateOf(c, options), today))
      if (key === 'won') return run(c, { ok: true, patch: markWon() }, { sales_stage_id: stageId })
      await update.mutateAsync({ id: c.id, patch: { sales_stage_id: stageId } })
      return { ok: true, patch: {} }
    },
    /** 改合作狀態：不合（A-6） */
    changeCooperation: async (c: Client, coopId: string | null): Promise<RuleResult> => {
      const key = keyOf(options, coopId)
      const extra: ClientInput = { cooperation_status_id: coopId }
      if (key === 'mismatch') return run(c, { ok: true, patch: setMismatch(stateOf(c, options)) }, extra)
      await update.mutateAsync({ id: c.id, patch: extra })
      return { ok: true, patch: {} }
    },
    /** 側邊欄：已寄出 No show 追蹤信（只清除提示，不計次） */
    clearNoShow: (c: Client) => update.mutateAsync({ id: c.id, patch: { no_show_pending: false } }),
    idOf: (category: Parameters<typeof idOf>[1], key: string) => idOf(options, category, key),
  }
}

export function useClientMutations() {
  const after = () => invalidateTable('clients')
  return {
    create: useMutation({ mutationFn: (input: ClientInput & { name: string }) => clientsRepo.create(input), onSettled: after }),
    remove: useMutation({ mutationFn: (id: string) => clientsRepo.remove(id), onSettled: () => { after(); invalidateTable('projects') } }),
    removeFollowup: useMutation({ mutationFn: (id: string) => clientsRepo.removeFollowup(id), onSettled: after }),
    addMeeting: useMutation({ mutationFn: (v: { id: string; startsAt: string; note: string | null }) => clientsRepo.addMeeting(v.id, v.startsAt, v.note), onSettled: after }),
    removeMeeting: useMutation({ mutationFn: (id: string) => clientsRepo.removeMeeting(id), onSettled: after }),
    addNote: useMutation({ mutationFn: (v: { id: string; content: string }) => clientsRepo.addNote(v.id, v.content), onSettled: after }),
    updateNote: useMutation({ mutationFn: (v: { id: string; content: string }) => clientsRepo.updateNote(v.id, v.content), onSettled: after }),
    removeNote: useMutation({ mutationFn: (id: string) => clientsRepo.removeNote(id), onSettled: after }),
    link: useMutation({ mutationFn: (v: { clientId: string; contactId: string }) => clientsRepo.link(v.clientId, v.contactId), onSettled: after }),
    unlink: useMutation({ mutationFn: (v: { clientId: string; contactId: string }) => clientsRepo.unlink(v.clientId, v.contactId), onSettled: after }),
  }
}

export function useContactMutations() {
  const after = () => {
    invalidateTable('contacts')
    invalidateTable('clients')
  }
  return {
    create: useMutation({ mutationFn: (input: ContactInput) => contactsRepo.create(input), onSettled: after }),
    update: useMutation({ mutationFn: (v: { id: string; patch: Partial<ContactInput> }) => contactsRepo.update(v.id, v.patch), onSettled: after }),
    remove: useMutation({ mutationFn: (id: string) => contactsRepo.remove(id), onSettled: after }),
  }
}
