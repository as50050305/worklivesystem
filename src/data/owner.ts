/**
 * 免登入單人模式：所有資料歸屬這個固定的擁有者 id
 * 必須與資料庫的 public.owner_id() 一致（supabase/migrations/20261029000100_no_login.sql）
 */
export const OWNER_ID = '00000000-0000-0000-0000-000000000001'
