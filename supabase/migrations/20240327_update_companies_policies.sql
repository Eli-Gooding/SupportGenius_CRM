-- First, drop existing policies
drop policy if exists "Supporters can view all companies" on companies;
drop policy if exists "Users can view their own company" on companies;
drop policy if exists "Enable service role operations on companies" on companies;

-- Ensure RLS is enabled
alter table companies enable row level security;

-- Create updated policies
create policy "Supporters can view and manage companies"
    on companies for all
    using (auth.uid() in (select id from supporters));

create policy "Users can view their own company"
    on companies for select
    using (id in (
        select company_id from users where id = auth.uid()
    ));

create policy "Allow read-only access to companies list"
    on companies for select
    using (true);

create policy "Enable service role operations on companies"
    on companies for all
    using (auth.role() = 'service_role');

-- Add comments explaining the policies
comment on policy "Supporters can view and manage companies" on companies is 
    'Allows supporters to view and manage all companies';
comment on policy "Users can view their own company" on companies is 
    'Allows authenticated users to view their assigned company';
comment on policy "Allow read-only access to companies list" on companies is 
    'Allows anyone to read the companies list for signup';
comment on policy "Enable service role operations on companies" on companies is 
    'Allows service role to perform all operations on companies'; 