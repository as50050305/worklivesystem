import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const map = {
  info: { icon: Info, cls: 'text-steel-ink', bg: '' },
  success: { icon: CheckCircle2, cls: 'text-primary-ink', bg: 'bg-primary-soft' },
  warning: { icon: AlertTriangle, cls: 'text-warning', bg: 'bg-warning-soft' },
  danger: { icon: OctagonAlert, cls: 'text-danger', bg: 'bg-danger-soft' },
} as const

/** 頁內提示（非彈跳通知） */
export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const { icon: Icon, cls, bg } = map[tone]
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border border-current p-4', cls, bg, className)}
    >
      <Icon size={18} strokeWidth={1.75} className="mt-0.5 flex-none" aria-hidden />
      <div className="min-w-0 flex-1 text-sm text-text">
        {title && <p className={cn('label-caps mb-1', cls)}>{title}</p>}
        {children}
      </div>
      {action && <div className="flex-none self-center">{action}</div>}
    </div>
  )
}
