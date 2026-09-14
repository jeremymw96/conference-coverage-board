-- ============================================================================
-- Conference Coverage Board — database schema
-- Run this in the Supabase SQL Editor (one time) to create the tables.
-- All tables have Row Level Security ON with no public policies, so nothing is
-- readable/writable directly from the browser. The app reaches the data only
-- through server-side API routes using the service-role key.
-- ============================================================================

-- Residents ------------------------------------------------------------------
create table if not exists residents (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  sched_key     text not null unique,          -- "Last, Initial" as it appears in the schedule grid
  pgy           int  not null default 1,
  clinic_cohort text,                           -- CCMA / CCWA / CCTHA / CCTUA
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Academic-year blocks -------------------------------------------------------
create table if not exists blocks (
  block_no   int primary key,                   -- 1..13
  start_date date not null,
  end_date   date not null
);

-- Per-resident, per-block rotation assignment (raw grid cell) -----------------
create table if not exists assignments (
  resident_id uuid not null references residents(id) on delete cascade,
  block_no    int  not null references blocks(block_no) on delete cascade,
  cell        text not null default '',         -- e.g. "NF (10/19 - 11/1) || ID CONSULT (11/2 - 11/15)"
  primary key (resident_id, block_no)
);

-- Conference-leave requests --------------------------------------------------
create table if not exists requests (
  id                  uuid primary key default gen_random_uuid(),
  resident_id         uuid references residents(id) on delete set null,
  resident_name       text not null,            -- denormalized so history survives roster changes
  conference          text not null,
  start_date          date not null,
  end_date            date not null,
  rotation            text,
  is_core             boolean default false,
  presentation_dates  date[] not null default '{}',
  status              text not null default 'pending' check (status in ('pending','approved','denied','needs_revision')),
  chief_comments      jsonb not null default '[]',   -- chief-to-chief thread: [{author,text,at}]
  coverage_needed     boolean,
  cover_resident_id   uuid references residents(id) on delete set null,
  cover_resident_name text,
  cover_from          text,
  decided_by          text,
  decided_at          timestamptz,
  note                text default '',
  submitted_at        timestamptz not null default now()
);

create index if not exists requests_status_idx on requests(status);
create index if not exists requests_start_idx  on requests(start_date);

-- Lock everything down; only the server (service role) may read/write ---------
alter table residents   enable row level security;
alter table blocks      enable row level security;
alter table assignments enable row level security;
alter table requests    enable row level security;
-- (No policies created on purpose — anon & authenticated users get no access.)
