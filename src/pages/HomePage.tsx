import { Check, Download, RefreshCw, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAppState } from '@/app/AppStateProvider'
import { PageHeader } from '@/components/PageHeader'
import { Alert, Badge, Button, Card, Chip, ProgressRing, Spinner } from '@/components/ui'
import { useColorTags } from '@/data/hooks'
import { formatDateTime } from '@/lib/dates'
import { appVersion, buildTime } from '@/lib/env'
import { usePwa } from '@/pwa/PwaProvider'
import { useOnline } from '@/pwa/useOnline'

function readLastBackup(): string | null {
  try {
    return localStorage.getItem('wls.lastBackupAt')
  } catch {
    return null
  }
}

type Status = 'ok' | 'fail' | 'pending' | 'info'

function Row({ status, label, children }: { status: Status; label: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 border-b border-dashed border-line-soft py-3 last:border-0">
      <span
        className={
          status === 'ok'
            ? 'mt-0.5 grid size-5 flex-none place-items-center rounded-full bg-primary text-on-primary'
            : status === 'fail'
              ? 'mt-0.5 grid size-5 flex-none place-items-center rounded-full border border-danger text-danger'
              : 'mt-0.5 grid size-5 flex-none place-items-center rounded-full border border-line text-text-2'
        }
        aria-hidden
      >
        {status === 'ok' ? <Check size={12} strokeWidth={3} /> : status === 'fail' ? <X size={12} strokeWidth={3} /> : status === 'pending' ? <Spinner size={12} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="label-caps text-[11px] text-text-2">{label}</p>
        <div className="mt-1 text-sm">{children}</div>
      </div>
    </li>
  )
}

const PHASES = [
  ['P1', '骨架、Supabase、Style Guide、部署、PWA'],
  ['P2', '顏色標籤、時間軸、側邊欄'],
  ['P3', '專案、筆記、階段模板、看板、地圖'],
  ['P4', '收藏庫與轉換'],
  ['P5', '客戶、追蹤自動化、速記、人脈'],
  ['P6', '報價單、品項庫、合約 PDF、成交同步'],
  ['P7', '備份、RWD、全域搜尋、離線、整體測試'],
] as const

export function HomePage() {
  const { settings, setupError, usingCachedSettings } = useAppState()
  const pwa = usePwa()
  const online = useOnline()
  const tagsQ = useColorTags()
  const tags = tagsQ.data ?? null
  const tagError = tagsQ.error ? (tagsQ.error instanceof Error ? tagsQ.error.message : String(tagsQ.error)) : null
  const lastBackup = readLastBackup()
  const backupDays = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86_400_000) : null

  return (
    <>
      <PageHeader title="總覽" eyebrow="System">
        系統狀態與開發進度。
      </PageHeader>

      {setupError && (
        <Alert tone="danger" title="資料庫尚未就緒" className="mb-6">
          {setupError}
          <p className="mt-1 text-text-2">通常是 migration 尚未套用，請依 README 執行 npx supabase db push。</p>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="系統狀態">
          <ul>
            <Row status="info" label="存取模式">
              免登入（單人使用）。網址請勿外流，
              <Link to="/settings?tab=security" className="underline decoration-dotted underline-offset-4">
                了解風險與建議
              </Link>
            </Row>
            <Row status={settings?.seeded_at ? 'ok' : setupError ? 'fail' : 'pending'} label="預設資料">
              {settings?.seeded_at ? `已建立（${formatDateTime(settings.seeded_at)}）` : setupError ? '建立失敗' : '建立中…'}
            </Row>
            <Row status={online && !usingCachedSettings ? 'ok' : 'info'} label="連線">
              {online && !usingCachedSettings ? '已連線，資料即時同步' : '離線中：顯示這台裝置上次同步的資料，暫停編輯；恢復連線後自動更新'}
            </Row>
            <Row status={backupDays !== null && backupDays <= 30 ? 'ok' : 'info'} label="備份">
              {lastBackup ? `這台裝置上次匯出：${formatDateTime(lastBackup)}${backupDays! > 30 ? `（已超過 ${backupDays} 天）` : ''}` : '這台裝置尚未匯出過備份'}
              {'　'}
              <Link to="/settings?tab=backup" className="underline decoration-dotted underline-offset-4">
                匯出／匯入
              </Link>
            </Row>
            <Row status={tags ? 'ok' : tagError ? 'fail' : 'pending'} label="資料讀取（RLS）">
              {tags ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <Chip key={t.id} color={t.color}>
                      {t.name}
                    </Chip>
                  ))}
                </div>
              ) : (
                (tagError ?? '讀取中…')
              )}
            </Row>
            <Row status={pwa.isStandalone ? 'ok' : 'info'} label="App 安裝">
              {pwa.isStandalone ? (
                '目前以已安裝的 App 開啟'
              ) : pwa.canInstall ? (
                <Button variant="primary" size="sm" bracket icon={<Download size={14} />} onClick={pwa.promptInstall}>
                  安裝為 App
                </Button>
              ) : (
                '在瀏覽器中開啟。安裝方式請見 README（Safari／iPhone 需用「分享 → 加入主畫面」）'
              )}
            </Row>
            <Row status={pwa.needRefresh ? 'info' : 'ok'} label="版本">
              <div className="flex flex-wrap items-center gap-3">
                <span className="tabular font-mono">v{appVersion}</span>
                <span className="text-xs text-text-2">建置於 {formatDateTime(buildTime)}</span>
                {pwa.needRefresh ? (
                  <Button variant="primary" size="sm" onClick={pwa.applyUpdate} icon={<RefreshCw size={14} />}>
                    更新到新版
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={pwa.checkForUpdate} icon={<RefreshCw size={14} />}>
                    檢查更新
                  </Button>
                )}
              </div>
            </Row>
          </ul>
        </Card>

        <Card title="開發進度">
          <div className="flex justify-center py-2">
            <ProgressRing value={100} size={220} label="P7 ／ 7" sublabel="全部完成" />
          </div>
          <ol className="mt-4">
            {PHASES.map(([p, desc]) => (
              <li key={p} className="flex items-center gap-3 border-b border-dashed border-line-soft py-2 text-sm last:border-0">
                <Badge tone="primary">{p}</Badge>
                <span>{desc}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  )
}
