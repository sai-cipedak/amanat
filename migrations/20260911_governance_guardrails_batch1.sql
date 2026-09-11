-- Gerak SAI governance guardrails — Batch 1
-- 2026-09-11
--
-- Implements the governance decisions captured for Gerak SAI:
-- 1) Admin and Cluster Lead are mutually exclusive roles.
-- 2) Metric Owner changes/endings require a stated reason.
-- 3) Primary and Supporting Metric Owners may manage contributor lifecycle.
--    Contributor lifecycle is limited to active / ended.
-- 4) Skill requirements/taxonomy requests are editable by Admin or Primary
--    Metric Owner only; Supporting Metric Owner remains able to manage
--    contribution execution/opportunities.

-- ---------------------------------------------------------------------
-- A. Admin <-> Cluster Lead segregation of duties
-- ---------------------------------------------------------------------

-- Preserve cluster-review continuity when cleaning up any pre-existing
-- conflict: the Cluster Lead assignment remains current and the conflicting
-- Admin access is deactivated. Future conflicts are rejected by triggers.
update public.admin_users au
set
  is_active = false,
  updated_at = now(),
  updated_by = 'governance_guardrails_batch1'
where au.role = 'admin'
  and au.is_active = true
  and exists (
    select 1
    from public.cluster_leads cl
    where lower(cl.lead_email) = lower(au.email)
      and cl.assignment_status in ('pending','active')
  );

create or replace function public.prevent_admin_cluster_lead_conflict_on_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'admin' and new.is_active = true then
    if exists (
      select 1
      from public.cluster_leads cl
      where lower(cl.lead_email) = lower(new.email)
        and cl.assignment_status in ('pending','active')
    ) then
      raise exception 'This user is a current Cluster Lead. End the Cluster Lead assignment before granting active Admin access.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_admin_cluster_lead_conflict_on_admin
  on public.admin_users;
create trigger trg_prevent_admin_cluster_lead_conflict_on_admin
before insert or update of email, role, is_active
on public.admin_users
for each row
execute function public.prevent_admin_cluster_lead_conflict_on_admin();

create or replace function public.prevent_admin_cluster_lead_conflict_on_cluster_lead()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assignment_status in ('pending','active') then
    if exists (
      select 1
      from public.admin_users au
      where lower(au.email) = lower(new.lead_email)
        and au.role = 'admin'
        and au.is_active = true
    ) then
      raise exception 'Active Admin cannot be assigned as Cluster Lead.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_admin_cluster_lead_conflict_on_cluster_lead
  on public.cluster_leads;
create trigger trg_prevent_admin_cluster_lead_conflict_on_cluster_lead
before insert or update of lead_email, assignment_status
on public.cluster_leads
for each row
execute function public.prevent_admin_cluster_lead_conflict_on_cluster_lead();

create or replace function public.assign_cluster_lead(
  p_cluster text,
  p_email text,
  p_display_name text default null::text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cluster text;
  v_email text;
  v_user_id uuid;
  v_id bigint;
begin
  if public.current_admin_role() <> 'admin' then
    raise exception 'Only Admin can assign Cluster Leads.';
  end if;

  v_cluster := trim(coalesce(p_cluster,''));
  v_email := lower(trim(coalesce(p_email,'')));

  if v_cluster = '' then
    raise exception 'Cluster is required.';
  end if;
  if v_email = '' then
    raise exception 'Cluster Lead email is required.';
  end if;

  if not exists (
    select 1 from public.mandates m where m.cluster = v_cluster
  ) then
    raise exception 'Cluster does not exist in the KPI model.';
  end if;

  -- Guard BEFORE ending the existing assignment.
  if exists (
    select 1
    from public.admin_users au
    where lower(au.email) = v_email
      and au.role = 'admin'
      and au.is_active = true
  ) then
    raise exception 'Active Admin cannot be assigned as Cluster Lead. Deactivate Admin access first.';
  end if;

  update public.cluster_leads
  set assignment_status = 'ended', ended_at = now(), updated_at = now()
  where cluster = v_cluster
    and assignment_status in ('pending','active');

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = v_email
  order by u.created_at desc
  limit 1;

  insert into public.cluster_leads(
    cluster, lead_email, display_name, user_id, assignment_status,
    assigned_by_user_id, assigned_by_email, assigned_at, activated_at
  )
  values(
    v_cluster,
    v_email,
    nullif(trim(coalesce(p_display_name,'')),''),
    v_user_id,
    case when v_user_id is null then 'pending' else 'active' end,
    auth.uid(),
    lower(coalesce(auth.jwt()->>'email','')),
    now(),
    case when v_user_id is null then null else now() end
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- B. Metric Owner change reasons
-- ---------------------------------------------------------------------

alter table public.metric_owners
  add column if not exists assignment_reason text,
  add column if not exists end_reason text,
  add column if not exists ended_by_user_id uuid,
  add column if not exists ended_by_email text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'metric_owners_ended_by_user_id_fkey'
      and conrelid = 'public.metric_owners'::regclass
  ) then
    alter table public.metric_owners
      add constraint metric_owners_ended_by_user_id_fkey
      foreign key (ended_by_user_id) references auth.users(id) on delete set null;
  end if;
end;
$$;

create or replace function public.assign_metric_owner_v2(
  p_metric_id text,
  p_owner_email text,
  p_display_name text,
  p_owner_role text,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_reason text;
  v_assignment_id bigint;
  v_existing_user_id uuid;
  v_existing_display_name text;
  v_existing_role text;
  v_current_primary_id bigint;
  v_current_primary_email text;
  v_actor_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not exists(select 1 from public.kpi_metrics where id = p_metric_id) then
    raise exception 'Metric not found.';
  end if;
  if not (
    public.current_admin_role() = 'admin'
    or public.is_cluster_lead_for_metric(p_metric_id)
  ) then
    raise exception 'Only Admin or the Cluster Lead for this metric can assign Metric Owners.';
  end if;
  if p_owner_role not in ('primary_owner','supporting_owner') then
    raise exception 'Invalid owner role.';
  end if;

  v_email := lower(trim(coalesce(p_owner_email,'')));
  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  v_actor_email := lower(coalesce(auth.jwt()->>'email',''));

  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'A valid owner email is required.';
  end if;

  select vp.user_id, vp.display_name
  into v_existing_user_id, v_existing_display_name
  from public.volunteer_profiles vp
  where lower(vp.email) = v_email
  limit 1;

  select mo.id, mo.owner_email
  into v_current_primary_id, v_current_primary_email
  from public.metric_owners mo
  where mo.metric_id = p_metric_id
    and mo.owner_role = 'primary_owner'
    and mo.assignment_status in ('pending','active')
  order by mo.assigned_at desc, mo.id desc
  limit 1
  for update;

  select mo.id, mo.owner_role
  into v_assignment_id, v_existing_role
  from public.metric_owners mo
  where mo.metric_id = p_metric_id
    and lower(mo.owner_email) = v_email
    and mo.assignment_status in ('pending','active')
  order by mo.assigned_at desc, mo.id desc
  limit 1
  for update;

  -- Any role change for an existing owner needs a reason.
  if v_assignment_id is not null
     and v_existing_role is distinct from p_owner_role
     and v_reason is null then
    raise exception 'Reason is required when changing a Metric Owner role.';
  end if;

  -- Replacing a different current Primary Owner needs a reason.
  if p_owner_role = 'primary_owner'
     and v_current_primary_id is not null
     and (v_assignment_id is null or v_current_primary_id <> v_assignment_id)
     and lower(coalesce(v_current_primary_email,'')) <> v_email
     and v_reason is null then
    raise exception 'Reason is required when changing the Primary Metric Owner.';
  end if;

  if p_owner_role = 'primary_owner'
     and v_current_primary_id is not null
     and (v_assignment_id is null or v_current_primary_id <> v_assignment_id)
     and lower(coalesce(v_current_primary_email,'')) <> v_email then
    update public.metric_owners
    set
      assignment_status = 'ended',
      ended_at = now(),
      end_reason = v_reason,
      ended_by_user_id = auth.uid(),
      ended_by_email = v_actor_email,
      updated_at = now()
    where id = v_current_primary_id;
  end if;

  if v_assignment_id is not null then
    update public.metric_owners
    set
      owner_role = p_owner_role,
      display_name = coalesce(
        nullif(trim(coalesce(p_display_name,'')),''),
        v_existing_display_name,
        display_name
      ),
      user_id = coalesce(user_id, v_existing_user_id),
      assignment_status = case
        when coalesce(user_id, v_existing_user_id) is not null then 'active'
        else 'pending'
      end,
      activated_at = case
        when coalesce(user_id, v_existing_user_id) is not null
          then coalesce(activated_at, now())
        else activated_at
      end,
      assignment_reason = case
        when v_existing_role is distinct from p_owner_role then v_reason
        else assignment_reason
      end,
      updated_at = now()
    where id = v_assignment_id;
    return v_assignment_id;
  end if;

  insert into public.metric_owners(
    metric_id, owner_email, display_name, user_id, owner_role, assignment_status,
    assigned_by_user_id, assigned_by_email, assigned_at, activated_at,
    assignment_reason
  ) values (
    p_metric_id,
    v_email,
    coalesce(nullif(trim(coalesce(p_display_name,'')),''), v_existing_display_name),
    v_existing_user_id,
    p_owner_role,
    case when v_existing_user_id is null then 'pending' else 'active' end,
    auth.uid(),
    v_actor_email,
    now(),
    case when v_existing_user_id is null then null else now() end,
    v_reason
  )
  returning id into v_assignment_id;

  return v_assignment_id;
end;
$$;

-- Compatibility wrapper: old UI remains safe. Initial assignments can still
-- work without a reason, while actual changes are rejected by v2 until the
-- refreshed UI supplies one.
create or replace function public.assign_metric_owner(
  p_metric_id text,
  p_owner_email text,
  p_display_name text,
  p_owner_role text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.assign_metric_owner_v2(
    p_metric_id,
    p_owner_email,
    p_display_name,
    p_owner_role,
    null
  );
end;
$$;

create or replace function public.end_metric_owner_assignment_v2(
  p_assignment_id bigint,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metric_id text;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  if v_reason is null then
    raise exception 'Reason is required to end a Metric Owner assignment.';
  end if;

  select mo.metric_id
  into v_metric_id
  from public.metric_owners mo
  where mo.id = p_assignment_id
    and mo.assignment_status in ('pending','active')
  for update;

  if v_metric_id is null then
    raise exception 'Current ownership assignment not found.';
  end if;
  if not (
    public.current_admin_role() = 'admin'
    or public.is_cluster_lead_for_metric(v_metric_id)
  ) then
    raise exception 'Only Admin or the Cluster Lead for this metric can end Metric Owner assignments.';
  end if;

  update public.metric_owners
  set
    assignment_status = 'ended',
    ended_at = now(),
    end_reason = v_reason,
    ended_by_user_id = auth.uid(),
    ended_by_email = lower(coalesce(auth.jwt()->>'email','')),
    updated_at = now()
  where id = p_assignment_id;
end;
$$;

create or replace function public.end_metric_owner_assignment(p_assignment_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.end_metric_owner_assignment_v2(p_assignment_id, null);
end;
$$;

-- ---------------------------------------------------------------------
-- C. Primary-only skill requirement authority
-- ---------------------------------------------------------------------

create or replace function public.can_manage_metric_skills(p_metric_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_admin_role() = 'admin'
      or public.is_primary_metric_owner(p_metric_id);
$$;

create or replace function public.save_owner_metric_skills(
  p_metric_id text,
  p_required_skill_ids bigint[],
  p_preferred_skill_ids bigint[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required bigint[] := coalesce(p_required_skill_ids,array[]::bigint[]);
  v_preferred bigint[] := coalesce(p_preferred_skill_ids,array[]::bigint[]);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public.can_manage_metric_skills(p_metric_id) then
    raise exception 'Only Admin or the Primary Metric Owner can change skill requirements.';
  end if;
  if not exists(select 1 from public.kpi_metrics where id = p_metric_id) then
    raise exception 'Metric not found.';
  end if;
  if exists(
    select 1 from unnest(v_required) r
    join unnest(v_preferred) p on r = p
  ) then
    raise exception 'A skill cannot be both Required and Preferred.';
  end if;
  if exists(
    select 1
    from unnest(v_required || v_preferred) requested(skill_id)
    left join public.skill_catalog sc
      on sc.id = requested.skill_id and sc.is_active = true
    where sc.id is null
  ) then
    raise exception 'One or more selected skills are invalid or inactive.';
  end if;

  delete from public.metric_skill_requirements where metric_id = p_metric_id;

  insert into public.metric_skill_requirements(metric_id,skill_id,requirement_level)
  select p_metric_id,skill_id,'required'
  from unnest(v_required) skill_id
  on conflict(metric_id,skill_id)
  do update set requirement_level = excluded.requirement_level, updated_at = now();

  insert into public.metric_skill_requirements(metric_id,skill_id,requirement_level)
  select p_metric_id,skill_id,'preferred'
  from unnest(v_preferred) skill_id
  on conflict(metric_id,skill_id)
  do update set requirement_level = excluded.requirement_level, updated_at = now();
end;
$$;

create or replace function public.submit_metric_skill_request(
  p_metric_id text,
  p_request_type text,
  p_skill_family text,
  p_skill_name text,
  p_description text,
  p_requirement_level text,
  p_rationale text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id bigint;
  v_family text;
  v_name text;
  v_existing_family text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public.can_manage_metric_skills(p_metric_id) then
    raise exception 'Only Admin or the Primary Metric Owner can request skill taxonomy changes for this metric.';
  end if;
  if p_request_type not in ('new_skill','new_family_skill') then
    raise exception 'Invalid request type.';
  end if;
  if p_requirement_level not in ('required','preferred') then
    raise exception 'Invalid requirement level.';
  end if;

  v_family := trim(coalesce(p_skill_family,''));
  v_name := trim(coalesce(p_skill_name,''));
  if v_family = '' then raise exception 'Skill family / talent pool is required.'; end if;
  if v_name = '' then raise exception 'Skill name is required.'; end if;

  if p_request_type = 'new_skill' then
    select sc.skill_family into v_existing_family
    from public.skill_catalog sc
    where sc.is_active = true
      and lower(sc.skill_family) = lower(v_family)
    order by sc.sort_order, sc.id
    limit 1;
    if v_existing_family is null then
      raise exception 'Selected talent pool does not exist. Use Propose New Talent Pool.';
    end if;
    v_family := v_existing_family;
  else
    if exists(
      select 1 from public.skill_catalog sc
      where sc.is_active = true and lower(sc.skill_family) = lower(v_family)
    ) then
      raise exception 'Talent pool already exists. Request a new skill under the existing pool instead.';
    end if;
  end if;

  if exists(
    select 1 from public.skill_catalog sc
    where sc.is_active = true
      and lower(sc.skill_family) = lower(v_family)
      and lower(sc.skill_name) = lower(v_name)
  ) then
    raise exception 'This skill already exists in the catalog. Use Manage Skills instead.';
  end if;

  if exists(
    select 1 from public.skill_taxonomy_requests str
    where str.metric_id = p_metric_id
      and str.status = 'pending'
      and lower(str.proposed_skill_family) = lower(v_family)
      and lower(str.proposed_skill_name) = lower(v_name)
  ) then
    raise exception 'A pending request for this skill already exists.';
  end if;

  insert into public.skill_taxonomy_requests(
    metric_id, request_type, proposed_skill_family, proposed_skill_name,
    proposed_description, requirement_level, rationale,
    requested_by_user_id, requested_by_email
  ) values (
    p_metric_id, p_request_type, v_family, v_name,
    nullif(trim(coalesce(p_description,'')),''),
    p_requirement_level,
    nullif(trim(coalesce(p_rationale,'')),''),
    auth.uid(),
    lower(coalesce(auth.jwt()->>'email',''))
  ) returning id into v_request_id;

  return v_request_id;
end;
$$;

-- Direct table writes stay Admin-only; Primary Owner writes go through the
-- guarded SECURITY DEFINER RPC above.
drop policy if exists "Editor admin can manage metric skill requirements"
  on public.metric_skill_requirements;
drop policy if exists "Admin can manage metric skill requirements"
  on public.metric_skill_requirements;
create policy "Admin can manage metric skill requirements"
on public.metric_skill_requirements
for all
to authenticated
using (public.current_admin_role() = 'admin')
with check (public.current_admin_role() = 'admin');

-- ---------------------------------------------------------------------
-- D. Contributor lifecycle: active / ended; managed by Metric Owners
-- ---------------------------------------------------------------------

alter table public.metric_contributors
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by_user_id uuid,
  add column if not exists ended_by_email text,
  add column if not exists end_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'metric_contributors_ended_by_user_id_fkey'
      and conrelid = 'public.metric_contributors'::regclass
  ) then
    alter table public.metric_contributors
      add constraint metric_contributors_ended_by_user_id_fkey
      foreign key (ended_by_user_id) references auth.users(id) on delete set null;
  end if;
end;
$$;

alter table public.metric_contributors
  drop constraint if exists metric_contributors_assignment_status_check;
alter table public.metric_contributors
  add constraint metric_contributors_assignment_status_check
  check (assignment_status in ('active','ended'));

create or replace function public.get_metric_contributors(p_metric_id text)
returns table(
  contributor_id bigint,
  metric_id text,
  volunteer_user_id uuid,
  volunteer_email text,
  volunteer_name text,
  contribution_mode text,
  committed_hours_month numeric,
  assignment_status text,
  assignment_note text,
  assigned_by text,
  assigned_at timestamptz,
  ended_at timestamptz,
  ended_by_email text,
  end_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public.can_manage_metric(p_metric_id) then
    raise exception 'Only Admin or a current Metric Owner can view contributor assignments for this metric.';
  end if;

  return query
  select
    mc.id,
    mc.metric_id,
    mc.user_id,
    vp.email,
    vp.display_name,
    mc.contribution_mode,
    mc.committed_hours_month,
    mc.assignment_status,
    mc.assignment_note,
    mc.assigned_by,
    mc.assigned_at,
    mc.ended_at,
    mc.ended_by_email,
    mc.end_reason
  from public.metric_contributors mc
  join public.volunteer_profiles vp on vp.user_id = mc.user_id
  where mc.metric_id = p_metric_id
  order by
    case mc.assignment_status when 'active' then 1 else 2 end,
    mc.assigned_at desc,
    mc.id desc;
end;
$$;

create or replace function public.end_metric_contributor_assignment(
  p_contributor_id bigint,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metric_id text;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  if v_reason is null then
    raise exception 'Reason is required to end a contributor assignment.';
  end if;

  select mc.metric_id
  into v_metric_id
  from public.metric_contributors mc
  where mc.id = p_contributor_id
    and mc.assignment_status = 'active'
  for update;

  if v_metric_id is null then
    raise exception 'Active contributor assignment not found.';
  end if;
  if not public.can_manage_metric(v_metric_id) then
    raise exception 'Only Admin or a current Primary/Supporting Metric Owner can end this contributor assignment.';
  end if;

  update public.metric_contributors
  set
    assignment_status = 'ended',
    ended_at = now(),
    ended_by_user_id = auth.uid(),
    ended_by_email = lower(coalesce(auth.jwt()->>'email','')),
    end_reason = v_reason,
    updated_at = now()
  where id = p_contributor_id;
end;
$$;

-- Remove legacy Editor language from direct contributor write policies.
drop policy if exists "Contributor own assignment select" on public.metric_contributors;
create policy "Contributor own assignment select"
on public.metric_contributors
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_admin_role() = 'admin'
);

drop policy if exists "Editor admin manage assignments" on public.metric_contributors;
drop policy if exists "Admin manages contributor assignments directly" on public.metric_contributors;
create policy "Admin manages contributor assignments directly"
on public.metric_contributors
for all
to authenticated
using (public.current_admin_role() = 'admin')
with check (public.current_admin_role() = 'admin');

-- ---------------------------------------------------------------------
-- E. Grants
-- ---------------------------------------------------------------------

revoke all on function public.assign_metric_owner_v2(text,text,text,text,text) from public, anon;
revoke all on function public.end_metric_owner_assignment_v2(bigint,text) from public, anon;
revoke all on function public.can_manage_metric_skills(text) from public, anon;
revoke all on function public.get_metric_contributors(text) from public, anon;
revoke all on function public.end_metric_contributor_assignment(bigint,text) from public, anon;

grant execute on function public.assign_metric_owner_v2(text,text,text,text,text) to authenticated, service_role;
grant execute on function public.end_metric_owner_assignment_v2(bigint,text) to authenticated, service_role;
grant execute on function public.can_manage_metric_skills(text) to authenticated, service_role;
grant execute on function public.get_metric_contributors(text) to authenticated, service_role;
grant execute on function public.end_metric_contributor_assignment(bigint,text) to authenticated, service_role;
