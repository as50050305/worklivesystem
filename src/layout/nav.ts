import { BookUser, Bookmark, CalendarRange, FileText, FolderKanban, LayoutDashboard, Palette, Settings, Users, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** 預計實作階段（尚未完成時顯示） */
  phase?: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '總覽', icon: LayoutDashboard },
  { to: '/timeline', label: '時間軸', icon: CalendarRange },
  { to: '/projects', label: '專案', icon: FolderKanban },
  { to: '/collections', label: '收藏庫', icon: Bookmark },
  { to: '/clients', label: '客戶', icon: Users },
  { to: '/quotes', label: '報價單', icon: FileText },
  { to: '/contacts', label: '人脈', icon: BookUser },
  { to: '/settings', label: '設定', icon: Settings },
  { to: '/style-guide', label: 'Style Guide', icon: Palette },
]
