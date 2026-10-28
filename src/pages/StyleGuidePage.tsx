import {
  Bell,
  Bookmark,
  CalendarRange,
  Check,
  ChevronDown,
  FileText,
  FolderKanban,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { BoxIllustration, GlobeIllustration, LampIllustration, PlantIllustration } from '@/components/illustrations/Illustrations'
import { PageHeader } from '@/components/PageHeader'
import {
  Alert,
  Badge,
  BarSpark,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmDialog,
  Countdown,
  Divider,
  EmptyState,
  Input,
  ProgressRing,
  Radio,
  SectionTitle,
  Select,
  StageBar,
  Switch,
  Tabs,
  Textarea,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { addDays, todayTaipei } from '@/lib/dates'
import { useTheme } from '@/lib/ThemeContext'

/* ---------- 色票 ---------- */

const BRAND = [
  { name: 'Gunmetal', role: '背景與容器', use: '頁面背景、側欄、卡片底色', fill: '--brand-gunmetal', ink: '--c-text' },
  { name: 'Mint', role: '主要操作', use: '主要按鈕、選取、進度、focus ring', fill: '--c-primary', ink: '--c-primary-ink' },
  { name: 'Cool Steel', role: '次要資訊', use: '輔助操作、次級狀態', fill: '--c-steel', ink: '--c-steel-ink' },
  { name: 'Lavender Grey', role: '分類與內容', use: '分類標籤、專案標記', fill: '--c-lavender', ink: '--c-lavender-ink' },
  { name: 'Dusty Mauve', role: '私人事件', use: '生活事件、個人事項', fill: '--c-mauve', ink: '--c-mauve-ink' },
]

const DERIVED = [
  ['--c-bg', '頁面底色'],
  ['--c-surface', '卡片面'],
  ['--c-surface-2', '抬升／hover'],
  ['--c-surface-3', '內凹／輸入框'],
  ['--c-line', '線條（元件外框）'],
  ['--c-line-soft', '虛線分隔'],
  ['--c-text', '主文字'],
  ['--c-text-2', '次文字'],
  ['--c-text-3', '停用／placeholder'],
  ['--c-danger', '危險'],
  ['--c-warning', '警告'],
  ['--c-focus', 'Focus ring'],
] as const

function useCssVars(names: string[], dep: unknown): Record<string, string> {
  const [vals, setVals] = useState<Record<string, string>>({})
  useEffect(() => {
    // 等主題套用到 <html> 之後再讀（父層 effect 晚於子層執行）
    const id = requestAnimationFrame(() => {
      const cs = getComputedStyle(document.documentElement)
      setVals(Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim().toUpperCase()])))
    })
    return () => cancelAnimationFrame(id)
  }, [dep])
  return vals
}

function Swatch({ cssVar, size = 'md' }: { cssVar: string; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn('block flex-none rounded-2xl border border-line', size === 'lg' ? 'h-20 w-full' : 'size-12')}
      style={{ background: `var(${cssVar})` }}
    />
  )
}

/* ---------- 小工具 ---------- */

function Specimen({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="label-caps mb-3 text-[11px] text-text-3">{label}</p>
      {children}
    </div>
  )
}

const MoreBtn = () => <Button variant="ghost" size="sm" iconOnly aria-label="更多" icon={<MoreHorizontal size={18} strokeWidth={1.5} />} />

const STAGES = ['草稿', '提案', '定稿', '線稿', '精稿', '上色', '光影', '修改', '完稿']

/* ---------- 頁面 ---------- */

export function StyleGuidePage() {
  const { theme, setTheme } = useTheme()
  const vars = useCssVars(
    [...BRAND.flatMap((b) => [b.fill, b.ink]), ...DERIVED.map(([v]) => v)],
    theme,
  )
  const today = todayTaipei()

  const [tab, setTab] = useState<'day' | 'week' | 'month'>('week')
  const [view, setView] = useState<'list' | 'board' | 'map'>('board')
  const [filters, setFilters] = useState<Record<string, boolean>>({ 工作: true, 分類: false, 私人: true })
  const [chips, setChips] = useState(['線上會議', '回覆報價', 'IG 私訊'])
  const [checked, setChecked] = useState(true)
  const [sw, setSw] = useState(true)
  const [radio, setRadio] = useState('email')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Design System · v0.1"
        title="Style Guide"
        actions={
          <Tabs
            ariaLabel="主題"
            items={[
              { value: 'dark', label: '深色' },
              { value: 'light', label: '淺色' },
            ]}
            value={theme}
            onChange={setTheme}
          />
        }
      >
        線稿式介面、細線框、藍圖感、復古像素點綴、大量留白。所有元件皆使用 CSS 變數，深淺色模式自動切換。
      </PageHeader>

      <div className="space-y-16">
        {/* ============ 色彩 ============ */}
        <section>
          <SectionTitle aside={<span className="font-mono text-xs text-text-3">{theme === 'dark' ? 'DARK（預設）' : 'LIGHT'}</span>}>
            Color Tokens · 品牌色
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {BRAND.map((b) => (
              <div key={b.name} className="card p-4">
                <Swatch cssVar={b.fill} size="lg" />
                <p className="mt-3 text-sm font-semibold">{b.role}</p>
                <p className="font-mono text-xs text-text-2">
                  {b.name} · {vars[b.fill]}
                </p>
                <p className="mt-2 text-xs text-text-2">{b.use}</p>
                <Divider className="my-3" />
                <p className="text-xs">
                  <span className="text-text-3">文字用 ink：</span>
                  <span className="font-mono font-semibold" style={{ color: `var(${b.ink})` }}>
                    {vars[b.ink]}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <h3 className="label-caps mb-4 mt-10 text-[12px] text-text-2">推導色</h3>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {DERIVED.map(([v, label]) => (
              <div key={v} className="flex items-center gap-3">
                <Swatch cssVar={v} />
                <div className="min-w-0">
                  <p className="text-sm">{label}</p>
                  <p className="truncate font-mono text-xs text-text-2">
                    {v} · {vars[v]}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Alert tone="info" className="mt-6">
            文字對比皆符合 WCAG AA（≥ 4.5:1），元件外框 ≥ 3:1；可執行 <code className="font-mono">node scripts/check-contrast.mjs</code> 驗證。
            原始的 Lavender／Mauve 直接當小字在 Gunmetal 上只有 3.3～3.8:1，因此文字一律改用較亮的 ink 版本，原色用於色塊與圓點。
          </Alert>
        </section>

        {/* ============ 字體 ============ */}
        <section>
          <SectionTitle>Typography · 字體</SectionTitle>
          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-5">
              {[
                ['Display 72 · Mono', <span className="tabular font-mono text-7xl font-medium tracking-tight">75.4%</span>],
                ['H1 48', <span className="text-5xl font-medium tracking-tight">Lighting 專案總覽</span>],
                ['H2 28', <span className="text-[28px] font-medium">本週時間軸 Timeline</span>],
                ['H3 20', <span className="text-xl font-semibold">客戶詳情 Client</span>],
                ['Body 15', <span className="text-[15px]">申請截止日前 14 天完成作品集，並寄出追蹤信給 3 位客戶。</span>],
                ['Small 13', <span className="text-[13px] text-text-2">建立於 2026/10/28 14:41 · 最後編輯 2 分鐘前</span>],
                ['Label Caps 12 · Mono', <span className="label-caps">Living Room · 進行中</span>],
              ].map(([label, el]) => (
                <div key={label as string} className="flex items-baseline gap-4 border-b border-dashed border-line-soft pb-4">
                  <span className="w-36 flex-none font-mono text-[11px] text-text-3">{label}</span>
                  <div className="min-w-0">{el}</div>
                </div>
              ))}
            </div>
            <div className="card-inset space-y-4 p-6 text-sm">
              <p>
                <span className="label-caps text-text-2">英數</span>
                <br />
                <span className="text-lg">Space Grotesk</span> — 標題、內文
                <br />
                <span className="font-mono text-lg">JetBrains Mono</span> — 數字、標籤、按鈕、分頁籤
              </p>
              <p>
                <span className="label-caps text-text-2">中文</span>
                <br />
                <span className="text-lg">Noto Sans TC 思源黑體</span>
              </p>
              <p className="text-text-2">字型檔隨 App 打包並在首次使用時快取，離線也能正確顯示。分頁籤與小標籤一律全大寫、字距 0.1em；重要數字使用等寬數字對齊。</p>
            </div>
          </div>
        </section>

        {/* ============ 間距／圓角／層次 ============ */}
        <section className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionTitle>Spacing · 間距</SectionTitle>
            <div className="flex flex-wrap items-end gap-5">
              {[4, 8, 12, 16, 24, 32, 48].map((s) => (
                <div key={s} className="text-center">
                  <div className="hatch border border-line" style={{ width: s, height: s }} />
                  <p className="mt-2 font-mono text-[11px] text-text-2">{s}</p>
                </div>
              ))}
            </div>
            <SectionTitle className="mt-10">Radius · 圓角</SectionTitle>
            <div className="flex flex-wrap items-end gap-4">
              {[
                ['4', 'var(--r-xs)'],
                ['8', 'var(--r-sm)'],
                ['12', 'var(--r-md)'],
                ['16', 'var(--r-lg)'],
                ['24', 'var(--r-xl)'],
                ['32', 'var(--r-2xl)'],
                ['full', 'var(--r-full)'],
              ].map(([l, r]) => (
                <div key={l} className="text-center">
                  <div className="size-14 border border-line" style={{ borderTopLeftRadius: r }} />
                  <p className="mt-2 font-mono text-[11px] text-text-2">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-text-2">卡片與面板 32、輸入框 12、按鈕與 Chip 膠囊形。</p>
          </div>

          <div>
            <SectionTitle>Elevation · 層次</SectionTitle>
            <p className="mb-6 text-sm text-text-2">不用模糊陰影；以「斜線網點＋錯位實線」表示高度。</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-10 pr-3">
              {([0, 1, 2, 3] as const).map((lv) => (
                <div key={lv} className={cn('card grid h-24 place-items-center bg-surface', lv > 0 && `elev-${lv}`)}>
                  <span className="label-caps text-[11px]">Level {lv}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ 按鈕 ============ */}
        <section>
          <SectionTitle>Buttons · 按鈕</SectionTitle>
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-4">
                <thead>
                  <tr className="label-caps text-left text-[11px] text-text-3">
                    <th className="pr-4 font-medium" />
                    <th className="pr-4 font-medium">一般</th>
                    <th className="pr-4 font-medium">按下</th>
                    <th className="font-medium">停用</th>
                  </tr>
                </thead>
                <tbody>
                  {(['primary', 'secondary', 'ghost', 'danger'] as const).map((v) => (
                    <tr key={v}>
                      <td className="label-caps pr-4 text-[11px] text-text-2">{v}</td>
                      <td className="pr-4">
                        <Button variant={v} bracket={v !== 'ghost'}>
                          {v === 'danger' ? '刪除' : '儲存'}
                        </Button>
                      </td>
                      <td className="pr-4">
                        <Button variant={v} bracket={v !== 'ghost'} pressed>
                          {v === 'danger' ? '刪除' : '儲存'}
                        </Button>
                      </td>
                      <td>
                        <Button variant={v} bracket={v !== 'ghost'} disabled>
                          {v === 'danger' ? '刪除' : '儲存'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-6">
              <Specimen label="尺寸">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="sm">
                    小
                  </Button>
                  <Button variant="primary">中</Button>
                  <Button variant="primary" size="lg">
                    大
                  </Button>
                </div>
              </Specimen>
              <Specimen label="附圖示／只有圖示">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" icon={<Plus size={16} strokeWidth={2} />}>
                    新增專案
                  </Button>
                  <Button iconOnly aria-label="搜尋" icon={<Search size={16} strokeWidth={1.75} />} />
                  <Button variant="danger" iconOnly aria-label="刪除" icon={<Trash2 size={16} strokeWidth={1.75} />} />
                  <MoreBtn />
                </div>
              </Specimen>
              <Specimen label="載入中">
                <Button
                  variant="primary"
                  bracket
                  loading={loading}
                  onClick={() => {
                    setLoading(true)
                    window.setTimeout(() => setLoading(false), 1500)
                  }}
                >
                  {loading ? '儲存中' : '點我試試'}
                </Button>
              </Specimen>
              <Specimen label="下拉選單（膠囊）">
                <button type="button" className="btn btn-secondary h-12 w-full max-w-xs justify-between px-6 text-sm">
                  SOLAR PANELS <ChevronDown size={18} strokeWidth={1.5} />
                </button>
              </Specimen>
            </div>
          </div>
        </section>

        {/* ============ 分頁籤／Chip ============ */}
        <section className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionTitle>Tabs · 分頁籤</SectionTitle>
            <Specimen label="時間軸檢視">
              <Tabs
                items={[
                  { value: 'day', label: '日 Day' },
                  { value: 'week', label: '週 Week' },
                  { value: 'month', label: '月 Month' },
                ]}
                value={tab}
                onChange={setTab}
              />
            </Specimen>
            <Specimen label="專案檢視" className="mt-8">
              <Tabs
                items={[
                  { value: 'list', label: '列表' },
                  { value: 'board', label: '看板' },
                  { value: 'map', label: '世界地圖' },
                ]}
                value={view}
                onChange={setView}
              />
            </Specimen>
          </div>
          <div>
            <SectionTitle>Chips · Badges</SectionTitle>
            <Specimen label="篩選（可切換）">
              <div className="flex flex-wrap gap-2">
                {[
                  ['工作', 'var(--c-primary)'],
                  ['分類', 'var(--c-lavender)'],
                  ['私人', 'var(--c-mauve)'],
                ].map(([n, c]) => (
                  <Chip key={n} color={filters[n!] ? undefined : c} selected={filters[n!]} onClick={() => setFilters((f) => ({ ...f, [n!]: !f[n!] }))}>
                    {n}
                  </Chip>
                ))}
              </div>
            </Specimen>
            <Specimen label="可移除" className="mt-6">
              <div className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <Chip key={c} onRemove={() => setChips((cs) => cs.filter((x) => x !== c))}>
                    {c}
                  </Chip>
                ))}
                {chips.length === 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setChips(['線上會議', '回覆報價', 'IG 私訊'])}>
                    復原
                  </Button>
                )}
              </div>
            </Specimen>
            <Specimen label="狀態徽章" className="mt-6">
              <div className="flex flex-wrap gap-2">
                <Badge tone="primary">進行中</Badge>
                <Badge tone="steel">追蹤中</Badge>
                <Badge tone="lavender">展會</Badge>
                <Badge tone="mauve">私人</Badge>
                <Badge tone="warning">冷卻中</Badge>
                <Badge tone="danger">下次婉拒</Badge>
                <Badge>草稿</Badge>
              </div>
            </Specimen>
          </div>
        </section>

        {/* ============ 表單 ============ */}
        <section>
          <SectionTitle>Inputs · 表單</SectionTitle>
          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
            <Input label="品牌名稱" placeholder="例如：日日好食" />
            <Input label="申請截止日" type="date" defaultValue={addDays(today, 14)} help="格式 YYYY/MM/DD，週一為一週開始" />
            <Input label="Email" type="email" defaultValue="hello@" error="Email 格式不正確" />
            <Select label="銷售流程" defaultValue="寄出報價">
              {['初次接觸', '信件溝通中', '線上會議預約', 'No show', '寄出報價', '報價失敗', '成交'].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
            <Input label="停用" disabled defaultValue="自動計算：66.7%" />
            <Input label="搜尋" placeholder="搜尋專案、客戶、人脈…（Ctrl／⌘ K）" />
            <Textarea label="速記" wrapperClassName="md:col-span-2" placeholder="客戶需求、注意事項…" defaultValue="偏好溫暖色調；避免使用紫色。" />
            <div className="space-y-4">
              <p className="field-label">選取控制</p>
              <Checkbox label="已完成" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <Checkbox label="停用的勾選" disabled />
              <div className="flex gap-5">
                <Radio name="m" label="Email" checked={radio === 'email'} onChange={() => setRadio('email')} />
                <Radio name="m" label="IG" checked={radio === 'ig'} onChange={() => setRadio('ig')} />
              </div>
              <Switch label="明年提醒" checked={sw} onChange={(e) => setSw(e.target.checked)} />
            </div>
          </div>
        </section>

        {/* ============ 數字與進度 ============ */}
        <section>
          <SectionTitle>Numbers · 進度與倒數</SectionTitle>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="商業插畫案 · 進度" actions={<MoreBtn />}>
              <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
                <ProgressRing value={75.4} size={230} label="上色" sublabel="6 ／ 9 階段" />
                <div className="space-y-5">
                  {[
                    ['日日好食 包裝插畫', true],
                    ['餐桌風景 系列海報', false],
                  ].map(([n, on]) => (
                    <div key={n as string}>
                      <p className="label-caps text-[12px]">{n}</p>
                      <p className="font-mono text-[11px] text-text-2">{on ? '進行中' : '暫停'}</p>
                    </div>
                  ))}
                </div>
              </div>
              <StageBar stages={STAGES} current={5} className="mt-6" />
              <p className="mt-2 flex justify-between font-mono text-[11px] text-text-3">
                <span>草稿</span>
                <span>完稿</span>
              </p>
            </Card>
            <Card title="倒數 · 本週統計" actions={<MoreBtn />}>
              <div className="grid grid-cols-3 gap-4">
                <Countdown caption="申請截止" target={addDays(today, 12)} today={today} size="md" />
                <Countdown caption="活動開始" target={today} today={today} size="md" />
                <Countdown caption="已截止" target={addDays(today, -3)} today={today} size="md" />
              </div>
              <Divider className="my-6" />
              <p className="mb-3 text-sm text-text-2">You relax, we'll do the math. 本週完成的任務數：</p>
              <BarSpark
                values={[3, 5, 4, 6, 8, 2, 4, 7, 5, 9, 3, 6, 4, 5]}
                labels={['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']}
                height={120}
                max={12}
              />
            </Card>
          </div>
        </section>

        {/* ============ 卡片 ============ */}
        <section>
          <SectionTitle>Cards · 卡片範例</SectionTitle>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Card elevation={1} title={<span className="flex items-center gap-2"><span className="chip-dot" style={{ background: 'var(--c-lavender)' }} />展會</span>} actions={<MoreBtn />}>
              <p className="text-xl font-semibold">台北插畫藝術節 2027</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text-2">
                <MapPin size={14} strokeWidth={1.5} /> 台北・台灣
              </p>
              <Divider className="my-4" />
              <div className="flex items-end justify-between">
                <Countdown caption="申請截止" target={addDays(today, 12)} today={today} size="md" />
                <Badge tone="primary">已送件</Badge>
              </div>
            </Card>

            <Card title="C007 · 客戶" actions={<MoreBtn />}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xl font-semibold">山嵐茶屋</p>
                <Badge tone="danger">下次婉拒</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="steel">寄出報價</Badge>
                <Badge tone="warning">冷卻中</Badge>
              </div>
              <Divider className="my-4" />
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-text-2">本輪追蹤</dt>
                <dd className="tabular text-right font-mono">5 ／ 5</dd>
                <dt className="text-text-2">冷卻至</dt>
                <dd className="tabular text-right font-mono">2027/01/01</dd>
              </dl>
            </Card>

            <Card title="今日排程" className="bg-surface">
              <ul className="space-y-1">
                {[
                  ['09:30', '寄追蹤信給 C003', 'var(--c-primary)', true],
                  ['14:00', '線上會議：日日好食', 'var(--c-primary)', false],
                  ['整天', '繳電話費', 'var(--c-mauve)', false],
                ].map(([t, n, c, d]) => (
                  <li key={n as string} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                    <input type="checkbox" className="check" defaultChecked={d as boolean} aria-label={`完成：${n}`} />
                    <span className="chip-dot" style={{ background: c as string }} />
                    <span className={cn('flex-1 text-sm', d && 'text-text-3 line-through')}>{n}</span>
                    <span className="tabular font-mono text-xs text-text-2">{t}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-line-soft px-3 py-2 text-sm text-text-2 hover:border-line hover:text-text">
                <Plus size={14} /> 快速新增
              </button>
            </Card>
          </div>
        </section>

        {/* ============ 提示 ============ */}
        <section>
          <SectionTitle>Feedback · 提示</SectionTitle>
          <p className="mb-5 text-sm text-text-2">所有提醒集中在側邊欄，不使用彈跳通知；頁內提示只用於表單結果與錯誤。刪除一律二次確認。</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Alert tone="info" title="資訊">錨點日期為空的任務已略過 2 筆。</Alert>
            <Alert tone="success" title="完成">已轉為專案，並產生 4 筆時間軸任務。</Alert>
            <Alert tone="warning" title="注意" action={<Button size="sm" variant="secondary">寄信</Button>}>
              C003 會議 No show，請寄追蹤信。
            </Alert>
            <Alert tone="danger" title="錯誤">本季已跑過一輪，無法開始新一輪追蹤。</Alert>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button variant="danger" bracket icon={<Trash2 size={14} />} onClick={() => setConfirmOpen(true)}>
              刪除專案
            </Button>
            <span className="text-sm text-text-2">← 試試二次確認對話框</span>
            <span className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary elev-1">
              <Bell size={16} /> 側邊欄更新提示樣式：有新版本，點此更新
            </span>
          </div>
          <ConfirmDialog
            open={confirmOpen}
            title="確定要刪除「台北插畫藝術節 2027」？"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => setConfirmOpen(false)}
          >
            專案的筆記、成本、附件與時間軸任務會一起刪除，無法復原。
          </ConfirmDialog>
        </section>

        {/* ============ 表格 ============ */}
        <section>
          <SectionTitle>Table · 表格</SectionTitle>
          <div className="card overflow-x-auto p-2 sm:p-4">
            <table className="table">
              <thead>
                <tr>
                  <th>編號</th>
                  <th>品牌</th>
                  <th>銷售流程</th>
                  <th>追蹤狀態</th>
                  <th className="text-right">下次追蹤</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['C001', '日日好食', '寄出報價', 'steel', '追蹤中', '2026/11/04'],
                    ['C002', '山嵐茶屋', '報價失敗', 'warning', '冷卻中', '—'],
                    ['C003', '小島花藝', 'No show', 'steel', '追蹤中', '2026/10/28'],
                    ['C004', '晨光選物', '成交', 'primary', '成交', '—'],
                  ] as const
                ).map(([id, n, s, tone, st, d]) => (
                  <tr key={id}>
                    <td className="tabular font-mono text-text-2">{id}</td>
                    <td>{n}</td>
                    <td>{s}</td>
                    <td>
                      <Badge tone={tone}>{st}</Badge>
                    </td>
                    <td className="tabular text-right font-mono">{d}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5}>
                    <div className="flex items-center gap-4">
                      <div className="skeleton h-3 w-12" />
                      <div className="skeleton h-3 w-28" />
                      <div className="skeleton h-3 flex-1" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ============ 空狀態與圖示 ============ */}
        <section>
          <SectionTitle>Empty States · 空狀態</SectionTitle>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card padded={false}>
              <EmptyState illustration={<LampIllustration size={96} />} title="今天沒有排程" />
            </Card>
            <Card padded={false}>
              <EmptyState illustration={<PlantIllustration size={96} />} title="還沒有收藏" action={<Button size="sm" variant="primary" icon={<Plus size={14} />}>新增收藏</Button>} />
            </Card>
            <Card padded={false}>
              <EmptyState illustration={<BoxIllustration size={96} />} title="沒有符合的客戶" />
            </Card>
            <Card padded={false}>
              <EmptyState illustration={<GlobeIllustration size={96} />} title="尚未設定地點" />
            </Card>
          </div>

          <SectionTitle className="mt-12">Icons · 圖示（線條 1.5px）</SectionTitle>
          <div className="flex flex-wrap gap-6 text-text">
            {[CalendarRange, FolderKanban, Bookmark, Users, FileText, Settings, Search, Bell, MapPin, Plus, Check, Trash2].map((I, i) => (
              <span key={i} className="grid size-12 place-items-center rounded-xl border border-line-soft">
                <I size={20} strokeWidth={1.5} />
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
