/** 刻度式載入指示（線稿風） */
export function Spinner({ size = 16, label = '載入中' }: { size?: number; label?: string }) {
  const ticks = 8
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="status"
      aria-label={label}
      style={{ animation: 'spin-steps 0.9s steps(8) infinite' }}
    >
      {Array.from({ length: ticks }, (_, i) => (
        <line
          key={i}
          x1="12"
          y1="2.5"
          x2="12"
          y2="7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.2 + (0.8 * i) / (ticks - 1)}
          transform={`rotate(${(360 / ticks) * i} 12 12)`}
        />
      ))}
    </svg>
  )
}
