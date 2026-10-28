import { useId } from 'react'

export interface ProgressRingProps {
  /** 0–100 */
  value: number
  size?: number
  label?: string
  sublabel?: string
  ticks?: number
}

/** 圓形刻度環（參考圖 1）：已完成刻度實色，未完成刻度淡色，內圈圓點標示目前位置 */
export function ProgressRing({ value, size = 240, label, sublabel, ticks = 60 }: ProgressRingProps) {
  const id = useId()
  const v = Math.max(0, Math.min(100, value))
  const c = size / 2
  const rInner = size * 0.33
  const r1 = size * 0.4
  const r2Long = size * 0.47
  const r2Short = size * 0.44
  const done = Math.round((v / 100) * ticks)
  const angle = (v / 100) * 2 * Math.PI - Math.PI / 2
  const dot = { x: c + rInner * Math.cos(angle), y: c + rInner * Math.sin(angle) }
  const text = Number.isInteger(v) ? `${v}` : v.toFixed(1)

  return (
    <figure
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-labelledby={`${id}-t`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
        {Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * 2 * Math.PI - Math.PI / 2
          const long = i % 5 === 0
          const r2 = long ? r2Long : r2Short
          const active = i < done
          return (
            <line
              key={i}
              x1={c + r1 * Math.cos(a)}
              y1={c + r1 * Math.sin(a)}
              x2={c + r2 * Math.cos(a)}
              y2={c + r2 * Math.sin(a)}
              stroke={active ? 'var(--c-primary-ink)' : 'var(--c-line-soft)'}
              strokeWidth={active ? 2.2 : 1.5}
              strokeLinecap="round"
            />
          )
        })}
        <circle cx={c} cy={c} r={rInner} fill="none" stroke="var(--c-line)" strokeWidth={1.25} />
        <circle cx={dot.x} cy={dot.y} r={size * 0.024} fill="var(--c-text)" stroke="var(--c-surface)" strokeWidth={2} />
      </svg>
      <figcaption id={`${id}-t`} className="relative text-center">
        <span className="tabular block font-mono font-medium leading-none tracking-tight" style={{ fontSize: size * 0.15 }}>
          {text}%
        </span>
        {label && <span className="mt-2 block text-[15px] text-text">{label}</span>}
        {sublabel && <span className="block font-mono text-[13px] text-text-2">{sublabel}</span>}
      </figcaption>
    </figure>
  )
}
