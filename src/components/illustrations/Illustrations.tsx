import { useId } from 'react'

/** 線稿插圖：stroke 使用 currentColor，網點用 --c-hatch。全部原創、可自由修改。 */

function Hatch({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="var(--c-hatch)" strokeWidth="1" />
      </pattern>
    </defs>
  )
}

const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** 吊燈：空的今日排程 */
export function LampIllustration({ size = 120 }: { size?: number }) {
  const h = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <Hatch id={h} />
      <g {...common}>
        <line x1="60" y1="4" x2="60" y2="40" />
        <path d="M54 52 L60 40 L66 52" />
        <path d="M22 84 A38 34 0 0 1 98 84 Z" />
        <path d="M30 84 A30 26 0 0 1 90 84 Z" fill={`url(#${h})`} stroke="none" />
        <path d="M52 84 A8 8 0 0 0 68 84" />
        <line x1="40" y1="100" x2="34" y2="110" strokeDasharray="2 4" />
        <line x1="60" y1="102" x2="60" y2="114" strokeDasharray="2 4" />
        <line x1="80" y1="100" x2="86" y2="110" strokeDasharray="2 4" />
      </g>
    </svg>
  )
}

/** 盆栽：沒有資料 */
export function PlantIllustration({ size = 120 }: { size?: number }) {
  const h = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <Hatch id={h} />
      <g {...common}>
        <path d="M60 78 C60 60 60 46 60 30" />
        <path d="M60 58 C48 56 38 46 36 32 C50 32 59 42 60 58 Z" fill={`url(#${h})`} />
        <path d="M60 50 C70 46 80 36 82 22 C68 24 61 34 60 50 Z" />
        <path d="M60 66 C70 66 80 60 86 50 C74 48 64 54 60 66 Z" />
        <path d="M38 78 H82 L76 112 H44 Z" />
        <line x1="40" y1="86" x2="80" y2="86" />
        <line x1="20" y1="112" x2="100" y2="112" strokeDasharray="3 4" />
      </g>
    </svg>
  )
}

/** 空箱子：清單為空 */
export function BoxIllustration({ size = 120 }: { size?: number }) {
  const h = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <Hatch id={h} />
      <g {...common}>
        <path d="M24 50 L60 36 L96 50 L60 64 Z" fill={`url(#${h})`} />
        <path d="M24 50 V88 L60 104 V64" />
        <path d="M96 50 V88 L60 104" />
        <path d="M24 50 L12 36 L48 22 L60 36" />
        <path d="M96 50 L108 36 L72 22 L60 36" />
        <line x1="70" y1="86" x2="86" y2="79" />
      </g>
    </svg>
  )
}

/** 地球：地圖檢視空狀態 */
export function GlobeIllustration({ size = 120 }: { size?: number }) {
  const h = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <Hatch id={h} />
      <g {...common}>
        <circle cx="60" cy="56" r="38" />
        <ellipse cx="60" cy="56" rx="16" ry="38" />
        <line x1="22" y1="56" x2="98" y2="56" />
        <path d="M27 38 H93 M27 74 H93" strokeDasharray="2 3" />
        <path d="M74 30 C70 24 66 22 62 24 C64 30 70 34 74 30 Z" fill={`url(#${h})`} />
        <line x1="60" y1="94" x2="60" y2="106" />
        <line x1="44" y1="108" x2="76" y2="108" />
      </g>
    </svg>
  )
}
