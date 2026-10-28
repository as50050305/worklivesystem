import { chunk, TABLE_LABELS, TABLE_ORDER, type Backup, type BackupFile, type BackupTable, type RestorePlan } from '@/lib/backup'
import { getSupabase } from '@/lib/supabase'
import { OWNER_ID } from '../owner'

type Row = Record<string, unknown>
const BUCKET = 'attachments'
const PAGE = 1000

async function selectAll(table: string): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase().from(table).select('*').order('id').range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as Row[]))
    if (!data || data.length < PAGE) return out
  }
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export type Progress = (message: string) => void

export const backupRepo = {
  /** 讀出全部資料（每張表分頁讀取） */
  async readAll(onProgress?: Progress): Promise<{ tables: Partial<Record<BackupTable, Row[]>>; settings: Backup['settings'] }> {
    const tables: Partial<Record<BackupTable, Row[]>> = {}
    for (const t of TABLE_ORDER) {
      onProgress?.(`讀取${TABLE_LABELS[t]}…`)
      tables[t] = await selectAll(t)
    }
    const { data, error } = await getSupabase().from('app_settings').select('theme,preferences').maybeSingle()
    if (error) throw error
    return { tables, settings: (data as Backup['settings']) ?? null }
  },

  /** 下載附件檔案（轉成 base64 放進備份） */
  async readFiles(attachments: Row[], onProgress?: Progress): Promise<{ files: Record<string, BackupFile>; failed: string[] }> {
    const files: Record<string, BackupFile> = {}
    const failed: string[] = []
    for (const [i, a] of attachments.entries()) {
      const path = a.storage_path as string
      onProgress?.(`下載附件 ${i + 1}／${attachments.length}…`)
      const { data, error } = await getSupabase().storage.from(BUCKET).download(path)
      if (error || !data) {
        failed.push(String(a.file_name ?? path))
        continue
      }
      files[path] = { type: data.type || String(a.mime_type ?? 'application/octet-stream'), data: toBase64(await data.arrayBuffer()) }
    }
    return { files, failed }
  },

  async currentProtected() {
    const sb = getSupabase()
    const { data: opts, error: e1 } = await sb.from('option_items').select('id,category,key').not('key', 'is', null)
    if (e1) throw e1
    const { data: tag, error: e2 } = await sb.from('color_tags').select('id').eq('is_default', true).maybeSingle()
    if (e2) throw e2
    return { keyedOptions: (opts ?? []) as { id: string; category: string; key: string }[], defaultTagId: (tag as { id: string } | null)?.id ?? null }
  },

  /**
   * 以備份取代目前全部資料。
   * 順序：刪除（子 → 父）→ 更新受保護的列 → 插入（父 → 子）→ 補延後欄位 → 設定 → 附件檔
   */
  async restore(backup: Backup, plan: RestorePlan, onProgress?: Progress): Promise<{ filesFailed: string[] }> {
    const sb = getSupabase()

    // 0. 目前的附件檔：備份裡沒有這個路徑、或備份會重新上傳的，先從雲端刪掉
    const keepPaths = new Set((backup.tables.attachments ?? []).map((a) => a.storage_path as string))
    const { data: curAtt, error: eAtt } = await sb.from('attachments').select('storage_path')
    if (eAtt) throw eAtt
    const removePaths = ((curAtt ?? []) as { storage_path: string }[]).map((a) => a.storage_path).filter((p) => !keepPaths.has(p) || backup.files?.[p])
    for (const part of chunk(removePaths, 100)) await sb.storage.from(BUCKET).remove(part)

    // 1. 刪除（系統選項、預設標籤受保護，資料庫會自動略過）
    for (const t of [...TABLE_ORDER].reverse()) {
      onProgress?.(`清除${TABLE_LABELS[t]}…`)
      const { error } = await sb.from(t).delete().not('id', 'is', null)
      if (error) throw error
    }

    // 2. 受保護的列：更新成備份內容
    onProgress?.('更新系統選項…')
    for (const o of plan.updates.option_items) {
      const { id, ...rest } = o
      const { error } = await sb.from('option_items').update({ label: rest.label, sort_order: rest.sort_order, color: rest.color ?? null }).eq('id', id as string)
      if (error) throw error
    }
    for (const t of plan.updates.color_tags) {
      const { id, ...rest } = t
      const { error } = await sb.from('color_tags').update({ name: rest.name, color: rest.color, sort_order: rest.sort_order, is_life_todo: rest.is_life_todo ?? false }).eq('id', id as string)
      if (error) throw error
    }

    // 3. 插入
    for (const t of TABLE_ORDER) {
      const rows = plan.inserts[t]
      if (!rows.length) continue
      onProgress?.(`寫入${TABLE_LABELS[t]}（${rows.length}）…`)
      for (const part of chunk(rows, 500)) {
        const { error } = await sb.from(t).insert(part)
        if (error) throw error
      }
    }

    // 4. 延後欄位
    for (const t of TABLE_ORDER) {
      const rows = plan.deferred[t]
      if (!rows?.length) continue
      onProgress?.(`補上${TABLE_LABELS[t]}的關聯…`)
      for (const part of chunk(rows, 500)) {
        const { error } = await sb.from(t).upsert(part, { onConflict: 'id' })
        if (error) throw error
      }
    }

    // 5. 設定（主題、報價方資料等）；不動每日檢查與初始化紀錄
    if (backup.settings) {
      const patch: Row = {}
      if (backup.settings.theme === 'dark' || backup.settings.theme === 'light') patch.theme = backup.settings.theme
      if (backup.settings.preferences && typeof backup.settings.preferences === 'object') patch.preferences = backup.settings.preferences
      if (Object.keys(patch).length) {
        const { error } = await sb.from('app_settings').update(patch).eq('user_id', OWNER_ID)
        if (error) throw error
      }
    }

    // 6. 附件檔
    const filesFailed: string[] = []
    const entries = Object.entries(backup.files ?? {})
    for (const [i, [path, f]] of entries.entries()) {
      onProgress?.(`上傳附件 ${i + 1}／${entries.length}…`)
      const { error } = await sb.storage.from(BUCKET).upload(path, fromBase64(f.data, f.type), { upsert: true, contentType: f.type })
      if (error) filesFailed.push(path.split('/').pop() ?? path)
    }
    return { filesFailed }
  },
}
