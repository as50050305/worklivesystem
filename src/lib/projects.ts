/**
 * 專案相關的純函式
 * - 進度：依目前階段的順序自動計算（可手動覆寫，見 progress_is_manual）
 * - 錨點任務：依階段模板的 template_tasks 與專案錨點日期產生時間軸任務
 * - 規則 C：錨點日期變更時，只重算「模板產生、未手動調整、未完成」的任務
 */
import { addDays, type PlainDate } from './dates'

export type AnchorKind = 'apply_start' | 'apply_deadline' | 'event_start'

export const ANCHOR_LABEL: Record<AnchorKind, string> = {
  apply_start: '開始申請日',
  apply_deadline: '申請截止日',
  event_start: '活動開始日',
}

export interface ProjectAnchors {
  apply_start_on: PlainDate | null
  apply_deadline_on: PlainDate | null
  event_start_on: PlainDate | null
}

export function anchorDate(p: ProjectAnchors, anchor: AnchorKind): PlainDate | null {
  if (anchor === 'apply_start') return p.apply_start_on
  if (anchor === 'apply_deadline') return p.apply_deadline_on
  return p.event_start_on
}

/** 任務日期 = 錨點日期 + 偏移天數；錨點為空回傳 null */
export function taskDate(p: ProjectAnchors, anchor: AnchorKind, offsetDays: number): PlainDate | null {
  const base = anchorDate(p, anchor)
  return base ? addDays(base, offsetDays) : null
}

/** 偏移顯示：申請截止日 −14 天 */
export function describeOffset(anchor: AnchorKind, offset: number): string {
  if (offset === 0) return `${ANCHOR_LABEL[anchor]}當天`
  return `${ANCHOR_LABEL[anchor]} ${offset > 0 ? '+' : '−'}${Math.abs(offset)} 天`
}

/* ---------------- 進度 ---------------- */

export interface StageLike {
  id: string
  sort_order: number
}

/** 目前階段在模板中的位置：(序號) / (階段數) × 100，四捨五入到小數 1 位 */
export function progressFromStage(stages: StageLike[], currentStageId: string | null): number {
  if (!currentStageId || stages.length === 0) return 0
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order)
  const idx = sorted.findIndex((s) => s.id === currentStageId)
  if (idx < 0) return 0
  return Math.round(((idx + 1) / sorted.length) * 1000) / 10
}

/* ---------------- 錨點任務產生 ---------------- */

export interface TemplateTaskLike {
  id: string
  name: string
  anchor: AnchorKind
  offset_days: number
  color_tag_id: string | null
  sort_order: number
}

export interface PlannedTask {
  template_task_id: string
  title: string
  item_date: PlainDate
  anchor: AnchorKind
  offset_days: number
  color_tag_id: string | null
  sort_order: number
}

export interface TaskPlan {
  create: PlannedTask[]
  /** 錨點日期為空而略過的模板任務 */
  skippedNoAnchor: TemplateTaskLike[]
  /** 此專案已產生過的模板任務 */
  alreadyExists: number
}

/**
 * 依模板規劃要產生的任務。
 * @param existingTemplateIds 此專案已存在的 template_task_id（避免重複）
 * @param fallbackColor 模板沒指定顏色時使用（通常是專案的顏色標籤）
 */
export function planTemplateTasks(
  templates: TemplateTaskLike[],
  project: ProjectAnchors,
  existingTemplateIds: Iterable<string>,
  fallbackColor: string | null = null,
): TaskPlan {
  const existing = new Set(existingTemplateIds)
  const plan: TaskPlan = { create: [], skippedNoAnchor: [], alreadyExists: 0 }
  for (const t of [...templates].sort((a, b) => a.sort_order - b.sort_order)) {
    if (existing.has(t.id)) {
      plan.alreadyExists++
      continue
    }
    const date = taskDate(project, t.anchor, t.offset_days)
    if (!date) {
      plan.skippedNoAnchor.push(t)
      continue
    }
    plan.create.push({
      template_task_id: t.id,
      title: t.name,
      item_date: date,
      anchor: t.anchor,
      offset_days: t.offset_days,
      color_tag_id: t.color_tag_id ?? fallbackColor,
      sort_order: t.sort_order,
    })
  }
  return plan
}

/* ---------------- 規則 C：錨點日期變更 ---------------- */

export interface ProjectTaskLike {
  id: string
  item_date: PlainDate
  source: 'manual' | 'template'
  is_manually_adjusted: boolean
  is_done: boolean
  anchor: AnchorKind | null
  offset_days: number | null
}

export interface Reschedule {
  id: string
  from: PlainDate
  to: PlainDate
}

/** 錨點日期是否有變（只比較三個錨點） */
export function anchorsChanged(before: ProjectAnchors, after: ProjectAnchors): AnchorKind[] {
  const out: AnchorKind[] = []
  if (before.apply_start_on !== after.apply_start_on) out.push('apply_start')
  if (before.apply_deadline_on !== after.apply_deadline_on) out.push('apply_deadline')
  if (before.event_start_on !== after.event_start_on) out.push('event_start')
  return out
}

/**
 * 計算需要重算的任務：只動 source = 模板產生、is_manually_adjusted = false、且未完成的任務；
 * 新錨點為空或日期不變者略過。
 */
export function rescheduleTasks(tasks: ProjectTaskLike[], project: ProjectAnchors, onlyAnchors?: AnchorKind[]): Reschedule[] {
  const out: Reschedule[] = []
  for (const t of tasks) {
    if (t.source !== 'template' || t.is_manually_adjusted || t.is_done) continue
    if (!t.anchor || t.offset_days === null) continue
    if (onlyAnchors && !onlyAnchors.includes(t.anchor)) continue
    const d = taskDate(project, t.anchor, t.offset_days)
    if (d && d !== t.item_date) out.push({ id: t.id, from: t.item_date, to: d })
  }
  return out
}

/* ---------------- 成本 ---------------- */

/** 依幣別分開加總（保留兩位小數，避免浮點誤差） */
export function sumByCurrency(costs: { amount: number | string; currency: string }[]): { currency: string; total: number }[] {
  const map = new Map<string, number>()
  for (const c of costs) {
    const cents = Math.round(Number(c.amount) * 100)
    if (!Number.isFinite(cents)) continue
    map.set(c.currency, (map.get(c.currency) ?? 0) + cents)
  }
  return [...map.entries()].map(([currency, cents]) => ({ currency, total: cents / 100 })).sort((a, b) => a.currency.localeCompare(b.currency))
}

export function formatMoney(n: number, currency: string): string {
  const digits = currency === 'JPY' || currency === 'TWD' ? 0 : 2
  const s = n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : digits, maximumFractionDigits: 2 })
  return `${currency} ${s}`
}
