/**
 * 規則 A：客戶追蹤（純函式，不碰資料庫）
 *
 * 所有函式都接收目前狀態，回傳「要寫入的變更」（patch）與需要新增的追蹤紀錄；
 * 狀態類欄位以系統鍵表示（following / cooling / recontact / won / rejected …），
 * 由 repository 轉成選項 ID 後寫入。
 */
import { addDays, isSameQuarter, nextQuarterStart, type PlainDate } from './dates'

export const MAX_FOLLOWUPS = 5
export const FOLLOWUP_INTERVAL_DAYS = 7

export type FollowupStatusKey = 'following' | 'cooling' | 'recontact' | 'won' | 'rejected'
export type SalesStageKey = 'first_contact' | 'emailing' | 'meeting_booked' | 'no_show' | 'quote_sent' | 'quote_failed' | 'won'
export type CooperationKey = 'unset' | 'aligned' | 'cold' | 'mismatch'

export interface FollowupState {
  followup_count: number
  round: number
  round_started_on: PlainDate | null
  next_followup_on: PlainDate | null
  cooldown_until: PlainDate | null
  /** 系統鍵；使用者自訂的狀態為 null */
  followup_status: FollowupStatusKey | null
  sales_stage: SalesStageKey | null
  cooperation: CooperationKey | null
  has_worked_together: boolean
  decline_next: boolean
  no_show_pending: boolean
}

export interface FollowupPatch {
  followup_count?: number
  round?: number
  round_started_on?: PlainDate | null
  next_followup_on?: PlainDate | null
  cooldown_until?: PlainDate | null
  followup_status?: FollowupStatusKey
  sales_stage?: SalesStageKey
  has_worked_together?: boolean
  decline_next?: boolean
  no_show_pending?: boolean
}

export interface LogEntry {
  followed_on: PlainDate
  note: string
  round: number
}

export type RuleResult = { ok: true; patch: FollowupPatch; log?: LogEntry; message?: string } | { ok: false; reason: string }

/** A-4：次數達 5 且未成交 → 冷卻至下一季第一天、清空下次追蹤日 */
function applyLimit(state: FollowupState, patch: FollowupPatch, today: PlainDate): FollowupPatch {
  const count = patch.followup_count ?? state.followup_count
  const won = (patch.sales_stage ?? state.sales_stage) === 'won' || (patch.followup_status ?? state.followup_status) === 'won'
  if (count >= MAX_FOLLOWUPS && !won) {
    return { ...patch, followup_status: 'cooling', cooldown_until: nextQuarterStart(today), next_followup_on: null }
  }
  return patch
}

/**
 * A-1：開始新一輪
 * 次數 = 1、本輪開始日 = 今天、下次追蹤日 = 今天 + 7、追蹤狀態 = 追蹤中。
 * 若本輪開始日與今天同一季 → 禁止（本季已跑過一輪）。
 * 輪次：第一次開始為 1；若已由每日檢查解凍（可重新聯絡，輪次已 +1）則不再增加；其餘情況 +1。
 */
export function startNewRound(state: FollowupState, today: PlainDate): RuleResult {
  if (state.round_started_on && isSameQuarter(state.round_started_on, today)) {
    return { ok: false, reason: '本季已跑過一輪' }
  }
  if (state.cooperation === 'mismatch' && !state.has_worked_together) {
    return { ok: false, reason: '合作狀態為「不合」，不再追蹤' }
  }
  let round: number
  if (state.followup_status === 'recontact') round = Math.max(state.round, 1)
  else if (state.round === 0 && !state.round_started_on) round = 1
  else round = state.round + 1
  const patch: FollowupPatch = {
    followup_count: 1,
    round,
    round_started_on: today,
    next_followup_on: addDays(today, FOLLOWUP_INTERVAL_DAYS),
    followup_status: 'following',
    cooldown_until: null,
  }
  return { ok: true, patch, log: { followed_on: today, note: `開始第 ${round} 輪`, round } }
}

/**
 * A-2：記錄一次追蹤（次數 +1、下次追蹤日 = 今天 + 7，並新增一筆追蹤紀錄）
 * 達 5 次且未成交 → A-4 冷卻。記錄追蹤也會清除 No show 的「寄追蹤信」提示。
 */
export function recordFollowup(state: FollowupState, today: PlainDate, note = ''): RuleResult {
  if (state.followup_status !== 'following') {
    return { ok: false, reason: state.followup_status === 'recontact' ? '請先「開始新一輪」' : '目前不在追蹤中，請先開始新一輪' }
  }
  if (state.followup_count >= MAX_FOLLOWUPS) return { ok: false, reason: `本輪已追蹤 ${MAX_FOLLOWUPS} 次` }
  const count = state.followup_count + 1
  const patch = applyLimit(
    state,
    { followup_count: count, next_followup_on: addDays(today, FOLLOWUP_INTERVAL_DAYS), no_show_pending: false },
    today,
  )
  return {
    ok: true,
    patch,
    log: { followed_on: today, note, round: state.round },
    message: patch.followup_status === 'cooling' ? `已追蹤 ${MAX_FOLLOWUPS} 次，冷卻至 ${patch.cooldown_until}` : undefined,
  }
}

/**
 * A-3：銷售流程改為 No show → 次數 +1、下次追蹤日 = 今天 + 7、側邊欄顯示「寄追蹤信」
 * （同樣受 A-4 次數上限約束）
 */
export function markNoShow(state: FollowupState, today: PlainDate): RuleResult {
  const base: FollowupPatch = { sales_stage: 'no_show', no_show_pending: true }
  // 尚未開始追蹤或不在追蹤中：只更新銷售流程與提示，不動次數
  if (state.followup_status !== 'following' || state.followup_count >= MAX_FOLLOWUPS) {
    return { ok: true, patch: base }
  }
  const patch = applyLimit(state, { ...base, followup_count: state.followup_count + 1, next_followup_on: addDays(today, FOLLOWUP_INTERVAL_DAYS) }, today)
  return { ok: true, patch, log: { followed_on: today, note: 'No show（會議未出席）', round: state.round } }
}

/**
 * A-5：每日檢查 — 今天 ≥ 冷卻至，且合作狀態 ≠ 不合
 * → 可重新聯絡、次數歸零、輪次 +1。
 * 只處理「冷卻中」的客戶，處理後狀態改變，因此重複執行不會再加輪次（冪等）。
 */
export function dailyUnfreeze(state: FollowupState, today: PlainDate): FollowupPatch | null {
  if (state.followup_status !== 'cooling') return null
  if (!state.cooldown_until || state.cooldown_until > today) return null
  if (state.cooperation === 'mismatch') return null
  return { followup_status: 'recontact', followup_count: 0, round: state.round + 1 }
}

/**
 * A-6：合作狀態改為「不合」
 * 已接過案 → 下次婉拒 = true；未接過案 → 冷卻中、冷卻至清空（永不自動解凍）
 */
export function setMismatch(state: FollowupState): FollowupPatch {
  if (state.has_worked_together) return { decline_next: true }
  return { followup_status: 'cooling', cooldown_until: null, next_followup_on: null }
}

/**
 * A-7（無報價單時）：手動把銷售流程改為成交 → 追蹤狀態 = 成交、是否接過案 = 是
 * （有「已寄出」報價單時的流程於 P6 報價單完成）
 */
export function markWon(): FollowupPatch {
  return { sales_stage: 'won', followup_status: 'won', has_worked_together: true, next_followup_on: null, no_show_pending: false }
}

/** 側邊欄分類 */
export function isDueToday(state: Pick<FollowupState, 'followup_status' | 'next_followup_on'>, today: PlainDate): boolean {
  return state.followup_status === 'following' && state.next_followup_on !== null && state.next_followup_on <= today
}
