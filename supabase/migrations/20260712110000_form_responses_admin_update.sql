-- Allow admins to edit (update) a collected form response — e.g. to fix a
-- typo a parent/guardian made. Responses stay admin-only for read/edit/delete;
-- the public can still only INSERT (submit).

drop policy if exists "form_responses_admin_update" on public.form_responses;
create policy "form_responses_admin_update" on public.form_responses
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

grant update on public.form_responses to authenticated;
