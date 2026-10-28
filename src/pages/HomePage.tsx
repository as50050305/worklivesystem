import { Check, Download, RefreshCw, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { useAppState } from '@/app/AppStateProvider'
import { PageHeader } from '@/components/PageHeader'
import { Alert, Badge, Button, Card, Chip, ProgressRing, Spinner } from '@/components/ui'
import { colorTagsRepo } from '@/data/repositories/colorTagsRepo'
import type { ColorTag } from '@/data/types'
import { formatDateTime } from '@/lib/dates'
import { appVersion, buildTime } from '@/lib/env'
import { usePwa } from '@/pwa/PwaProvider'

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
  ['P1', '骨架、Supabase、登入、Style Guide、部署、PWA'],
  ['P2', '顏色標籤、時間軸、側邊欄'],
  ['P3', '專案、筆記、階段模板、看板、地圖'],
  ['P4', '收藏庫與轉換'],
  ['P5', '客戶、追蹤自動化、速記、人脈'],
  ['P6', '報價單、品項庫、合約 PDF、成交同步'],
  ['P7', '備份、RWD、全域搜尋、離線、整體測試'],
] as const

export function HomePage() {
  const { settings, setupError } = useAppState()
  const pwa = usePwa()
  const [tags, setTags] = useState<ColorTag[] | null>(null)
  const [tagError, setTagError] = useState<string | null>(null)

  useEffect(() => {
    if (!settings) return
    colorTagsRepo
      .list()
      .then(setTags)
      .catch((e: unknown) => setTagError(e instanceof Error ? e.message : String(e)))
  }, [settings])

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
            <ProgressRing value={(4 / 7) * 100} size={220} label="P4 ／ 7" sublabel="收藏庫完成" />
          </div>
          <ol className="mt-4">
            {PHASES.map(([p, desc], i) => (
              <li key={p} className="flex items-center gap-3 border-b border-dashed border-line-soft py-2 text-sm last:border-0">
                <Badge tone={i <= 3 ? 'primary' : 'neutral'}>{p}</Badge>
                <span className={i <= 3 ? 'text-text' : 'text-text-2'}>{desc}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  )
}
