/**
 * 規則 A-7：成交同步
 * 報價單狀態改為「成交」時：
 *   1. 客戶：銷售流程、追蹤狀態 → 成交；接過案 → 是
 *   2. 報價單沒有關聯專案 → 自動建立「商業插畫案」專案（名稱：品牌名稱＋品項），套用階段模板，雙向關聯
 *   3. 已有關聯專案 → 只補上專案端的報價單關聯
 */
import { markWon } from '@/lib/followup'
import { planTemplateTasks, progressFromStage } from '@/lib/projects'
import { wonProjectName } from '@/lib/quotes'
import { idOf, toDbPatch } from './clientRules'
import { clientsRepo } from './repositories/clientsRepo'
import { projectsRepo } from './repositories/projectsRepo'
import { quotesRepo } from './repositories/quotesRepo'
import { templatesRepo } from './repositories/templatesRepo'
import { timelineRepo } from './repositories/timelineRepo'
import type { OptionItem, Project, Quote } from './types'

export interface WonResult {
  project: Project | null
  createdProject: boolean
}

export async function syncQuoteWon(quote: Quote, options: OptionItem[]): Promise<WonResult> {
  const wonStatus = idOf(options, 'quote_status', 'won')
  if (quote.status_id !== wonStatus) await quotesRepo.update(quote.id, { status_id: wonStatus })

  const client = quote.client_id ? await clientsRepo.get(quote.client_id) : null
  if (client) await clientsRepo.update(client.id, toDbPatch(markWon(), options))

  if (quote.project_id) {
    const p = await projectsRepo.get(quote.project_id)
    if (p && !p.quote_id) return { project: await projectsRepo.update(p.id, { quote_id: quote.id }), createdProject: false }
    return { project: p, createdProject: false }
  }

  const lines = await quotesRepo.listLines(quote.id)
  const typeId = idOf(options, 'project_type', 'commercial')
  const stages = (await templatesRepo.listStages()).filter((s) => s.project_type_id === typeId).sort((a, b) => a.sort_order - b.sort_order)
  const first = stages[0]?.id ?? null
  const brand = client?.name ?? quote.title ?? '成交報價'
  const project = await projectsRepo.create({
    name: wonProjectName(brand, lines.map((l) => l.item_name)),
    type_id: typeId,
    status_id: idOf(options, 'project_status', 'active'),
    current_stage_id: first,
    progress: progressFromStage(stages, first),
    client_id: client?.id ?? null,
    quote_id: quote.id,
    color_tag_id: client?.color_tag_id ?? null,
  })
  await quotesRepo.update(quote.id, { project_id: project.id })

  // 階段模板中的任務：新專案尚無錨點日期，只會產生不需錨點的任務（之後填日期可在專案頁補產生）
  const tasks = (await templatesRepo.listTasks()).filter((t) => t.project_type_id === typeId)
  const plan = planTemplateTasks(tasks, { apply_start_on: null, apply_deadline_on: null, event_start_on: null }, [], project.color_tag_id)
  if (plan.create.length) await timelineRepo.createTemplateTasks(project.id, plan.create)

  return { project, createdProject: true }
}
