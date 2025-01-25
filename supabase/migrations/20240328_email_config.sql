-- Email configuration and templates
create table email_config (
    id uuid default uuid_generate_v4() primary key,
    config_key text unique not null,
    config_value text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Email templates for automated responses
create table email_templates (
    id uuid default uuid_generate_v4() primary key,
    template_key text unique not null,
    subject_template text not null,
    body_template text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Insert default templates
insert into email_templates (template_key, subject_template, body_template) values
('new_user_ticket', 'Your Support Ticket #{ticket_id} Has Been Created', 'Dear {user_name},

Thank you for contacting our support team. Your ticket (#{ticket_id}) has been created and our team will respond shortly.

To access your ticket and view responses, please create an account using the following temporary credentials:

Email: {user_email}
Temporary Password: {temp_password}

Please visit {login_url} to log in and change your password.

Best regards,
The Support Team'),

('existing_user_ticket', 'Your Support Ticket #{ticket_id} Has Been Created', 'Dear {user_name},

Thank you for contacting our support team. Your ticket (#{ticket_id}) has been created and our team will respond shortly.

You can view your ticket and any responses by logging into your account at {login_url}

Best regards,
The Support Team');

-- Create trigger to update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_email_config_timestamp
    before update on email_config
    for each row
    execute function update_updated_at();

create trigger update_email_template_timestamp
    before update on email_templates
    for each row
    execute function update_updated_at();

-- Add indexes
create index idx_email_config_key on email_config(config_key);
create index idx_email_template_key on email_templates(template_key);

-- Add RLS policies
alter table email_config enable row level security;
alter table email_templates enable row level security;

create policy "Email config viewable by supporters"
    on email_config for select
    using (
        exists (
            select 1 from supporters
            where id = auth.uid()
        )
    );

create policy "Email templates viewable by supporters"
    on email_templates for select
    using (
        exists (
            select 1 from supporters
            where id = auth.uid()
        )
    ); 