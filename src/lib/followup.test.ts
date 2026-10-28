import { describe, expect, it } from 'vitest'
import { dailyUnfreeze, isDueToday, markNoShow, markWon, recordFollowup, setMismatch, startNewRound, type FollowupState } from './followup'

const fresh: FollowupState = {
  followup_count: 0, round: 0, round_started_on: null, next_followup_on: null, cooldown_until: null,
  followup_status: null, sales_stage: 'first_contact', cooperation: 'unset', has_worked_together: false, decline_next: false, no_show_pending: false,
}
/** 依序套用 patch 方便模擬流程 */
const apply = (s: FollowupState, p: Partial<FollowupState>): FollowupState => ({ ...s, ...p })
const run = (s: FollowupState, r: ReturnType<typeof startNewRound>) => {
  if (!r.ok) throw new Error(r.reason)
  return apply(s, r.patch)
}

describe('A-1 開始新一輪', () => {
  it('第一次：次數 1、輪次 1、+7 天、追蹤中', () => {
    const r = startNewRound(fresh, '2026-10-28')
    expect(r).toMatchObject({ ok: true, patch: { followup_count: 1, round: 1, round_started_on: '2026-10-28', next_followup_on: '2026-11-04', followup_status: 'following' } })
    expect(r.ok && r.log?.note).toBe('開始第 1 輪')
  })
  it('同一季禁止（季度邊界內）', () => {
    const s = { ...fresh, round: 1, round_started_on: '2026-10-01' }
    expect(startNewRound(s, '2026-12-31')).toEqual({ ok: false, reason: '本季已跑過一輪' })
  })
  it('季度邊界：9/30 開始，10/1 可以再開（不同季）', () => {
    const s = { ...fresh, round: 1, round_started_on: '2026-09-30', followup_status: 'following' as const }
    expect(startNewRound(s, '2026-10-01')).toMatchObject({ ok: true, patch: { round: 2 } })
  })
  it('跨年：去年 Q4 開始，今年 Q4 可以（同季不同年）', () => {
    const s = { ...fresh, round: 2, round_started_on: '2025-11-15', followup_status: 'recontact' as const }
    expect(startNewRound(s, '2026-11-15')).toMatchObject({ ok: true, patch: { round: 2 } })
  })
  it('解凍後（可重新聯絡）開始新一輪：輪次不再 +1', () => {
    const s = { ...fresh, round: 2, round_started_on: '2026-04-01', followup_status: 'recontact' as const }
    expect(startNewRound(s, '2026-07-02')).toMatchObject({ ok: true, patch: { round: 2, followup_count: 1 } })
  })
  it('未接過案且「不合」不可開始', () => {
    expect(startNewRound({ ...fresh, cooperation: 'mismatch' }, '2026-10-28').ok).toBe(false)
  })
})

describe('A-2 記錄追蹤 ＋ A-4 冷卻', () => {
  it('次數 +1、下次追蹤 +7、留紀錄', () => {
    const s = run(fresh, startNewRound(fresh, '2026-10-28'))
    const r = recordFollowup(s, '2026-11-04', 'Email 追蹤')
    expect(r).toMatchObject({ ok: true, patch: { followup_count: 2, next_followup_on: '2026-11-11' }, log: { followed_on: '2026-11-04', note: 'Email 追蹤', round: 1 } })
  })
  it('第 5 次未成交 → 冷卻至下一季第一天、清空下次追蹤日', () => {
    let s = run(fresh, startNewRound(fresh, '2026-10-28'))
    for (const d of ['2026-11-04', '2026-11-11', '2026-11-18']) s = run(s, recordFollowup(s, d))
    expect(s.followup_count).toBe(4)
    const r = recordFollowup(s, '2026-11-25')
    expect(r).toMatchObject({ ok: true, patch: { followup_count: 5, followup_status: 'cooling', cooldown_until: '2027-01-01', next_followup_on: null } })
  })
  it('Q1 冷卻至 4/1、Q2 → 7/1、Q3 → 10/1', () => {
    const s = { ...fresh, followup_status: 'following' as const, followup_count: 4, round: 1, round_started_on: '2026-01-05' }
    expect(recordFollowup(s, '2026-03-31')).toMatchObject({ patch: { cooldown_until: '2026-04-01' } })
    expect(recordFollowup(s, '2026-04-01')).toMatchObject({ patch: { cooldown_until: '2026-07-01' } })
    expect(recordFollowup(s, '2026-09-30')).toMatchObject({ patch: { cooldown_until: '2026-10-01' } })
  })
  it('已成交達 5 次不冷卻', () => {
    const s = { ...fresh, followup_status: 'following' as const, followup_count: 4, sales_stage: 'won' as const }
    const r = recordFollowup(s, '2026-10-28')
    expect(r.ok && r.patch.followup_status).toBeUndefined()
  })
  it('不在追蹤中不可記錄', () => {
    expect(recordFollowup({ ...fresh, followup_status: 'cooling' }, '2026-10-28').ok).toBe(false)
    expect(recordFollowup({ ...fresh, followup_status: 'recontact' }, '2026-10-28')).toEqual({ ok: false, reason: '請先「開始新一輪」' })
  })
  it('記錄追蹤會清除 No show 提示', () => {
    const s = { ...fresh, followup_status: 'following' as const, followup_count: 2, no_show_pending: true }
    expect(recordFollowup(s, '2026-10-28')).toMatchObject({ patch: { no_show_pending: false } })
  })
})

describe('A-3 No show', () => {
  it('次數 +1、+7 天、顯示寄追蹤信', () => {
    const s = { ...fresh, followup_status: 'following' as const, followup_count: 2, round: 1 }
    expect(markNoShow(s, '2026-10-28')).toMatchObject({ ok: true, patch: { sales_stage: 'no_show', followup_count: 3, next_followup_on: '2026-11-04', no_show_pending: true } })
  })
  it('No show 使次數達 5 → 冷卻', () => {
    const s = { ...fresh, followup_status: 'following' as const, followup_count: 4, round: 1 }
    expect(markNoShow(s, '2026-12-20')).toMatchObject({ patch: { followup_count: 5, followup_status: 'cooling', cooldown_until: '2027-01-01' } })
  })
  it('尚未追蹤時只更新流程與提示', () => {
    expect(markNoShow(fresh, '2026-10-28')).toEqual({ ok: true, patch: { sales_stage: 'no_show', no_show_pending: true } })
  })
})

describe('A-5 每日檢查解凍（冪等）', () => {
  const cooling = { ...fresh, followup_status: 'cooling' as const, followup_count: 5, round: 1, cooldown_until: '2027-01-01' }
  it('冷卻至當天解凍：可重新聯絡、次數歸零、輪次 +1', () => {
    expect(dailyUnfreeze(cooling, '2027-01-01')).toEqual({ followup_status: 'recontact', followup_count: 0, round: 2 })
  })
  it('跨年前一天不解凍', () => expect(dailyUnfreeze(cooling, '2026-12-31')).toBeNull())
  it('重複執行不會再加輪次', () => {
    const once = apply(cooling, dailyUnfreeze(cooling, '2027-01-02')!)
    expect(dailyUnfreeze(once, '2027-01-02')).toBeNull()
    expect(once.round).toBe(2)
  })
  it('合作狀態「不合」不解凍', () => expect(dailyUnfreeze({ ...cooling, cooperation: 'mismatch' }, '2027-02-01')).toBeNull())
  it('冷卻至為空（不合、未接過案）永不解凍', () => expect(dailyUnfreeze({ ...cooling, cooldown_until: null }, '2030-01-01')).toBeNull())
})

describe('A-6 不合', () => {
  it('已接過案 → 下次婉拒', () => expect(setMismatch({ ...fresh, has_worked_together: true })).toEqual({ decline_next: true }))
  it('未接過案 → 冷卻中、冷卻至清空', () =>
    expect(setMismatch({ ...fresh, followup_status: 'following' })).toEqual({ followup_status: 'cooling', cooldown_until: null, next_followup_on: null }))
})

describe('A-7 成交（無報價單）與側邊欄', () => {
  it('成交：追蹤狀態成交、接過案', () => expect(markWon()).toMatchObject({ sales_stage: 'won', followup_status: 'won', has_worked_together: true }))
  it('待追蹤：下次追蹤日 ≤ 今天（含逾期）', () => {
    expect(isDueToday({ followup_status: 'following', next_followup_on: '2026-10-20' }, '2026-10-28')).toBe(true)
    expect(isDueToday({ followup_status: 'following', next_followup_on: '2026-10-29' }, '2026-10-28')).toBe(false)
    expect(isDueToday({ followup_status: 'cooling', next_followup_on: '2026-10-20' }, '2026-10-28')).toBe(false)
  })
})

describe('完整流程：一輪 5 次 → 冷卻 → 跨年解凍 → 新一輪', () => {
  it('Q4 跑完一輪，隔年 1/1 解凍，1/2 開新一輪', () => {
    let s = run(fresh, startNewRound(fresh, '2026-10-05'))
    for (const d of ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']) s = run(s, recordFollowup(s, d))
    expect(s).toMatchObject({ followup_status: 'cooling', cooldown_until: '2027-01-01', followup_count: 5, round: 1 })
    expect(startNewRound(s, '2026-12-01')).toEqual({ ok: false, reason: '本季已跑過一輪' })
    s = apply(s, dailyUnfreeze(s, '2027-01-01')!)
    expect(s).toMatchObject({ followup_status: 'recontact', followup_count: 0, round: 2 })
    s = run(s, startNewRound(s, '2027-01-02'))
    expect(s).toMatchObject({ followup_status: 'following', followup_count: 1, round: 2, round_started_on: '2027-01-02', next_followup_on: '2027-01-09' })
  })
})
