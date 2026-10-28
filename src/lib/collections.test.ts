import { describe, expect, it } from 'vitest'
import { canConvertToClient, defaultRemindDate, draftClientFromCollection, draftProjectFromCollection, isReminderDue, mapToProjectType, sortCollections } from './collections'

const base = {
  id: 'c1', name: '台中藝術駐村', url: 'https://example.com', note: null, type_id: 't-res', organizer: '某基金會',
  city: '台中', country: '台灣', apply_start_on: '2026-03-01', apply_deadline_on: '2026-04-15', event_start_on: '2026-07-01', event_end_on: '2026-08-31',
  fee_amount: '1500.00', fee_currency: 'TWD', remind_next_year: false, remind_on: null, updated_at: '2026-10-01T00:00:00Z', status_id: 's1',
}

describe('規則 B：轉換帶入', () => {
  const projectTypes = [
    { id: 'p-exh', key: 'exhibition', label: '展會' },
    { id: 'p-res', key: 'residency', label: '駐村' },
  ]
  it('依系統鍵對應專案類型', () => {
    expect(mapToProjectType({ id: 't-res', key: 'residency', label: '駐村' }, projectTypes)).toBe('p-res')
    expect(mapToProjectType({ id: 't-r', key: 'research', label: '研究參考' }, projectTypes)).toBeNull()
  })
  it('專案草稿：名稱、類型、地點、日期、網址、費用→成本', () => {
    expect(draftProjectFromCollection(base, 'p-res')).toEqual({
      name: '台中藝術駐村', type_id: 'p-res', city: '台中', country: '台灣',
      apply_start_on: '2026-03-01', apply_deadline_on: '2026-04-15', event_start_on: '2026-07-01', event_end_on: '2026-08-31',
      url: 'https://example.com', cost: { item: '費用', amount: 1500, currency: 'TWD' },
    })
  })
  it('沒有費用或 0 元不產生成本', () => {
    expect(draftProjectFromCollection({ ...base, fee_amount: null }, null).cost).toBeNull()
    expect(draftProjectFromCollection({ ...base, fee_amount: '0' }, null).cost).toBeNull()
  })
  it('只有潛在客戶品牌可轉客戶，帶入名稱與網址', () => {
    expect(canConvertToClient({ id: 'x', key: 'prospect_brand', label: '潛在客戶品牌' })).toBe(true)
    expect(canConvertToClient({ id: 'x', key: 'exhibition', label: '展會' })).toBe(false)
    expect(draftClientFromCollection(base)).toEqual({ name: '台中藝術駐村', website: 'https://example.com' })
  })
})

describe('明年提醒', () => {
  it('開始申請日的明年提前 30 天', () => expect(defaultRemindDate(base, '2026-10-28')).toBe('2027-01-30'))
  it('沒有開始申請日用申請截止日', () => expect(defaultRemindDate({ ...base, apply_start_on: null }, '2026-10-28')).toBe('2027-03-16'))
  it('沒有任何日期 → 一年後', () => expect(defaultRemindDate({ apply_start_on: null, apply_deadline_on: null, event_start_on: null }, '2026-10-28')).toBe('2027-10-28'))
  it('推算結果已過則再延一年', () => expect(defaultRemindDate({ ...base, apply_start_on: '2024-03-01' }, '2026-10-28')).toBe('2027-01-30'))
  it('到期判斷', () => {
    expect(isReminderDue({ remind_next_year: true, remind_on: '2026-10-28' }, '2026-10-28')).toBe(true)
    expect(isReminderDue({ remind_next_year: true, remind_on: '2026-10-29' }, '2026-10-28')).toBe(false)
    expect(isReminderDue({ remind_next_year: false, remind_on: '2026-10-01' }, '2026-10-28')).toBe(false)
  })
})

describe('排序', () => {
  const list = [
    { ...base, id: 'a', name: 'A', apply_deadline_on: null },
    { ...base, id: 'b', name: 'B', apply_deadline_on: '2026-05-01' },
    { ...base, id: 'c', name: 'C', apply_deadline_on: '2026-04-01' },
  ]
  it('日期遞增，空值在最後', () => expect(sortCollections(list, 'apply_deadline_on', 'asc', () => '').map((x) => x.id)).toEqual(['c', 'b', 'a']))
  it('日期遞減，空值仍在最後', () => expect(sortCollections(list, 'apply_deadline_on', 'desc', () => '').map((x) => x.id)).toEqual(['b', 'c', 'a']))
})
