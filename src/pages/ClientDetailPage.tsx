import { ArrowLeft, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NotesThread } from '@/components/notes/NotesThread'
import { BoxIllustration } from '@/components/illustrations/Illustrations'
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Select, Spinner, Switch } from '@/components/ui'
import { useClient, useClientActions, useClientMutations, useClientNotes } from '@/data/clientHooks'
import { useOptionSet } from '@/data/projectHooks'
import type { Client } from '@/data/types'
import { ContactInfoCard, FollowupLog, FollowupPanel, LinkedContactsCard, MeetingsCard, RelatedProjectsCard } from '@/features/clients/detail'
import { ClientQuotesCard } from '@/features/quotes/ClientQuotesCard'
import { useSalesStageChange } from '@/features/quotes/WonQuoteDialog'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

function Header({ client }: { client: Client }) {
  const online = useOnline()
  const nav = useNavigate()
  const today = useToday()
  const actions = useClientActions()
  const { remove } = useClientMutations()
  const sales = useOptionSet('sales_stage')
  const coop = useOptionSet('cooperation_status')
  const fstatus = useOptionSet('followup_status')
  const [code, setCode] = useState(client.code)
  const [name, setName] = useState(client.name)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const stage = useSalesStageChange((r) => setMsg(!r.ok ? r.reason : (r.message ?? null)))
  // 開關立即反映
  const [worked, setWorked] = useState(client.has_worked_together)
  const [decline, setDecline] = useState(client.decline_next)
  useEffect(() => {
    setCode(client.code)
    setName(client.name)
    setWorked(client.has_worked_together)
    setDecline(client.decline_next)
  }, [client])

  return (
    <div className="mb-8">
      <Link to="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-2 hover:text-text">
        <ArrowLeft size={14} /> 客戶
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            className="tabular w-28 rounded-lg bg-transparent font-mono text-sm text-text-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
            aria-label="客戶編號"
            value={code}
            disabled={!online}
            onChange={(e) => setCode(e.target.value)}
            onBlur={() => (code.trim() && code.trim() !== client.code ? actions.update.mutate({ id: client.id, patch: { code: code.trim() } }) : setCode(client.code))}
          />
          <input
            className="mt-1 w-full rounded-lg bg-transparent text-4xl font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] sm:text-5xl"
            aria-label="品牌名稱"
            value={name}
            disabled={!online}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => (name.trim() && name.trim() !== client.name ? actions.update.mutate({ id: client.id, patch: { name: name.trim() } }) : setName(client.name))}
          />
          {client.decline_next && (
            <Badge tone="danger" className="mt-3 h-7 px-3 text-[12px]">
              下次婉拒：曾合作但合作狀態為「不合」
            </Badge>
          )}
        </div>
        <Button variant="danger" size="sm" icon={<Trash2 size={14} />} disabled={!online} onClick={() => setConfirm(true)}>
          刪除客戶
        </Button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,200px))_1fr]">
        <Select
          label="銷售流程"
          value={client.sales_stage_id ?? ''}
          disabled={!online}
          onChange={(e) => void stage.change(client, e.target.value || null, today)}
        >
          <option value="">未設定</option>
          {sales.items.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          label="合作狀態"
          value={client.cooperation_status_id ?? ''}
          disabled={!online}
          onChange={async (e) => {
            const r = await actions.changeCooperation(client, e.target.value || null)
            setMsg(!r.ok ? r.reason : null)
          }}
        >
          <option value="">未設定</option>
          {coop.items.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select label="追蹤狀態" value={client.followup_status_id ?? ''} disabled={!online} help="可手動修改" onChange={(e) => actions.update.mutate({ id: client.id, patch: { followup_status_id: e.target.value || null } })}>
          <option value="">未開始</option>
          {fstatus.items.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        <div className="flex flex-col justify-center gap-3 pt-5">
          <Switch
            label="接過案"
            checked={worked}
            disabled={!online}
            onChange={(e) => {
              setWorked(e.target.checked)
              actions.update.mutate({ id: client.id, patch: { has_worked_together: e.target.checked } })
            }}
          />
          <Switch
            label="下次婉拒"
            checked={decline}
            disabled={!online}
            onChange={(e) => {
              setDecline(e.target.checked)
              actions.update.mutate({ id: client.id, patch: { decline_next: e.target.checked } })
            }}
          />
        </div>
      </div>
      {msg && (
        <Alert tone="info" className="mt-4" action={<Button size="sm" variant="ghost" onClick={() => setMsg(null)}>知道了</Button>}>
          {msg}
        </Alert>
      )}
      {stage.dialog}
      <ConfirmDialog
        open={confirm}
        title={`確定要刪除「${client.code} ${client.name}」？`}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false)
          await remove.mutateAsync(client.id)
          nav('/clients')
        }}
      >
        追蹤紀錄、會議、速記與人脈關聯會一起刪除；相關專案與人脈本身會保留。
      </ConfirmDialog>
    </div>
  )
}

export function ClientDetailPage() {
  const { id } = useParams()
  const q = useClient(id)
  const notes = useClientNotes(id ?? '')
  const m = useClientMutations()
  if (q.isLoading) {
    return (
      <div className="grid place-items-center py-20 text-text-2">
        <Spinner size={24} />
      </div>
    )
  }
  if (!q.data) {
    return (
      <Card>
        <EmptyState illustration={<BoxIllustration />} title="找不到這個客戶" action={<Link to="/clients" className="underline">回客戶列表</Link>} />
      </Card>
    )
  }
  const c = q.data
  return (
    <div className="mx-auto max-w-[1280px]">
      <Header client={c} />
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-6">
          <FollowupPanel client={c} />
          <Card title="速記">
            <NotesThread
              notes={notes.data ?? []}
              loading={notes.isLoading}
              placeholder="需求、偏好、注意事項…"
              onAdd={(content) => m.addNote.mutateAsync({ id: c.id, content })}
              onUpdate={(nid, content) => m.updateNote.mutateAsync({ id: nid, content })}
              onRemove={(nid) => m.removeNote.mutateAsync(nid)}
            />
          </Card>
          <FollowupLog client={c} />
        </div>
        <div className="grid gap-6">
          <ContactInfoCard client={c} />
          <MeetingsCard client={c} />
          <LinkedContactsCard client={c} />
          <RelatedProjectsCard client={c} />
          <ClientQuotesCard client={c} />
        </div>
      </div>
    </div>
  )
}
