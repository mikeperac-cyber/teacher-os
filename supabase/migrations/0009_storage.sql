-- Storage buckets and their access policies.
--
-- Every bucket is private. Nothing here is ever served from a public URL:
-- reading a file goes through a server-generated signed URL issued after an
-- authorization check, or through these policies on a direct client read.
--
-- PATH CONVENTION
-- ---------------
-- Authorization is derived from the object path, so the layout is part of the
-- security model and must not be changed casually:
--
--   homework-submissions   {workspace_id}/{student_id}/{submission_id}/{file}
--   speaking-recordings    {workspace_id}/{student_id}/{recording_id}/{file}
--   materials              {workspace_id}/{material_id}/{file}
--   avatars                {user_id}/{file}

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------

-- A path segment is untrusted text. Casting it straight to uuid raises on
-- anything malformed, which would turn a bad filename into a request error
-- rather than a clean denial. This returns null instead, and null fails every
-- comparison below.
create or replace function private.safe_uuid(value text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  return value::uuid;
exception
  when others then
    return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'homework-submissions',
    'homework-submissions',
    false,
    26214400, -- 25 MB
    array[
      'application/pdf',
      'image/png', 'image/jpeg', 'image/webp',
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'speaking-recordings',
    'speaking-recordings',
    false,
    104857600, -- 100 MB; a full Speaking mock runs to ~15 minutes
    array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg']
  ),
  (
    'materials',
    'materials',
    false,
    52428800, -- 50 MB
    array[
      'application/pdf',
      'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
      'audio/mpeg', 'audio/mp4', 'audio/wav',
      'text/plain', 'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
  ),
  (
    'avatars',
    'avatars',
    false,
    2097152, -- 2 MB
    array['image/png', 'image/jpeg', 'image/webp']
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- homework-submissions
-- ---------------------------------------------------------------------------

create policy "staff may read submissions for students they can access"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'homework-submissions'
    and private.can_access_student(
      private.safe_uuid((storage.foldername(name))[2])
    )
  );

create policy "a student may read their own submission files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'homework-submissions'
    and private.is_own_student_record(
      private.safe_uuid((storage.foldername(name))[2])
    )
  );

create policy "a student may upload their own submission files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'homework-submissions'
    and private.is_own_student_record(
      private.safe_uuid((storage.foldername(name))[2])
    )
  );

create policy "staff may upload submission files for students they can access"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'homework-submissions'
    and private.can_access_student(
      private.safe_uuid((storage.foldername(name))[2])
    )
  );

-- Deleting submitted work is staff-only. A student who could delete their own
-- submission after it was marked would be able to erase the evidence behind
-- their feedback.
create policy "staff may delete submission files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'homework-submissions'
    and private.can_access_student(
      private.safe_uuid((storage.foldername(name))[2])
    )
  );

-- ---------------------------------------------------------------------------
-- speaking-recordings
-- ---------------------------------------------------------------------------

create policy "staff may read speaking recordings for their students"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'speaking-recordings'
    and private.can_access_student(
      private.safe_uuid((storage.foldername(name))[2])
    )
  );

create policy "a student may read their own speaking recordings"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'speaking-recordings'
    and private.is_own_student_record(
      private.safe_uuid((storage.foldername(name))[2])
    )
  );

create policy "a student may upload their own speaking recordings"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'speaking-recordings'
    and private.is_own_student_record(
      private.safe_uuid((storage.foldername(name))[2])
    )
  );

create policy "staff may upload speaking recordings for their students"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'speaking-recordings'
    and private.can_access_student(
      private.safe_uuid((storage.foldername(name))[2])
    )
  );

create policy "staff may delete speaking recordings"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'speaking-recordings'
    and private.can_access_student(
      private.safe_uuid((storage.foldername(name))[2])
    )
  );

-- ---------------------------------------------------------------------------
-- materials
-- ---------------------------------------------------------------------------
-- Staff only, matching the `materials` table. Sharing a specific material with
-- a learner needs an explicit link and is deferred rather than approximated.

create policy "staff may read materials in their workspace"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'materials'
    and private.is_workspace_staff(
      private.safe_uuid((storage.foldername(name))[1])
    )
  );

create policy "staff may upload materials to their workspace"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'materials'
    and private.is_workspace_staff(
      private.safe_uuid((storage.foldername(name))[1])
    )
  );

create policy "staff may replace materials in their workspace"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'materials'
    and private.is_workspace_staff(
      private.safe_uuid((storage.foldername(name))[1])
    )
  )
  with check (
    bucket_id = 'materials'
    and private.is_workspace_staff(
      private.safe_uuid((storage.foldername(name))[1])
    )
  );

create policy "staff may delete materials in their workspace"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'materials'
    and private.is_workspace_staff(
      private.safe_uuid((storage.foldername(name))[1])
    )
  );

-- ---------------------------------------------------------------------------
-- avatars
-- ---------------------------------------------------------------------------

create policy "a user may read their own avatar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "a user may upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "a user may replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "a user may delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
