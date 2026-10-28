/** 細線長條圖（參考圖 1 的 Analytics） */
export function BarSpark({
  values,
  labels,
  height = 150,
  max,
  unit,
}: {
  values: number[]
  labels?: string[]
  height?: number
  max?: number
  unit?: string
}) {
  const top = max ?? Math.max(...values, 1)
  const gridSteps = 4
  const w = 100
  return (
    <div>
      <div className="relative" style={{ height }}>
        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const v = Math.round((top / gridSteps) * (gridSteps - i))
          return (
            <div key={i} className="absolute inset-x-0 flex items-center gap-2" style={{ top: `${(i / gridSteps) * 100}%` }}>
              <span className="tabular w-8 -translate-y-1/2 font-mono text-[11px] text-text-3">{v}</span>
              <span className="h-0 flex-1 -translate-y-1/2 border-t border-line-soft" />
            </div>
          )
        })}
        <svg className="absolute bottom-0 left-10 h-full w-[calc(100%-2.5rem)]" viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" aria-hidden>
          {values.map((v, i) => {
            const x = ((i + 0.5) / values.length) * w
            return (
              <line
                key={i}
                x1={x}
                x2={x}
                y1={100}
                y2={100 - (v / top) * 100}
                stroke="var(--c-text)"
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>
      </div>
      {labels && (
        <div className="ml-10 mt-2 flex justify-between font-mono text-[11px] uppercase tracking-wider text-text-2">
          {unit && <span className="-ml-10 w-10 text-text-3">{unit}</span>}
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}
