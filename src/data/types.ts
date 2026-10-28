/** 資料表型別（P1 先定義已使用到的；後續階段逐步補齊） */

export type ThemeName = 'dark' | 'light'

export interface AppSettings {
  id: string
  user_id: string
  last_daily_check: string | null
  theme: ThemeName
  preferences: Record<string, unknown>
  seeded_at: string | null
  created_at: string
  updated_at: string
}

export interface ColorTag {
  id: string
  user_id: string
  name: string
  color: string
  sort_order: number
  is_default: boolean
  /** 此標籤的項目列入側邊欄「生活代辦」 */
  is_life_todo: boolean
  created_at: string
  updated_at: string
}

export type OptionCategory =
  | 'project_type'
  | 'project_status'
  | 'collection_type'
  | 'collection_status'
  | 'sales_stage'
  | 'cooperation_status'
  | 'followup_status'
  | 'quote_status'
  | 'contact_source'
  | 'contact_relation'
  | 'followup_method'
  | 'currency'

export interface OptionItem {
  id: string
  user_id: string
  category: OptionCategory
  /** 系統鍵：自動化規則依此判斷，不依顯示名稱。非 null 者不可刪除。 */
  key: string | null
  label: string
  sort_order: number
  color: string | null
  created_at: string
  updated_at: string
}

export type TimelineKind = 'normal' | 'checklist'
export type RecurrenceKind = 'none' | 'weekly' | 'monthly' | 'bimonthly' | 'custom'
export type RecurrenceUnit = 'day' | 'week' | 'month'
export type AnchorKind = 'apply_start' | 'apply_deadline' | 'event_start'

export interface TimelineItem {
  id: string
  user_id: string
  item_date: string
  /** 'HH:MM:SS'；null = 整天 */
  item_time: string | null
  title: string
  content: string | null
  color_tag_id: string | null
  is_done: boolean
  done_at: string | null
  project_id: string | null
  client_id: string | null
  kind: TimelineKind
  recurrence: RecurrenceKind
  recurrence_interval: number | null
  recurrence_unit: RecurrenceUnit | null
  series_id: string | null
  series_start_on: string | null
  next_occurrence_id: string | null
  source: 'manual' | 'template'
  template_task_id: string | null
  anchor: AnchorKind | null
  offset_days: number | null
  is_manually_adjusted: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ChecklistItem {
  id: string
  user_id: string
  timeline_item_id: string
  content: string
  is_done: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/** 新增／編輯時間軸項目時可設定的欄位 */
export type TimelineItemInput = Pick<
  TimelineItem,
  'item_date' | 'item_time' | 'title' | 'content' | 'color_tag_id' | 'kind' | 'recurrence' | 'recurrence_interval' | 'recurrence_unit'
> &
  Partial<Pick<TimelineItem, 'project_id' | 'client_id' | 'is_done' | 'sort_order'>>

export interface ChecklistDraft {
  id?: string
  content: string
  is_done: boolean
}

export interface ProjectCountdownRow {
  id: string
  name: string
  apply_deadline_on: string | null
  event_start_on: string | null
  color_tag_id: string | null
}

export interface Project {
  id: string
  user_id: string
  name: string
  type_id: string | null
  status_id: string | null
  current_stage_id: string | null
  progress: number
  progress_is_manual: boolean
  apply_start_on: string | null
  apply_deadline_on: string | null
  event_start_on: string | null
  event_end_on: string | null
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  color_tag_id: string | null
  source_collection_id: string | null
  client_id: string | null
  quote_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type ProjectInput = Partial<Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>> & { name: string }

export interface ProjectNote {
  id: string
  project_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface ProjectCost {
  id: string
  project_id: string
  item: string
  amount: number
  currency: string
  sort_order: number
  created_at: string
}

export interface ProjectLink {
  id: string
  project_id: string
  url: string
  title: string | null
  sort_order: number
  created_at: string
}

export interface Attachment {
  id: string
  project_id: string | null
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export interface StageTemplate {
  id: string
  project_type_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface TemplateTask {
  id: string
  project_type_id: string
  name: string
  anchor: AnchorKind
  offset_days: number
  color_tag_id: string | null
  sort_order: number
  created_at: string
}

export interface GeoResult {
  label: string
  city: string | null
  country: string | null
  latitude: number
  longitude: number
}

export interface Collection {
  id: string
  user_id: string
  name: string
  url: string | null
  note: string | null
  type_id: string | null
  organizer: string | null
  city: string | null
  country: string | null
  apply_start_on: string | null
  apply_deadline_on: string | null
  event_start_on: string | null
  event_end_on: string | null
  fee_amount: number | null
  fee_currency: string | null
  requirements: string | null
  status_id: string | null
  remind_next_year: boolean
  remind_on: string | null
  converted_project_id: string | null
  converted_client_id: string | null
  created_at: string
  updated_at: string
}

export type CollectionInput = Partial<Omit<Collection, 'id' | 'user_id' | 'created_at' | 'updated_at'>> & { name: string }

/** P4 只用到建立；完整欄位於 P5 */
export interface ClientRow {
  id: string
  code: string
  name: string
  website: string | null
}
