-- Users table policies
create policy "Users can view their own profile"
    on users for select
    using (auth.uid() = id);

create policy "Enable insert for authenticated users during signup"
    on users for insert
    with check (auth.uid() = id);

create policy "Enable service role operations on users"
    on users for all
    using (auth.role() = 'service_role');

-- Supporters table policies
create policy "Allow public read access to supporters"
    on supporters for select
    using (true);

create policy "Enable insert for authenticated users during signup"
    on supporters for insert
    with check (auth.uid() = id);

create policy "Supporters can update their own record"
    on supporters for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

create policy "Enable service role operations on supporters"
    on supporters for all
    using (auth.role() = 'service_role');

-- Tickets table policies
create policy "Users can view their own tickets"
    on tickets for select
    using (created_by_user_id = auth.uid());

create policy "Supporters can view all tickets"
    on tickets for select
    using (auth.uid() in (select id from supporters));

create policy "Users can create tickets"
    on tickets for insert
    with check (created_by_user_id = auth.uid());

create policy "Supporters can update any ticket"
    on tickets for update
    using (auth.uid() in (select id from supporters));

-- Messages table policies
create policy "Users can view messages in their tickets"
    on messages for select
    using (ticket_id in (
        select id from tickets where created_by_user_id = auth.uid()
    ));

create policy "Supporters can view all messages"
    on messages for select
    using (auth.uid() in (select id from supporters));

create policy "Users can create messages in their tickets"
    on messages for insert
    with check (
        sender_type = 'user' and
        sender_id = auth.uid() and
        ticket_id in (
            select id from tickets where created_by_user_id = auth.uid()
        )
    );

create policy "Supporters can create messages"
    on messages for insert
    with check (
        sender_type = 'supporter' and
        sender_id = auth.uid() and
        auth.uid() in (select id from supporters)
    );

-- Notes table policies (supporters only)
create policy "Supporters can view all notes"
    on notes for select
    using (auth.uid() in (select id from supporters));

create policy "Supporters can create notes"
    on notes for insert
    with check (
        supporter_id = auth.uid() and
        auth.uid() in (select id from supporters)
    );

-- Files table policies
create policy "Users can view files in their tickets"
    on files for select
    using (
        ticket_id in (
            select id from tickets where created_by_user_id = auth.uid()
        ) or
        message_id in (
            select id from messages where ticket_id in (
                select id from tickets where created_by_user_id = auth.uid()
            )
        )
    );

create policy "Supporters can view all files"
    on files for select
    using (auth.uid() in (select id from supporters));

create policy "Users can upload files to their tickets"
    on files for insert
    with check (
        uploaded_by_type = 'user' and
        uploaded_by_id = auth.uid() and
        (
            ticket_id in (
                select id from tickets where created_by_user_id = auth.uid()
            ) or
            message_id in (
                select id from messages where ticket_id in (
                    select id from tickets where created_by_user_id = auth.uid()
                )
            )
        )
    );

create policy "Supporters can upload files"
    on files for insert
    with check (
        uploaded_by_type = 'supporter' and
        uploaded_by_id = auth.uid() and
        auth.uid() in (select id from supporters)
    );

-- Templates table policies (supporters only)
create policy "Supporters can view all templates"
    on templates for select
    using (auth.uid() in (select id from supporters));

create policy "Supporters can manage templates"
    on templates for all
    using (auth.uid() in (select id from supporters))
    with check (auth.uid() in (select id from supporters));

-- Template mappings policies (supporters only)
create policy "Supporters can view template mappings"
    on template_mappings for select
    using (auth.uid() in (select id from supporters));

create policy "Supporters can manage template mappings"
    on template_mappings for all
    using (auth.uid() in (select id from supporters))
    with check (auth.uid() in (select id from supporters));

-- Companies table policies
create policy "Supporters can view all companies"
    on companies for select
    using (auth.uid() in (select id from supporters));

create policy "Users can view their own company"
    on companies for select
    using (id in (
        select company_id from users where id = auth.uid()
    ));

create policy "Enable service role operations on companies"
    on companies for all
    using (auth.role() = 'service_role'); 