import { countdown, formatDate, type PlainDate } from '@/lib/dates'
import { cn } from '@/lib/cn'

/** 倒數大數字：今天／N 天／已過 N 天 */
export function Countdown({
  target,
  today,
  caption,
  size = 'lg',
}: {
  target: PlainDate
  today: PlainDate
  caption?: string
  size?: 'md' | 'lg'
}) {
  const cd = countdown(target, today)
  return (
    <div>
      {caption && <p className="label-caps text-text-2">{caption}</p>}
      <p className={cn('tabular mt-1 flex items-baseline gap-2 font-mono font-medium leading-none', cd.kind === 'past' && 'text-text-3')}>
        {cd.kind === 'today' ? (
          <span className={cn(size === 'lg' ? 'text-6xl' : 'text-4xl', 'text-primary-ink')}>今天</span>
        ) : (
          <>
            {cd.kind === 'past' && <span className="text-base">已過</span>}
            <span className={size === 'lg' ? 'text-7xl tracking-tight' : 'text-5xl tracking-tight'}>{cd.days}</span>
            <span className="text-base">天</span>
          </>
        )}
      </p>
      <p className="mt-2 font-mono text-[13px] text-text-2">{formatDate(target)}</p>
    </div>
  )
}
