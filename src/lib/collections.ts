/**
 * 收藏庫（純函式）
 * - 規則 B：轉為專案／轉為客戶的帶入內容
 * - 明年提醒的預設日期
 * - 表格排序
 */
import { addDays, addMonths, type PlainDate } from './dates'

export interface CollectionLike {
  id: string
  name: string
  url: string | null
  note: string | null
  type_id: string | null
  organizer: string | null
  city: string | null
  country: string | null
  apply_start_on: PlainDate | null
  apply_deadline_on: PlainDate | null
  event_start_on: PlainDate | null
  event_end_on: PlainDate | null
  fee_amount: number | string | null
  fee_currency: string | null
  remind_next_year: boolean
  remind_on: PlainDate | null
  updated_at: string
}

export interface OptionLike {
  id: string
  key: string | null
  label: string
}

/** 收藏類型 → 對應的專案類型（依系統鍵：展會、駐村、補助／計畫） */
export function mapToProjectType(collectionType: OptionLike | undefined, projectTypes: OptionLike[]): string | null {
  if (!collectionType?.key) return null
  return projectTypes.find((p) => p.key === collectionType.key)?.id ?? null
}

export function canConvertToClient(collectionType: OptionLike | undefined): boolean {
  return collectionType?.key === 'prospect_brand'
}

export interface ProjectDraft {
  name: string
  type_id: string | null
  city: string | null
  country: string | null
  apply_start_on: PlainDate | null
  apply_deadline_on: PlainDate | null
  event_start_on: PlainDate | null
  event_end_on: PlainDate | null
  url: string | null
  /** 費用帶入為一筆成本；null 代表沒有費用 */
  cost: { item: string; amount: number; currency: string } | null
}

/** 規則 B：收藏 → 專案的預設帶入內容（預覽時仍可修改） */
export function draftProjectFromCollection(c: CollectionLike, projectTypeId: string | null): ProjectDraft {
  const fee = c.fee_amount === null || c.fee_amount === '' ? null : Number(c.fee_amount)
  return {
    name: c.name,
    type_id: projectTypeId,
    city: c.city,
    country: c.country,
    apply_start_on: c.apply_start_on,
    apply_deadline_on: c.apply_deadline_on,
    event_start_on: c.event_start_on,
    event_end_on: c.event_end_on,
    url: c.url,
    cost: fee !== null && Number.isFinite(fee) && fee !== 0 ? { item: '費用', amount: fee, currency: c.fee_currency || 'TWD' } : null,
  }
}

export interface ClientDraft {
  name: string
  website: string | null
}

/** 規則 B：收藏 → 客戶（僅限潛在客戶品牌），帶入名稱與網址 */
export function draftClientFromCollection(c: CollectionLike): ClientDraft {
  return { name: c.name, website: c.url }
}

/**
 * 明年提醒的預設日期：以開始申請日（沒有就用申請截止日、活動開始日）的明年同一天提前 30 天；
 * 都沒有日期則為一年後的今天。
 */
export function defaultRemindDate(c: Pick<CollectionLike, 'apply_start_on' | 'apply_deadline_on' | 'event_start_on'>, today: PlainDate): PlainDate {
  const base = c.apply_start_on ?? c.apply_deadline_on ?? c.event_start_on
  if (!base) return addMonths(today, 12)
  let d = addDays(addMonths(base, 12), -30)
  // 若推算結果已過（例如資料是兩年前的），改為從今天起算
  while (d <= today) d = addMonths(d, 12)
  return d
}

/** 明年提醒是否到期 */
export function isReminderDue(c: Pick<CollectionLike, 'remind_next_year' | 'remind_on'>, today: PlainDate): boolean {
  return c.remind_next_year && c.remind_on !== null && c.remind_on <= today
}

export type SortKey = 'name' | 'type' | 'apply_deadline_on' | 'event_start_on' | 'status' | 'updated_at'
export type SortDir = 'asc' | 'desc'

/** 排序：空日期一律排在最後 */
export function sortCollections<T extends CollectionLike & { status_id: string | null }>(
  list: T[],
  key: SortKey,
  dir: SortDir,
  labelOf: (optionId: string | null) => string,
): T[] {
  const sign = dir === 'asc' ? 1 : -1
  const val = (c: T): string | null => {
    switch (key) {
      case 'name':
        return c.name
      case 'type':
        return labelOf(c.type_id)
      case 'status':
        return labelOf(c.status_id)
      case 'updated_at':
        return c.updated_at
      default:
        return c[key]
    }
  }
  return [...list].sort((a, b) => {
    const va = val(a)
    const vb = val(b)
    if (va === vb) return a.name.localeCompare(b.name, 'zh-Hant')
    if (va === null || va === '') return 1
    if (vb === null || vb === '') return -1
    return sign * va.localeCompare(vb, 'zh-Hant')
  })
}
