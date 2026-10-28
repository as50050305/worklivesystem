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
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('tabs', className)}>
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
