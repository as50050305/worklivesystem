/**
 * 備份（JSON 全量匯出／匯入）的純函式
 * - 匯出：每張表的所有資料列（不含 user_id，匯入時由資料庫自動帶入）
 * - 匯入＝還原：以備份「取代」目前全部資料
 *   - 系統選項（有 key）與預設顏色標籤受資料庫保護、不能刪除，因此用「對應到現有那一筆再更新」處理，
 *     其他表引用它們的欄位一併改寫成現有的 ID
 *   - 循環／自我參照欄位（例如專案 ↔ 報價單）第一輪先填 null，第二輪再補上
 */

export const BACKUP_APP = 'worklivesystem'
export const BACKUP_FORMAT = 1

type Row = Record<string, unknown>

/** 匯入順序（父 → 子）；刪除時反向 */
export const TABLE_ORDER = [
  'option_items',
  'color_tags',
  'stage_templates',
  'template_tasks',
  'contract_templates',
  'quote_item_library',
  'clients',
  'contacts',
  'client_contacts',
  'client_followups',
  'client_meetings',
  'client_notes',
  'collections',
  'projects',
  'project_notes',
  'project_costs',
  'project_links',
  'attachments',
  'quotes',
  'quote_lines',
  'contracts',
  'timeline_items',
  'checklist_items',
] as const
export type BackupTable = (typeof TABLE_ORDER)[number]

export const TABLE_LABELS: Record<BackupTable, string> = {
  option_items: '選項',
  color_tags: '顏色標籤',
  stage_templates: '階段模板',
  template_tasks: '模板任務',
  contract_templates: '合約模板',
  quote_item_library: '品項庫',
  clients: '客戶',
  contacts: '人脈',
  client_contacts: '客戶－人脈關聯',
  client_followups: '追蹤紀錄',
  client_meetings: '會議',
  client_notes: '客戶速記',
  collections: '收藏',
  projects: '專案',
  project_notes: '專案筆記',
  project_costs: '專案成本',
  project_links: '專案網址',
  attachments: '附件',
  quotes: '報價單',
  quote_lines: '報價品項',
  contracts: '合約',
  timeline_items: '時間軸項目',
  checklist_items: '清單項目',
}

/** 第一輪先設為 null 的欄位 */
export const DEFERRED_COLUMNS: Partial<Record<BackupTable, string[]>> = {
  contacts: ['referrer_contact_id'],
  collections: ['converted_project_id'],
  projects: ['quote_id'],
  quotes: ['copied_from_id'],
  timeline_items: ['next_occurrence_id'],
}

/** 引用 option_items 的欄位 */
const OPTION_REFS: Partial<Record<BackupTable, string[]>> = {
  stage_templates: ['project_type_id'],
  template_tasks: ['project_type_id'],
  clients: ['sales_stage_id', 'cooperation_status_id', 'followup_status_id'],
  client_followups: ['method_id'],
  contacts: ['source_id', 'relation_id'],
  collections: ['type_id', 'status_id'],
  projects: ['type_id', 'status_id'],
  quotes: ['status_id'],
}

/** 引用 color_tags 的欄位 */
const TAG_REFS: Partial<Record<BackupTable, string[]>> = {
  template_tasks: ['color_tag_id'],
  clients: ['color_tag_id'],
  projects: ['color_tag_id'],
  timeline_items: ['color_tag_id'],
}

export interface BackupFile {
  type: string
  /** base64 */
  data: string
}

export interface Backup {
  app: typeof BACKUP_APP
  format: number
  app_version?: string
  exported_at: string
  settings: { theme?: string; preferences?: Record<string, unknown> } | null
  tables: Partial<Record<BackupTable, Row[]>>
  /** 附件檔案（選擇「包含附件檔案」時才有）：storage_path → 內容 */
  files?: Record<string, BackupFile>
}

/** 去掉 user_id；其餘欄位原樣保留 */
export function cleanRow(row: Row): Row {
  const { user_id: _u, ...rest } = row
  return rest
}

export function makeBackup(
  tables: Partial<Record<BackupTable, Row[]>>,
  settings: Backup['settings'],
  meta: { appVersion: string; now: Date; files?: Record<string, BackupFile> },
): Backup {
  const out: Backup = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    app_version: meta.appVersion,
    exported_at: meta.now.toISOString(),
    settings,
    tables: {},
  }
  for (const t of TABLE_ORDER) out.tables[t] = (tables[t] ?? []).map(cleanRow)
  if (meta.files && Object.keys(meta.files).length) out.files = meta.files
  return out
}

export type ParseResult = { ok: true; backup: Backup; warnings: string[] } | { ok: false; error: string }

/** 檢查匯入檔格式 */
export function parseBackup(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: '檔案不是有效的 JSON' }
  }
  const b = data as Partial<Backup> | null
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP) return { ok: false, error: '這不是本 App 匯出的備份檔' }
  if (typeof b.format !== 'number' || b.format > BACKUP_FORMAT) return { ok: false, error: `備份格式版本 ${String(b.format)} 不支援，請先更新 App` }
  if (!b.tables || typeof b.tables !== 'object') return { ok: false, error: '備份檔缺少資料' }
  const warnings: string[] = []
  const tables: Backup['tables'] = {}
  for (const t of TABLE_ORDER) {
    const rows = (b.tables as Record<string, unknown>)[t]
    if (rows === undefined) {
      warnings.push(`備份中沒有「${TABLE_LABELS[t]}」，將視為空白`)
      tables[t] = []
      continue
    }
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || typeof (r as Row).id !== 'string')) {
      return { ok: false, error: `「${TABLE_LABELS[t]}」的資料格式不正確` }
    }
    tables[t] = (rows as Row[]).map(cleanRow)
  }
  const attachments = tables.attachments ?? []
  const files = b.files ?? {}
  const missing = attachments.filter((a) => !files[a.storage_path as string]).length
  if (attachments.length && missing) warnings.push(`有 ${missing} 個附件的檔案不在備份內（只還原附件紀錄；若檔案仍在雲端空間就能開啟）`)
  return {
    ok: true,
    warnings,
    backup: { app: BACKUP_APP, format: b.format, app_version: b.app_version, exported_at: String(b.exported_at ?? ''), settings: b.settings ?? null, tables, files: b.files },
  }
}

export function countRows(b: Pick<Backup, 'tables'>): { table: BackupTable; label: string; count: number }[] {
  return TABLE_ORDER.map((t) => ({ table: t, label: TABLE_LABELS[t], count: b.tables[t]?.length ?? 0 }))
}

/* ---------------- 還原計畫 ---------------- */

export interface CurrentProtected {
  /** 目前資料庫中的系統選項 */
  keyedOptions: { id: string; category: string; key: string }[]
  /** 目前的預設顏色標籤 */
  defaultTagId: string | null
}

export interface RestorePlan {
  /** 要「更新」到現有那一筆的系統選項、預設標籤（ID 已換成現有 ID） */
  updates: { option_items: Row[]; color_tags: Row[] }
  /** 第一輪插入（延後欄位已設 null） */
  inserts: Record<BackupTable, Row[]>
  /** 第二輪：補上延後欄位（只含需要補的列） */
  deferred: Partial<Record<BackupTable, Row[]>>
  /** 備份 ID → 實際 ID（只列有變動的） */
  remap: Record<string, string>
}

export function planRestore(backup: Pick<Backup, 'tables'>, current: CurrentProtected): RestorePlan {
  const remap: Record<string, string> = {}
  const updates: RestorePlan['updates'] = { option_items: [], color_tags: [] }
  const byKey = new Map(current.keyedOptions.map((o) => [`${o.category}:${o.key}`, o.id]))

  const options: Row[] = []
  for (const o of backup.tables.option_items ?? []) {
    const existing = o.key ? byKey.get(`${String(o.category)}:${String(o.key)}`) : undefined
    if (existing) {
      if (existing !== o.id) remap[o.id as string] = existing
      updates.option_items.push({ ...o, id: existing })
    } else {
      // 沒有 key，或目前資料庫沒有這個系統鍵：一般插入
      options.push(o)
    }
  }

  const tags: Row[] = []
  for (const t of backup.tables.color_tags ?? []) {
    if (t.is_default && current.defaultTagId) {
      if (current.defaultTagId !== t.id) remap[t.id as string] = current.defaultTagId
      updates.color_tags.push({ ...t, id: current.defaultTagId })
    } else {
      tags.push(current.defaultTagId ? { ...t, is_default: false } : t)
    }
  }

  const map = (v: unknown) => (typeof v === 'string' && remap[v] ? remap[v] : v)
  const inserts = {} as Record<BackupTable, Row[]>
  const deferred: RestorePlan['deferred'] = {}
  for (const t of TABLE_ORDER) {
    const src = t === 'option_items' ? options : t === 'color_tags' ? tags : (backup.tables[t] ?? [])
    const refCols = [...(OPTION_REFS[t] ?? []), ...(TAG_REFS[t] ?? [])]
    const defCols = DEFERRED_COLUMNS[t] ?? []
    const rows: Row[] = []
    const later: Row[] = []
    for (const r0 of src) {
      const r = { ...r0 }
      for (const c of refCols) if (c in r) r[c] = map(r[c])
      if (defCols.some((c) => r[c] !== null && r[c] !== undefined)) {
        later.push({ ...r })
        for (const c of defCols) if (c in r) r[c] = null
      }
      rows.push(r)
    }
    inserts[t] = rows
    if (later.length) deferred[t] = later
  }
  return { updates, inserts, deferred, remap }
}

/** 把陣列切成每批 n 筆 */
export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

/** 備份檔名：worklivesystem-backup-2026-10-28-1530.json（台北時間） */
export function backupFileName(now: Date, suffix = ''): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `worklivesystem-backup-${g('year')}-${g('month')}-${g('day')}-${g('hour')}${g('minute')}${suffix}.json`
}
