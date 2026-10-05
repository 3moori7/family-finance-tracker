-- Business rules enforced in the database so they hold no matter which code writes.
-- Error messages are stable codes that the app maps to friendly text.

create or replace function month_is_closed(mid bigint) returns boolean
language sql stable as $$
  select coalesce((select status = 'closed' from months where id = mid), false)
$$;

create or replace function savings_balance() returns bigint
language sql stable as $$
  select coalesce(sum(case when type = 'withdrawal' then -amount else amount end), 0)::bigint
  from ledger_entries
$$;

-- months: closed months are frozen, never deleted, close requires a complete checklist
create or replace function guard_month() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'month_delete_forbidden';
  end if;
  if old.status = 'closed' then
    raise exception 'month_closed';
  end if;
  if exists (select 1 from ledger_entries where month_id = old.id and type = 'deposit')
     and (new.salary_base, new.split_percent, new.sadaqah_percent, new.salary_adjustment)
         is distinct from (old.salary_base, old.split_percent, old.sadaqah_percent, old.salary_adjustment) then
    raise exception 'deposit_exists';
  end if;
  if new.status = 'closed' then
    if new.salary_confirmed_at is null
       or not exists (select 1 from ledger_entries where month_id = old.id and type = 'deposit')
       or not new.sadaqah_given
       or (not new.reimbursed and exists (select 1 from family_expenses where month_id = old.id))
       or not exists (select 1 from cash_counts where month_id = old.id) then
      raise exception 'close_incomplete';
    end if;
    new.closed_at = coalesce(new.closed_at, now());
  end if;
  return new;
end $$;
create trigger months_guard before update or delete on months
  for each row execute function guard_month();

-- ledger: append-only; corrections allowed in closed months, everything else not
create or replace function guard_ledger() returns trigger language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'ledger_append_only';
  end if;
  if new.month_id is not null and new.type <> 'correction' and month_is_closed(new.month_id) then
    raise exception 'month_closed';
  end if;
  if new.type = 'withdrawal' and new.amount > savings_balance() then
    raise exception 'insufficient_balance';
  end if;
  if new.type = 'correction' and new.amount < 0 and -new.amount > savings_balance() then
    raise exception 'insufficient_balance';
  end if;
  return new;
end $$;
create trigger ledger_guard before insert or update or delete on ledger_entries
  for each row execute function guard_ledger();

-- family expenses: only in open, un-reimbursed months, and the date must belong to the month
create or replace function guard_family_expense() returns trigger language plpgsql as $$
declare ym text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if month_is_closed(old.month_id) then raise exception 'month_closed'; end if;
    if (select reimbursed from months where id = old.month_id) then raise exception 'month_reimbursed'; end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if month_is_closed(new.month_id) then raise exception 'month_closed'; end if;
    if (select reimbursed from months where id = new.month_id) then raise exception 'month_reimbursed'; end if;
    select year_month into ym from months where id = new.month_id;
    if to_char(new.expense_date, 'YYYY-MM') <> ym then raise exception 'date_month_mismatch'; end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger family_expenses_guard before insert or update or delete on family_expenses
  for each row execute function guard_family_expense();

-- cash counts: not in closed months
create or replace function guard_cash_count() returns trigger language plpgsql as $$
begin
  if month_is_closed(coalesce(new.month_id, old.month_id)) then raise exception 'month_closed'; end if;
  return coalesce(new, old);
end $$;
create trigger cash_counts_guard before insert or update or delete on cash_counts
  for each row execute function guard_cash_count();

-- reimbursement can be set (and undone) only while the month is open (covered by guard_month)
