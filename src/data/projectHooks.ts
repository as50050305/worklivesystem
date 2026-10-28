import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { progressFromStage, type PlannedTask, type Reschedule } from '@/lib/projects'
import { optionsRepo } from './repositories/optionsRepo'
import { projectsRepo } from './repositories/projectsRepo'
import { templatesRepo } from './repositories/templatesRepo'
import { timelineRepo } from './repositories/timelineRepo'
import { invalidateTable } from './queryClient'
import type { AnchorKind, OptionCategory, OptionItem, Project, ProjectInput, StageTemplate } from './types'

/* ---------------- 選項 ---------------- */

export function useOptions() {
  return useQuery({ queryKey: ['options'], queryFn: optionsRepo.listAll, staleTime: 5 * 60_000 })
}

/** 取得某分類的選項（已排序）與查詢工具 */
export function useOptionSet(category: OptionCategory) {
  const q = useOptions()
  const items = (q.data ?? []).filter((o) => o.category === category).sort((a, b) => a.sort_order - b.sort_order)
  return {
    items,
    byId: (id: string | null | undefined): OptionItem | undefined => items.find((o) => o.id === id),
    byKey: (key: string): OptionItem | undefined => items.find((o) => o.key === key),
    isLoading: q.isLoading,
  }
}

export function useOptionMutations() {
  const after = () => invalidateTable('option_items')
  return {
    create: useMutation({ mutationFn: (v: { category: OptionCategory; label: string; sortOrder: number }) => optionsRepo.create(v.category, v.label, v.sortOrder), onSettled: after }),
    rename: useMutation({ mutationFn: (v: { id: string; label: string }) => optionsRepo.rename(v.id, v.label), onSettled: after }),
    remove: useMutation({ mutationFn: (id: string) => optionsRepo.remove(id), onSettled: after }),
    reorder: useMutation({ mutationFn: (ids: string[]) => optionsRepo.reorder(ids), onSettled: after }),
  }
}

/* ---------------- 階段模板 ---------------- */

export function useStageTemplates() {
  return useQuery({ queryKey: ['templates', 'stages'], queryFn: templatesRepo.listStages })
}

export function useTemplateTasks() {
  return useQuery({ queryKey: ['templates', 'tasks'], queryFn: templatesRepo.listTasks })
}

/** 某類型的階段（已排序） */
export function stagesOf(all: StageTemplate[] | undefined, typeId: string | null): StageTemplate[] {
  return (all ?? []).filter((s) => s.project_type_id === typeId).sort((a, b) => a.sort_order - b.sort_order)
}

export function useTemplateMutations() {
  const after = () => {
    invalidateTable('stage_templates')
    invalidateTable('template_tasks')
  }
  return {
    createStage: useMutation({ mutationFn: (v: { typeId: string; name: string; sortOrder: number }) => templatesRepo.createStage(v.typeId, v.name, v.sortOrder), onSettled: after }),
    renameStage: useMutation({ mutationFn: (v: { id: string; name: string }) => templatesRepo.renameStage(v.id, v.name), onSettled: after }),
    removeStage: useMutation({ mutationFn: (id: string) => templatesRepo.removeStage(id), onSettled: after }),
    reorderStages: useMutation({ mutationFn: (ids: string[]) => templatesRepo.reorderStages(ids), onSettled: after }),
    createTask: useMutation({
      mutationFn: (v: { project_type_id: string; name: string; anchor: AnchorKind; offset_days: number; color_tag_id: string | null; sort_order: number }) => templatesRepo.createTask(v),
      onSettled: after,
    }),
    updateTask: useMutation({ mutationFn: (v: { id: string; patch: Parameters<typeof templatesRepo.updateTask>[1] }) => templatesRepo.updateTask(v.id, v.patch), onSettled: after }),
    removeTask: useMutation({ mutationFn: (id: string) => templatesRepo.removeTask(id), onSettled: after }),
  }
}

/* ---------------- 專案 ---------------- */

export function useProjects() {
  return useQuery({ queryKey: ['projects', 'list'], queryFn: projectsRepo.list })
}

export function useProject(id: string | undefined) {
  return useQuery({ queryKey: ['projects', 'one', id], queryFn: () => projectsRepo.get(id!), enabled: Boolean(id) })
}

export function useProjectNotes(id: string) {
  return useQuery({ queryKey: ['projects', 'notes', id], queryFn: () => projectsRepo.listNotes(id) })
}
export function useProjectCosts(id: string) {
  return useQuery({ queryKey: ['projects', 'costs', id], queryFn: () => projectsRepo.listCosts(id) })
}
export function useProjectLinks(id: string) {
  return useQuery({ queryKey: ['projects', 'links', id], queryFn: () => projectsRepo.listLinks(id) })
}
export function useProjectAttachments(id: string) {
  return useQuery({ queryKey: ['projects', 'attachments', id], queryFn: () => projectsRepo.listAttachments(id) })
}
export function useProjectTasks(id: string) {
  return useQuery({ queryKey: ['projects', 'tasks', id], queryFn: () => timelineRepo.listByProject(id) })
}

/**
 * 階段改變時的進度：未手動覆寫時自動依階段計算
 * 回傳應寫入的 patch
 */
export function stagePatch(project: Pick<Project, 'progress_is_manual'>, stages: StageTemplate[], stageId: string | null): Partial<ProjectInput> {
  const patch: Partial<ProjectInput> = { current_stage_id: stageId }
  if (!project.progress_is_manual) patch.progress = progressFromStage(stages, stageId)
  return patch
}

export function useProjectMutations() {
  const qc = useQueryClient()
  const after = () => invalidateTable('projects')
  const afterAll = () => {
    invalidateTable('projects')
    invalidateTable('timeline_items')
  }
  return {
    create: useMutation({
      mutationFn: async (v: { input: ProjectInput; tasks?: PlannedTask[] }) => {
        const p = await projectsRepo.create(v.input)
        const created = v.tasks?.length ? await timelineRepo.createTemplateTasks(p.id, v.tasks) : 0
        return { project: p, created }
      },
      onSettled: afterAll,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: Partial<ProjectInput> }) => projectsRepo.update(v.id, v.patch),
      // 立即反映在畫面上（開關、下拉選單不必等網路），失敗時由重新抓取還原
      onMutate: (v) => {
        qc.setQueryData<Project | null>(['projects', 'one', v.id], (old) => (old ? { ...old, ...v.patch } : old))
        qc.setQueryData<Project[]>(['projects', 'list'], (old) => old?.map((p) => (p.id === v.id ? { ...p, ...v.patch } : p)))
      },
      onSettled: after,
    }),
    remove: useMutation({ mutationFn: (id: string) => projectsRepo.remove(id), onSettled: afterAll }),
    generateTasks: useMutation({ mutationFn: (v: { id: string; tasks: PlannedTask[] }) => timelineRepo.createTemplateTasks(v.id, v.tasks), onSettled: afterAll }),
    reschedule: useMutation({ mutationFn: (changes: Reschedule[]) => timelineRepo.reschedule(changes), onSettled: afterAll }),
    addNote: useMutation({ mutationFn: (v: { id: string; content: string }) => projectsRepo.addNote(v.id, v.content), onSettled: after }),
    updateNote: useMutation({ mutationFn: (v: { id: string; content: string }) => projectsRepo.updateNote(v.id, v.content), onSettled: after }),
    removeNote: useMutation({ mutationFn: (id: string) => projectsRepo.removeNote(id), onSettled: after }),
    addCost: useMutation({
      mutationFn: ({ id, ...cost }: { id: string; item: string; amount: number; currency: string; sort_order: number }) => projectsRepo.addCost(id, cost),
      onSettled: after,
    }),
    updateCost: useMutation({ mutationFn: (v: { id: string; patch: { item?: string; amount?: number; currency?: string } }) => projectsRepo.updateCost(v.id, v.patch), onSettled: after }),
    removeCost: useMutation({ mutationFn: (id: string) => projectsRepo.removeCost(id), onSettled: after }),
    addLink: useMutation({ mutationFn: (v: { id: string; url: string; title: string | null; sort_order: number }) => projectsRepo.addLink(v.id, v.url, v.title, v.sort_order), onSettled: after }),
    removeLink: useMutation({ mutationFn: (id: string) => projectsRepo.removeLink(id), onSettled: after }),
    upload: useMutation({ mutationFn: (v: { id: string; file: File }) => projectsRepo.uploadAttachment(v.id, v.file), onSettled: after }),
    removeAttachment: useMutation({ mutationFn: projectsRepo.removeAttachment, onSettled: after }),
  }
}
