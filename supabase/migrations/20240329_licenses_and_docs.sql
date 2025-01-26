-- Create licenses table
create table licenses (
    id uuid default uuid_generate_v4() primary key,
    license_name text not null unique,
    license_cost decimal(10,2) not null,
    license_ranking integer not null,
    created_at timestamp with time zone default now()
);

-- Create product documentation table
create table product_documentation (
    id uuid default uuid_generate_v4() primary key,
    doc_title text not null,
    doc_description text,
    required_license_id uuid references licenses(id) not null,
    storage_path text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Create license update requests table
create table license_update_requests (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references users(id) not null,
    current_license_id uuid references licenses(id) not null,
    requested_license_id uuid references licenses(id) not null,
    request_status text not null check (request_status in ('pending', 'approved', 'rejected')),
    processed_by_id uuid references supporters(id),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Add admin column to supporters
alter table supporters
add column is_admin boolean not null default false;

-- Add license column to users
alter table users
add column license_id uuid references licenses(id);

-- Enable RLS
alter table licenses enable row level security;
alter table product_documentation enable row level security;
alter table license_update_requests enable row level security;

-- RLS Policies for licenses
create policy "Allow public read access to licenses"
    on licenses for select
    to public
    using (true);

create policy "Allow admin supporters to manage licenses"
    on licenses for all
    to authenticated
    using (
        exists (
            select 1 from supporters
            where id = auth.uid()
            and is_admin = true
        )
    );

-- RLS Policies for product documentation
create policy "Allow users to read documentation they have license for"
    on product_documentation for select
    to authenticated
    using (
        exists (
            select 1 from users
            where id = auth.uid()
            and exists (
                select 1 from licenses l
                where l.id = users.license_id
                and l.license_ranking >= (
                    select license_ranking from licenses
                    where id = product_documentation.required_license_id
                )
            )
        )
        or
        exists (
            select 1 from supporters
            where id = auth.uid()
        )
    );

create policy "Allow admin supporters to manage documentation"
    on product_documentation for all
    to authenticated
    using (
        exists (
            select 1 from supporters
            where id = auth.uid()
            and is_admin = true
        )
    );

-- RLS Policies for license update requests
create policy "Allow users to create and view their own license requests"
    on license_update_requests for select
    to authenticated
    using (
        user_id = auth.uid()
        or
        exists (
            select 1 from supporters
            where id = auth.uid()
            and is_admin = true
        )
    );

create policy "Allow users to create their own license requests"
    on license_update_requests for insert
    to authenticated
    with check (user_id = auth.uid());

create policy "Allow admin supporters to process license requests"
    on license_update_requests for update
    to authenticated
    using (
        exists (
            select 1 from supporters
            where id = auth.uid()
            and is_admin = true
        )
    );

-- Create indexes
create index idx_product_documentation_license on product_documentation(required_license_id);
create index idx_users_license on users(license_id);
create index idx_license_requests_user on license_update_requests(user_id);
create index idx_license_requests_status on license_update_requests(request_status);

-- Insert seed data
insert into licenses (license_name, license_cost, license_ranking) values
    ('Standard', 0.00, 0),
    ('Professional', 99.99, 10),
    ('Enterprise', 499.99, 20);

-- Set default license for existing users
update users
set license_id = (select id from licenses where license_name = 'Standard')
where license_id is null; 