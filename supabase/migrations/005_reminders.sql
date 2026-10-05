-- Which reminder was already emailed for which month, so each one is sent at most once per month.
create table reminder_log (
  id bigserial primary key,
  month_key text not null check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  kind text not null check (kind in ('salary', 'sadaqah', 'cashcount')),
  sent_at timestamptz not null default now(),
  unique (month_key, kind)
);
alter table reminder_log enable row level security;
