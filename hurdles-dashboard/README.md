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

## WhatsApp agent

A Twilio-powered WhatsApp bot (Vercel serverless function at `api/whatsapp.ts`) lets you
query your training log and add sessions in natural language when you can't use the website —
e.g. *"how many speed sessions in the last 3 months?"*, *"what weight did I bench on 6/6/26?"*,
*"add a gym session tomorrow, bench 80kg 5x5, high intensity"*.

It runs a Claude tool-use agent against Supabase. Per-exercise loads aren't a structured column,
so the agent reads them out of each session's free-text `title` / `actual_notes`.

### 1. Conversation-memory table

Run in the Supabase SQL Editor (in addition to the schema above):

```sql
create table whatsapp_threads (
  phone text primary key,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);
-- RLS on with no policies => only the service-role key (server) can touch it.
alter table whatsapp_threads enable row level security;
```

### 2. Server environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (server-side; do **not**
prefix with `VITE_`). See `.env.example`:

| Var | Notes |
| --- | --- |
| `SUPABASE_URL` | same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret**; bypasses RLS — never expose to the client |
| `ANTHROPIC_API_KEY` | Claude API key |
| `ANTHROPIC_MODEL` | optional, defaults to `claude-sonnet-4-6` |
| `TWILIO_AUTH_TOKEN` | from the Twilio console; verifies webhook signatures |
| `WHATSAPP_ALLOWED_FROM` | the only sender allowed, e.g. `whatsapp:+27821234567` |
| `OWNER_USER_ID` | Supabase auth user id the agent reads/writes (Dashboard → Authentication → Users) |

### 3. Twilio setup

1. In the Twilio console open **Messaging → Try it out → Send a WhatsApp message** (sandbox).
2. From your phone, send the sandbox `join <code>` message to the Twilio number.
3. Set the sandbox **"When a message comes in"** webhook to
   `https://<your-app>.vercel.app/api/whatsapp` (HTTP POST).
4. Deploy (`git push` to the connected branch, or `vercel deploy`), then message the bot.

### 4. Local testing (no Twilio needed)

With `SKIP_TWILIO_VALIDATION=true` set, POST a simulated payload (requires `vercel dev` or any
runner that serves `api/`):

```powershell
curl.exe -X POST http://localhost:3000/api/whatsapp `
  -d "From=whatsapp:+27821234567" `
  -d "Body=how many speed sessions in the last 3 months?"
```

You should get back TwiML containing the answer. `From` must match `WHATSAPP_ALLOWED_FROM`.

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
api/             Vercel serverless (server-only)
  whatsapp.ts    Twilio WhatsApp webhook
  _lib/          agent (Claude tool-use), tools (Supabase), threads, twilio helpers
```
