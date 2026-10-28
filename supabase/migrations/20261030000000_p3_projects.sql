-- =====================================================================
-- P3：專案與錨點任務
--   * 同一專案、同一模板任務只會產生一筆（多裝置同時按「從模板產生」也不會重複）
-- =====================================================================

create unique index if not exists timeline_items_project_template_uniq
  on public.timeline_items (project_id, template_task_id)
  where project_id is not null and template_task_id is not null;

create index if not exists projects_type_idx on public.projects (type_id);
create index if not exists stage_templates_user_type_idx on public.stage_templates (user_id, project_type_id, sort_order);
