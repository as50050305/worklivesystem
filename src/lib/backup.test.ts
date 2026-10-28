import { describe, expect, it } from 'vitest'
import { backupFileName, chunk, countRows, makeBackup, parseBackup, planRestore, TABLE_ORDER } from './backup'

const backup = makeBackup(
  {
    option_items: [
      { id: 'o-won', user_id: 'u', category: 'quote_status', key: 'won', label: '成交了', sort_order: 3 },
      { id: 'o-custom', user_id: 'u', category: 'project_type', key: null, label: '工作坊', sort_order: 9 },
      { id: 'o-type', user_id: 'u', category: 'project_type', key: 'commercial', label: '商業插畫案', sort_order: 4 },
    ],
    color_tags: [
      { id: 't-def', is_default: true, name: '未分類', color: '#888888' },
      { id: 't-work', is_default: false, name: '工作', color: '#7EA2AA' },
    ],
    projects: [
      { id: 'p1', name: 'A', type_id: 'o-type', status_id: null, color_tag_id: 't-def', quote_id: 'q1' },
      { id: 'p2', name: 'B', type_id: 'o-custom', color_tag_id: 't-work', quote_id: null },
    ],
    quotes: [
      { id: 'q1', project_id: 'p1', status_id: 'o-won', copied_from_id: null },
      { id: 'q2', project_id: 'p1', status_id: 'o-won', copied_from_id: 'q1' },
    ],
    contacts: [{ id: 'c1', referrer_contact_id: 'c1' }],
  },
  { theme: 'light', preferences: { business: { name: 'X' } } },
  { appVersion: '0.1.0', now: new Date('2026-10-28T07:30:00Z') },
)

describe('備份格式', () => {
  it('匯出：每張表都有、移除 user_id', () => {
    expect(Object.keys(backup.tables)).toEqual([...TABLE_ORDER])
    expect(backup.tables.option_items![0]).not.toHaveProperty('user_id')
    expect(backup.tables.timeline_items).toEqual([])
  })
  it('parseBackup：接受自己的格式並回傳警告', () => {
    const r = parseBackup(JSON.stringify(backup))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings).toEqual([])
  })
  it('parseBackup：拒絕非 JSON、別的檔案、未來版本、壞資料', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false, error: '檔案不是有效的 JSON' })
    expect(parseBackup('{"a":1}')).toMatchObject({ ok: false, error: '這不是本 App 匯出的備份檔' })
    expect(parseBackup(JSON.stringify({ ...backup, format: 99 }))).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify({ ...backup, tables: { ...backup.tables, clients: [{ name: '沒有 id' }] } }))).toMatchObject({ ok: false, error: '「客戶」的資料格式不正確' })
  })
  it('parseBackup：缺表視為空白、附件檔不在備份內會提醒', () => {
    const { clients: _c, ...rest } = backup.tables
    const r = parseBackup(JSON.stringify({ ...backup, tables: { ...rest, attachments: [{ id: 'a1', storage_path: 'x/y.pdf' }] } }))
    expect(r.ok && r.warnings.length).toBe(2)
    if (r.ok) expect(r.backup.tables.clients).toEqual([])
  })
  it('countRows', () => {
    expect(countRows(backup).find((c) => c.table === 'projects')).toEqual({ table: 'projects', label: '專案', count: 2 })
  })
  it('檔名使用台北時間', () => {
    expect(backupFileName(new Date('2026-10-28T07:30:00Z'))).toBe('worklivesystem-backup-2026-10-28-1530.json')
    expect(backupFileName(new Date('2026-10-28T16:05:00Z'), '-還原前')).toBe('worklivesystem-backup-2026-10-29-0005-還原前.json')
  })
  it('chunk', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('還原計畫', () => {
  const plan = planRestore(backup, {
    keyedOptions: [
      { id: 'N-won', category: 'quote_status', key: 'won' },
      { id: 'o-type', category: 'project_type', key: 'commercial' },
    ],
    defaultTagId: 'N-def',
  })
  it('系統選項對應到現有 ID 並改為更新（保留改過的名稱）', () => {
    expect(plan.updates.option_items).toEqual([
      expect.objectContaining({ id: 'N-won', label: '成交了' }),
      expect.objectContaining({ id: 'o-type' }),
    ])
    expect(plan.inserts.option_items.map((o) => o.id)).toEqual(['o-custom'])
    expect(plan.remap).toEqual({ 'o-won': 'N-won', 't-def': 'N-def' })
  })
  it('預設顏色標籤對應到現有那一筆；其他標籤插入', () => {
    expect(plan.updates.color_tags).toEqual([expect.objectContaining({ id: 'N-def', name: '未分類' })])
    expect(plan.inserts.color_tags.map((t) => t.id)).toEqual(['t-work'])
  })
  it('外鍵改寫為現有 ID', () => {
    expect(plan.inserts.projects[0]).toMatchObject({ color_tag_id: 'N-def', type_id: 'o-type' })
    expect(plan.inserts.quotes.every((q) => q.status_id === 'N-won')).toBe(true)
  })
  it('循環／自我參照欄位第一輪為 null，第二輪補上', () => {
    expect(plan.inserts.projects[0]!.quote_id).toBeNull()
    expect(plan.deferred.projects).toEqual([expect.objectContaining({ id: 'p1', quote_id: 'q1', color_tag_id: 'N-def' })])
    expect(plan.inserts.quotes[1]!.copied_from_id).toBeNull()
    expect(plan.deferred.quotes?.map((q) => q.id)).toEqual(['q2'])
    expect(plan.deferred.contacts?.[0]).toMatchObject({ referrer_contact_id: 'c1' })
    expect(plan.deferred.timeline_items).toBeUndefined()
  })
  it('不修改原備份物件', () => {
    expect(backup.tables.projects![0]!.quote_id).toBe('q1')
    expect(backup.tables.quotes![0]!.status_id).toBe('o-won')
  })
})
