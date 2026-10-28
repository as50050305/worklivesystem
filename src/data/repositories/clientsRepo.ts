import { dailyUnfreeze, type LogEntry } from '@/lib/followup'
import { getSupabase } from '@/lib/supabase'
import { idOf, stateOf, toDbPatch } from '../clientRules'
import type { Client, ClientContactLink, ClientFollowup, ClientInput, ClientMeeting, ClientNote, OptionItem } from '../types'

const T = 'clients'

export const clientsRepo = {
  async list(): Promise<Client[]> {
    const { data, error } = await getSupabase().from(T).select('*').order('code')
    if (error) throw error
    return (data ?? []) as Client[]
  },
  async get(id: string): Promise<Client | null> {
    const { data, error } = await getSupabase().from(T).select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data as Client | null
  },
  /** 編號留空時由資料庫自動產生 C001、C002… */
  async create(input: ClientInput & { name: string }): Promise<Client> {
    const { data, error } = await getSupabase().from(T).insert(input).select().single()
    if (error) throw error
    return data as Client
  },
  async update(id: string, patch: ClientInput): Promise<Client> {
    const { data, error } = await getSupabase().from(T).update(patch).eq('id', id).select().single()
    if (error) throw error
    return data as Client
  },
  async remove(id: string): Promise<void> {
    const { error } = await getSupabase().from(T).delete().eq('id', id)
    if (error) throw error
  },

  /** 套用規則 A 的結果：更新客戶並（必要時）新增一筆追蹤紀錄 */
  async applyRule(id: string, patch: ClientInput, log?: LogEntry & { method_id?: string | null }): Promise<Client> {
    const client = await clientsRepo.update(id, patch)
    if (log) {
      const { error } = await getSupabase()
        .from('client_followups')
        .insert({ client_id: id, followed_on: log.followed_on, note: log.note || null, round: log.round, method_id: log.method_id ?? null })
      if (error) throw error
    }
    return client
  },

  /**
   * A-5 每日檢查：冷卻至 ≤ 今天、合作狀態 ≠ 不合 → 可重新聯絡、次數歸零、輪次 +1。
   * 以「目前仍是冷卻中」為更新條件，多台裝置同時執行也只會生效一次。
   */
  async unfreezeDue(today: string, options: OptionItem[]): Promise<number> {
    const coolingId = idOf(options, 'followup_status', 'cooling')
    if (!coolingId) return 0
    const { data, error } = await getSupabase().from(T).select('*').eq('followup_status_id', coolingId).lte('cooldown_until', today)
    if (error) throw error
    let n = 0
    for (const c of (data ?? []) as Client[]) {
      const p = dailyUnfreeze(stateOf(c, options), today)
      if (!p) continue
      const { data: upd, error: e } = await getSupabase().from(T).update(toDbPatch(p, options)).eq('id', c.id).eq('followup_status_id', coolingId).select('id')
      if (e) throw e
      n += upd?.length ?? 0
    }
    return n
  },

  /* ---------- 追蹤紀錄 ---------- */
  async listFollowups(clientId: string): Promise<ClientFollowup[]> {
    const { data, error } = await getSupabase().from('client_followups').select('*').eq('client_id', clientId).order('followed_on', { ascending: false }).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientFollowup[]
  },
  async removeFollowup(id: string): Promise<void> {
    const { error } = await getSupabase().from('client_followups').delete().eq('id', id)
    if (error) throw error
  },

  /* ---------- 會議 ---------- */
  async listMeetings(clientId: string): Promise<ClientMeeting[]> {
    const { data, error } = await getSupabase().from('client_meetings').select('*').eq('client_id', clientId).order('starts_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientMeeting[]
  },
  async addMeeting(clientId: string, startsAt: string, note: string | null): Promise<void> {
    const { error } = await getSupabase().from('client_meetings').insert({ client_id: clientId, starts_at: startsAt, note })
    if (error) throw error
  },
  async removeMeeting(id: string): Promise<void> {
    const { error } = await getSupabase().from('client_meetings').delete().eq('id', id)
    if (error) throw error
  },

  /* ---------- 速記 ---------- */
  async listNotes(clientId: string): Promise<ClientNote[]> {
    const { data, error } = await getSupabase().from('client_notes').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ClientNote[]
  },
  async addNote(clientId: string, content: string): Promise<void> {
    const { error } = await getSupabase().from('client_notes').insert({ client_id: clientId, content })
    if (error) throw error
  },
  async updateNote(id: string, content: string): Promise<void> {
    const { error } = await getSupabase().from('client_notes').update({ content }).eq('id', id)
    if (error) throw error
  },
  async removeNote(id: string): Promise<void> {
    const { error } = await getSupabase().from('client_notes').delete().eq('id', id)
    if (error) throw error
  },

  /* ---------- 關聯人脈（多對多） ---------- */
  async listLinks(): Promise<ClientContactLink[]> {
    const { data, error } = await getSupabase().from('client_contacts').select('id,client_id,contact_id')
    if (error) throw error
    return (data ?? []) as ClientContactLink[]
  },
  async link(clientId: string, contactId: string): Promise<void> {
    const { error } = await getSupabase().from('client_contacts').insert({ client_id: clientId, contact_id: contactId })
    if (error && error.code !== '23505') throw error
  },
  async unlink(clientId: string, contactId: string): Promise<void> {
    const { error } = await getSupabase().from('client_contacts').delete().eq('client_id', clientId).eq('contact_id', contactId)
    if (error) throw error
  },
}
