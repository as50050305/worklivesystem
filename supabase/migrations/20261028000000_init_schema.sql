-- =====================================================================
-- 個人工作＋生活規劃系統｜初始 Schema
-- 原則：
--   * 每張表都有 id、user_id、created_at、updated_at
--   * user_id 預設為 auth.uid()，前端不必自行帶入
--   * 每張表都啟用 RLS，只允許登入的擁有者讀寫
--   * 類型／狀態／階段等選項都放在 option_items（可新增、改名、排序）
--     自動化規則只認 option_items.key（系統鍵），不認顯示名稱，因此改名不會壞掉
--   * 自動計算的欄位都附 *_is_manual 旗標；為 true 時自動化不得覆蓋
-- =====================================================================

-- ---------- 共用函式 ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- 使用者設定／每日檢查狀態 ----------
create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  last_daily_check date,                     -- 每日檢查冪等：同一天只生效一次
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  preferences jsonb not null default '{}'::jsonb,
  seeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ---------- 可編輯選項表 ----------
-- category 例：project_type, project_status, collection_type, collection_status,
--   sales_stage, cooperation_status, followup_status, quote_status,
--   contact_source, contact_relation, followup_method, currency
create table public.option_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null,
  key text,                                  -- 系統鍵；非 null 者可改名、排序，但不可刪除
  label text not null,
  sort_order integer not null default 0,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, key)
);
create index option_items_user_category_idx on public.option_items (user_id, category, sort_order);

-- ---------- 顏色標籤 ----------
create table public.color_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  is_default boolean not null default false, -- 「未分類」：不可刪除
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index color_tags_one_default_per_user on public.color_tags (user_id) where is_default;
create index color_tags_user_idx on public.color_tags (user_id, sort_order);

-- ---------- 階段模板 ----------
create table public.stage_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_type_id uuid not null references public.option_items (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stage_templates_type_idx on public.stage_templates (project_type_id, sort_order);

create table public.template_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_type_id uuid not null references public.option_items (id) on delete cascade,
  name text not null,
  anchor text not null check (anchor in ('apply_start', 'apply_deadline', 'event_start')),
  offset_days integer not null default 0,
  color_tag_id uuid references public.color_tags (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index template_tasks_type_idx on public.template_tasks (project_type_id, sort_order);

-- ---------- 人脈 ----------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  company text,
  job_title text,
  website text,
  instagram text,
  source_id uuid references public.option_items (id) on delete restrict,      -- 認識管道
  referrer_contact_id uuid references public.contacts (id) on delete set null, -- 轉介人（既有人脈）
  referrer_name text,                                                          -- 轉介人（自由輸入）
  relation_id uuid references public.option_items (id) on delete restrict,    -- 與我的關係
  client_id uuid,                                                              -- 關聯客戶（FK 於下方補上）
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_user_idx on public.contacts (user_id, name);

-- ---------- 客戶 ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null,                         -- C001…，可改但不可重複（觸發器自動產生）
  name text not null,                         -- 品牌名稱
  phone text,
  email text,
  instagram text,
  website text,
  sales_stage_id uuid references public.option_items (id) on delete restrict,
  cooperation_status_id uuid references public.option_items (id) on delete restrict,
  followup_status_id uuid references public.option_items (id) on delete restrict,
  followup_count integer not null default 0 check (followup_count between 0 and 5),
  round integer not null default 0 check (round >= 0),
  round_started_on date,
  next_followup_on date,
  cooldown_until date,
  has_worked_together boolean not null default false,
  decline_next boolean not null default false,
  no_show_pending boolean not null default false, -- No show 後待寄追蹤信（側邊欄提示）
  color_tag_id uuid references public.color_tags (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);
create index clients_next_followup_idx on public.clients (user_id, next_followup_on);
create index clients_cooldown_idx on public.clients (user_id, cooldown_until);

alter table public.contacts
  add constraint contacts_client_id_fkey foreign key (client_id) references public.clients (id) on delete set null;

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, contact_id)
);
create index client_contacts_contact_idx on public.client_contacts (contact_id);

create table public.client_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  starts_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_meetings_client_idx on public.client_meetings (client_id, starts_at);

create table public.client_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  followed_on date not null,
  method_id uuid references public.option_items (id) on delete restrict,
  note text,
  round integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_followups_client_idx on public.client_followups (client_id, followed_on desc);

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_notes_client_idx on public.client_notes (client_id, created_at desc);

-- ---------- 收藏庫 ----------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  url text,
  note text,
  type_id uuid references public.option_items (id) on delete restrict,
  organizer text,
  city text,
  country text,
  apply_start_on date,
  apply_deadline_on date,
  event_start_on date,
  event_end_on date,
  fee_amount numeric(14, 2),
  fee_currency text default 'TWD',
  requirements text,                          -- 條件摘要
  status_id uuid references public.option_items (id) on delete restrict,
  remind_next_year boolean not null default false,
  remind_on date,
  converted_project_id uuid,                  -- FK 於下方補上
  converted_client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collections_user_idx on public.collections (user_id, apply_deadline_on);
create index collections_remind_idx on public.collections (user_id, remind_on) where remind_next_year;

-- ---------- 專案 ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type_id uuid references public.option_items (id) on delete restrict,
  status_id uuid references public.option_items (id) on delete restrict,
  current_stage_id uuid references public.stage_templates (id) on delete set null,
  progress numeric(5, 2) not null default 0 check (progress between 0 and 100),
  progress_is_manual boolean not null default false,
  apply_start_on date,
  apply_deadline_on date,
  event_start_on date,
  event_end_on date,
  city text,
  country text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  color_tag_id uuid references public.color_tags (id) on delete set null,
  source_collection_id uuid references public.collections (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  quote_id uuid,                              -- FK 於下方補上
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_idx on public.projects (user_id, status_id);
create index projects_client_idx on public.projects (client_id);

alter table public.collections
  add constraint collections_converted_project_id_fkey foreign key (converted_project_id) references public.projects (id) on delete set null;

create table public.project_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  item text not null,
  amount numeric(14, 2) not null default 0,
  currency text not null default 'TWD',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_costs_project_idx on public.project_costs (project_id, sort_order);

create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null,
  title text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_links_project_idx on public.project_links (project_id, sort_order);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  storage_path text not null,                 -- attachments bucket 內路徑：{user_id}/{project_id}/{uuid}-{檔名}
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_path)
);
create index attachments_project_idx on public.attachments (project_id);

create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_notes_project_idx on public.project_notes (project_id, created_at desc);

-- ---------- 時間軸 ----------
create table public.timeline_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_date date not null,
  item_time time,                             -- null = 整天
  title text not null,
  content text,
  color_tag_id uuid references public.color_tags (id) on delete set null,
  is_done boolean not null default false,
  done_at timestamptz,
  project_id uuid references public.projects (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  kind text not null default 'normal' check (kind in ('normal', 'checklist')),
  recurrence text not null default 'none'
    check (recurrence in ('none', 'weekly', 'monthly', 'bimonthly', 'custom')),
  recurrence_interval integer check (recurrence_interval is null or recurrence_interval > 0),
  recurrence_unit text check (recurrence_unit is null or recurrence_unit in ('day', 'week', 'month')),
  series_id uuid,                             -- 同一重複系列共用
  next_occurrence_id uuid references public.timeline_items (id) on delete set null, -- 已產生的下一筆（冪等）
  source text not null default 'manual' check (source in ('manual', 'template')),
  template_task_id uuid references public.template_tasks (id) on delete set null,
  anchor text check (anchor is null or anchor in ('apply_start', 'apply_deadline', 'event_start')),
  offset_days integer,
  is_manually_adjusted boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeline_custom_recurrence check (
    recurrence <> 'custom' or (recurrence_interval is not null and recurrence_unit is not null)
  )
);
create index timeline_items_date_idx on public.timeline_items (user_id, item_date);
create index timeline_items_project_idx on public.timeline_items (project_id);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  timeline_item_id uuid not null references public.timeline_items (id) on delete cascade,
  content text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checklist_items_parent_idx on public.checklist_items (timeline_item_id, sort_order);

-- ---------- 報價單 ----------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  version integer not null,                   -- 觸發器自動遞增（同客戶＋專案）
  copied_from_id uuid references public.quotes (id) on delete set null,
  issued_on date not null default (now() at time zone 'Asia/Taipei')::date,
  title text,
  currency text not null default 'TWD',
  license_scope text,                         -- 授權範圍
  revision_count integer,                     -- 修改次數
  delivery_terms text,                        -- 交期
  deposit_percent numeric(5, 2) check (deposit_percent is null or deposit_percent between 0 and 100),
  tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100),
  total numeric(14, 2) not null default 0,
  total_is_manual boolean not null default false,
  status_id uuid references public.option_items (id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_client_idx on public.quotes (client_id, version);
create index quotes_project_idx on public.quotes (project_id);

alter table public.projects
  add constraint projects_quote_id_fkey foreign key (quote_id) references public.quotes (id) on delete set null;

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  item_name text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0,
  subtotal_is_manual boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quote_lines_quote_idx on public.quote_lines (quote_id, sort_order);

create table public.quote_item_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  unit_price numeric(14, 2) not null default 0,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  body text not null,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete set null,
  template_id uuid references public.contract_templates (id) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contracts_quote_idx on public.contracts (quote_id);

-- ---------- 自動編號觸發器 ----------
-- 客戶編號：未填時自動給下一個 C###
create or replace function public.assign_client_code()
returns trigger
language plpgsql
as $$
declare
  next_no integer;
begin
  if new.code is null or btrim(new.code) = '' then
    select coalesce(max((substring(code from '^C(\d+)$'))::integer), 0) + 1
      into next_no
      from public.clients
     where user_id = new.user_id
       and code ~ '^C\d+$';
    new.code := 'C' || lpad(next_no::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger clients_assign_code
  before insert on public.clients
  for each row execute function public.assign_client_code();

-- 報價單版本：同一客戶＋專案下自動遞增
create or replace function public.assign_quote_version()
returns trigger
language plpgsql
as $$
begin
  if new.version is null or new.version <= 0 then
    select coalesce(max(version), 0) + 1
      into new.version
      from public.quotes
     where user_id = new.user_id
       and client_id is not distinct from new.client_id
       and project_id is not distinct from new.project_id;
  end if;
  return new;
end;
$$;

create trigger quotes_assign_version
  before insert on public.quotes
  for each row execute function public.assign_quote_version();

-- ---------- updated_at 觸發器、RLS、Realtime：套用到所有表 ----------
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
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_id_idx', t);

    execute format(
      'create policy "owner_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "owner_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "owner_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    -- 刪除政策個別定義（部分表有保護條件）
    if t not in ('option_items', 'color_tags') then
      execute format(
        'create policy "owner_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
    end if;

    -- 多裝置即時同步
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- 系統選項（有 key）不可刪除；「未分類」顏色標籤不可刪除
create policy "owner_delete" on public.option_items
  for delete to authenticated using (user_id = (select auth.uid()) and key is null);
create policy "owner_delete" on public.color_tags
  for delete to authenticated using (user_id = (select auth.uid()) and not is_default);
