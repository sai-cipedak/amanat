-- Gerak SAI governance hardening
-- No user may verify or reject a metric update they created themselves.
-- Routing rule:
--   Metric Owner / Contributor -> Cluster Lead
--   Cluster Lead self-submission -> Admin
--   Admin self-submission -> relevant Cluster Lead

create or replace function public.can_review_metric_update(p_update_id bigint)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
    select exists(
        select 1
        from public.metric_updates mu
        where mu.id=p_update_id
          and mu.verification_status='draft'
          and mu.created_by is distinct from auth.uid()
          and (
              public.current_admin_role()='admin'
              or (
                  public.current_admin_role()='reviewer'
                  and public.is_cluster_lead_for_metric(mu.metric_id)
              )
          )
    );
$function$;

create or replace function public.get_metric_update_review_queue()
returns table(
    id bigint,
    metric_id text,
    as_of_date date,
    actual numeric,
    progress_pct numeric,
    public_evidence_url text,
    update_note text,
    verification_status text,
    submitted_by text,
    verified_by text,
    verified_at timestamptz,
    reviewed_by text,
    reviewed_at timestamptz,
    review_note text,
    created_by uuid,
    created_at timestamptz,
    cluster text,
    cluster_lead_name text,
    cluster_lead_email text,
    review_route text,
    can_current_user_review boolean,
    is_self_submitted boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
    v_role text;
begin
    v_role:=public.current_admin_role();

    if v_role not in ('reviewer','admin') then
        return;
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
        mu.verified_by,
        mu.verified_at,
        mu.reviewed_by,
        mu.reviewed_at,
        mu.review_note,
        mu.created_by,
        mu.created_at,
        m.cluster,
        current_lead.display_name,
        current_lead.lead_email,
        case
            when submitter_is_admin.is_admin
                then 'cluster_lead'
            when submitter_is_cluster_lead.is_lead
                then 'admin_escalation'
            when current_lead.id is null
                then 'admin_no_cluster_lead'
            else 'cluster_lead'
        end,
        public.can_review_metric_update(mu.id),
        (mu.created_by=auth.uid())
    from public.metric_updates mu
    join public.kpi_metrics km on km.id=mu.metric_id
    join public.kpis k on k.id=km.kpi_id
    join public.mandates m on m.id=k.mandate_id
    left join lateral (
        select cl.*
        from public.cluster_leads cl
        where cl.cluster=m.cluster
          and cl.assignment_status in ('pending','active')
        order by
            case cl.assignment_status when 'active' then 1 else 2 end,
            cl.assigned_at desc
        limit 1
    ) current_lead on true
    left join lateral (
        select exists(
            select 1
            from public.cluster_leads scl
            where scl.cluster=m.cluster
              and scl.assignment_status in ('pending','active')
              and (
                  scl.user_id=mu.created_by
                  or lower(scl.lead_email)=lower(coalesce(mu.submitted_by,''))
              )
        ) as is_lead
    ) submitter_is_cluster_lead on true
    left join lateral (
        select exists(
            select 1
            from public.admin_users au
            where au.is_active=true
              and au.role='admin'
              and lower(au.email)=lower(coalesce(mu.submitted_by,''))
        ) as is_admin
    ) submitter_is_admin on true
    where mu.verification_status='draft'
      and (
          v_role='admin'
          or (
              v_role='reviewer'
              and public.is_cluster_lead_for_metric(mu.metric_id)
          )
      )
    order by mu.created_at asc,mu.id asc;
end;
$function$;

create or replace function public.review_metric_update(
    p_update_id bigint,
    p_status text,
    p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_update public.metric_updates%rowtype;
begin
    if auth.uid() is null then
        raise exception 'Authentication required.';
    end if;

    if p_status not in ('verified','rejected') then
        raise exception 'Review status must be verified or rejected.';
    end if;

    select * into v_update
    from public.metric_updates
    where id=p_update_id
    for update;

    if v_update.id is null then
        raise exception 'Metric update not found.';
    end if;

    if v_update.verification_status<>'draft' then
        raise exception 'Only Draft updates can be reviewed.';
    end if;

    if v_update.created_by=auth.uid() then
        if public.current_admin_role()='admin' then
            raise exception 'Self-review is not allowed. An Admin-submitted draft requires Cluster Lead review.';
        elsif public.current_admin_role()='reviewer'
              and public.is_cluster_lead_for_metric(v_update.metric_id) then
            raise exception 'Self-review is not allowed. A Cluster Lead-submitted draft requires Admin review.';
        else
            raise exception 'Self-review is not allowed.';
        end if;
    end if;

    if not public.can_review_metric_update(p_update_id) then
        raise exception 'You are not authorized to review this metric update.';
    end if;

    if p_status='rejected'
       and nullif(trim(coalesce(p_review_note,'')),'') is null then
        raise exception 'Reject requires a review note.';
    end if;

    update public.metric_updates
    set
        verification_status=p_status,
        review_note=nullif(trim(coalesce(p_review_note,'')),'')
    where id=p_update_id;
end;
$function$;
