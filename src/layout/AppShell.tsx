import { CloudOff, Menu, Moon, OctagonAlert, RefreshCw, Search, Sun, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { runDailyCheck } from '@/automation/dailyCheck'
import { useAppState } from '@/app/AppStateProvider'
import { useRealtimeSync } from '@/data/hooks'
import { onMutationError } from '@/data/queryClient'
import { TimelineEditorProvider } from '@/features/timeline/EditorContext'
import { useToday } from '@/lib/useToday'
import { NavLink, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/ThemeContext'
import { usePwa } from '@/pwa/PwaProvider'
import { useOnline } from '@/pwa/useOnline'
import { NAV_ITEMS } from './nav'
import { Sidebar } from './Sidebar'

const COLLAPSE_KEY = 'wls.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function ThemeButton() {
  const { theme, toggle } = useTheme()
  return (
    <Button
      variant="ghost"
      iconOnly
      size="sm"
      aria-label={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
      onClick={toggle}
      icon={theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
    />
  )
}

function OfflinePill() {
  const online = useOnline()
  if (online) return null
  return (
    <span className="badge h-7 gap-1.5 border-dashed px-3 text-warning" role="status">
      <CloudOff size={14} strokeWidth={1.75} /> 離線中
    </span>
  )
}

function NavTabs() {
  return (
    <nav aria-label="主選單" className="tabs gap-6 border-b-0">
      {NAV_ITEMS.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/'}
          className={({ isActive }) => cn('tab', isActive && 'active', it.phase && !isActive && 'text-text-3')}
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** 寫入失敗時在頁首下方顯示（非彈跳通知） */
function MutationErrorBar() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => onMutationError(setMsg), [])
  if (!msg) return null
  return (
    <div role="alert" className="flex items-center gap-3 border-b border-danger bg-danger-soft px-4 py-2.5 text-sm text-danger sm:px-6 lg:px-10">
      <OctagonAlert size={16} strokeWidth={1.75} className="flex-none" />
      <span className="flex-1">變更未儲存：{msg}</span>
      <button type="button" aria-label="關閉" onClick={() => setMsg(null)} className="grid size-7 place-items-center rounded-lg hover:bg-danger-soft">
        <X size={14} />
      </button>
    </div>
  )
}

/** 背景工作：即時同步、每日檢查 */
function useBackgroundSync() {
  const { settings } = useAppState()
  const ready = Boolean(settings)
  const today = useToday()
  useRealtimeSync(ready)
  useEffect(() => {
    if (ready) runDailyCheck(today).catch(() => {})
  }, [ready, today])
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TimelineEditorProvider>
      <AppShellInner>{children}</AppShellInner>
    </TimelineEditorProvider>
  )
}

function AppShellInner({ children }: { children: ReactNode }) {
  useBackgroundSync()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setDrawerOpen(false), [location.pathname])

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !c
    })
  }

  return (
    <div className="flex min-h-dvh">
      {/* 桌面側邊欄 */}
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh flex-none border-r border-line bg-surface lg:block',
          collapsed ? 'w-16' : 'w-[300px]',
        )}
        aria-label="提醒側邊欄"
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* 手機抽屜 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="選單">
          <button type="button" aria-label="關閉選單" className="absolute inset-0 bg-[var(--c-backdrop)]" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(340px,88vw)] flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="label-caps text-text-2">選單</span>
              <Button variant="ghost" iconOnly size="sm" aria-label="關閉選單" onClick={() => setDrawerOpen(false)} icon={<X size={18} strokeWidth={1.5} />} />
            </div>
            <nav aria-label="主選單" className="grid grid-cols-2 gap-2 px-5 py-3">
              {NAV_ITEMS.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm',
                      isActive ? 'border-primary bg-primary text-on-primary' : 'border-line-soft text-text',
                    )
                  }
                >
                  <it.icon size={16} strokeWidth={1.5} />
                  {it.label}
                </NavLink>
              ))}
            </nav>
            <div className="min-h-0 flex-1">
              <Sidebar collapsed={false} inDrawer />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur-[2px]">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:h-auto lg:px-8">
            <Button
              variant="ghost"
              iconOnly
              size="sm"
              className="lg:hidden"
              aria-label="開啟選單"
              onClick={() => setDrawerOpen(true)}
              icon={<Menu size={20} strokeWidth={1.5} />}
            />
            <span className="font-mono text-sm font-semibold tracking-[0.14em] lg:hidden">規劃</span>
            <div className="hidden min-w-0 flex-1 lg:block">
              <NavTabs />
            </div>
            <div className="ml-auto flex flex-none items-center gap-1">
              <OfflinePill />
              <Button variant="ghost" iconOnly size="sm" aria-label="快速搜尋（P7）" title="快速搜尋 Ctrl／⌘ + K（P7）" disabled icon={<Search size={18} strokeWidth={1.5} />} />
              <ThemeButton />
            </div>
          </div>
          <MutationErrorBar />
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  )
}

/** 沒有側邊欄的頁面使用的更新按鈕 */
export function PublicUpdateButton() {
  const { needRefresh, applyUpdate } = usePwa()
  if (!needRefresh) return null
  return (
    <Button variant="primary" size="sm" onClick={applyUpdate} icon={<RefreshCw size={14} strokeWidth={1.75} />}>
      有新版本，點此更新
    </Button>
  )
}

/** 尚未設定 Supabase 時的簡易外框（Style Guide 預覽用） */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center justify-between border-b border-line px-4 sm:px-6 lg:px-10">
        <NavLink to="/" className="font-mono text-sm font-semibold tracking-[0.14em]">
          規劃
        </NavLink>
        <div className="flex items-center gap-2">
          <PublicUpdateButton />
          <OfflinePill />
          <ThemeButton />
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  )
}
