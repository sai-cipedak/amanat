-- Gerak SAI governance hardening
-- Admin > Cluster Lead > Metric Owner > Volunteer

create or replace function public.assign_metric_owner(
  p_metric_id text,
  p_owner_email text,
  p_display_name text,
  p_owner_role text
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text;
  v_assignment_id bigint;
  v_existing_user_id uuid;
  v_existing_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists(select 1 from public.kpi_metrics where id=p_metric_id) then
    raise exception 'Metric not found.';
  end if;

  if not (
    public.current_admin_role()='admin'
    or public.is_cluster_lead_for_metric(p_metric_id)
  ) then
    raise exception 'Only Admin or the Cluster Lead for this metric can assign Metric Owners.';
  end if;

  if p_owner_role not in ('primary_owner','supporting_owner') then
    raise exception 'Invalid owner role.';
  end if;

  v_email := lower(trim(coalesce(p_owner_email,'')));
  if v_email='' or position('@' in v_email)<=1 then
    raise exception 'A valid owner email is required.';
  end if;

  select vp.user_id, vp.display_name
    into v_existing_user_id, v_existing_display_name
  from public.volunteer_profiles vp
  where lower(vp.email)=v_email
  limit 1;

  if p_owner_role='primary_owner' then
    update public.metric_owners
    set assignment_status='ended', ended_at=now(), updated_at=now()
    where metric_id=p_metric_id
      and owner_role='primary_owner'
      and assignment_status in ('pending','active')
      and lower(owner_email)<>v_email;
  end if;

  select mo.id into v_assignment_id
  from public.metric_owners mo
  where mo.metric_id=p_metric_id
    and lower(mo.owner_email)=v_email
    and mo.assignment_status in ('pending','active')
  limit 1 for update;

  if v_assignment_id is not null then
    update public.metric_owners
    set owner_role=p_owner_role,
        display_name=coalesce(
          nullif(trim(coalesce(p_display_name,'')),''),
          v_existing_display_name,
          display_name
        ),
        user_id=coalesce(user_id,v_existing_user_id),
        assignment_status=case
          when coalesce(user_id,v_existing_user_id) is not null then 'active'
          else 'pending'
        end,
        activated_at=case
          when coalesce(user_id,v_existing_user_id) is not null
            then coalesce(activated_at,now())
          else activated_at
        end,
        updated_at=now()
    where id=v_assignment_id;
    return v_assignment_id;
  end if;

  insert into public.metric_owners(
    metric_id,owner_email,display_name,user_id,owner_role,assignment_status,
    assigned_by_user_id,assigned_by_email,assigned_at,activated_at
  ) values (
    p_metric_id,
    v_email,
    coalesce(nullif(trim(coalesce(p_display_name,'')),''),v_existing_display_name),
    v_existing_user_id,
    p_owner_role,
    case when v_existing_user_id is null then 'pending' else 'active' end,
    auth.uid(),
    lower(coalesce(auth.jwt()->>'email','')),
    now(),
    case when v_existing_user_id is null then null else now() end
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$function$;

create or replace function public.end_metric_owner_assignment(
  p_assignment_id bigint
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_metric_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select mo.metric_id
  into v_metric_id
  from public.metric_owners mo
  where mo.id=p_assignment_id
    and mo.assignment_status in ('pending','active')
  for update;

  if v_metric_id is null then
    raise exception 'Current ownership assignment not found.';
  end if;

  if not (
    public.current_admin_role()='admin'
    or public.is_cluster_lead_for_metric(v_metric_id)
  ) then
    raise exception 'Only Admin or the Cluster Lead for this metric can end Metric Owner assignments.';
  end if;

  update public.metric_owners
  set assignment_status='ended', ended_at=now(), updated_at=now()
  where id=p_assignment_id;
end;
$function$;

create or replace function public.get_admin_metric_ownership()
returns table(
  assignment_id bigint,
  metric_id text,
  metric_name text,
  kpi_id text,
  kpi_title text,
  cluster text,
  owner_email text,
  display_name text,
  owner_role text,
  assignment_status text,
  owner_user_id uuid,
  assigned_by_email text,
  assigned_at timestamptz,
  activated_at timestamptz,
  ended_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_role := public.current_admin_role();

  if v_role not in ('admin','reviewer') then
    raise exception 'Only Admin or Cluster Lead can view ownership governance.';
  end if;

  return query
  select
    mo.id,
    km.id,
    km.metric_name,
    k.id,
    k.title,
    m.cluster,
    mo.owner_email,
    mo.display_name,
    mo.owner_role,
    mo.assignment_status,
    mo.user_id,
    mo.assigned_by_email,
    mo.assigned_at,
    mo.activated_at,
    mo.ended_at
  from public.metric_owners mo
  join public.kpi_metrics km on km.id=mo.metric_id
  join public.kpis k on k.id=km.kpi_id
  join public.mandates m on m.id=k.mandate_id
  where
    v_role='admin'
    or public.is_cluster_lead_for_metric(km.id)
  order by
    m.sort_order,
    k.sort_order,
    km.sort_order,
    case mo.assignment_status when 'active' then 1 when 'pending' then 2 else 3 end,
    case mo.owner_role when 'primary_owner' then 1 else 2 end,
    mo.assigned_at desc;
end;
$function$;

-- Ownership visibility follows governance scope.
drop policy if exists "Admin editor can read metric ownership" on public.metric_owners;
drop policy if exists "Governance can read metric ownership" on public.metric_owners;
create policy "Governance can read metric ownership"
on public.metric_owners
for select
to authenticated
using (
  public.current_admin_role()='admin'
  or public.is_cluster_lead_for_metric(metric_id)
);

-- Remove implicit public/anon execution from SECURITY DEFINER RPCs.
-- Preserve authenticated application behavior and service-role access.
do $block$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef=true
  loop
    execute format('revoke execute on function %s from public', r.fn);
    execute format('revoke execute on function %s from anon', r.fn);
    execute format('grant execute on function %s to authenticated', r.fn);
    execute format('grant execute on function %s to service_role', r.fn);
  end loop;
end;
$block$;

-- Intentional public RPC used by the unauthenticated Volunteer Marketplace.
grant execute on function public.get_open_volunteer_opportunities() to anon;
