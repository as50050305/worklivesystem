import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { BoxIllustration } from '@/components/illustrations/Illustrations'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import { useClientLinks, useClients, useContacts } from '@/data/clientHooks'
import { useOptionSet } from '@/data/projectHooks'
import { ContactEditor } from '@/features/contacts/ContactEditor'
import { matchesAll } from '@/lib/search'
import { useOnline } from '@/pwa/useOnline'

export function ContactsPage() {
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const q = useContacts()
  const clients = useClients()
  const links = useClientLinks()
  const sources = useOptionSet('contact_source')
  const relations = useOptionSet('contact_relation')
  const [search, setSearch] = useState('')
  const editId = params.get('edit')
  const isNew = params.get('new') === '1'
  const editing = editId ? (q.data ?? []).find((c) => c.id === editId) ?? null : null
  const close = () => setParams({}, { replace: true })

  const rows = useMemo(() => {
    const all = q.data ?? []
    return all.map((c) => {
      const cl = (links.data ?? []).filter((l) => l.contact_id === c.id).map((l) => clients.data?.find((x) => x.id === l.client_id)).filter(Boolean)
      const referrer = c.referrer_contact_id ? all.find((x) => x.id === c.referrer_contact_id)?.name : c.referrer_name
      const text = [c.name, c.phone, c.email, c.company, c.job_title, c.website, c.instagram, c.note, referrer, sources.byId(c.source_id)?.label, relations.byId(c.relation_id)?.label, ...cl.map((x) => `${x!.code} ${x!.name}`)]
        .filter(Boolean)
        .join(' ')
      return { c, clients: cl, referrer, text }
    })
  }, [q.data, links.data, clients.data, sources, relations])
  const list = search.trim() ? rows.filter((r) => matchesAll(r.text, search)) : rows

  return (
    <>
      <PageHeader
        title="人脈"
        eyebrow="Contacts"
        actions={
          <Button variant="primary" bracket icon={<Plus size={16} strokeWidth={2} />} disabled={!online} onClick={() => setParams({ new: '1' }, { replace: true })}>
            新增人脈
          </Button>
        }
      >
        工作用聯絡人。搜尋會比對所有欄位，可用空白輸入多個關鍵字。
      </PageHeader>
      <div className="relative mb-5 max-w-xl">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-3" />
        <input className="input pl-10" placeholder="搜尋姓名、公司、職位、電話、Email、備註、關聯客戶…" aria-label="搜尋人脈" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card padded={false} className="overflow-hidden">
        {q.isLoading ? (
          <div className="skeleton m-6 h-24" />
        ) : list.length === 0 ? (
          <EmptyState illustration={<BoxIllustration />} title={q.data?.length ? '沒有符合的人脈' : '還沒有人脈'} />
        ) : (
          <div className="overflow-x-auto p-2 sm:p-4">
            <table className="table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>品牌／公司・職位</th>
                  <th>聯絡方式</th>
                  <th>認識管道</th>
                  <th>關係</th>
                  <th>關聯客戶</th>
                </tr>
              </thead>
              <tbody>
                {list.map(({ c, clients: cl, referrer }) => (
                  <tr key={c.id}>
                    <td>
                      <button type="button" className="font-medium hover:underline" onClick={() => setParams({ edit: c.id }, { replace: true })}>
                        {c.name}
                      </button>
                    </td>
                    <td className="text-text-2">
                      {c.company ?? '—'}
                      {c.job_title && <span className="block text-xs text-text-3">{c.job_title}</span>}
                    </td>
                    <td className="text-xs text-text-2">
                      {[c.phone, c.email, c.instagram].filter(Boolean).map((x) => (
                        <span key={x} className="block">
                          {x}
                        </span>
                      ))}
                    </td>
                    <td className="whitespace-nowrap text-text-2">
                      {sources.byId(c.source_id)?.label ?? '—'}
                      {referrer && <span className="block text-xs text-text-3">轉介：{referrer}</span>}
                    </td>
                    <td>{c.relation_id ? <Badge tone="steel">{relations.byId(c.relation_id)?.label}</Badge> : '—'}</td>
                    <td className="space-x-1">
                      {cl.map((x) => (
                        <Link key={x!.id} to={`/clients/${x!.id}`} className="chip h-6 text-[12px] hover:bg-surface-2">
                          {x!.code} {x!.name}
                        </Link>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {(isNew || editing) && <ContactEditor key={editing?.id ?? 'new'} contact={editing} onClose={close} />}
    </>
  )
}
