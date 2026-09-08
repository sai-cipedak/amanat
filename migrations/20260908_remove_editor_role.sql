begin;

-- Retire the legacy global Editor role.
-- Metric ownership and Cluster Lead assignments live in separate tables,
-- so removing these allowlist rows does not remove contextual assignments.
delete from public.admin_users
where role <> 'admin';

alter table public.admin_users
  drop constraint if exists admin_users_role_check;

alter table public.admin_users
  add constraint admin_users_role_check
  check (role = 'admin');

-- Effective administrative roles are now only:
--   admin    -> explicit active admin_users row
--   reviewer -> active/pending Cluster Lead assignment
create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path=public
as $$
    with current_email as (
        select lower(coalesce(auth.jwt()->>'email','')) as email
    ),
    explicit_admin as (
        select 1
        from public.admin_users au,current_email ce
        where au.is_active=true
          and au.role='admin'
          and lower(au.email)=ce.email
        limit 1
    ),
    scoped_reviewer as (
        select 1
        from public.cluster_leads cl,current_email ce
        where cl.assignment_status in ('pending','active')
          and (
              cl.user_id=auth.uid()
              or lower(cl.lead_email)=ce.email
          )
        limit 1
    )
    select case
        when exists(select 1 from explicit_admin)
            then 'admin'
        when exists(select 1 from scoped_reviewer)
            then 'reviewer'
        else null
    end;
$$;

-- Global metric write capability belongs only to Admin.
-- Otherwise the user must be an explicit Primary/Supporting Metric Owner.
create or replace function public.can_manage_metric(
    p_metric_id text
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
    select public.current_admin_role()='admin'
           or public.is_metric_owner(p_metric_id);
$$;

-- Role-aware My Metrics access without the retired Editor role.
create or replace function public.get_my_metrics_access()
returns table (
    can_access boolean,
    access_scope text,
    role_label text,
    owner_count bigint,
    reviewer_cluster_count bigint
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
    v_role text;
    v_owner_count bigint;
    v_cluster_count bigint;
begin
    if auth.uid() is null then
        return query
        select false,'none','Public',0::bigint,0::bigint;
        return;
    end if;

    v_role:=public.current_admin_role();

    select count(*)
    into v_owner_count
    from public.metric_owners mo
    where mo.assignment_status in ('pending','active')
      and (
          mo.user_id=auth.uid()
          or lower(mo.owner_email)=
             lower(coalesce(auth.jwt()->>'email',''))
      );

    select count(distinct cl.cluster)
    into v_cluster_count
    from public.cluster_leads cl
    where cl.assignment_status in ('pending','active')
      and (
          cl.user_id=auth.uid()
          or lower(cl.lead_email)=
             lower(coalesce(auth.jwt()->>'email',''))
      );

    return query
    select
        coalesce(v_role in ('admin','reviewer'),false)
          or v_owner_count>0,
        case
            when v_role='admin' then 'admin'
            when v_role='reviewer' then 'reviewer'
            when v_owner_count>0 then 'owner'
            else 'none'
        end,
        case
            when v_role='admin' then 'Admin'
            when v_role='reviewer' then 'Cluster Lead · Reviewer'
            when v_owner_count>0 then 'Metric Owner'
            else 'Volunteer'
        end,
        v_owner_count,
        v_cluster_count;
end;
$$;

-- Metric history is scoped to contextual authority.
-- This also closes the legacy reviewer-history loophole: a Reviewer can only
-- read history for a metric inside a cluster they lead.
create or replace function public.get_my_metric_update_history(
    p_metric_id text
)
returns table (
    update_id bigint,
    metric_id text,
    as_of_date date,
    actual numeric,
    progress_pct numeric,
    public_evidence_url text,
    update_note text,
    verification_status text,
    submitted_by text,
    reviewed_by text,
    reviewed_at timestamptz,
    review_note text,
    created_at timestamptz,
    updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
    if auth.uid() is null then
        raise exception 'Authentication required.';
    end if;

    if not (
        public.is_metric_owner(p_metric_id)
        or public.current_admin_role()='admin'
        or (
            public.current_admin_role()='reviewer'
            and public.is_cluster_lead_for_metric(p_metric_id)
        )
    ) then
        raise exception 'You do not have permission to read this metric history.';
    end if;

    return query
    select
        mu.id,
        mu.metric_id,
        mu.as_of_date,
        mu.actual,
        mu.progress_pct,
        mu.public_evidence_url,
        mu.update_note,
        mu.verification_status,
        mu.submitted_by,
        mu.reviewed_by,
        mu.reviewed_at,
        mu.review_note,
        mu.created_at,
        mu.updated_at
    from public.metric_updates mu
    where mu.metric_id=p_metric_id
    order by
        mu.as_of_date desc,
        mu.created_at desc,
        mu.id desc;
end;
$$;

-- Clean the direct Metric Update write policies.
drop policy if exists "Editors admins submit draft metric updates"
on public.metric_updates;

drop policy if exists "Admins submit draft metric updates"
on public.metric_updates;

create policy "Admins submit draft metric updates"
on public.metric_updates
for insert
to authenticated
with check (
    public.current_admin_role()='admin'
    and verification_status='draft'
    and created_by=auth.uid()
);

drop policy if exists "Editors can update own drafts"
on public.metric_updates;

drop policy if exists "Editors update own drafts"
on public.metric_updates;

-- KPI project flags are now Admin-only global controls.
drop policy if exists "Editors and admins can update KPI flags"
on public.kpis;

drop policy if exists "Admins can update KPI flags"
on public.kpis;

create policy "Admins can update KPI flags"
on public.kpis
for update
to authenticated
using (public.current_admin_role()='admin')
with check (public.current_admin_role()='admin');

commit;