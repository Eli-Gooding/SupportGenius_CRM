-- Create processed_emails table
create table if not exists processed_emails (
  email_id text primary key,
  processed_at timestamp with time zone not null,
  history_id text not null,
  created_at timestamp with time zone default now(),
  -- Add indexes for common queries
  constraint processed_emails_email_id_key unique (email_id)
);

-- Add RLS policies
alter table processed_emails enable row level security;

-- Allow service role full access
create policy "Service role can manage processed_emails"
  on processed_emails
  to service_role
  using (true)
  with check (true);

-- Add helpful comments
comment on table processed_emails is 'Tracks processed Gmail messages to prevent duplicate processing';
comment on column processed_emails.email_id is 'Gmail message ID';
comment on column processed_emails.processed_at is 'When the email was processed';
comment on column processed_emails.history_id is 'Gmail history ID when processed'; 