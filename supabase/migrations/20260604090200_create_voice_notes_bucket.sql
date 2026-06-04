-- Private bucket for voice-note audio. Files: "<user_id>/<visit_id>".
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

drop policy if exists "voice_notes_select_own" on storage.objects;
drop policy if exists "voice_notes_insert_own" on storage.objects;
drop policy if exists "voice_notes_update_own" on storage.objects;
drop policy if exists "voice_notes_delete_own" on storage.objects;

create policy "voice_notes_select_own"
  on storage.objects for select to authenticated
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "voice_notes_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "voice_notes_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "voice_notes_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text);
