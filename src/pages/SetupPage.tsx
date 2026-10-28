import { Link } from 'react-router-dom'
import { BoxIllustration } from '@/components/illustrations/Illustrations'
import { Card, EmptyState } from '@/components/ui'

/** 尚未設定 Supabase 環境變數時顯示 */
export function SetupPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="max-w-lg" elevation={2}>
        <EmptyState illustration={<BoxIllustration size={96} />} title="尚未連接 Supabase">
          <p>
            請在專案根目錄建立 <code className="font-mono">.env.local</code>（或在 Vercel 設定環境變數）：
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-line-soft bg-surface-3 p-3 text-left font-mono text-xs text-text">
            VITE_SUPABASE_URL=…{'\n'}VITE_SUPABASE_ANON_KEY=…
          </pre>
          <p className="mt-3">詳見 README「建立 Supabase 專案」。</p>
          <p className="mt-4">
            <Link to="/style-guide" className="underline decoration-dotted underline-offset-4">
              先看 Style Guide →
            </Link>
          </p>
        </EmptyState>
      </Card>
    </div>
  )
}
