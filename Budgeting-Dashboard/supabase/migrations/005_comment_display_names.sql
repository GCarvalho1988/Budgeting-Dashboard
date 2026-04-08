-- supabase/migrations/005_comment_display_names.sql

-- Add display name to profiles
alter table profiles add column display_name text not null default '';
update profiles set display_name = 'Gui'   where role = 'admin';
update profiles set display_name = 'Dulce' where role = 'member';

-- Allow users to delete their own flags; allow admins to delete any flag
create policy "delete own or admin flags" on flags
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );
