INSERT INTO public.focus_areas (key, title, subtitle, manager_type, is_default, accent_color, icon_name, sort_order)
SELECT 'nla', 'NLA', 'Program Coordination', 'PC', true, '#bf0f3e', 'shield', 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.focus_areas WHERE key = 'nla' AND manager_type = 'PC'
);