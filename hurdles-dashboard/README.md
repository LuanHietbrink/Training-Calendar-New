# 400m Hurdles Dashboard

Personal training dashboard for a 400m hurdles athlete. Three tabs:

1. **Training program** — interactive calendar; add / edit / mark-complete sessions with intensity, type, planned vs actual notes, optional weekly recurrence.
2. **Speed progression** — log 10/20/30m fly splits (best and average), filter by distance, view chart in split time, m/s, kph, or mph.
3. **Weight** — current weight hero with 7-day / 30-day deltas, daily upsert, line chart with range selector.

## Stack

React 18 + Vite + TypeScript · Tailwind CSS · Recharts · FullCalendar · Supabase (Postgres + Auth).

## Setup

### 1. Install dependencies

```bash
cd hurdles-dashboard
npm install
```

### 2. Create a Supabase project

- Go to https://supabase.com and create a project.
- In **Project Settings → API**, copy the **Project URL** and **anon public** key.
- Copy `.env.example` to `.env` and paste them in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. Run the schema

Open **SQL Editor** in Supabase and run:

```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  start_time time,
  session_type text not null,
  intensity text not null check (intensity in ('High','Medium','Low')),
  title text not null,
  planned_notes text,
  actual_notes text,
  completed boolean not null default false,
  recurrence text,
  recurrence_until date,
  created_at timestamptz default now()
);

create table splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  distance int not null check (distance in (10,20,30)),
  best_time numeric(5,2) not null,
  avg_time  numeric(5,2) not null,
  notes text
);

create table weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null,
  unique (user_id, date)
);

alter table sessions enable row level security;
alter table splits   enable row level security;
alter table weights  enable row level security;

create policy "own rows" on sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on splits   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on weights  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 4. (Optional) Disable email confirmation for solo use

In **Authentication → Providers → Email**, toggle "Confirm email" off if you just want to sign up and log in immediately.

### 5. Run

```bash
npm run dev
```

Open the URL Vite prints, sign up with email + password, and you're in.

## Scripts

- `npm run dev` — start dev server
- `npm run build` — type-check + production build
- `npm run preview` — preview the built bundle

## Layout

```
src/
  lib/           supabase client, shared types
  auth/          AuthProvider, LoginPage
  components/    Layout, TabBar
  features/
    training/    FullCalendar, SessionDialog, useSessions (recurrence expansion)
    speed/       SpeedTab, useSplits
    weight/      WeightTab, useWeights
```
