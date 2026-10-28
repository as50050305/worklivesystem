import { cn } from '@/lib/cn'

/** 階段進度條：每個階段一格，已完成格實色、目前格網點、未來格空框 */
export function StageBar({ stages, current, className }: { stages: string[]; current: number; className?: string }) {
  return (
    <div className={className}>
      <div className="flex gap-1" role="img" aria-label={`目前階段：${stages[current] ?? '—'}（${current + 1}／${stages.length}）`}>
        {stages.map((s, i) => (
          <span
            key={s}
            title={s}
            className={cn(
              'h-2.5 flex-1 rounded-full border',
              i < current && 'border-primary bg-primary',
              i === current && 'hatch-dense border-primary-ink',
              i > current && 'border-line-soft',
            )}
          />
        ))}
      </div>
    </div>
  )
}
