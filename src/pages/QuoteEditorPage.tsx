import { ArrowLeft, Copy, Download, FileSignature, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BoxIllustration } from '@/components/illustrations/Illustrations'
import { Alert, Button, Card, ConfirmDialog, EmptyState, Select, Spinner } from '@/components/ui'
import { useClient } from '@/data/clientHooks'
import { keyOf } from '@/data/clientRules'
import { useOptions, useOptionSet, useProject } from '@/data/projectHooks'
import { useBusinessProfile, useQuote, useQuoteLines, useQuoteMutations } from '@/data/quoteHooks'
import type { Contract, Quote } from '@/data/types'
import { ContractEditor } from '@/features/quotes/ContractEditor'
import { ContractsCard, QuoteBasicsCard, QuoteLinesCard, QuoteTermsCard, QuoteTotalsCard, VersionsCard } from '@/features/quotes/editor'
import { buildQuotePdfData, quoteFileName } from '@/features/quotes/pdfData'
import { DraftInput, quoteNo } from '@/features/quotes/shared'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'

/** PDF 模組（含 pdf-lib 與字型處理）只在第一次下載時載入 */
const loadPdf = () => import('@/pdf')

function Editor({ quote }: { quote: Quote }) {
  const online = useOnline()
  const nav = useNavigate()
  const today = useToday()
  const { data: options = [] } = useOptions()
  const statuses = useOptionSet('quote_status')
  const client = useClient(quote.client_id ?? undefined).data ?? null
  const project = useProject(quote.project_id ?? undefined).data ?? null
  const lines = useQuoteLines(quote.id)
  const { profile } = useBusinessProfile()
  const m = useQuoteMutations()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string; link?: { to: string; label: string } } | null>(null)
  const [pdfBusy, setPdfBusy] = useState<string | null>(null)
  const [contract, setContract] = useState<{ c: Contract | null } | null>(null)
  const number = quoteNo(quote, client)

  useEffect(() => {
    document.title = `${number}・報價單`
  }, [number])

  const changeStatus = async (statusId: string) => {
    setMsg(null)
    if (keyOf(options, statusId) === 'won') {
      const r = await m.markWon.mutateAsync({ ...quote, status_id: quote.status_id })
      setMsg({
        tone: 'info',
        text: r.createdProject ? `已成交：客戶已更新為成交，並建立專案「${r.project?.name}」。` : '已成交：客戶已更新為成交。',
        link: r.project ? { to: `/projects/${r.project.id}`, label: '前往專案' } : undefined,
      })
      return
    }
    m.update.mutate({ id: quote.id, patch: { status_id: statusId || null } })
  }

  const downloadQuote = async () => {
    setPdfBusy('quote')
    setMsg(null)
    try {
      const pdf = await loadPdf()
      const blob = await pdf.quotePdf(buildQuotePdfData(quote, lines.data ?? [], client, project, profile))
      pdf.downloadBlob(blob, quoteFileName(quote, client, '報價單'))
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setPdfBusy(null)
    }
  }

  const downloadContract = async (c: { title: string; body: string }, id = 'contract') => {
    setPdfBusy(id)
    try {
      const pdf = await loadPdf()
      const blob = await pdf.contractPdf({ title: c.title, body: c.body, footer: c.title.includes(number) ? c.title : `${number}　${c.title}`, author: profile.name || undefined })
      pdf.downloadBlob(blob, `${c.title}.pdf`)
    } finally {
      setPdfBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-8">
        <Link to="/quotes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-2 hover:text-text">
          <ArrowLeft size={14} /> 報價單
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="tabular font-mono text-sm text-text-2">
              {number}
              {client && (
                <>
                  {'　'}
                  <Link to={`/clients/${client.id}`} className="underline decoration-dotted underline-offset-4 hover:text-text">
                    {client.name}
                  </Link>
                </>
              )}
            </p>
            <DraftInput
              aria-label="報價單標題"
              placeholder="（未命名報價單）"
              value={quote.title ?? ''}
              disabled={!online}
              className="mt-1 h-auto w-full border-transparent bg-transparent px-0 text-3xl font-medium tracking-tight sm:text-4xl"
              onCommit={(v) => m.update.mutate({ id: quote.id, patch: { title: v.trim() || null } })}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Select label="狀態" value={quote.status_id ?? ''} disabled={!online || m.markWon.isPending} onChange={(e) => void changeStatus(e.target.value)} wrapperClassName="w-32">
              <option value="">未設定</option>
              {statuses.items.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button variant="primary" bracket icon={<Download size={15} />} loading={pdfBusy === 'quote'} disabled={lines.isLoading} onClick={() => void downloadQuote()}>
              下載 PDF
            </Button>
            <Button icon={<FileSignature size={15} />} disabled={!online} onClick={() => setContract({ c: null })}>
              產生合約
            </Button>
            <Button
              icon={<Copy size={15} />}
              disabled={!online}
              loading={m.copy.isPending}
              onClick={async () => {
                const q = await m.copy.mutateAsync({ id: quote.id, today })
                nav(`/quotes/${q.id}`)
              }}
            >
              複製為新版本
            </Button>
            <Button variant="danger" iconOnly aria-label="刪除報價單" icon={<Trash2 size={15} />} disabled={!online} onClick={() => setConfirmDelete(true)} />
          </div>
        </div>
        {m.markWon.isPending && (
          <p className="mt-3 flex items-center gap-2 text-sm text-text-2">
            <Spinner size={14} /> 成交同步中…
          </p>
        )}
        {msg && (
          <Alert
            tone={msg.tone}
            className="mt-4"
            action={
              <div className="flex gap-2">
                {msg.link && (
                  <Link to={msg.link.to} className="btn btn-sm btn-secondary">
                    {msg.link.label}
                  </Link>
                )}
                <Button size="sm" variant="ghost" onClick={() => setMsg(null)}>
                  知道了
                </Button>
              </div>
            }
          >
            {msg.text}
          </Alert>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-6">
          <QuoteLinesCard quote={quote} lines={lines.data ?? []} loading={lines.isLoading} />
          <QuoteTermsCard quote={quote} />
        </div>
        <div className="grid gap-6">
          <QuoteTotalsCard quote={quote} lines={lines.data ?? []} />
          <QuoteBasicsCard quote={quote} />
          <ContractsCard quote={quote} onOpen={(c) => setContract({ c })} onDownload={(c) => void downloadContract(c, c.id).catch((e) => setMsg({ tone: 'danger', text: String(e?.message ?? e) }))} downloading={pdfBusy} />
          <VersionsCard quote={quote} client={client} />
        </div>
      </div>

      {contract && <ContractEditor quote={quote} client={client} lines={lines.data ?? []} contract={contract.c} onClose={() => setContract(null)} onDownload={(c) => downloadContract(c)} />}

      <ConfirmDialog
        open={confirmDelete}
        title={`確定要刪除報價單「${number}」？`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          await m.remove.mutateAsync(quote.id)
          nav('/quotes')
        }}
      >
        品項會一起刪除；已產生的合約與關聯專案會保留。
      </ConfirmDialog>
    </div>
  )
}

export function QuoteEditorPage() {
  const { id } = useParams()
  const q = useQuote(id)
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
        <EmptyState illustration={<BoxIllustration />} title="找不到這張報價單" action={<Link to="/quotes" className="underline">回報價單列表</Link>} />
      </Card>
    )
  }
  return <Editor key={q.data.id} quote={q.data} />
}
