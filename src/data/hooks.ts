import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { colorTagsRepo, type ColorTagInput } from './repositories/colorTagsRepo'
import { projectsRepo } from './repositories/projectsRepo'
import { realtimeRepo } from './repositories/realtimeRepo'
import { timelineRepo } from './repositories/timelineRepo'
import { invalidateTable } from './queryClient'
import type { ChecklistDraft, ChecklistItem, ColorTag, TimelineItem, TimelineItemInput } from './types'

/* ---------------- 即時同步 ---------------- */

export function useRealtimeSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    return realtimeRepo.subscribe(invalidateTable)
  }, [enabled])
}

/* ---------------- 顏色標籤 ---------------- */

export function useColorTags() {
  return useQuery({ queryKey: ['color_tags'], queryFn: colorTagsRepo.list })
}

/** id → 標籤；找不到時退回「未分類」 */
export function useTagLookup(): (id: string | null) => ColorTag | undefined {
  const { data } = useColorTags()
  const fallback = data?.find((t) => t.is_default)
  return (id) => (id ? (data?.find((t) => t.id === id) ?? fallback) : fallback)
}

export function useColorTagMutations() {
  const after = () => invalidateTable('color_tags')
  return {
    create: useMutation({
      mutationFn: ({ input, sortOrder }: { input: ColorTagInput; sortOrder: number }) => colorTagsRepo.create(input, sortOrder),
      onSettled: after,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Partial<ColorTagInput> }) => colorTagsRepo.update(id, patch),
      onSettled: after,
    }),
    remove: useMutation({ mutationFn: (id: string) => colorTagsRepo.remove(id), onSettled: after }),
    reorder: useMutation({ mutationFn: (ids: string[]) => colorTagsRepo.reorder(ids), onSettled: after }),
  }
}

/* ---------------- 時間軸 ---------------- */

export function useTimelineRange(from: string, to: string) {
  return useQuery({ queryKey: ['timeline', from, to], queryFn: () => timelineRepo.listRange(from, to) })
}

export function useChecklist(itemIds: string[]) {
  const ids = [...itemIds].sort()
  return useQuery({
    queryKey: ['checklist', ids],
    queryFn: () => timelineRepo.listChecklist(ids),
    enabled: ids.length > 0,
  })
}

/** 在快取中直接修改項目（拖移、勾選時立即反映） */
function patchCached(qc: ReturnType<typeof useQueryClient>, id: string, patch: Partial<TimelineItem>) {
  for (const prefix of [['timeline'], ['sidebar']]) {
    qc.setQueriesData<unknown>({ queryKey: prefix }, (old: unknown) => {
      if (Array.isArray(old)) return old.map((it: TimelineItem) => (it?.id === id ? { ...it, ...patch } : it))
      if (old && typeof old === 'object' && 'items' in old) {
        const o = old as { items: TimelineItem[] }
        return { ...o, items: o.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }
      }
      return old
    })
  }
}

export function useTimelineMutations() {
  const qc = useQueryClient()
  const after = () => {
    invalidateTable('timeline_items')
    invalidateTable('checklist_items')
  }
  return {
    create: useMutation({
      mutationFn: async ({ input, checklist }: { input: TimelineItemInput; checklist?: ChecklistDraft[] }) => {
        const item = await timelineRepo.create(input)
        if (input.kind === 'checklist' && checklist?.length) await timelineRepo.saveChecklist(item.id, checklist, [])
        return item
      },
      onSettled: after,
    }),
    update: useMutation({
      mutationFn: async ({
        item,
        patch,
        checklist,
        existingChecklist,
      }: {
        item: TimelineItem
        patch: Partial<TimelineItemInput>
        checklist?: ChecklistDraft[]
        existingChecklist?: ChecklistItem[]
      }) => {
        await timelineRepo.update(item, patch)
        if (checklist) await timelineRepo.saveChecklist(item.id, checklist, existingChecklist ?? [])
      },
      onSettled: after,
    }),
    move: useMutation({
      mutationFn: ({ id, date }: { id: string; date: string }) => timelineRepo.moveToDate(id, date),
      onMutate: ({ id, date }) => patchCached(qc, id, { item_date: date, is_manually_adjusted: true }),
      onSettled: after,
    }),
    toggleDone: useMutation({
      mutationFn: async (item: TimelineItem): Promise<void> => {
        if (item.is_done) await timelineRepo.uncomplete(item.id)
        else await timelineRepo.complete(item)
      },
      onMutate: (item) => patchCached(qc, item.id, { is_done: !item.is_done }),
      onSettled: after,
    }),
    remove: useMutation({ mutationFn: (id: string) => timelineRepo.remove(id), onSettled: after }),
    toggleChecklist: useMutation({
      mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) => timelineRepo.setChecklistDone(id, isDone),
      onMutate: ({ id, isDone }) => {
        qc.setQueriesData<ChecklistItem[]>({ queryKey: ['checklist'] }, (old) => old?.map((c) => (c.id === id ? { ...c, is_done: isDone } : c)))
      },
      onSettled: () => invalidateTable('checklist_items'),
    }),
  }
}

/* ---------------- 側邊欄 ---------------- */

export interface SidebarData {
  items: TimelineItem[]
}

/** 今天的項目＋生活代辦標籤的逾期未完成項目 */
export function useSidebarTimeline(today: string, lifeTagIds: string[]) {
  const key = [...lifeTagIds].sort()
  return useQuery({
    queryKey: ['sidebar', 'timeline', today, key],
    queryFn: async (): Promise<SidebarData> => {
      const [todays, overdue] = await Promise.all([timelineRepo.listRange(today, today), timelineRepo.listOverdueByTags(today, key)])
      return { items: [...overdue, ...todays] }
    },
  })
}

export function useActiveProjectsForCountdown() {
  return useQuery({ queryKey: ['sidebar', 'projects'], queryFn: projectsRepo.listActiveForCountdown })
}
