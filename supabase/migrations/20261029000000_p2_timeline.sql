-- =====================================================================
-- P2：時間軸與顏色標籤
--   * color_tags.is_life_todo：此標籤的項目列入側邊欄「生活代辦」（預設：私人）
--   * timeline_items.series_start_on：重複系列的起始日（每月重複時保留原本的「幾號」）
--   * complete_timeline_item()：勾選完成＋產生下一筆重複項目（冪等、原子）
--   * bootstrap_defaults() 重新定義：新使用者的「私人」標籤預設列入生活代辦
-- =====================================================================

alter table public.color_tags
  add column if not exists is_life_todo boolean not null default false;

-- 既有使用者：把預設的「私人」標籤設為生活代辦
update public.color_tags
   set is_life_todo = true
 where name = '私人' and upper(color) = '#9C7A97' and not is_default;

alter table public.timeline_items
  add column if not exists series_start_on date;

create index if not exists timeline_items_series_idx on public.timeline_items (series_id);
create index if not exists timeline_items_open_idx on public.timeline_items (user_id, item_date) where not is_done;

-- 勾選完成。若為重複項目且尚未產生下一筆，則以 p_next_date（由前端純函式依「原定日期」推算）
-- 建立下一筆：繼承標題、內容、顏色、時間、關聯與重複設定；清單子項目全部重設為未勾選。
-- 同一筆重複呼叫不會產生第二筆（以 next_occurrence_id 判斷），多裝置同時操作也安全（row lock）。
create or replace function public.complete_timeline_item(p_id uuid, p_next_date date default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  it timeline_items%rowtype;
  new_id uuid;
begin
  select * into it from timeline_items where id = p_id for update;
  if not found then
    raise exception '找不到項目' using errcode = 'P0002';
  end if;

  update timeline_items
     set is_done = true,
         done_at = coalesce(done_at, now())
   where id = p_id;

  if it.recurrence = 'none' or it.next_occurrence_id is not null or p_next_date is null then
    return it.next_occurrence_id;
  end if;

  new_id := gen_random_uuid();
  insert into timeline_items (
    id, item_date, item_time, title, content, color_tag_id, project_id, client_id, kind,
    recurrence, recurrence_interval, recurrence_unit, series_id, series_start_on, source, sort_order
  ) values (
    new_id, p_next_date, it.item_time, it.title, it.content, it.color_tag_id, it.project_id, it.client_id, it.kind,
    it.recurrence, it.recurrence_interval, it.recurrence_unit,
    coalesce(it.series_id, it.id), coalesce(it.series_start_on, it.item_date), 'manual', it.sort_order
  );

  insert into checklist_items (timeline_item_id, content, is_done, sort_order)
  select new_id, content, false, sort_order
    from checklist_items
   where timeline_item_id = p_id;

  update timeline_items
     set next_occurrence_id = new_id,
         series_id = coalesce(series_id, id),
         series_start_on = coalesce(series_start_on, item_date)
   where id = p_id;

  return new_id;
end;
$$;

grant execute on function public.complete_timeline_item(uuid, date) to authenticated;
revoke execute on function public.complete_timeline_item(uuid, date) from anon;

-- 重新定義預設資料（只有「私人」標籤多了 is_life_todo = true）
create or replace function public.bootstrap_defaults()
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t_exhibition uuid;
  t_residency uuid;
  t_grant uuid;
  t_commercial uuid;
  tag_work uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

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

