import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  /** 右上角動作（例如「…」選單按鈕） */
  actions?: ReactNode
  elevation?: 0 | 1 | 2 | 3
  padded?: boolean
  as?: 'section' | 'div' | 'article'
}

export function Card({
  title,
  actions,
  elevation = 0,
  padded = true,
  as: Tag = 'section',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag className={cn('card', elevation > 0 && `elev-${elevation}`, padded && 'p-5 sm:p-6', className)} {...rest}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          {title && <h3 className="label-caps text-[13px] text-text">{title}</h3>}
          {actions && <div className="-mr-2 -mt-2 flex items-center gap-1">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  )
}

/** 區塊標題＋點線引導（參考 Style Guide 的「COLOR TOKENS ……」） */
export function SectionTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5 flex items-center gap-3', className)}>
      <h2 className="label-caps whitespace-nowrap text-[13px] text-text">{children}</h2>
      <span aria-hidden className="h-0 flex-1 border-t border-dotted border-line" />
      {aside}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('divider-dashed', className)} />
}
