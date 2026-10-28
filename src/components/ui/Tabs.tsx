import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: string
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  ariaLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // 目前分頁捲到可見範圍（窄螢幕分頁列可左右滑動）
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    const box = ref.current
    if (!el || !box || box.scrollWidth <= box.clientWidth) return
    const left = el.offsetLeft - box.offsetLeft
    if (left < box.scrollLeft || left + el.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollTo({ left: Math.max(0, left - 24) })
  }, [value])
  return (
    <div ref={ref} role="tablist" aria-label={ariaLabel} className={cn('tabs', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={it.value === value}
          className="tab"
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
