import { describe, expect, it } from 'vitest'
import { anchorsChanged, describeOffset, planTemplateTasks, progressFromStage, rescheduleTasks, sumByCurrency, taskDate } from './projects'

const P = { apply_start_on: '2026-11-01', apply_deadline_on: '2026-12-15', event_start_on: null }

describe('錨點日期', () => {
  it('偏移可正可負，跨年', () => {
    expect(taskDate(P, 'apply_deadline', -14)).toBe('2026-12-01')
    expect(taskDate(P, 'apply_deadline', 20)).toBe('2027-01-04')
    expect(taskDate(P, 'event_start', 0)).toBeNull()
  })
  it('describeOffset', () => {
    expect(describeOffset('apply_deadline', -14)).toBe('申請截止日 −14 天')
    expect(describeOffset('event_start', 0)).toBe('活動開始日當天')
  })
})

describe('進度依階段自動計算', () => {
  const stages = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, sort_order: i }))
  it('第 6 階段（上色）／9 = 66.7%', () => expect(progressFromStage(stages, 's5')).toBe(66.7))
  it('最後一階段 = 100%', () => expect(progressFromStage(stages, 's8')).toBe(100))
  it('未設定 = 0', () => expect(progressFromStage(stages, null)).toBe(0))
  it('不依陣列順序而依 sort_order', () => expect(progressFromStage([...stages].reverse(), 's0')).toBe(11.1))
})

describe('從模板產生任務', () => {
  const templates = [
    { id: 't1', name: '開始準備', anchor: 'apply_start' as const, offset_days: 0, color_tag_id: null, sort_order: 1 },
    { id: 't2', name: '完成作品集', anchor: 'apply_deadline' as const, offset_days: -14, color_tag_id: 'tagA', sort_order: 2 },
    { id: 't3', name: '行前準備', anchor: 'event_start' as const, offset_days: -7, color_tag_id: null, sort_order: 3 },
  ]
  it('錨點為空的略過並回報', () => {
    const plan = planTemplateTasks(templates, P, [], 'projTag')
    expect(plan.create.map((c) => [c.title, c.item_date, c.color_tag_id])).toEqual([
      ['開始準備', '2026-11-01', 'projTag'],
      ['完成作品集', '2026-12-01', 'tagA'],
    ])
    expect(plan.skippedNoAnchor.map((s) => s.id)).toEqual(['t3'])
  })
  it('已產生過的不重複', () => {
    const plan = planTemplateTasks(templates, P, ['t1'])
    expect(plan.create.map((c) => c.template_task_id)).toEqual(['t2'])
    expect(plan.alreadyExists).toBe(1)
  })
})

describe('規則 C：錨點變更只重算符合條件的任務', () => {
  const base = { source: 'template' as const, is_manually_adjusted: false, is_done: false, anchor: 'apply_deadline' as const, offset_days: -14 }
  const tasks = [
    { ...base, id: 'auto', item_date: '2026-12-01' },
    { ...base, id: 'manual-adjusted', item_date: '2026-12-03', is_manually_adjusted: true },
    { ...base, id: 'done', item_date: '2026-12-01', is_done: true },
    { ...base, id: 'manual-source', item_date: '2026-12-01', source: 'manual' as const },
    { ...base, id: 'other-anchor', item_date: '2026-11-01', anchor: 'apply_start' as const, offset_days: 0 },
  ]
  const after = { ...P, apply_deadline_on: '2027-01-10' }
  it('只動模板產生、未手動調整、未完成的', () => {
    expect(rescheduleTasks(tasks, after)).toEqual([{ id: 'auto', from: '2026-12-01', to: '2026-12-27' }])
  })
  it('anchorsChanged', () => expect(anchorsChanged(P, after)).toEqual(['apply_deadline']))
  it('新錨點為空時不動', () => expect(rescheduleTasks(tasks, { ...P, apply_deadline_on: null })).toEqual([]))
  it('可限定只看變更的錨點', () => {
    const moved = { ...after, apply_start_on: '2026-11-05' }
    expect(rescheduleTasks(tasks, moved, ['apply_start']).map((r) => r.id)).toEqual(['other-anchor'])
  })
})

describe('成本依幣別加總', () => {
  it('分開加總、無浮點誤差', () => {
    expect(
      sumByCurrency([
        { amount: '0.1', currency: 'USD' },
        { amount: 0.2, currency: 'USD' },
        { amount: 3000, currency: 'TWD' },
        { amount: '1500.5', currency: 'TWD' },
      ]),
    ).toEqual([
      { currency: 'TWD', total: 4500.5 },
      { currency: 'USD', total: 0.3 },
    ])
  })
})
