-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member'))
);

-- Uploads (one row per imported CSV)
create table uploads (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  period text not null,  -- YYYY-MM e.g. '2025-10'
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now(),
  row_count integer not null
);
create unique index uploads_period_unique on uploads(period);

-- Transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  amount numeric(10,2) not null,
  category text not null,
  upload_id uuid references uploads(id) on delete cascade
);
create index transactions_upload_idx on transactions(upload_id);
create index transactions_date_idx on transactions(date);
create index transactions_category_idx on transactions(category);

-- Flags (comments on transactions)
create table flags (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  user_id uuid references profiles(id),
  comment text not null,
  created_at timestamptz default now()
);
create index flags_transaction_idx on flags(transaction_id);

-- Row Level Security
alter table profiles enable row level security;
alter table uploads enable row level security;
alter table transactions enable row level security;
alter table flags enable row level security;

-- All authenticated users can read everything
create policy "authenticated read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "authenticated read uploads" on uploads for select using (auth.role() = 'authenticated');
create policy "authenticated read transactions" on transactions for select using (auth.role() = 'authenticated');
create policy "authenticated read flags" on flags for select using (auth.role() = 'authenticated');

-- Only authenticated users can insert their own flags
create policy "insert own flags" on flags for insert with check (auth.uid() = user_id);
