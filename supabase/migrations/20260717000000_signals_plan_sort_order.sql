-- Ordering for Today's Plan, independent of today_sort_order.
--
-- today_sort_order orders signals WITHIN a focus area. Today's Plan is a
-- cross-area subset (planned_date = today), and the owner wants to drag it into
-- its own order. Giving the plan a separate column means reordering the plan
-- never disturbs the in-tile order, and vice versa. Null until first reordered
-- (the plan then falls back to today_sort_order / created_at order).
alter table public.signals
  add column if not exists plan_sort_order integer;
