-- Create the storage bucket for ticket files
insert into storage.buckets (id, name, public)
values ('ticket-files', 'ticket-files', false);

-- Policy to allow authenticated users to view files in the bucket
create policy "Allow authenticated users to view files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ticket-files' AND
  auth.role() = 'authenticated' AND
  (
    -- Check if the user is a supporter
    exists (
      select 1 from supporters
      where id = auth.uid()
    ) OR
    -- Or if the user owns the ticket associated with the file
    exists (
      select 1 from files f
      join tickets t on f.ticket_id = t.id
      where 
        f.storage_path = storage.objects.name AND
        t.created_by_user_id = auth.uid()
    )
  )
);

-- Policy to allow authenticated users to upload files
create policy "Allow authenticated users to upload files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ticket-files' AND
  auth.role() = 'authenticated' AND
  (
    -- Check if the user is a supporter
    exists (
      select 1 from supporters
      where id = auth.uid()
    ) OR
    -- Or if the user owns the ticket
    exists (
      select 1 from tickets t
      where 
        t.id = (
          -- Extract ticket ID from storage path (format: {ticket_id}/{timestamp}.{ext})
          split_part(storage.objects.name, '/', 1)::uuid
        ) AND
        t.created_by_user_id = auth.uid()
    )
  )
);

-- Policy to allow authenticated users to delete their own uploads
create policy "Allow users to delete their own uploads"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ticket-files' AND
  auth.role() = 'authenticated' AND
  (
    -- Check if the user is a supporter
    exists (
      select 1 from supporters
      where id = auth.uid()
    ) OR
    -- Or if the user owns the file
    exists (
      select 1 from files f
      where 
        f.storage_path = storage.objects.name AND
        f.uploaded_by_id = auth.uid()
    )
  )
);

-- Policy to allow authenticated users to update their own uploads
create policy "Allow users to update their own uploads"
on storage.objects for update
to authenticated
using (
  bucket_id = 'ticket-files' AND
  auth.role() = 'authenticated' AND
  (
    -- Check if the user is a supporter
    exists (
      select 1 from supporters
      where id = auth.uid()
    ) OR
    -- Or if the user owns the file
    exists (
      select 1 from files f
      where 
        f.storage_path = storage.objects.name AND
        f.uploaded_by_id = auth.uid()
    )
  )
); 