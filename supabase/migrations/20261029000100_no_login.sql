-- =====================================================================
-- 改為「免登入」單人模式（使用者決定，2026/10/29）
--
-- ⚠️ 安全取捨：不再需要登入，任何知道網址（與前端內含的 anon key）的人
--    都能讀取與修改資料。請勿公開分享網址，並定期匯出備份。
--
-- 做法：
--   * 所有資料歸屬固定的擁有者 public.owner_id()，不再依賴 auth.users
--   * RLS 仍啟用：anon／authenticated 只能存取 user_id = owner_id() 的列
--   * 保留保護：系統選項與「未分類」標籤不可刪除；收回 TRUNCATE 權限（RLS 擋不住 TRUNCATE）
--   * 既有資料（若曾以帳號登入建立）一併轉移給固定擁有者
-- =====================================================================

create or replace function public.owner_id()
returns uuid
language sql
immutable
as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;

grant execute on function public.owner_id() to anon, authenticated;

do $$
declare
  t text;
  tables text[] := array[
    'app_settings', 'option_items', 'color_tags', 'stage_templates', 'template_tasks',
    'contacts', 'clients', 'client_contacts', 'client_meetings', 'client_followups', 'client_notes',
    'collections', 'projects', 'project_costs', 'project_links', 'attachments', 'project_notes',
    'timeline_items', 'checklist_items',
    'quotes', 'quote_lines', 'quote_item_library', 'contract_templates', 'contracts'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_user_id_fkey');
    execute format('alter table public.%I alter column user_id set default public.owner_id()', t);
    execute format('update public.%I set user_id = public.owner_id() where user_id is distinct from public.owner_id()', t);

    execute format('drop policy if exists "owner_select" on public.%I', t);
    execute format('drop policy if exists "owner_insert" on public.%I', t);
    execute format('drop policy if exists "owner_update" on public.%I', t);
    execute format('drop policy if exists "owner_delete" on public.%I', t);

    execute format(
      'create policy "single_owner_select" on public.%I for select to anon, authenticated using (user_id = public.owner_id())', t);
    execute format(
      'create policy "single_owner_insert" on public.%I for insert to anon, authenticated with check (user_id = public.owner_id())', t);
    execute format(
      'create policy "single_owner_update" on public.%I for update to anon, authenticated using (user_id = public.owner_id()) with check (user_id = public.owner_id())', t);
    if t not in ('option_items', 'color_tags') then
      execute format(
        'create policy "single_owner_delete" on public.%I for delete to anon, authenticated using (user_id = public.owner_id())', t);
    end if;

    execute format('revoke truncate on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

create policy "single_owner_delete" on public.option_items
  for delete to anon, authenticated using (user_id = public.owner_id() and key is null);
create policy "single_owner_delete" on public.color_tags
  for delete to anon, authenticated using (user_id = public.owner_id() and not is_default);

-- 每日檢查宣告改用固定擁有者
create or replace function public.claim_daily_check(p_today date)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  update app_settings
     set last_daily_check = p_today
   where user_id = public.owner_id()
     and (last_daily_check is null or last_daily_check < p_today)
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

-- 預設資料改用固定擁有者（內容與前一版相同）
create or replace function public.bootstrap_defaults()
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := public.owner_id();
  t_exhibition uuid;
  t_residency uuid;
  t_grant uuid;
  t_commercial uuid;
  tag_work uuid;
begin
  -- 冪等鎖：已有設定列就代表做過了（並行呼叫時第二個會落在 do nothing）
  insert into app_settings (user_id) values (uid) on conflict (user_id) do nothing;
  if not found then
    return false;
  end if;

  -- ---- 選項表 ----
  insert into option_items (category, key, label, sort_order) values
    ('project_type', 'exhibition', '展會', 1),
    ('project_type', 'residency', '駐村', 2),
    ('project_type', 'grant', '補助／計畫', 3),
    ('project_type', 'commercial', '商業插畫案', 4),

    ('project_status', 'active', '進行中', 1),
    ('project_status', 'done', '完成', 2),
    ('project_status', 'paused', '暫停', 3),
    ('project_status', 'cancelled', '取消', 4),

    ('collection_type', 'prospect_brand', '潛在客戶品牌', 1),
    ('collection_type', 'research', '研究參考', 2),
    ('collection_type', 'exhibition', '展會', 3),
    ('collection_type', 'residency', '駐村', 4),
    ('collection_type', 'grant', '補助／計畫', 5),

    ('collection_status', 'watching', '觀望中', 1),
    ('collection_status', 'joining', '決定參加', 2),
    ('collection_status', 'skipped', '不參加', 3),
    ('collection_status', 'missed', '錯過', 4),
    ('collection_status', 'converted', '已轉換', 5),

    ('sales_stage', 'first_contact', '初次接觸', 1),
    ('sales_stage', 'emailing', '信件溝通中', 2),
    ('sales_stage', 'meeting_booked', '線上會議預約', 3),
    ('sales_stage', 'no_show', 'No show', 4),
    ('sales_stage', 'quote_sent', '寄出報價', 5),
    ('sales_stage', 'quote_failed', '報價失敗', 6),
    ('sales_stage', 'won', '成交', 7),

    ('cooperation_status', 'unset', '未設定', 1),
    ('cooperation_status', 'aligned', '同頻', 2),
    ('cooperation_status', 'cold', '冷淡', 3),
    ('cooperation_status', 'mismatch', '不合', 4),

    ('followup_status', 'following', '追蹤中', 1),
    ('followup_status', 'cooling', '冷卻中', 2),
    ('followup_status', 'recontact', '可重新聯絡', 3),
    ('followup_status', 'won', '成交', 4),
    ('followup_status', 'rejected', '拒絕', 5),

    ('quote_status', 'draft', '草稿', 1),
    ('quote_status', 'sent', '已寄出', 2),
    ('quote_status', 'won', '成交', 3),
    ('quote_status', 'lost', '失敗', 4),

    ('contact_source', 'mutual_follow', '互相追蹤', 1),
    ('contact_source', 'facebook', '臉書好友', 2),
    ('contact_source', 'referral', '轉介', 3),

    ('contact_relation', 'prospect', '潛在客戶', 1),
    ('contact_relation', 'paying', '付費客戶', 2),
    ('contact_relation', 'vendor', '廠商', 3);

  -- 純使用者自訂（無系統鍵，可刪除）
  insert into option_items (category, key, label, sort_order) values
    ('followup_method', null, 'Email', 1),
    ('followup_method', null, 'IG 私訊', 2),
    ('followup_method', null, '電話', 3),
    ('followup_method', null, '會議', 4),
    ('currency', null, 'TWD', 1),
    ('currency', null, 'USD', 2),
    ('currency', null, 'JPY', 3),
    ('currency', null, 'EUR', 4);

  -- ---- 顏色標籤 ----
  insert into color_tags (name, color, sort_order, is_default) values
    ('未分類', '#8A938F', 0, true);
  insert into color_tags (name, color, sort_order) values
    ('工作', '#8BE8CB', 1) returning id into tag_work;
  insert into color_tags (name, color, sort_order) values
    ('分類', '#888DA7', 2);
  insert into color_tags (name, color, sort_order, is_life_todo) values
    ('私人', '#9C7A97', 3, true);

  -- ---- 階段模板 ----
  select id into t_exhibition from option_items where user_id = uid and category = 'project_type' and key = 'exhibition';
  select id into t_residency  from option_items where user_id = uid and category = 'project_type' and key = 'residency';
  select id into t_grant      from option_items where user_id = uid and category = 'project_type' and key = 'grant';
  select id into t_commercial from option_items where user_id = uid and category = 'project_type' and key = 'commercial';

  insert into stage_templates (project_type_id, name, sort_order)
  select t_commercial, s.name, s.ord
    from unnest(array['草稿', '提案', '定稿', '線稿', '精稿', '上色', '光影', '修改', '完稿'])
         with ordinality as s(name, ord);

  -- 展會／駐村／補助：預設階段（可在設定頁修改）
  insert into stage_templates (project_type_id, name, sort_order)
  select tt.type_id, s.name, s.ord
    from (values (t_exhibition), (t_residency), (t_grant)) as tt(type_id)
   cross join unnest(array['準備申請', '已送件', '審核中', '錄取／通過', '執行中', '結案'])
         with ordinality as s(name, ord);

  -- ---- 錨點任務範例（可在設定頁修改） ----
  insert into template_tasks (project_type_id, name, anchor, offset_days, color_tag_id, sort_order)
  select tt.type_id, x.name, x.anchor, x.off, tag_work, x.ord
    from (values (t_exhibition), (t_residency), (t_grant)) as tt(type_id)
   cross join (values
      ('開始準備申請資料', 'apply_start', 0, 1),
      ('完成作品集', 'apply_deadline', -14, 2),
      ('送出申請', 'apply_deadline', -3, 3),
      ('行前準備清單', 'event_start', -7, 4)
   ) as x(name, anchor, off, ord);

  -- ---- 合約模板 ----
  insert into contract_templates (name, is_default, body) values (
    '插畫委託合約（預設）', true,
$body$插畫委託合約書

委託方：{{客戶名稱}}（以下簡稱甲方）
受託方：{{我的名稱}}（以下簡稱乙方）

一、委託內容
甲方委託乙方繪製插畫，品項明細詳見報價單（版本 {{報價版本}}）。

二、費用與付款
1. 本案總額為新臺幣 {{總額}} 元（含稅）。
2. 簽約後甲方應先支付總額 {{訂金比例}}% 作為訂金，乙方收到訂金後開始作業。
3. 餘款於乙方交付完稿後 14 日內付清。

三、交期
{{交期}}

四、修改
本案包含 {{修改次數}} 次修改。超出次數之修改，雙方另行議價。

五、授權範圍
{{授權範圍}}
著作人格權歸乙方所有；除上述授權範圍外，甲方不得另作他用。

六、其他
本合約未盡事宜，雙方本誠信原則協商之。

甲方簽章：＿＿＿＿＿＿＿＿　　日期：＿＿＿＿＿＿
乙方簽章：＿＿＿＿＿＿＿＿　　日期：{{今天}}
$body$
  );

  update app_settings set seeded_at = now() where user_id = uid;
  return true;
end;
$$;

grant execute on function public.bootstrap_defaults() to anon, authenticated;
grant execute on function public.claim_daily_check(date) to anon, authenticated;
grant execute on function public.complete_timeline_item(uuid, date) to anon, authenticated;

-- ---------- Storage：附件路徑第一層為擁有者 id ----------
drop policy if exists "attachments_owner_select" on storage.objects;
drop policy if exists "attachments_owner_insert" on storage.objects;
drop policy if exists "attachments_owner_update" on storage.objects;
drop policy if exists "attachments_owner_delete" on storage.objects;

create policy "attachments_single_owner_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.owner_id()::text);
create policy "attachments_single_owner_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.owner_id()::text);
create policy "attachments_single_owner_update" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.owner_id()::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.owner_id()::text);
create policy "attachments_single_owner_delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.owner_id()::text);
