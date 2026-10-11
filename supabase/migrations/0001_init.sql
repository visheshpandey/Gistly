-- Gistly initial schema.
-- Run in the Supabase SQL editor, or with the Supabase CLI: supabase db push

create extension if not exists pgcrypto;

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  review text not null,
  category text not null,
  occurrences integer not null default 1 check (occurrences > 0),
  source text not null default 'csv',
  -- Null unless a date is known. If dates are simulated, set the flag below.
  created_at_feedback timestamptz,
  date_is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (review, category)
);

create table if not exists feedback_analysis (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references feedback(id) on delete cascade,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative', 'mixed')),
  primary_theme text,
  severity text check (severity in ('low', 'medium', 'high', 'critical')),
  key_issue text,
  recommended_action text,
  analysis_source text not null default 'adaption',
  created_at timestamptz not null default now(),
  unique (feedback_id)
);

create table if not exists issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  theme text,
  severity text check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  evidence_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  content jsonb not null default '{}'::jsonb,
  share_token text unique,
  created_at timestamptz not null default now()
);

create index if not exists feedback_category_idx on feedback (category);
create index if not exists feedback_analysis_feedback_idx on feedback_analysis (feedback_id);
create index if not exists issues_status_idx on issues (status);

-- Row level security is on with no public policies: the browser anon key cannot
-- read or write. Server code will use a server-only key in a later phase.
alter table feedback enable row level security;
alter table feedback_analysis enable row level security;
alter table issues enable row level security;
alter table reports enable row level security;
