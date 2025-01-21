-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Companies table
create table companies (
    id uuid default uuid_generate_v4() primary key,
    company_name text not null,
    created_at timestamp with time zone default now()
);

-- Users (Customers) table
create table users (
    id uuid primary key references auth.users(id),
    email text unique not null,
    full_name text not null,
    company_id uuid references companies(id),
    created_at timestamp with time zone default now(),
    last_login timestamp with time zone
);

-- Supporters table
create table supporters (
    id uuid primary key references auth.users(id),
    email text unique not null,
    full_name text not null,
    created_at timestamp with time zone default now(),
    last_login timestamp with time zone
);

-- Categories table
create table categories (
    id uuid default uuid_generate_v4() primary key,
    category_name text not null,
    description text
);

-- Tickets table
create table tickets (
    id uuid default uuid_generate_v4() primary key,
    title text not null,
    category_id uuid references categories(id),
    created_by_user_id uuid references users(id),
    assigned_to_supporter_id uuid references supporters(id),
    ticket_status text not null check (ticket_status in ('new', 'in_progress', 'requires_response', 'closed')),
    priority text check (priority in ('low', 'medium', 'high', 'urgent')),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    closed_at timestamp with time zone
);

-- Messages table
create table messages (
    id uuid default uuid_generate_v4() primary key,
    ticket_id uuid references tickets(id),
    sender_type text not null check (sender_type in ('user', 'supporter')),
    sender_id uuid not null,
    content text not null,
    created_at timestamp with time zone default now()
);

-- Notes (Internal) table
create table notes (
    id uuid default uuid_generate_v4() primary key,
    ticket_id uuid references tickets(id),
    supporter_id uuid references supporters(id),
    note_title text,
    content text not null,
    created_at timestamp with time zone default now()
);

-- Ticket Status History table
create table ticket_status_history (
    id uuid default uuid_generate_v4() primary key,
    ticket_id uuid references tickets(id),
    old_ticket_status text,
    new_ticket_status text not null,
    changed_by_id uuid not null,
    changed_at timestamp with time zone default now()
);

-- Files table
create table files (
    id uuid default uuid_generate_v4() primary key,
    file_name text not null,
    file_size bigint not null,
    mime_type text not null,
    storage_path text not null,
    uploaded_by_type text not null check (uploaded_by_type in ('user', 'supporter')),
    uploaded_by_id uuid not null,
    ticket_id uuid references tickets(id),
    message_id uuid references messages(id),
    created_at timestamp with time zone default now(),
    constraint file_association_check check (
        (ticket_id IS NOT NULL AND message_id IS NULL) OR
        (ticket_id IS NULL AND message_id IS NOT NULL)
    )
);

-- Templates table
create table templates (
    id uuid default uuid_generate_v4() primary key,
    template_name text not null,
    content text not null,
    created_by_supporter_id uuid references supporters(id),
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Template Mappings table
create table template_mappings (
    id uuid default uuid_generate_v4() primary key,
    template_id uuid references templates(id),
    ticket_category_id uuid references categories(id),
    created_at timestamp with time zone default now(),
    unique(template_id, ticket_category_id)
);

-- Create indexes
create index idx_users_email on users(email);
create index idx_supporters_email on supporters(email);
create index idx_tickets_created_by_user_id on tickets(created_by_user_id);
create index idx_tickets_assigned_to_supporter_id on tickets(assigned_to_supporter_id);
create index idx_tickets_ticket_status on tickets(ticket_status);
create index idx_messages_ticket_id on messages(ticket_id);
create index idx_notes_ticket_id on notes(ticket_id);
create index idx_files_ticket_id on files(ticket_id);
create index idx_files_message_id on files(message_id);
create index idx_template_mappings_ticket_category_id on template_mappings(ticket_category_id);

-- Enable Row Level Security (RLS)
alter table companies enable row level security;
alter table users enable row level security;
alter table supporters enable row level security;
alter table tickets enable row level security;
alter table messages enable row level security;
alter table notes enable row level security;
alter table files enable row level security;
alter table templates enable row level security;
alter table template_mappings enable row level security;

-- Add RLS policies
create policy "Allow public read access to companies"
    on companies for select
    to public
    using (true);

-- Add RLS policies for supporters
create policy "Allow public read access to supporters for auth"
    on supporters for select
    to public
    using (true);

create policy "Allow supporters to update their own record"
    on supporters for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Create trigger function for updating ticket updated_at
create or replace function update_ticket_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Create trigger for ticket updates
create trigger update_ticket_timestamp
    before update on tickets
    for each row
    execute function update_ticket_updated_at(); 