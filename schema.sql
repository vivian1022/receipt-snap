-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor)
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  spent_at date not null,
  merchant text not null,
  amount numeric(12, 2) not null,
  category text not null,
  created_at timestamptz not null default now()
);

create index if not exists expenses_spent_at_idx on expenses (spent_at);

-- Optional: block everything from the public anon key.
-- The server uses the service-role key, which bypasses RLS.
alter table expenses enable row level security;
