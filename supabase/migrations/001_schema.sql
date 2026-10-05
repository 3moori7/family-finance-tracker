-- Family Savings and Expenses Tracker: core schema.
-- All amounts are integer halalas (1 SAR = 100).

create table settings (
  id int primary key default 1 check (id = 1),
  owner_email text not null,
  owner_password_hash text not null,
  salary_amount bigint not null default 0 check (salary_amount >= 0),
  split_percent numeric(5,2) not null default 75 check (split_percent between 0 and 100),
  sadaqah_percent numeric(5,2) not null default 2.5 check (sadaqah_percent between 0 and 100),
  language text not null default 'ar' check (language in ('ar', 'en')),
  reminder_email text,
  reminders_enabled boolean not null default true,
  pin_hash text,
  view_token_hash text,
  view_token_version int not null default 1,
  setup_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sadaqah_percent <= split_percent)
);

create table months (
  id bigserial primary key,
  year_month text not null unique check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'open' check (status in ('open', 'closed')),
  -- salary figures are snapshotted from settings until the deposit is confirmed
  salary_base bigint not null default 0 check (salary_base >= 0),
  split_percent numeric(5,2) not null default 75,
  sadaqah_percent numeric(5,2) not null default 2.5,
  salary_adjustment bigint not null default 0,
  adjustment_note text,
  salary_confirmed_at timestamptz,
  sadaqah_given boolean not null default false,
  reimbursed boolean not null default false,
  reimbursed_amount bigint,
  reimbursed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (salary_adjustment = 0 or length(coalesce(adjustment_note, '')) > 0),
  check (salary_base + salary_adjustment >= 0)
);

create table ledger_entries (
  id bigserial primary key,
  month_id bigint references months(id),
  type text not null check (type in ('opening', 'deposit', 'withdrawal', 'correction')),
  amount bigint not null,
  reason text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  check (
    (type = 'opening' and amount >= 0 and month_id is null) or
    (type = 'deposit' and amount >= 0 and month_id is not null) or
    (type = 'withdrawal' and amount > 0 and length(coalesce(reason, '')) > 0) or
    (type = 'correction' and amount <> 0 and length(coalesce(reason, '')) > 0)
  )
);
create unique index ledger_one_opening on ledger_entries ((1)) where type = 'opening';
create unique index ledger_one_deposit_per_month on ledger_entries (month_id) where type = 'deposit';
create index ledger_month_idx on ledger_entries (month_id);

create table family_expenses (
  id bigserial primary key,
  month_id bigint not null references months(id),
  amount bigint not null check (amount > 0),
  category text not null check (category in ('home', 'car', 'groceries', 'other')),
  expense_date date not null,
  note text,
  created_at timestamptz not null default now()
);
create index family_expenses_month_idx on family_expenses (month_id);

create table cash_counts (
  id bigserial primary key,
  month_id bigint not null references months(id),
  counted_amount bigint not null check (counted_amount >= 0),
  expected_amount bigint not null,
  difference bigint not null,
  accepted_difference boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  check (difference = counted_amount - expected_amount)
);
create index cash_counts_month_idx on cash_counts (month_id);

create table personal_expenses (
  id bigserial primary key,
  amount bigint not null check (amount > 0),
  category text not null check (category in ('home', 'car', 'groceries', 'other')),
  expense_date date not null,
  note text,
  created_at timestamptz not null default now()
);
create index personal_expenses_date_idx on personal_expenses (expense_date);

create table activity_log (
  id bigserial primary key,
  entity text not null,
  entity_id text,
  action text not null check (action in ('create', 'edit', 'delete')),
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on activity_log (created_at desc);

-- failed login / PIN attempts, used for rate limiting
create table auth_attempts (
  id bigserial primary key,
  scope text not null,
  created_at timestamptz not null default now()
);
create index auth_attempts_scope_idx on auth_attempts (scope, created_at desc);

-- Row-level security: enabled with NO policies, so the public Supabase API keys
-- (anon / authenticated) can never read or write anything. The app connects with the
-- database owner role, which bypasses RLS.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

alter table settings enable row level security;
alter table months enable row level security;
alter table ledger_entries enable row level security;
alter table family_expenses enable row level security;
alter table cash_counts enable row level security;
alter table personal_expenses enable row level security;
alter table activity_log enable row level security;
alter table auth_attempts enable row level security;
