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