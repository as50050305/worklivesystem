import { useState } from 'react'
import { ConfirmDialog, Select } from '@/components/ui'
import { useOptionMutations, useOptionSet, useProjects, useProjectTypeMutations, useStageTemplates } from '@/data/projectHooks'
import { OrderedListEditor, type ListRow } from './OrderedListEditor'

/**
 * 專案類型：新增、改名、排序、刪除（包含預設類型）
 * 刪除仍有專案使用的類型時，先選擇要把那些專案改成哪個類型
 */
export function ProjectTypesEditor() {
  const types = useOptionSet('project_type')
  const projects = useProjects()
  const stagesQ = useStageTemplates()
  const om = useOptionMutations()
  const tm = useProjectTypeMutations()
  const [toDelete, setToDelete] = useState<ListRow | null>(null)
  const [moveTo, setMoveTo] = useState<string>('')

  const usedBy = toDelete ? (projects.data ?? []).filter((p) => p.type_id === toDelete.id).length : 0
  const stageCount = toDelete ? (stagesQ.data ?? []).filter((s) => s.project_type_id === toDelete.id).length : 0
  const others = types.items.filter((t) => t.id !== toDelete?.id)

  return (
    <>
      <OrderedListEditor
        rows={types.items.map((o) => ({ id: o.id, label: o.label }))}
        onRename={(id, label) => om.rename.mutate({ id, label })}
        onReorder={(ids) => om.reorder.mutate(ids)}
        onDelete={() => {}}
        onRequestDelete={(r) => {
          setToDelete(r)
          setMoveTo(types.items.find((t) => t.id !== r.id)?.id ?? '')
        }}
        onAdd={(label) => tm.create.mutateAsync({ label, sortOrder: types.items.length + 1 })}
        addPlaceholder="新增專案類型，例如：個展、出版"
      />
      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要刪除專案類型「${toDelete?.label ?? ''}」？`}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const r = toDelete
          setToDelete(null)
          if (r) await tm.remove.mutateAsync({ id: r.id, moveTo: moveTo || null }).catch(() => {})
        }}
      >
        <p>{stageCount > 0 ? `這個類型的 ${stageCount} 個階段與錨點任務會一併刪除。` : '這個類型的階段與錨點任務會一併刪除。'}</p>
        {usedBy > 0 && (
          <div className="mt-4">
            <Select label={`有 ${usedBy} 個專案使用這個類型，要改成：`} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
              <option value="">（不指定類型）</option>
            </Select>
            <p className="mt-2 text-xs">這些專案的階段會重設為新類型的第一個階段，時間軸任務保留。</p>
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}
