import { getSupabase } from '@/lib/supabase'
import type { PlannedTask } from '@/lib/projects'
import { projectsRepo } from './projectsRepo'
import { timelineRepo } from './timelineRepo'
import type { ClientRow, Collection, CollectionInput, Project, ProjectInput } from '../types'

const T = 'collections'

export interface ToProjectArgs {
  collection: Collection
  project: ProjectInput
  url: string | null
  cost: { item: string; amount: number; currency: string } | null
  tasks: PlannedTask[]
  convertedStatusId: string | null
}

export interface ToClientArgs {
  collection: Collection
  client: { name: string; website: string | null; sales_stage_id: string | null; cooperation_status_id: string | null }
  convertedStatusId: string | null
}

export const collectionsRepo = {
  async list(): Promise<Collection[]> {
    const { data, error } = await getSupabase().from(T).select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Collection[]
  },

  async create(input: CollectionInput): Promise<Collection> {
    const { data, error } = await getSupabase().from(T).insert(input).select().single()
    if (error) throw error
    return data as Collection
  },

  async update(id: string, patch: Partial<CollectionInput>): Promise<void> {
    const { error } = await getSupabase().from(T).update(patch).eq('id', id)
    if (error) throw error
  },

  async remove(id: string): Promise<void> {
    const { error } = await getSupabase().from(T).delete().eq('id', id)
    if (error) throw error
  },

  /**
   * 規則 B：轉為專案。建立專案（含網址、費用成本、模板任務），
   * 原收藏保留，狀態改為「已轉換」並記錄專案 ID。
   */
  async toProject(a: ToProjectArgs): Promise<{ project: Project; tasks: number }> {
    const project = await projectsRepo.create({ ...a.project, source_collection_id: a.collection.id })
    if (a.url) await projectsRepo.addLink(project.id, a.url, null, 0)
    if (a.cost) await projectsRepo.addCost(project.id, { ...a.cost, sort_order: 0 })
    const tasks = a.tasks.length ? await timelineRepo.createTemplateTasks(project.id, a.tasks) : 0
    await collectionsRepo.update(a.collection.id, { status_id: a.convertedStatusId ?? a.collection.status_id, converted_project_id: project.id })
    return { project, tasks }
  },

  /** 規則 B：轉為客戶（僅限潛在客戶品牌）。客戶編號由資料庫自動產生（C001…） */
  async toClient(a: ToClientArgs): Promise<ClientRow> {
    const { data, error } = await getSupabase().from('clients').insert(a.client).select('id,code,name,website').single()
    if (error) throw error
    const client = data as ClientRow
    await collectionsRepo.update(a.collection.id, { status_id: a.convertedStatusId ?? a.collection.status_id, converted_client_id: client.id })
    return client
  },
}
