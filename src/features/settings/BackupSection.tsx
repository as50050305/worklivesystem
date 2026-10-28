import { Download, FileUp, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAppState } from '@/app/AppStateProvider'
import { Alert, Button, Card, Checkbox, ConfirmDialog, Spinner } from '@/components/ui'
import { queryClient } from '@/data/queryClient'
import { backupRepo } from '@/data/repositories/backupRepo'
import { backupFileName, countRows, makeBackup, parseBackup, planRestore, type Backup } from '@/lib/backup'
import { formatDateTime } from '@/lib/dates'
import { appVersion } from '@/lib/env'
import { useOnline } from '@/pwa/useOnline'

const LAST_KEY = 'wls.lastBackupAt'

function readLast(): string | null {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

function saveJson(obj: unknown, name: string) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** 匯出目前全部資料並下載；回傳備份內容 */
async function exportNow(withFiles: boolean, onProgress: (m: string) => void, suffix = ''): Promise<{ backup: Backup; filesFailed: string[] }> {
  const { tables, settings } = await backupRepo.readAll(onProgress)
  let files: Backup['files']
  let filesFailed: string[] = []
  if (withFiles && tables.attachments?.length) {
    const r = await backupRepo.readFiles(tables.attachments, onProgress)
    files = r.files
    filesFailed = r.failed
  }
  const now = new Date()
  const backup = makeBackup(tables, settings, { appVersion, now, files })
  saveJson(backup, backupFileName(now, suffix))
  try {
    localStorage.setItem(LAST_KEY, now.toISOString())
  } catch {
    /* 無痕模式等 */
  }
  return { backup, filesFailed }
}

function ExportCard() {
  const online = useOnline()
  const [withFiles, setWithFiles] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const [last, setLast] = useState(readLast)

  const run = async () => {
    setMsg(null)
    setBusy('準備中…')
    try {
      const { backup, filesFailed } = await exportNow(withFiles, setBusy)
      const total = countRows(backup).reduce((s, c) => s + c.count, 0)
      setMsg({ tone: 'info', text: `已下載備份：共 ${total} 筆資料${backup.files ? `、${Object.keys(backup.files).length} 個附件檔` : ''}。${filesFailed.length ? `（${filesFailed.length} 個附件下載失敗：${filesFailed.join('、')}）` : ''}` })
      setLast(readLast())
    } catch (e) {
      setMsg({ tone: 'danger', text: `匯出失敗：${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card title="匯出備份">
      <p className="-mt-2 mb-4 text-sm text-text-2">
        把所有資料（時間軸、專案、收藏、客戶、人脈、報價單、合約、選項、模板、設定）存成一個 JSON 檔。建議定期備份，並存放在雲端硬碟。
      </p>
      <Checkbox label="包含附件檔案（檔案會變大）" checked={withFiles} onChange={(e) => setWithFiles(e.target.checked)} disabled={Boolean(busy)} />
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button variant="primary" bracket icon={<Download size={15} />} loading={Boolean(busy)} disabled={!online} onClick={() => void run()}>
          下載備份（JSON）
        </Button>
        {busy ? (
          <span className="text-sm text-text-2" role="status">
            {busy}
          </span>
        ) : (
          <span className="tabular font-mono text-xs text-text-2">{last ? `這台裝置上次匯出：${formatDateTime(last)}` : '這台裝置尚未匯出過'}</span>
        )}
      </div>
      {!online && <p className="field-help">離線時無法匯出（資料在雲端）。</p>}
      {msg && (
        <Alert tone={msg.tone} className="mt-4">
          {msg.text}
        </Alert>
      )}
    </Card>
  )
}

function ImportCard() {
  const online = useOnline()
  const { refreshSettings } = useAppState()
  const input = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<{ backup: Backup; warnings: string[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [safety, setSafety] = useState(true)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const pick = async (f: File | undefined) => {
    setErr(null)
    setDone(null)
    setParsed(null)
    if (!f) return
    setFileName(f.name)
    const r = parseBackup(await f.text())
    if (!r.ok) return setErr(r.error)
    setParsed({ backup: r.backup, warnings: r.warnings })
  }

  const restore = async () => {
    if (!parsed) return
    setConfirm(false)
    setErr(null)
    let safetySaved = false
    try {
      if (safety) {
        setBusy('還原前先下載目前資料的備份…')
        await exportNow(false, setBusy, '-還原前')
        safetySaved = true
      }
      setBusy('準備還原…')
      const plan = planRestore(parsed.backup, await backupRepo.currentProtected())
      const { filesFailed } = await backupRepo.restore(parsed.backup, plan, setBusy)
      await queryClient.invalidateQueries()
      await refreshSettings()
      setDone(`還原完成。${filesFailed.length ? `有 ${filesFailed.length} 個附件檔上傳失敗：${filesFailed.join('、')}` : ''}`)
      setParsed(null)
      setFileName(null)
      if (input.current) input.current.value = ''
    } catch (e) {
      setErr(`還原失敗：${e instanceof Error ? e.message : String(e)}。${safetySaved ? '還原前的備份已下載，可以用它再還原一次。' : ''}`)
      await queryClient.invalidateQueries()
    } finally {
      setBusy(null)
    }
  }

  const counts = parsed ? countRows(parsed.backup).filter((c) => c.count > 0) : []

  return (
    <Card title="匯入（還原）">
      <p className="-mt-2 mb-4 text-sm text-text-2">選擇之前匯出的備份檔。還原會以備份內容「取代」目前所有資料。</p>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--r-lg)] border border-dashed border-line px-4 py-8 text-center text-sm text-text-2 hover:bg-surface-2">
        <FileUp size={22} strokeWidth={1.5} />
        <span>{fileName ?? '點此選擇備份檔（.json）'}</span>
        <input ref={input} type="file" accept="application/json,.json" aria-label="選擇備份檔" className="sr-only" disabled={Boolean(busy)} onChange={(e) => void pick(e.target.files?.[0])} />
      </label>

      {parsed && (
        <div className="mt-5 space-y-4">
          <p className="text-sm">
            備份時間 <span className="tabular font-mono">{formatDateTime(parsed.backup.exported_at)}</span>
            {parsed.backup.app_version && <span className="ml-2 text-text-2">（v{parsed.backup.app_version}）</span>}
          </p>
          <dl aria-label="備份內容" className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {counts.map((c) => (
              <div key={c.table} className="flex justify-between border-b border-dashed border-line-soft py-1">
                <dt className="text-text-2">{c.label}</dt>
                <dd className="tabular font-mono">{c.count}</dd>
              </div>
            ))}
            {parsed.backup.files && (
              <div className="flex justify-between border-b border-dashed border-line-soft py-1">
                <dt className="text-text-2">附件檔案</dt>
                <dd className="tabular font-mono">{Object.keys(parsed.backup.files).length}</dd>
              </div>
            )}
          </dl>
          {parsed.warnings.map((w) => (
            <Alert key={w} tone="warning">
              {w}
            </Alert>
          ))}
          <Checkbox label="還原前先下載目前資料的備份（建議）" checked={safety} onChange={(e) => setSafety(e.target.checked)} disabled={Boolean(busy)} />
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="danger" bracket icon={<RotateCcw size={15} />} loading={Boolean(busy)} disabled={!online} onClick={() => setConfirm(true)}>
              以此備份取代目前資料
            </Button>
            {busy && (
              <span className="flex items-center gap-2 text-sm text-text-2" role="status">
                <Spinner size={14} /> {busy}
              </span>
            )}
          </div>
        </div>
      )}
      {!online && <p className="field-help">離線時無法還原。</p>}
      {err && (
        <Alert tone="danger" className="mt-4">
          {err}
        </Alert>
      )}
      {done && (
        <Alert tone="info" className="mt-4">
          {done}
        </Alert>
      )}
      <ConfirmDialog
        open={confirm}
        title="確定要以備份取代目前所有資料？"
        confirmLabel="確認還原"
        onCancel={() => setConfirm(false)}
        onConfirm={() => void restore()}
      >
        目前的時間軸、專案、客戶、報價單等資料會被刪除，改成備份檔的內容，無法復原。{safety ? '還原前會先下載一份目前資料的備份。' : '你已取消「還原前先備份」。'}
      </ConfirmDialog>
    </Card>
  )
}

export function BackupSection() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <ExportCard />
      <ImportCard />
    </div>
  )
}
