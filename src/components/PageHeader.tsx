import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { NAV_ITEMS } from '@/layout/nav'

/** 頁面在主選單中的編號（01、02…）；「初號機配色」系列把它當成機體編號顯示在小標前 */
function pageCode(pathname: string): string | null {
  const idx = NAV_ITEMS.reduce((best, it, i) => {
    const hit = it.to === '/' ? pathname === '/' : pathname === it.to || pathname.startsWith(`${it.to}/`)
    return hit && (best < 0 || it.to.length > NAV_ITEMS[best]!.to.length) ? i : best
  }, -1)
  return idx < 0 ? null : String(idx + 1).padStart(2, '0')
}

/** 頁面大標題（參考圖 1 的「Lighting」） */
export function PageHeader({ title, eyebrow, actions, children }: { title: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const code = pageCode(useLocation().pathname)
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="series-plate min-w-0">
          {eyebrow && (
            <p className="label-caps series-eyebrow mb-2 text-text-2">
              {code && <span className="series-code">{code} — </span>}
              {eyebrow}
            </p>
          )}
          <h1 className="series-title text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children && <div className="mt-3 max-w-2xl text-text-2">{children}</div>}
    </div>
  )
}
