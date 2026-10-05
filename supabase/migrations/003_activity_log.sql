-- Every create/edit/delete is recorded; the log itself is insert-only.

create or replace function log_activity() returns trigger language plpgsql as $$
declare
  secrets text[] := array['owner_password_hash', 'pin_hash', 'view_token_hash'];
  o jsonb;
  n jsonb;
  s text;
  eid text;
begin
  if tg_op in ('UPDATE', 'DELETE') then o := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then n := to_jsonb(new); end if;
  if tg_table_name = 'settings' then
    foreach s in array secrets loop
      if o is not null and o ? s then o := o || jsonb_build_object(s, case when o->>s is null then null else '[set]' end); end if;
      if n is not null and n ? s then n := n || jsonb_build_object(s, case when n->>s is null then null else '[set]' end); end if;
    end loop;
  end if;
  eid := coalesce((n->>'id'), (o->>'id'));
  insert into activity_log(entity, entity_id, action, old_value, new_value)
  values (
    tg_table_name, eid,
    case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'edit' else 'delete' end,
    o, n
  );
  return null;
end $$;

create trigger settings_log after insert or update or delete on settings for each row execute function log_activity();
create trigger months_log after insert or update or delete on months for each row execute function log_activity();
create trigger ledger_log after insert or update or delete on ledger_entries for each row execute function log_activity();
create trigger family_expenses_log after insert or update or delete on family_expenses for each row execute function log_activity();
create trigger cash_counts_log after insert or update or delete on cash_counts for each row execute function log_activity();
create trigger personal_expenses_log after insert or update or delete on personal_expenses for each row execute function log_activity();

create or replace function guard_activity_log() returns trigger language plpgsql as $$
begin
  raise exception 'activity_log_immutable';
end $$;
create trigger activity_log_no_change before update or delete on activity_log
  for each row execute function guard_activity_log();
create trigger activity_log_no_truncate before truncate on activity_log
  for each statement execute function guard_activity_log();
