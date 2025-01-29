-- Add policy for admin supporters to update user licenses
create policy "Allow admin supporters to update user licenses"
    on users
    for update
    to authenticated
    using (
        exists (
            select 1 from supporters
            where id = auth.uid()
            and is_admin = true
        )
    )
    with check (
        exists (
            select 1 from supporters
            where id = auth.uid()
            and is_admin = true
        )
    );

-- Add policy for users to update their own information
create policy "Allow users to update their own profile"
    on users
    for update
    to authenticated
    using (auth.uid() = id);

-- Add policy for supporters to update their own information
create policy "Allow supporters to update their own profile"
    on supporters
    for update
    to authenticated
    using (auth.uid() = id); 