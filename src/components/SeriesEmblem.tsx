/**
 * 「初號機配色」系列的徽章：原創圖形（六角機板＋三段上升的進度條），只在該系列顯示。
 * 不是任何作品的標誌；顏色全部取自主題 token，深色、淺色都會跟著變。
 */
export function SeriesEmblem({ size = 46, className }: { size?: number; className?: string }) {
  return (
    <div className={`series-emblem items-center gap-3 ${className ?? ''}`} role="img" aria-label="工作生活規劃 徽章">
      <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden className="flex-none">
        {/* 六角機板 */}
        <polygon points="28,3 50,15.5 50,40.5 28,53 6,40.5 6,15.5" fill="var(--c-surface-3)" stroke="var(--c-line)" strokeWidth="1.5" strokeLinejoin="round" />
        {/* 內框：上半以主色描邊，右上角留缺口 */}
        <polyline points="10.5,35 10.5,18 28,8 38,13.7" fill="none" stroke="var(--c-primary-ink)" strokeWidth="1.5" strokeLinecap="square" />
        {/* 右上角的警示色切角 */}
        <polygon points="41,15.4 45.5,18 45.5,24" fill="var(--c-warning)" />
        {/* 三段上升的進度條：計畫 → 進行 → 完成 */}
        <rect x="16.5" y="31" width="5.5" height="9" fill="var(--c-primary)" stroke="var(--c-line)" strokeWidth="0.75" />
        <rect x="25.25" y="25" width="5.5" height="15" fill="var(--c-primary)" stroke="var(--c-line)" strokeWidth="0.75" />
        <rect x="34" y="19" width="5.5" height="21" fill="var(--c-primary)" stroke="var(--c-line)" strokeWidth="0.75" />
        {/* 底線與刻度 */}
        <line x1="14" y1="43.5" x2="42" y2="43.5" stroke="var(--c-line)" strokeWidth="1.5" />
        <line x1="19.25" y1="45.5" x2="19.25" y2="47.5" stroke="var(--c-line)" strokeWidth="1" />
        <line x1="28" y1="45.5" x2="28" y2="48.5" stroke="var(--c-line)" strokeWidth="1" />
        <line x1="36.75" y1="45.5" x2="36.75" y2="47.5" stroke="var(--c-line)" strokeWidth="1" />
      </svg>
      <div className="min-w-0 leading-none">
        <p className="font-mono text-[13px] font-bold tracking-[0.16em] text-text">WORK·LIFE</p>
        <p className="mt-1.5 font-mono text-[9px] tracking-[0.22em] text-text-2">PLANNING SYSTEM</p>
        <p className="mt-1.5 text-[11px] tracking-[0.3em] text-primary-ink">工作生活規劃</p>
      </div>
    </div>
  )
}
