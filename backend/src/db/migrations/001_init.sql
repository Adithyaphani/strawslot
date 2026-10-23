-- StrawSlot schema v1.
-- Every domain table carries district_id so one deployment can serve many districts.

create table districts (
  id            text primary key,
  name          text not null,
  state         text not null,
  centre_lat    double precision not null,
  centre_lon    double precision not null,
  bbox_w double precision not null, bbox_s double precision not null, bbox_e double precision not null, bbox_n double precision not null,
  anchor_date   date,
  simulated     boolean not null default false,
  next_field_no integer not null default 1001,
  -- Bumped by triggers whenever anything that affects the schedule changes.
  -- The plan cache is keyed on this number, so stale plans can never be served.
  data_version  bigint not null default 1,
  created_at    timestamptz not null default now()
);

create table blocks (
  district_id text not null references districts(id) on delete cascade,
  id text not null, name text not null, lat double precision not null, lon double precision not null,
  primary key (district_id, id)
);

create table villages (
  district_id text not null, id text not null, block_id text not null, name text not null,
  lat double precision not null, lon double precision not null,
  primary key (district_id, id),
  foreign key (district_id, block_id) references blocks(district_id, id) on delete cascade
);

create table chcs (
  district_id text not null, id text not null, block_id text not null, name text not null,
  phone text not null, operator text, lat double precision not null, lon double precision not null,
  primary key (district_id, id),
  foreign key (district_id, block_id) references blocks(district_id, id) on delete cascade
);

create table tractors (
  district_id text not null, id text not null, chc_id text not null, hp integer not null check (hp between 10 and 200),
  primary key (district_id, id),
  foreign key (district_id, chc_id) references chcs(district_id, id) on delete cascade
);

create table machines (
  district_id text not null, id text not null, chc_id text not null,
  type text not null check (type in ('super_seeder','happy_seeder','mulcher','baler')),
  label text not null, acres_per_day numeric(5,1) not null check (acres_per_day > 0),
  status text not null default 'active' check (status in ('active','maintenance')),
  primary key (district_id, id),
  foreign key (district_id, chc_id) references chcs(district_id, id) on delete cascade
);
create index machines_chc_idx on machines (district_id, chc_id);

create table vendors (
  district_id text not null, id text not null, name text not null, phone text not null,
  destination text not null, capacity_tpd numeric(7,1) not null,
  primary key (district_id, id)
);

create table fields (
  district_id text not null, id text not null,
  source text not null check (source in ('seed','farmer')),
  farmer_name text not null, phone text not null,
  language text not null check (language in ('en','hi','pa')),
  village_id text not null,
  lat double precision not null, lon double precision not null,
  acres numeric(6,2) not null check (acres > 0 and acres <= 500),
  harvest_date date not null,
  window_days integer not null check (window_days between 5 and 45),
  next_crop text default 'wheat',
  preference text not null check (preference in ('in_situ','ex_situ','any')),
  tractor_owns boolean not null default false, tractor_hp integer not null default 0,
  status text not null default 'pending' check (status in ('pending','cleared','burned')),
  created_on date not null default current_date,
  cleared_on date, cleared_by text,
  version integer not null default 1,                -- optimistic concurrency token
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (district_id, id),
  foreign key (district_id, village_id) references villages(district_id, id)
);
create index fields_phone_idx   on fields (district_id, phone);
create index fields_status_idx  on fields (district_id, status);
create index fields_harvest_idx on fields (district_id, harvest_date);

create table pins (
  district_id text not null, field_id text not null, machine_id text not null,
  from_date date not null, by text not null, at timestamptz not null default now(),
  primary key (district_id, field_id),
  foreign key (district_id, field_id) references fields(district_id, id) on delete cascade,
  foreign key (district_id, machine_id) references machines(district_id, id) on delete cascade
);

create table issues (
  district_id text not null, id text not null, field_id text not null, phone text not null,
  type text not null check (type in ('machine_late','machine_not_needed','harvest_changed','other')),
  note text not null default '', status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(), resolved_at timestamptz, resolution text,
  primary key (district_id, id),
  foreign key (district_id, field_id) references fields(district_id, id) on delete cascade
);
create index issues_open_idx on issues (district_id, status, created_at desc);

create table audit_log (
  id bigserial primary key,
  district_id text not null, at timestamptz not null default now(),
  actor text not null, action text not null, detail text not null default '', request_id text
);
create index audit_district_idx on audit_log (district_id, id desc);

create table users (
  id uuid primary key default gen_random_uuid(),
  username text not null, display_name text not null,
  password_hash text not null,
  role text not null check (role in ('viewer','officer','admin')),
  district_id text not null references districts(id),
  active boolean not null default true,
  failed_attempts integer not null default 0, locked_until timestamptz, last_login_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index users_username_idx on users (lower(username));

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null,                           -- all tokens from one login share a family
  token_hash text not null unique,                   -- only the SHA-256 is stored
  expires_at timestamptz not null, revoked_at timestamptz, replaced_by uuid,
  created_at timestamptz not null default now(), ip text, user_agent text
);
create index refresh_family_idx on refresh_tokens (family_id);
create index refresh_user_idx on refresh_tokens (user_id);

-- Transactional outbox: messages are written in the same commit as the change that caused them
-- and delivered later by the worker with retries.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  district_id text not null, field_id text,
  channel text not null default 'sms', kind text not null,
  to_phone text not null, lang text not null default 'en',
  body text,                                          -- rendered at send time when null
  status text not null default 'pending' check (status in ('pending','sending','sent','dead')),
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  last_error text, provider_ref text, dedupe_key text unique,
  created_at timestamptz not null default now(), sent_at timestamptz
);
create index notifications_due_idx on notifications (next_attempt_at) where status = 'pending';

create table idempotency_keys (
  scope text not null, key text not null, request_hash text not null,
  status_code integer, response jsonb, created_at timestamptz not null default now(),
  primary key (scope, key)
);

create table live_snapshots (
  district_id text not null references districts(id) on delete cascade, kind text not null check (kind in ('weather','air','fires')),
  payload jsonb not null, source text not null, live boolean not null default false, fetched_at timestamptz not null default now(),
  primary key (district_id, kind)
);

create table kpi_history (
  district_id text not null references districts(id) on delete cascade, day date not null,
  on_time_pct numeric(5,1) not null, baseline_pct numeric(5,1) not null,
  pending integer not null, at_risk integer not null, high_risk integer not null,
  utilisation_pct numeric(5,1) not null, protected_acres numeric(9,1) not null,
  primary key (district_id, day)
);

create table job_runs (
  id bigserial primary key, job text not null, started_at timestamptz not null default now(), finished_at timestamptz,
  status text not null default 'running', detail text
);
create index job_runs_idx on job_runs (job, id desc);

-- Version bump: any change to schedule inputs invalidates cached plans for that district.
create function bump_district_version() returns trigger language plpgsql as $$
declare d text := coalesce(new.district_id, old.district_id);
begin
  update districts set data_version = data_version + 1 where id = d;
  return null;
end $$;

create trigger fields_bump   after insert or update or delete on fields   for each row execute function bump_district_version();
create trigger machines_bump after insert or update or delete on machines for each row execute function bump_district_version();
create trigger tractors_bump after insert or update or delete on tractors for each row execute function bump_district_version();
create trigger chcs_bump     after insert or update or delete on chcs     for each row execute function bump_district_version();
create trigger vendors_bump  after insert or update or delete on vendors  for each row execute function bump_district_version();
create trigger pins_bump     after insert or update or delete on pins     for each row execute function bump_district_version();
