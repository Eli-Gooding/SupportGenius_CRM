-- Create function to get license user counts
create or replace function get_license_user_counts()
returns table (
  license_id uuid,
  count bigint
) security definer
language plpgsql
as $$
begin
  return query
  select u.license_id, count(*)::bigint
  from users u
  where u.license_id is not null
  group by u.license_id;
end;
$$;

-- Create function to get supporter caseloads
create or replace function get_supporter_caseloads()
returns table (
  assigned_to_supporter jsonb,
  count bigint
) security definer
language plpgsql
as $$
begin
  return query
  select 
    jsonb_build_object(
      'id', s.id,
      'full_name', s.full_name
    ) as assigned_to_supporter,
    count(*)::bigint
  from tickets t
  left join supporters s on t.assigned_to_supporter_id = s.id
  where t.ticket_status != 'closed'
  group by s.id, s.full_name;
end;
$$;

-- Create function to get queue caseloads
create or replace function get_queue_caseloads()
returns table (
  category jsonb,
  count bigint
) security definer
language plpgsql
as $$
begin
  return query
  select 
    jsonb_build_object(
      'id', c.id,
      'category_name', c.category_name
    ) as category,
    count(*)::bigint
  from tickets t
  left join categories c on t.category_id = c.id
  where t.ticket_status != 'closed'
  group by c.id, c.category_name;
end;
$$;

-- Add RLS policies for the functions
revoke execute on function get_license_user_counts() from public;
revoke execute on function get_supporter_caseloads() from public;
revoke execute on function get_queue_caseloads() from public;

grant execute on function get_license_user_counts() to authenticated;
grant execute on function get_supporter_caseloads() to authenticated;
grant execute on function get_queue_caseloads() to authenticated;

-- Add row security policies
create policy "Allow admin supporters to execute get_license_user_counts"
  on users
  for select
  to authenticated
  using (
    exists (
      select 1 from supporters
      where id = auth.uid()
      and is_admin = true
    )
  );

create policy "Allow admin supporters to execute get_supporter_caseloads"
  on tickets
  for select
  to authenticated
  using (
    exists (
      select 1 from supporters
      where id = auth.uid()
      and is_admin = true
    )
  );

create policy "Allow admin supporters to execute get_queue_caseloads"
  on tickets
  for select
  to authenticated
  using (
    exists (
      select 1 from supporters
      where id = auth.uid()
      and is_admin = true
    )
  ); 