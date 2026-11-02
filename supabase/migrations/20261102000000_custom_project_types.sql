-- =====================================================================
-- 專案類型完整自訂（使用者要求，2026/11/02）
--   * 預設的專案類型（展會、駐村、補助／計畫、商業插畫案）也可以刪除
--   * 其他系統選項（狀態、銷售流程…）自動化規則仍需要，維持不可刪除
--   * 刪除類型時，該類型的階段與錨點任務一併刪除（stage_templates／template_tasks 既有 on delete cascade）；
--     仍有專案使用的類型會被外鍵擋下（前端會先把專案改到其他類型）
-- =====================================================================

drop policy if exists "single_owner_delete" on public.option_items;
create policy "single_owner_delete" on public.option_items
  for delete to anon, authenticated
  using (user_id = public.owner_id() and (key is null or category = 'project_type'));
