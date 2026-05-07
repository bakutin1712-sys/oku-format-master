
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  amount integer not null default 555,
  currency text not null default 'KGS',
  status text not null default 'pending',
  original_path text,
  processed_path text,
  payment_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "anyone can insert orders"
  on public.orders for insert
  with check (true);

create policy "anyone can read orders"
  on public.orders for select
  using (true);

alter publication supabase_realtime add table public.orders;
alter table public.orders replica identity full;

insert into storage.buckets (id, name, public) values ('documents','documents', true)
on conflict (id) do nothing;

create policy "public read documents"
  on storage.objects for select
  using (bucket_id = 'documents');

create policy "public upload documents"
  on storage.objects for insert
  with check (bucket_id = 'documents');
