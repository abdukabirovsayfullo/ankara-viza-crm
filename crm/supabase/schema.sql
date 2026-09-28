-- vizaCRM — Supabase sxemasi
-- Supabase Dashboard → SQL Editor → New query → shu faylni to‘liq qo‘yib "Run" bosing.
-- Qayta ishga tushirish xavfsiz (mavjud ma’lumotlar o‘chmaydi).

-- 1) Jadvallar: har bir yozuv `data` (jsonb) ustunida saqlanadi — ilovadagi tuzilma bilan bir xil.
create table if not exists public.clients (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.appointments (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.payments (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.app_settings (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Supabase jadval muharririda qulay ko‘rish uchun
create index if not exists clients_name_idx on public.clients ((data->>'name'));
create index if not exists appointments_client_idx on public.appointments ((data->>'clientId'));
create index if not exists payments_client_idx on public.payments ((data->>'clientId'));

-- 2) Xavfsizlik (RLS): faqat tizimga kirgan xodimlar o‘qiy va yoza oladi.
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.app_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clients','appointments','payments','app_settings'] loop
    execute format('drop policy if exists "staff_all" on public.%I', t);
    execute format('create policy "staff_all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- 3) Realtime: o‘zgarishlar boshqa qurilmalarga darhol yetib borishi uchun.
alter table public.clients replica identity full;
alter table public.appointments replica identity full;
alter table public.payments replica identity full;
alter table public.app_settings replica identity full;

do $$
declare t text;
begin
  foreach t in array array['clients','appointments','payments','app_settings'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
