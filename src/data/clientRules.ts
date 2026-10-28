/**
 * 規則 A 與資料庫欄位的轉換：
 * 資料庫存的是選項 ID，規則純函式用的是系統鍵。這裡負責兩邊互轉（不呼叫資料庫）。
 */
import type { CooperationKey, FollowupPatch, FollowupState, FollowupStatusKey, SalesStageKey } from '@/lib/followup'
import type { Client, ClientInput, OptionItem } from './types'

export function keyOf(options: OptionItem[], id: string | null): string | null {
  return options.find((o) => o.id === id)?.key ?? null
}

export function idOf(options: OptionItem[], category: OptionItem['category'], key: string): string | null {
  return options.find((o) => o.category === category && o.key === key)?.id ?? null
}

export function stateOf(c: Client, options: OptionItem[]): FollowupState {
  return {
    followup_count: c.followup_count,
    round: c.round,
    round_started_on: c.round_started_on,
    next_followup_on: c.next_followup_on,
    cooldown_until: c.cooldown_until,
    followup_status: keyOf(options, c.followup_status_id) as FollowupStatusKey | null,
    sales_stage: keyOf(options, c.sales_stage_id) as SalesStageKey | null,
    cooperation: keyOf(options, c.cooperation_status_id) as CooperationKey | null,
    has_worked_together: c.has_worked_together,
    decline_next: c.decline_next,
    no_show_pending: c.no_show_pending,
  }
}

export function toDbPatch(p: FollowupPatch, options: OptionItem[]): ClientInput {
  const out: ClientInput = {}
  for (const k of ['followup_count', 'round', 'round_started_on', 'next_followup_on', 'cooldown_until', 'has_worked_together', 'decline_next', 'no_show_pending'] as const) {
    if (k in p) (out as Record<string, unknown>)[k] = p[k]
  }
  if (p.followup_status) out.followup_status_id = idOf(options, 'followup_status', p.followup_status)
  if (p.sales_stage) out.sales_stage_id = idOf(options, 'sales_stage', p.sales_stage)
  return out
}
