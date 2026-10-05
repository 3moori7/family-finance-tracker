-- Closing a month requires a fresh, matching (or explicitly accepted) cash count.
create or replace function guard_month() returns trigger language plpgsql as $$
declare
  last_count record;
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
    select * into last_count from cash_counts where month_id = old.id order by id desc limit 1;
    if new.salary_confirmed_at is null
       or not exists (select 1 from ledger_entries where month_id = old.id and type = 'deposit')
       or not new.sadaqah_given
       or (not new.reimbursed and exists (select 1 from family_expenses where month_id = old.id))
       or last_count is null
       or not (last_count.difference = 0 or last_count.accepted_difference)
       or last_count.expected_amount <> savings_balance() then
      raise exception 'close_incomplete';
    end if;
    new.closed_at = coalesce(new.closed_at, now());
  end if;
  return new;
end $$;
