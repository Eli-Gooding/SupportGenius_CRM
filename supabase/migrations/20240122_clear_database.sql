-- Drop all policies first
drop policy if exists "Users can view their own profile" on users;
drop policy if exists "Enable insert for authenticated users during signup" on users;
drop policy if exists "Enable service role operations on users" on users;

drop policy if exists "Supporters can view all supporters" on supporters;
drop policy if exists "Enable insert for authenticated users during signup" on supporters;
drop policy if exists "Enable service role operations on supporters" on supporters;

drop policy if exists "Users can view their own tickets" on tickets;
drop policy if exists "Supporters can view all tickets" on tickets;
drop policy if exists "Users can create tickets" on tickets;
drop policy if exists "Supporters can update assigned tickets" on tickets;

drop policy if exists "Users can view messages in their tickets" on messages;
drop policy if exists "Supporters can view all messages" on messages;
drop policy if exists "Users can create messages in their tickets" on messages;
drop policy if exists "Supporters can create messages" on messages;

drop policy if exists "Supporters can view all notes" on notes;
drop policy if exists "Supporters can create notes" on notes;

drop policy if exists "Users can view files in their tickets" on files;
drop policy if exists "Supporters can view all files" on files;
drop policy if exists "Users can upload files to their tickets" on files;
drop policy if exists "Supporters can upload files" on files;

drop policy if exists "Supporters can view all templates" on templates;
drop policy if exists "Supporters can manage templates" on templates;

drop policy if exists "Supporters can view template mappings" on template_mappings;
drop policy if exists "Supporters can manage template mappings" on template_mappings;

-- Drop triggers
drop trigger if exists update_ticket_timestamp on tickets;
drop function if exists update_ticket_updated_at();

-- Drop tables in correct order (respecting foreign key constraints)
drop table if exists template_mappings;
drop table if exists templates;
drop table if exists files;
drop table if exists ticket_status_history;
drop table if exists notes;
drop table if exists messages;
drop table if exists tickets;
drop table if exists categories;
drop table if exists supporters;
drop table if exists users;
drop table if exists companies;

-- Drop any remaining extensions (optional, uncomment if needed)
-- drop extension if exists "uuid-ossp"; 