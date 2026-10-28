import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface ChipProps {
  children: ReactNode
  /** 顏色圓點（例如顏色標籤） */
  color?: string
  selected?: boolean
  onClick?: () => void
  onRemove?: () => void
  className?: string
}

export function Chip({ children, color, selected, onClick, onRemove, className }: ChipProps) {
  const content = (
    <>
      {color && <span className="chip-dot" style={{ background: color }} aria-hidden />}
      <span>{children}</span>
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={cn('chip', className)} aria-pressed={selected ?? false} onClick={onClick}>
        {content}
      </button>
    )
  }
  return (
    <span className={cn('chip', selected && 'selected', className)}>
      {content}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="移除"
          className="-mr-1 grid size-5 place-items-center rounded-full hover:bg-surface-2"
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
    </span>
  )
}
