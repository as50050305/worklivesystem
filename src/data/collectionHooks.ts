import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collectionsRepo, type ToClientArgs, type ToProjectArgs } from './repositories/collectionsRepo'
import { invalidateTable } from './queryClient'
import type { Collection, CollectionInput } from './types'

export function useCollections() {
  return useQuery({ queryKey: ['collections'], queryFn: collectionsRepo.list })
}

export function useCollectionMutations() {
  const qc = useQueryClient()
  const after = () => invalidateTable('collections')
  return {
    create: useMutation({ mutationFn: (input: CollectionInput) => collectionsRepo.create(input), onSettled: after }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: Partial<CollectionInput> }) => collectionsRepo.update(v.id, v.patch),
      onMutate: (v) => qc.setQueryData<Collection[]>(['collections'], (old) => old?.map((c) => (c.id === v.id ? { ...c, ...v.patch } : c))),
      onSettled: after,
    }),
    remove: useMutation({ mutationFn: (id: string) => collectionsRepo.remove(id), onSettled: after }),
    toProject: useMutation({
      mutationFn: (a: ToProjectArgs) => collectionsRepo.toProject(a),
      onSettled: () => {
        after()
        invalidateTable('projects')
        invalidateTable('timeline_items')
      },
    }),
    toClient: useMutation({
      mutationFn: (a: ToClientArgs) => collectionsRepo.toClient(a),
      onSettled: () => {
        after()
        invalidateTable('clients')
      },
    }),
  }
}
