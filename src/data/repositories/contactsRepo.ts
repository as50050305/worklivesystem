import { getSupabase } from '@/lib/supabase'
import type { Contact, ContactInput } from '../types'

export const contactsRepo = {
  async list(): Promise<Contact[]> {
    const { data, error } = await getSupabase().from('contacts').select('*').order('name')
    if (error) throw error
    return (data ?? []) as Contact[]
  },
  async create(input: ContactInput): Promise<Contact> {
    const { data, error } = await getSupabase().from('contacts').insert(input).select().single()
    if (error) throw error
    return data as Contact
  },
  async update(id: string, patch: Partial<ContactInput>): Promise<void> {
    const { error } = await getSupabase().from('contacts').update(patch).eq('id', id)
    if (error) throw error
  },
  async remove(id: string): Promise<void> {
    const { error } = await getSupabase().from('contacts').delete().eq('id', id)
    if (error) throw error
  },
}
