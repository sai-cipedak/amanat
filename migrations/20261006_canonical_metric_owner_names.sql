-- Gerak SAI — canonical Metric Owner names
-- 2026-10-06
--
-- Current/active Metric Owners should display the actual name of the assigned
-- Google account whenever that account has already authenticated. Pending
-- assignments that do not yet have an auth user continue to use the manually
-- supplied display name.

-- Backfill current assignments that are already bound to an authenticated user.
update public.metric_owners mo
set
  display_name = coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'),''),
    nullif(trim(u.raw_user_meta_data->>'name'),''),
    mo.display_name
  ),
  updated_at = now()
from auth.users u
where u.id = mo.user_id
  and mo.assignment_status in ('pending','active')
  and coalesce(
        nullif(trim(u.raw_user_meta_data->>'full_name'),''),
        nullif(trim(u.raw_user_meta_data->>'name'),'')
      ) is not null
  and mo.display_name is distinct from coalesce(
        nullif(trim(u.raw_user_meta_data->>'full_name'),''),
        nullif(trim(u.raw_user_meta_data->>'name'),'')
      );

create or replace function public.claim_my_metric_ownership()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_email text;
  v_count integer;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_email := lower(trim(coalesce(auth.jwt()->>'email','')));
  if v_email='' then
    raise exception 'Authenticated account has no email.';
  end if;

  select coalesce(
           nullif(trim(u.raw_user_meta_data->>'full_name'),''),
           nullif(trim(u.raw_user_meta_data->>'name'),'')
         )
  into v_display_name
  from auth.users u
  where u.id=auth.uid();

  update public.metric_owners mo
  set
      user_id=auth.uid(),
      display_name=coalesce(v_display_name,mo.display_name),
      assignment_status='active',
      activated_at=coalesce(mo.activated_at,now()),
      updated_at=now()
  where lower(mo.owner_email)=v_email
    and mo.assignment_status in ('pending','active')
    and (mo.user_id is null or mo.user_id=auth.uid());

  get diagnostics v_count=row_count;
  return v_count;
end;
$function$;

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
as $function$
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
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not exists(select 1 from public.kpi_metrics where id = p_metric_id) then raise exception 'Metric not found.'; end if;
  if not (public.current_admin_role() = 'admin' or public.is_cluster_lead_for_metric(p_metric_id)) then
    raise exception 'Only Admin or the Cluster Lead for this metric can assign Metric Owners.';
  end if;
  if p_owner_role not in ('primary_owner','supporting_owner') then raise exception 'Invalid owner role.'; end if;

  v_email := lower(trim(coalesce(p_owner_email,'')));
  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  v_actor_email := lower(coalesce(auth.jwt()->>'email',''));
  if v_email = '' or position('@' in v_email) <= 1 then raise exception 'A valid owner email is required.'; end if;

  -- Prefer the authenticated Google account as the canonical identity.
  select
    u.id,
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'),''),
      nullif(trim(u.raw_user_meta_data->>'name'),''),
      (
        select nullif(trim(vp.display_name),'')
        from public.volunteer_profiles vp
        where vp.user_id=u.id
        limit 1
      )
    )
  into v_existing_user_id, v_existing_display_name
  from auth.users u
  where lower(u.email)=v_email
  order by u.created_at desc
  limit 1;

  -- An account that has not authenticated yet remains Pending and may use
  -- the display name entered by Admin/Cluster Lead.
  if v_existing_user_id is null then
    select vp.user_id, nullif(trim(vp.display_name),'')
    into v_existing_user_id, v_existing_display_name
    from public.volunteer_profiles vp
    where lower(vp.email)=v_email
    limit 1;
  end if;

  select mo.id, mo.owner_email
  into v_current_primary_id, v_current_primary_email
  from public.metric_owners mo
  where mo.metric_id = p_metric_id
    and mo.owner_role = 'primary_owner'
    and mo.assignment_status in ('pending','active')
  order by mo.assigned_at desc, mo.id desc
  limit 1 for update;

  select mo.id, mo.owner_role
  into v_assignment_id, v_existing_role
  from public.metric_owners mo
  where mo.metric_id = p_metric_id
    and lower(mo.owner_email) = v_email
    and mo.assignment_status in ('pending','active')
  order by mo.assigned_at desc, mo.id desc
  limit 1 for update;

  if v_assignment_id is not null
     and v_existing_role is distinct from p_owner_role
     and v_reason is null then
    raise exception 'Reason is required when changing a Metric Owner role.';
  end if;

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
    set assignment_status = 'ended', ended_at = now(), end_reason = v_reason,
        ended_by_user_id = auth.uid(), ended_by_email = v_actor_email, updated_at = now()
    where id = v_current_primary_id;
  end if;

  if v_assignment_id is not null then
    update public.metric_owners
    set owner_role = p_owner_role,
        -- Authenticated account name is canonical; manual name is fallback for
        -- a still-pending/unbound assignment.
        display_name = coalesce(
          v_existing_display_name,
          nullif(trim(coalesce(p_display_name,'')),''),
          display_name
        ),
        user_id = coalesce(user_id,v_existing_user_id),
        assignment_status = case when coalesce(user_id,v_existing_user_id) is not null then 'active' else 'pending' end,
        activated_at = case when coalesce(user_id,v_existing_user_id) is not null then coalesce(activated_at,now()) else activated_at end,
        assignment_reason = case when v_existing_role is distinct from p_owner_role then v_reason else assignment_reason end,
        updated_at = now()
    where id = v_assignment_id;
    return v_assignment_id;
  end if;

  insert into public.metric_owners(
    metric_id,owner_email,display_name,user_id,owner_role,assignment_status,
    assigned_by_user_id,assigned_by_email,assigned_at,activated_at,assignment_reason
  ) values (
    p_metric_id,
    v_email,
    coalesce(v_existing_display_name,nullif(trim(coalesce(p_display_name,'')),'')),
    v_existing_user_id,
    p_owner_role,
    case when v_existing_user_id is null then 'pending' else 'active' end,
    auth.uid(),
    v_actor_email,
    now(),
    case when v_existing_user_id is null then null else now() end,
    v_reason
  ) returning id into v_assignment_id;

  return v_assignment_id;
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
set search_path = public
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
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'),''),
      nullif(trim(u.raw_user_meta_data->>'name'),''),
      nullif(trim(mo.display_name),''),
      split_part(mo.owner_email,'@',1)
    ),
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
  left join auth.users u on u.id=mo.user_id
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

-- Keep the existing workspace contract, but make canonical Google account names
-- authoritative in the owners JSON returned to every My Metrics card.
create or replace function public.get_my_metric_workspace()
returns table(
    assignment_id bigint,
    metric_id text,
    metric_name text,
    metric_description text,
    measurement_method text,
    measurement_direction text,
    baseline numeric,
    target numeric,
    actual numeric,
    progress_pct numeric,
    unit text,
    actual_date date,
    target_description text,
    evidence_requirement text,
    kpi_id text,
    kpi_title text,
    kpi_progress_pct numeric,
    kpi_is_priority boolean,
    kpi_is_active_manual boolean,
    mandate_id text,
    mandate_title text,
    cluster text,
    owner_role text,
    assignment_status text,
    opportunity_id bigint,
    opportunity_title text,
    opportunity_status text,
    min_hours_month numeric,
    max_hours_month numeric,
    volunteer_slots integer,
    pending_applications bigint,
    approved_applications bigint,
    active_contributors bigint,
    owners jsonb,
    active_volunteers jsonb,
    skills jsonb,
    contribution_modes jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
    v_role text;
begin
    if auth.uid() is null then
        raise exception 'Authentication required.';
    end if;
    v_role:=public.current_admin_role();

    return query
    with my_ownership as (
        select mo.*
        from public.metric_owners mo
        where mo.assignment_status in ('pending','active')
          and (
              mo.user_id=auth.uid()
              or lower(mo.owner_email)=lower(coalesce(auth.jwt()->>'email',''))
          )
    ),
    my_review_clusters as (
        select distinct cl.cluster
        from public.cluster_leads cl
        where cl.assignment_status in ('pending','active')
          and (
              cl.user_id=auth.uid()
              or lower(cl.lead_email)=lower(coalesce(auth.jwt()->>'email',''))
          )
    )
    select
        mo.id,
        km.id,
        km.metric_name,
        km.metric_description,
        km.measurement_method,
        km.measurement_direction,
        km.baseline,
        km.target,
        km.actual,
        km.progress_pct,
        km.unit,
        km.actual_date,
        km.target_description,
        km.evidence_requirement,
        k.id,
        k.title,
        k.progress_pct,
        coalesce(k.is_priority,false),
        coalesce(k.is_active_manual,false),
        m.id,
        m.title,
        m.cluster,
        coalesce(
            mo.owner_role,
            case
                when v_role='admin' then 'admin_scope'
                when v_role='reviewer' then 'reviewer_scope'
                else null
            end
        ),
        coalesce(mo.assignment_status,'scope'),
        vo.id,
        vo.opportunity_title,
        vo.status,
        vo.min_hours_month,
        vo.max_hours_month,
        vo.volunteer_slots,
        (
            select count(*)
            from public.volunteer_applications va
            where va.opportunity_id=vo.id
              and va.status='pending'
        ),
        (
            select count(*)
            from public.volunteer_applications va
            where va.opportunity_id=vo.id
              and va.status='approved'
        ),
        (
            select count(*)
            from public.metric_contributors mc
            where mc.metric_id=km.id
              and mc.assignment_status='active'
        ),
        coalesce(
            (
                select jsonb_agg(
                    jsonb_build_object(
                        'name', coalesce(
                            nullif(trim(u2.raw_user_meta_data->>'full_name'),''),
                            nullif(trim(u2.raw_user_meta_data->>'name'),''),
                            nullif(trim(mo2.display_name),''),
                            split_part(mo2.owner_email,'@',1)
                        ),
                        'role', mo2.owner_role,
                        'status', mo2.assignment_status
                    )
                    order by
                        case mo2.owner_role
                            when 'primary_owner' then 1
                            when 'supporting_owner' then 2
                            else 9
                        end,
                        coalesce(
                            nullif(trim(u2.raw_user_meta_data->>'full_name'),''),
                            nullif(trim(u2.raw_user_meta_data->>'name'),''),
                            nullif(trim(mo2.display_name),''),
                            mo2.owner_email
                        )
                )
                from public.metric_owners mo2
                left join auth.users u2 on u2.id=mo2.user_id
                where mo2.metric_id=km.id
                  and mo2.assignment_status in ('pending','active')
            ),
            '[]'::jsonb
        ),
        coalesce(
            (
                select jsonb_agg(
                    jsonb_build_object(
                        'name', av.volunteer_name,
                        'contribution_modes', to_jsonb(av.contribution_modes)
                    )
                    order by av.volunteer_name
                )
                from (
                    select
                        mc2.user_id,
                        coalesce(nullif(trim(vp.display_name),''), split_part(vp.email,'@',1)) as volunteer_name,
                        array_agg(distinct mc2.contribution_mode order by mc2.contribution_mode) as contribution_modes
                    from public.metric_contributors mc2
                    join public.volunteer_profiles vp on vp.user_id=mc2.user_id
                    where mc2.metric_id=km.id
                      and mc2.assignment_status='active'
                    group by mc2.user_id, vp.display_name, vp.email
                ) av
            ),
            '[]'::jsonb
        ),
        coalesce(
            (
                select jsonb_agg(
                    jsonb_build_object(
                        'skill_id',sc.id,
                        'skill_family',sc.skill_family,
                        'skill_name',sc.skill_name,
                        'requirement_level',msr.requirement_level
                    )
                    order by
                        case msr.requirement_level
                            when 'required' then 1
                            else 2
                        end,
                        sc.skill_family,
                        sc.sort_order,
                        sc.skill_name
                )
                from public.metric_skill_requirements msr
                join public.skill_catalog sc on sc.id=msr.skill_id
                where msr.metric_id=km.id
                  and sc.is_active=true
            ),
            '[]'::jsonb
        ),
        coalesce(
            (
                select jsonb_agg(
                    mcm.contribution_mode
                    order by
                        case mcm.contribution_mode
                            when 'advisor_sme' then 1
                            when 'operational_execution' then 2
                            when 'project_lead' then 3
                            else 9
                        end
                )
                from public.metric_contribution_modes mcm
                where mcm.metric_id=km.id
            ),
            '[]'::jsonb
        )
    from public.kpi_metrics km
    join public.kpis k on k.id=km.kpi_id
    join public.mandates m on m.id=k.mandate_id
    left join my_ownership mo on mo.metric_id=km.id
    left join lateral (
        select vo2.*
        from public.volunteer_opportunities vo2
        where vo2.metric_id=km.id
        order by
            case vo2.status
                when 'open' then 1
                when 'paused' then 2
                when 'draft' then 3
                when 'filled' then 4
                when 'closed' then 5
                else 9
            end,
            vo2.id desc
        limit 1
    ) vo on true
    where
        v_role='admin'
        or (
            v_role='reviewer'
            and exists(
                select 1 from my_review_clusters rc where rc.cluster=m.cluster
            )
        )
        or mo.id is not null
    order by
        m.sort_order,
        k.sort_order,
        km.sort_order,
        case coalesce(
            mo.owner_role,
            case
                when v_role='admin' then 'admin_scope'
                when v_role='reviewer' then 'reviewer_scope'
                else null
            end
        )
            when 'primary_owner' then 1
            when 'supporting_owner' then 2
            when 'admin_scope' then 3
            when 'reviewer_scope' then 4
            else 9
        end;
end;
$function$;

revoke all on function public.claim_my_metric_ownership() from public, anon;
grant execute on function public.claim_my_metric_ownership() to authenticated, service_role;

revoke all on function public.assign_metric_owner_v2(text,text,text,text,text) from public, anon;
grant execute on function public.assign_metric_owner_v2(text,text,text,text,text) to authenticated, service_role;

revoke all on function public.get_admin_metric_ownership() from public, anon;
grant execute on function public.get_admin_metric_ownership() to authenticated, service_role;

revoke all on function public.get_my_metric_workspace() from public, anon;
grant execute on function public.get_my_metric_workspace() to authenticated, service_role;
