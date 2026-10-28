import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function EmptyState({
  illustration,
  title,
  children,
  action,
  compact = false,
  className,
}: {
  illustration?: ReactNode
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center text-center text-text-2', compact ? 'gap-2 py-4' : 'gap-3 py-10', className)}>
      {illustration && <div className="text-text">{illustration}</div>}
      <p className={cn('font-medium text-text', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {children && <div className="max-w-sm text-sm">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
