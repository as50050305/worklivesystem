import type { ReactNode } from 'react'

/** 頁面大標題（參考圖 1 的「Lighting」） */
export function PageHeader({ title, eyebrow, actions, children }: { title: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="label-caps mb-2 text-text-2">{eyebrow}</p>}
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children && <div className="mt-3 max-w-2xl text-text-2">{children}</div>}
    </div>
  )
}
