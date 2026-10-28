import { useQuery } from '@tanstack/react-query'
import { Bookmark, BookUser, CalendarRange, CornerDownLeft, FileText, FolderKanban, LayoutDashboard, NotebookPen, Search, Users, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/ui'
import { useClients, useContacts } from '@/data/clientHooks'
import { useCollections } from '@/data/collectionHooks'
import { useOptions, useProjects } from '@/data/projectHooks'
import { useQuoteLineNames, useQuotes } from '@/data/quoteHooks'
import { searchRepo } from '@/data/repositories/searchRepo'
import type { TimelineItem } from '@/data/types'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/dates'
import { quoteNumber } from '@/lib/quotes'
import { searchEntries, snippet, type SearchEntry, type SearchGroup } from '@/lib/search'

interface Entry extends SearchEntry {
  to?: string
  timeline?: TimelineItem
  /** 顯示關鍵字附近片段的來源文字（筆記） */
  snippetOf?: string
}

const PAGES: { title: string; to: string; subtitle?: string; text?: string }[] = [
  { title: '總覽', to: '/', text: 'home dashboard 首頁' },
  { title: '時間軸', to: '/timeline', text: 'timeline calendar 行事曆 日曆 排程' },
  { title: '專案', to: '/projects', text: 'projects 看板 地圖' },
  { title: '收藏庫', to: '/collections', text: 'collections 收藏' },
  { title: '客戶', to: '/clients', text: 'clients 追蹤' },
  { title: '報價單', to: '/quotes', text: 'quotes 報價' },
  { title: '品項庫', subtitle: '報價單', to: '/quotes?tab=items', text: 'items 單價' },
  { title: '人脈', to: '/contacts', text: 'contacts 聯絡人' },
  { title: '顏色標籤', subtitle: '設定', to: '/settings?tab=tags', text: 'settings tags 生活代辦' },
  { title: '外觀', subtitle: '設定', to: '/settings?tab=appearance', text: 'settings theme 主題 深色 淺色' },
  { title: '選項表', subtitle: '設定', to: '/settings?tab=options', text: 'settings options 類型 狀態' },
  { title: '階段模板', subtitle: '設定', to: '/settings?tab=templates', text: 'settings templates 任務' },
  { title: '報價與合約', subtitle: '設定', to: '/settings?tab=contracts', text: 'settings 合約模板 報價方 匯款 contract' },
  { title: '匯出／匯入', subtitle: '設定', to: '/settings?tab=backup', text: 'settings 備份 還原 backup restore export import json' },
  { title: '安全與版本', subtitle: '設定', to: '/settings?tab=security', text: 'settings security version 版本' },
  { title: 'Style Guide', subtitle: '設計系統', to: '/style-guide', text: 'design 元件' },
]

const ICONS: Record<SearchGroup, LucideIcon> = {
  頁面: LayoutDashboard,
  專案: FolderKanban,
  客戶: Users,
  報價單: FileText,
  人脈: BookUser,
  收藏: Bookmark,
  時間軸: CalendarRange,
  筆記: NotebookPen,
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl+K'

function useEntries(open: boolean): { entries: Entry[]; loading: boolean } {
  const projects = useProjects()
  const clients = useClients()
  const contacts = useContacts()
  const collections = useCollections()
  const quotes = useQuotes()
  const lineNames = useQuoteLineNames()
  const { data: options = [] } = useOptions()
  const extras = useQuery({ queryKey: ['search', 'extras'], queryFn: searchRepo.extras, enabled: open, staleTime: 60_000 })

  const entries = useMemo(() => {
    const label = (id: string | null) => options.find((o) => o.id === id)?.label
    const clientOf = (id: string | null) => clients.data?.find((c) => c.id === id)
    const projectOf = (id: string | null) => projects.data?.find((p) => p.id === id)
    const quoteOf = (id: string | null) => quotes.data?.find((q) => q.id === id)
    const out: Entry[] = PAGES.map((p) => ({ key: `page:${p.to}`, group: '頁面', title: p.title, subtitle: p.subtitle, text: p.text, to: p.to }))
    for (const p of projects.data ?? [])
      out.push({ key: `project:${p.id}`, group: '專案', title: p.name, subtitle: [label(p.type_id), label(p.status_id), p.city].filter(Boolean).join('・'), text: [p.country, clientOf(p.client_id)?.name].filter(Boolean).join(' '), to: `/projects/${p.id}` })
    for (const c of clients.data ?? [])
      out.push({ key: `client:${c.id}`, group: '客戶', title: c.name, subtitle: [c.code, label(c.sales_stage_id)].filter(Boolean).join('・'), text: [c.email, c.phone, c.instagram, c.website].filter(Boolean).join(' '), to: `/clients/${c.id}` })
    for (const q of quotes.data ?? []) {
      const c = clientOf(q.client_id)
      const no = quoteNumber(c?.code, q.version)
      out.push({ key: `quote:${q.id}`, group: '報價單', title: `${no}　${q.title ?? c?.name ?? ''}`.trim(), subtitle: [c?.name, label(q.status_id), formatDate(q.issued_on)].filter(Boolean).join('・'), text: [q.title, projectOf(q.project_id)?.name, ...(lineNames.data?.[q.id] ?? [])].filter(Boolean).join(' '), to: `/quotes/${q.id}` })
    }
    for (const ct of extras.data?.contracts ?? []) {
      const q = quoteOf(ct.quote_id)
      if (q) out.push({ key: `contract:${ct.id}`, group: '報價單', title: ct.title, subtitle: '合約', to: `/quotes/${q.id}` })
    }
    for (const p of contacts.data ?? [])
      out.push({ key: `contact:${p.id}`, group: '人脈', title: p.name, subtitle: [p.company, p.job_title].filter(Boolean).join('・'), text: [p.email, p.phone, p.instagram, p.website, p.referrer_name, p.note].filter(Boolean).join(' '), to: `/contacts?edit=${p.id}` })
    for (const c of collections.data ?? [])
      out.push({ key: `collection:${c.id}`, group: '收藏', title: c.name, subtitle: [label(c.type_id), c.organizer, c.city].filter(Boolean).join('・'), text: [c.country, c.note, c.requirements, c.url].filter(Boolean).join(' '), to: `/collections?edit=${c.id}` })
    for (const t of extras.data?.timeline ?? [])
      out.push({ key: `timeline:${t.id}`, group: '時間軸', title: t.title, subtitle: `${formatDate(t.item_date)}${t.is_done ? '・已完成' : ''}`, text: t.content ?? '', timeline: t })
    for (const n of extras.data?.projectNotes ?? []) {
      const p = projectOf(n.project_id)
      out.push({ key: `pnote:${n.id}`, group: '筆記', title: p?.name ?? '專案筆記', subtitle: '專案筆記', text: n.content, snippetOf: n.content, to: `/projects/${n.project_id}` })
    }
    for (const n of extras.data?.clientNotes ?? []) {
      const c = clientOf(n.client_id)
      out.push({ key: `cnote:${n.id}`, group: '筆記', title: c?.name ?? '客戶速記', subtitle: '客戶速記', text: n.content, snippetOf: n.content, to: `/clients/${n.client_id}` })
    }
    return out
  }, [projects.data, clients.data, contacts.data, collections.data, quotes.data, lineNames.data, options, extras.data])

  return { entries, loading: open && extras.isLoading }
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nav = useNavigate()
  const listId = useId()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const { entries, loading } = useEntries(open)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      setQ('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    if (!open && d.open) d.close()
  }, [open])

  const sections = useMemo(() => searchEntries(entries, q, 6), [entries, q])
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections])
  useEffect(() => setActive(0), [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (e: Entry | undefined) => {
    if (!e) return
    onClose()
    if (e.timeline) {
      nav(`/timeline?view=day&date=${e.timeline.item_date}`, { state: { openItem: e.timeline } })
    } else if (e.to) nav(e.to)
  }

  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      setActive((a) => Math.min(flat.length - 1, a + 1))
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (ev.key === 'Enter' && !ev.nativeEvent.isComposing) {
      ev.preventDefault()
      pick(flat[active])
    }
  }

  let index = -1
  return (
    <dialog
      ref={ref}
      aria-label="全域搜尋"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="card elev-2 mx-auto mb-auto mt-[8vh] flex max-h-[min(640px,84dvh)] w-[min(640px,calc(100vw-24px))] flex-col overflow-hidden p-0 text-text backdrop:bg-[var(--c-backdrop)]"
    >
      <div className="flex items-center gap-3 border-b border-line-soft px-4 sm:px-5">
        <Search size={18} strokeWidth={1.5} className="flex-none text-text-2" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
          aria-label="搜尋關鍵字"
          aria-autocomplete="list"
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-text-3"
          placeholder="搜尋專案、客戶、報價單、人脈、時間軸、筆記…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
        />
        {loading && <Spinner size={14} />}
        <kbd className="hidden rounded-md border border-line-soft px-1.5 py-0.5 font-mono text-[11px] text-text-2 sm:inline">Esc</kbd>
      </div>

      <div ref={listRef} id={listId} role="listbox" aria-label="搜尋結果" className="min-h-0 flex-1 overflow-y-auto p-2">
        {!flat.length && <p className="px-3 py-10 text-center text-sm text-text-2">{q.trim() ? `找不到「${q.trim()}」` : '輸入關鍵字開始搜尋'}</p>}
        {sections.map((s) => {
          const Icon = ICONS[s.group]
          return (
            <div key={s.group} role="group" aria-label={s.group} className="mb-1">
              <p className="label-caps px-3 pb-1 pt-2 text-[11px] text-text-2">
                {s.group}
                {s.more > 0 && <span className="ml-2 normal-case tracking-normal text-text-3">另有 {s.more} 筆</span>}
              </p>
              {s.items.map((e) => {
                index += 1
                const i = index
                const sub = e.snippetOf ? snippet(e.snippetOf, q) : e.subtitle
                return (
                  <div
                    key={e.key}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    tabIndex={-1}
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => pick(e)}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2', i === active && 'bg-primary-soft')}
                  >
                    <Icon size={16} strokeWidth={1.5} className={cn('flex-none', i === active ? 'text-primary-ink' : 'text-text-2')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{e.title}</span>
                      {sub && <span className="block truncate text-xs text-text-2">{sub}</span>}
                    </span>
                    {i === active && <CornerDownLeft size={14} className="flex-none text-text-2" />}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="hidden items-center gap-4 border-t border-line-soft px-5 py-2.5 text-[11px] text-text-2 sm:flex">
        <span>↑ ↓ 選擇</span>
        <span>Enter 開啟</span>
        <span>Esc 關閉</span>
        <span className="ml-auto font-mono">{SHORTCUT_LABEL}</span>
      </div>
    </dialog>
  )
}

/** 全域快捷鍵 Ctrl／⌘ + K */
export function useSearchShortcut(toggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])
}
