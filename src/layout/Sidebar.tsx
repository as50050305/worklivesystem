import { CloudOff, PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAppState } from '@/app/AppStateProvider'
import { Button } from '@/components/ui'
import { formatDate, taipeiParts, weekdayZh } from '@/lib/dates'
import { appVersion } from '@/lib/env'
import { useNow } from '@/lib/useNow'
import { usePwa } from '@/pwa/PwaProvider'
import { SidebarSections } from './SidebarSections'
import { useOnline } from '@/pwa/useOnline'

function Clock({ compact }: { compact?: boolean }) {
  const now = useNow()
  const p = taipeiParts(now)
  const [hh, mm, ss] = p.time.split(':')
  if (compact) {
    return (
      <div className="tabular text-center font-mono text-sm font-medium" aria-label={`現在時間 ${p.time}`}>
        {hh}
        <br />
        {mm}
      </div>
    )
  }
  return (
    <div aria-live="off">
      <p className="tabular font-mono text-[44px] font-medium leading-none tracking-tight">
        {hh}:{mm}
        <span className="ml-1 text-xl text-text-3">{ss}</span>
      </p>
      <p className="tabular mt-2 font-mono text-[13px] text-text-2">
        {formatDate(p.date)} {weekdayZh(p.date)}
      </p>
    </div>
  )
}

/** 側邊欄：所有提醒集中在這裡（不使用彈跳通知） */
export function Sidebar({
  collapsed,
  onToggleCollapsed,
  inDrawer = false,
  footerExtra,
}: {
  collapsed: boolean
  onToggleCollapsed?: () => void
  inDrawer?: boolean
  footerExtra?: ReactNode
}) {
  const { settings } = useAppState()
  const { needRefresh, applyUpdate } = usePwa()
  const online = useOnline()

  if (collapsed && !inDrawer) {
    return (
      <div className="flex h-full flex-col items-center gap-4 py-5">
        <Button variant="ghost" iconOnly size="sm" aria-label="展開側邊欄" onClick={onToggleCollapsed} icon={<PanelLeftOpen size={18} strokeWidth={1.5} />} />
        <Clock compact />
        {needRefresh && (
          <Button variant="primary" iconOnly size="sm" aria-label="有新版本，點此更新" onClick={applyUpdate} icon={<RefreshCw size={16} strokeWidth={1.75} />} />
        )}
        {!online && <CloudOff size={18} strokeWidth={1.5} className="text-warning" aria-label="離線中" />}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 px-5 pb-4 pt-5">
        <Clock />
        {onToggleCollapsed && !inDrawer && (
          <Button variant="ghost" iconOnly size="sm" aria-label="收合側邊欄" onClick={onToggleCollapsed} icon={<PanelLeftClose size={18} strokeWidth={1.5} />} />
        )}
      </div>

      {(needRefresh || !online) && (
        <div className="space-y-2 px-5 pb-4">
          {needRefresh && (
            <button
              type="button"
              onClick={applyUpdate}
              className="elev-1 flex w-full items-center gap-3 rounded-2xl border border-primary bg-primary px-4 py-3 text-left text-on-primary"
            >
              <RefreshCw size={18} strokeWidth={1.75} className="flex-none" />
              <span className="text-sm font-semibold">有新版本，點此更新</span>
            </button>
          )}
          {!online && (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-warning px-4 py-3 text-warning">
              <CloudOff size={18} strokeWidth={1.5} className="flex-none" />
              <span className="text-sm">離線中：可瀏覽，暫停編輯</span>
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {settings ? <SidebarSections /> : null}
      </div>

      <footer className="border-t border-line-soft px-5 py-4">
        {footerExtra}
        <p className="tabular font-mono text-[11px] text-text-3">v{appVersion}</p>
      </footer>
    </div>
  )
}
