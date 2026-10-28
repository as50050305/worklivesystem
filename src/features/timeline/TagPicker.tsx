import { useColorTags } from '@/data/hooks'
import { cn } from '@/lib/cn'

/** 單選顏色標籤（膠囊） */
export function TagPicker({ value, onChange, disabled }: { value: string | null; onChange: (id: string) => void; disabled?: boolean }) {
  const { data: tags = [] } = useColorTags()
  const current = value ?? tags.find((t) => t.is_default)?.id
  return (
    <div role="radiogroup" aria-label="顏色標籤" className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const on = t.id === current
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(t.id)}
            className={cn('chip', on && 'border-[1.5px]')}
            style={on ? { borderColor: t.color, boxShadow: `inset 0 0 0 1px ${t.color}` } : undefined}
          >
            <span className="chip-dot" style={{ background: t.color }} />
            {t.name}
          </button>
        )
      })}
    </div>
  )
}
