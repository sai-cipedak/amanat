-- Gerak SAI — show current owners and active volunteers in metric workspace cards
-- 2026-10-06

drop function if exists public.get_my_metric_workspace();

create function public.get_my_metric_workspace()
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
              or lower(mo.owner_email)=
                 lower(coalesce(auth.jwt()->>'email',''))
          )
    ),
    my_review_clusters as (
        select distinct cl.cluster
        from public.cluster_leads cl
        where cl.assignment_status in ('pending','active')
          and (
              cl.user_id=auth.uid()
              or lower(cl.lead_email)=
                 lower(coalesce(auth.jwt()->>'email',''))
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
                        coalesce(nullif(trim(mo2.display_name),''), mo2.owner_email)
                )
                from public.metric_owners mo2
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
                        coalesce(
                            nullif(trim(vp.display_name),''),
                            split_part(vp.email,'@',1)
                        ) as volunteer_name,
                        array_agg(
                            distinct mc2.contribution_mode
                            order by mc2.contribution_mode
                        ) as contribution_modes
                    from public.metric_contributors mc2
                    join public.volunteer_profiles vp
                      on vp.user_id=mc2.user_id
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
                join public.skill_catalog sc
                  on sc.id=msr.skill_id
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
    join public.kpis k
      on k.id=km.kpi_id
    join public.mandates m
      on m.id=k.mandate_id

    left join my_ownership mo
      on mo.metric_id=km.id

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
                select 1
                from my_review_clusters rc
                where rc.cluster=m.cluster
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

revoke all on function public.get_my_metric_workspace() from public, anon;
grant execute on function public.get_my_metric_workspace() to authenticated, service_role;
