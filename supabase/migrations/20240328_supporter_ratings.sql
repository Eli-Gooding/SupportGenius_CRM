-- Create the supporter_ratings table
create table supporter_ratings (
    id uuid default uuid_generate_v4() primary key,
    ticket_id uuid references tickets(id) unique not null,
    supporter_id uuid references supporters(id) not null,
    rating integer not null check (rating >= 1 and rating <= 5),
    review text,
    created_at timestamp with time zone default now(),
    created_by_user_id uuid references users(id) not null
);

-- Create indexes for performance
create index supporter_ratings_ticket_id_idx on supporter_ratings(ticket_id);
create index supporter_ratings_supporter_id_idx on supporter_ratings(supporter_id);

-- Add RLS policies
alter table supporter_ratings enable row level security;

-- Users can only create ratings for tickets they own and only view their own ratings
create policy "Users can create ratings for their own tickets"
    on supporter_ratings
    for insert
    to authenticated
    with check (
        exists (
            select 1 from tickets
            where tickets.id = ticket_id
            and tickets.created_by_user_id = auth.uid()
            and tickets.ticket_status = 'closed'
        )
        and created_by_user_id = auth.uid()
    );

create policy "Users can view their own ratings"
    on supporter_ratings
    for select
    to authenticated
    using (
        exists (
            select 1 from tickets
            where tickets.id = ticket_id
            and tickets.created_by_user_id = auth.uid()
        )
    );

-- Supporters can view all ratings
create policy "Supporters can view all ratings"
    on supporter_ratings
    for select
    to authenticated
    using (
        exists (
            select 1 from supporters
            where supporters.id = auth.uid()
        )
    );

-- Create a function to calculate average rating for a supporter
create or replace function get_supporter_average_rating(supporter_uuid uuid)
returns table (
    average_rating numeric,
    total_ratings bigint
) as $$
begin
    return query
    select
        round(avg(rating)::numeric, 2) as average_rating,
        count(*) as total_ratings
    from supporter_ratings
    where supporter_id = supporter_uuid;
end;
$$ language plpgsql security definer; 