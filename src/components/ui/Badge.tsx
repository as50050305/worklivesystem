import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'primary' | 'steel' | 'lavender' | 'mauve' | 'danger' | 'warning'

const toneClass: Record<BadgeTone, string> = {
  neutral: 'text-text-2',
  primary: 'text-primary-ink',
  steel: 'text-steel-ink',
  lavender: 'text-lavender-ink',
  mauve: 'text-mauve-ink',
  danger: 'text-danger',
  warning: 'text-warning',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn('badge', toneClass[tone], className)}>{children}</span>
}
