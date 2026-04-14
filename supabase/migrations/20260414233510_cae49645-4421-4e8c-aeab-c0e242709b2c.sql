
-- Allow anon (kiosk) to create meal events
CREATE POLICY "Anon can insert meal_events"
ON public.meal_events FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon (kiosk) to update meal events (for closing/submitting and editing donor)
CREATE POLICY "Anon can update meal_events"
ON public.meal_events FOR UPDATE
TO anon
USING (event_date = CURRENT_DATE)
WITH CHECK (event_date = CURRENT_DATE);

-- Allow anon (kiosk) to insert meal items
CREATE POLICY "Anon can insert meal_items"
ON public.meal_items FOR INSERT
TO anon
WITH CHECK (EXISTS (
  SELECT 1 FROM meal_events me
  WHERE me.id = meal_items.meal_event_id
  AND me.event_date = CURRENT_DATE
));

-- Allow anon (kiosk) to delete meal items (for edit sheet removal)
CREATE POLICY "Anon can delete meal_items"
ON public.meal_items FOR DELETE
TO anon
USING (EXISTS (
  SELECT 1 FROM meal_events me
  WHERE me.id = meal_items.meal_event_id
  AND me.event_date = CURRENT_DATE
));
