const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const MODE_LABELS = {
  advisor_sme: "Advisor / SME",
  operational_execution: "Operational / Execution",
  project_lead: "Project Lead"
};

const state = {
  mode: new URLSearchParams(location.search).get("mode") === "capacity" ? "capacity" : "kpi",
  session: null,
  profile: null,
  profileSkillIds: [],
  profileModes: [],
  skills: [],
  opportunities: [],
  filtered: [],
  applications: [],
  selectedOpportunity: null,
  pendingJoinId: sessionStorage.getItem("saiVolunteerPendingJoin")
};

const $ = id => document.getElementById(id);
const els = {
  modeKpi:$("mode-kpi"), modeCapacity:$("mode-capacity"),
  authName:$("auth-name"), authEmail:$("auth-email"), login:$("login-button"),
  profileBtn:$("profile-button"), logout:$("logout-button"),
  kpiFilters:$("kpi-filters"), capacityFilters:$("capacity-filters"),
  search:$("search-filter"), cluster:$("cluster-filter"), skill:$("skill-filter"),
  priority:$("priority-filter"), activity:$("activity-filter"), resetKpi:$("reset-kpi-filters"),
  talentPools:$("talent-pool-list"), capTime:$("capacity-time"),
  capAdvisor:$("capacity-advisor"), capOperational:$("capacity-operational"),
  capLead:$("capacity-lead"), capPriority:$("capacity-priority"),
  capActive:$("capacity-active"), useProfile:$("use-profile-button"),
  resetCapacity:$("reset-capacity-filters"),
  resultsTitle:$("results-title"), resultCount:$("result-count"), list:$("opportunity-list"),
  profileModal:$("profile-modal"), profileContext:$("profile-context"), profileForm:$("profile-form"),
  profileName:$("profile-name"), profileEmail:$("profile-email"), profileBackground:$("profile-background"),
  profileOrg:$("profile-organization"), profileTime:$("profile-time"),
  profileAdvisor:$("profile-advisor"), profileOperational:$("profile-operational"),
  profileLead:$("profile-lead"), profileSkills:$("profile-skill-list"),
  profileContact:$("profile-contact"), profileMessage:$("profile-message"),
  joinModal:$("join-modal"), joinTitle:$("join-title"), joinContext:$("join-context"),
  joinForm:$("join-form"), joinMode:$("join-mode"), joinHours:$("join-hours"),
  joinMotivation:$("join-motivation"), joinCommitment:$("join-commitment"),
  joinContact:$("join-contact"), joinMessage:$("join-message"),
  thankModal:$("thankyou-modal"), thankCopy:$("thankyou-copy"),
  exploreMore:$("explore-more"), imDone:$("im-done")
};

function esc(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function message(el,text,type=""){el.textContent=text||"";el.className=`form-message ${type}`.trim();}
function approxBucket(h){const n=Number(h||0);return n<2?"1":n<=4?"3":n<=8?"6.5":n<=16?"12.5":"20";}

function metricProgress(m){
  if(m.progress_pct!==null&&m.progress_pct!==undefined)return Math.max(0,Math.min(100,Number(m.progress_pct)));
  if(m.actual===null||m.actual===undefined)return null;
  const a=Number(m.actual),t=m.target==null?null:Number(m.target),b=m.baseline==null?null:Number(m.baseline);
  switch(m.measurement_direction){
    case"binary":return a>=1?100:0;
    case"milestone":return t?Math.max(0,Math.min(100,a/t*100)):Math.max(0,Math.min(100,a));
    case"higher_is_better":
      if(t===null)return null;
      if(b!==null&&t!==b)return Math.max(0,Math.min(100,(a-b)/(t-b)*100));
      return t>0?Math.max(0,Math.min(100,a/t*100)):null;
    case"lower_is_better":
      return b===null||t===null||b===t?null:Math.max(0,Math.min(100,(b-a)/(b-t)*100));
    case"target_is_exact":return t!==null&&a===t?100:0;
    default:return null;
  }
}

function activityState(kpi){
  const metrics=(kpi.metrics||[]).filter(m=>m.is_public!==false);
  if(!metrics.length)return kpi.is_active_manual?"active":"not_active";
  const p=metrics.map(metricProgress);
  if(p.length&&p.every(x=>x!==null&&x>=100))return"completed";
  if(kpi.is_active_manual||p.some(x=>x!==null&&x>0))return"active";
  return"not_active";
}
const activityLabel=s=>({active:"● Active",not_active:"○ Belum Active",completed:"✓ Completed"}[s]||"—");

async function signIn(pendingId=null){
  if(pendingId){
    sessionStorage.setItem("saiVolunteerPendingJoin",String(pendingId));
    state.pendingJoinId=String(pendingId);
  }
  const redirectTo=`${location.origin}${location.pathname}${location.search}`;
  const {error}=await db.auth.signInWithOAuth({provider:"google",options:{redirectTo}});
  if(error)throw error;
}

async function loadSkills(){
  const {data,error}=await db.from("skill_catalog")
    .select("id,skill_code,skill_family,skill_name,sort_order")
    .eq("is_active",true).order("skill_family").order("sort_order").order("skill_name");
  if(error)throw error;
  state.skills=data||[];
}

async function loadOpportunities(){
  const {data:ops,error:oe}=await db.from("volunteer_opportunities")
    .select("id,metric_id,opportunity_title,short_description,status,min_hours_month,max_hours_month,volunteer_slots,public_note")
    .eq("status","open").order("id");
  if(oe)throw oe;
  if(!ops?.length){state.opportunities=[];return;}

  const metricIds=[...new Set(ops.map(x=>x.metric_id))];
  const [mr,rr,cr]=await Promise.all([
    db.from("kpi_metrics")
      .select("id,kpi_id,metric_name,metric_description,measurement_method,measurement_direction,baseline,target,actual,progress_pct,unit,is_public")
      .in("id",metricIds),
    db.from("metric_skill_requirements")
      .select("metric_id,skill_id,requirement_level").in("metric_id",metricIds),
    db.from("metric_contribution_modes")
      .select("metric_id,contribution_mode").in("metric_id",metricIds)
  ]);
  if(mr.error)throw mr.error;if(rr.error)throw rr.error;if(cr.error)throw cr.error;

  const metrics=mr.data||[],kpiIds=[...new Set(metrics.map(x=>x.kpi_id))];
  const {data:kpis,error:ke}=await db.from("kpis")
    .select(`id,title,measurement_type,responsibility,is_priority,is_active_manual,
      mandates(id,title,cluster,sort_order),
      kpi_metrics(id,measurement_direction,baseline,target,actual,progress_pct,is_public)`)
    .in("id",kpiIds);
  if(ke)throw ke;

  const skillById=new Map(state.skills.map(s=>[Number(s.id),s]));
  const metricById=new Map(metrics.map(m=>[m.id,m]));
  const kpiById=new Map((kpis||[]).map(k=>[k.id,{...k,metrics:k.kpi_metrics||[]}]));

  const reqs=new Map(),modes=new Map();
  for(const r of rr.data||[]){
    if(!reqs.has(r.metric_id))reqs.set(r.metric_id,[]);
    const s=skillById.get(Number(r.skill_id));
    if(s)reqs.get(r.metric_id).push({...s,requirement_level:r.requirement_level});
  }
  for(const r of cr.data||[]){
    if(!modes.has(r.metric_id))modes.set(r.metric_id,[]);
    modes.get(r.metric_id).push(r.contribution_mode);
  }

  state.opportunities=ops.map(o=>{
    const metric=metricById.get(o.metric_id);if(!metric)return null;
    const kpi=kpiById.get(metric.kpi_id);if(!kpi)return null;
    return {...o,metric,kpi,skills:reqs.get(metric.id)||[],modes:modes.get(metric.id)||[]};
  }).filter(Boolean);
}

async function loadUserData(){
  if(!state.session?.user){
    state.profile=null;state.profileSkillIds=[];state.profileModes=[];state.applications=[];return;
  }
  const uid=state.session.user.id;
  const [p,s,m,a]=await Promise.all([
    db.from("volunteer_profiles")
      .select("user_id,email,display_name,professional_background,current_organization,available_hours_month,willing_to_be_contacted")
      .eq("user_id",uid).maybeSingle(),
    db.from("volunteer_profile_skills").select("skill_id").eq("user_id",uid),
    db.from("volunteer_profile_contribution_modes").select("contribution_mode").eq("user_id",uid),
    db.from("volunteer_applications")
      .select("id,opportunity_id,contribution_mode,offered_hours_month,motivation,status,review_note,created_at")
      .eq("user_id",uid)
  ]);
  for(const r of[p,s,m,a])if(r.error)throw r.error;
  state.profile=p.data||null;
  state.profileSkillIds=(s.data||[]).map(x=>Number(x.skill_id));
  state.profileModes=(m.data||[]).map(x=>x.contribution_mode);
  state.applications=a.data||[];
}

function renderAuth(){
  if(!state.session?.user){
    els.authName.textContent="Browsing as public";
    els.authEmail.textContent="Login hanya dibutuhkan saat Join.";
    els.login.hidden=false;els.profileBtn.hidden=true;els.logout.hidden=true;return;
  }
  const u=state.session.user;
  els.authName.textContent=state.profile?.display_name||u.user_metadata?.full_name||u.email;
  els.authEmail.textContent=u.email||"";
  els.login.hidden=true;els.profileBtn.hidden=false;els.logout.hidden=false;
}

function populateFilters(){
  const clusters=[...new Set(state.opportunities.map(o=>o.kpi.mandates?.cluster).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,"id"));
  els.cluster.innerHTML='<option value="">Semua cluster</option>'+
    clusters.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");

  els.skill.innerHTML='<option value="">Semua skill</option>';
  let family=null,group=null;
  for(const s of state.skills){
    if(s.skill_family!==family){
      family=s.skill_family;group=document.createElement("optgroup");group.label=family;els.skill.appendChild(group);
    }
    const o=document.createElement("option");o.value=String(s.id);o.textContent=s.skill_name;group.appendChild(o);
  }

  const families=[...new Set(state.skills.map(s=>s.skill_family))].sort((a,b)=>a.localeCompare(b,"id"));
  els.talentPools.innerHTML=families.map(f=>`
    <label class="choice-chip"><input type="checkbox" data-family="${esc(f)}"><span>${esc(f)}</span></label>
  `).join("");
  els.talentPools.querySelectorAll("input[data-family]").forEach(x=>x.addEventListener("change",applyFilters));
}

function selectedFamilies(){
  return [...els.talentPools.querySelectorAll("input[data-family]:checked")].map(x=>x.dataset.family);
}
function selectedCapModes(){
  const a=[];if(els.capAdvisor.checked)a.push("advisor_sme");
  if(els.capOperational.checked)a.push("operational_execution");
  if(els.capLead.checked)a.push("project_lead");return a;
}
function appFor(id){return state.applications.find(a=>Number(a.opportunity_id)===Number(id))||null;}

function matchScore(o){
  const fam=selectedFamilies(),modes=selectedCapModes();
  const hrs=els.capTime.value===""?null:Number(els.capTime.value);
  let score=0,max=0;
  if(fam.length){max+=5;const hit=o.skills.filter(s=>fam.includes(s.skill_family));if(hit.length)score+=hit.some(s=>s.requirement_level==="required")?5:3;}
  if(modes.length){max+=3;if(o.modes.some(m=>modes.includes(m)))score+=3;}
  if(hrs!==null){max+=2;const min=Number(o.min_hours_month||0);if(hrs>=min)score+=2;}
  const pct=max?Math.round(score/max*100):0;
  return {percent:pct,label:pct>=75?"High Match":pct>=45?"Medium Match":pct?"Low Match":"Explore"};
}

function applyFilters(){
  if(state.mode==="capacity"){
    const fam=selectedFamilies(),modes=selectedCapModes(),hrs=els.capTime.value===""?null:Number(els.capTime.value);
    state.filtered=state.opportunities.filter(o=>{
      const familyOk=!fam.length||o.skills.some(s=>fam.includes(s.skill_family));
      const modeOk=!modes.length||o.modes.some(m=>modes.includes(m));
      const timeOk=hrs===null||hrs>=Number(o.min_hours_month||0);
      const prioOk=!els.capPriority.checked||o.kpi.is_priority;
      const activeOk=!els.capActive.checked||activityState(o.kpi)==="active";
      return familyOk&&modeOk&&timeOk&&prioOk&&activeOk;
    }).sort((a,b)=>matchScore(b).percent-matchScore(a).percent);
  }else{
    const q=els.search.value.trim().toLowerCase(),cluster=els.cluster.value,
      skillId=els.skill.value?Number(els.skill.value):null,prio=els.priority.value,activity=els.activity.value;
    state.filtered=state.opportunities.filter(o=>{
      const hay=[o.opportunity_title,o.short_description,o.metric.metric_name,o.metric.metric_description,
        o.kpi.id,o.kpi.title,o.kpi.mandates?.title,o.kpi.mandates?.cluster].filter(Boolean).join(" ").toLowerCase();
      return(!q||hay.includes(q))&&(!cluster||o.kpi.mandates?.cluster===cluster)&&
        (!skillId||o.skills.some(s=>Number(s.id)===skillId))&&
        (!prio||(prio==="priority"&&o.kpi.is_priority)||(prio==="less_priority"&&!o.kpi.is_priority))&&
        (!activity||activityState(o.kpi)===activity);
    });
  }
  renderList();
}

function skillTags(o){
  return o.skills.length?o.skills.map(s=>`<span class="skill-tag ${s.requirement_level==="required"?"required":""}">${esc(s.skill_name)}</span>`).join(""):"—";
}
function modeTags(o){
  return o.modes.length?o.modes.map(m=>`<span class="mode-tag">${esc(MODE_LABELS[m]||m)}</span>`).join(""):"—";
}
function hoursText(o){
  const min=o.min_hours_month,max=o.max_hours_month;
  if(min!=null&&max!=null)return`${min}–${max} jam/bulan`;
  if(min!=null)return`min. ${min} jam/bulan`;
  if(max!=null)return`maks. ${max} jam/bulan`;
  return"Waktu fleksibel / akan disepakati";
}

function renderList(){
  els.resultCount.textContent=state.filtered.length;
  els.resultsTitle.textContent=state.mode==="capacity"?"Matched opportunities":"Available opportunities";

  if(!state.opportunities.length){
    els.list.innerHTML='<div class="empty-card">Belum ada volunteering opportunity berstatus <strong>Open</strong>. Seeded opportunity masih Draft sampai editor/admin membukanya.</div>';return;
  }
  if(!state.filtered.length){
    els.list.innerHTML='<div class="empty-card">Tidak ada opportunity yang cocok dengan filter saat ini.</div>';return;
  }

  els.list.innerHTML=state.filtered.map(o=>{
    const act=activityState(o.kpi),app=appFor(o.id),match=matchScore(o);
    const matchBlock=state.mode==="capacity"?`<div class="match-score"><strong>${match.percent}%</strong><span>${match.label}</span></div>`:"";
    return`<article class="opportunity-card">
      <div class="card-top"><div>
        <div class="card-badges">
          <span class="badge ${o.kpi.is_priority?"priority":""}">${o.kpi.is_priority?"★ Prioritas":"◇ Less Priority"}</span>
          <span class="badge ${act}">${esc(activityLabel(act))}</span>
          <span class="badge">${esc(o.kpi.mandates?.cluster||"Unclassified")}</span>
        </div>
        <p class="card-kpi">${esc(o.kpi.id)} · ${esc(o.kpi.title)}</p>
        <h3>${esc(o.opportunity_title)}</h3>
        <p class="card-description">${esc(o.short_description||o.metric.metric_description||o.metric.metric_name)}</p>
      </div>${matchBlock}</div>
      <div class="card-details">
        <div><span class="detail-label">Skill Needed</span><div class="skill-row">${skillTags(o)}</div></div>
        <div><span class="detail-label">Contribution Mode</span><div class="mode-row">${modeTags(o)}</div></div>
      </div>
      <div class="card-footer"><div><span class="hours-note">${esc(hoursText(o))}</span>
        ${app?`<span class="application-status">Application: ${esc(app.status)}</span>`:""}</div>
        <button class="primary" data-join="${o.id}" ${app&&app.status!=="withdrawn"?"disabled":""}>${app?"Already Applied":"Join"}</button>
      </div>
    </article>`;
  }).join("");

  els.list.querySelectorAll("[data-join]").forEach(btn=>btn.addEventListener("click",async()=>{
    const o=state.opportunities.find(x=>Number(x.id)===Number(btn.dataset.join));if(o)await beginJoin(o);
  }));
}

function renderMode(){
  const cap=state.mode==="capacity";
  els.modeKpi.classList.toggle("active",!cap);els.modeCapacity.classList.toggle("active",cap);
  els.kpiFilters.hidden=cap;els.capacityFilters.hidden=!cap;
  const u=new URL(location.href);u.searchParams.set("mode",state.mode);history.replaceState(null,"",u);
  applyFilters();
}

async function beginJoin(o){
  state.selectedOpportunity=o;
  if(!state.session?.user){await signIn(o.id);return;}
  if(!state.profile){
    sessionStorage.setItem("saiVolunteerPendingJoin",String(o.id));state.pendingJoinId=String(o.id);
    openProfile("Lengkapi profile dulu. Setelah disimpan, form Join akan dibuka otomatis.");return;
  }
  openJoin(o);
}

function openProfile(context="Profile ini dipakai untuk matching dan aplikasi volunteer."){
  if(!state.session?.user)return;
  els.profileContext.textContent=context;
  const u=state.session.user;
  els.profileEmail.value=u.email||"";
  els.profileName.value=state.profile?.display_name||u.user_metadata?.full_name||"";
  els.profileBackground.value=state.profile?.professional_background||"";
  els.profileOrg.value=state.profile?.current_organization||"";
  els.profileTime.value=approxBucket(state.profile?.available_hours_month||3);
  els.profileContact.checked=state.profile?.willing_to_be_contacted!==false;
  els.profileAdvisor.checked=state.profileModes.includes("advisor_sme");
  els.profileOperational.checked=state.profileModes.includes("operational_execution");
  els.profileLead.checked=state.profileModes.includes("project_lead");
  els.profileSkills.innerHTML=state.skills.map(s=>`<label class="skill-chip">
    <input type="checkbox" data-profile-skill="${s.id}" ${state.profileSkillIds.includes(Number(s.id))?"checked":""}>
    <span>${esc(s.skill_family)} · ${esc(s.skill_name)}</span></label>`).join("");
  message(els.profileMessage,"");els.profileModal.hidden=false;
}

function profileModes(){
  const a=[];if(els.profileAdvisor.checked)a.push("advisor_sme");
  if(els.profileOperational.checked)a.push("operational_execution");
  if(els.profileLead.checked)a.push("project_lead");return a;
}
async function replaceRows(table,uid,rows){
  const {error:de}=await db.from(table).delete().eq("user_id",uid);if(de)throw de;
  if(rows.length){const {error}=await db.from(table).insert(rows);if(error)throw error;}
}

async function saveProfile(){
  const u=state.session?.user;if(!u)throw new Error("Login Google dulu.");
  const p={user_id:u.id,email:u.email,display_name:els.profileName.value.trim(),
    professional_background:els.profileBackground.value.trim(),
    current_organization:els.profileOrg.value.trim()||null,
    available_hours_month:Number(els.profileTime.value),
    willing_to_be_contacted:els.profileContact.checked,is_active:true};
  const {error}=await db.from("volunteer_profiles").upsert(p,{onConflict:"user_id"});if(error)throw error;
  const ids=[...els.profileSkills.querySelectorAll("input[data-profile-skill]:checked")].map(x=>Number(x.dataset.profileSkill));
  const modes=profileModes();
  await Promise.all([
    replaceRows("volunteer_profile_skills",u.id,ids.map(skill_id=>({user_id:u.id,skill_id}))),
    replaceRows("volunteer_profile_contribution_modes",u.id,modes.map(contribution_mode=>({user_id:u.id,contribution_mode})))
  ]);
  state.profile=p;state.profileSkillIds=ids;state.profileModes=modes;renderAuth();
}

function openJoin(o){
  state.selectedOpportunity=o;els.joinTitle.textContent=o.opportunity_title;
  els.joinContext.innerHTML=`<strong>${esc(o.kpi.id)}</strong> · ${esc(o.kpi.title)}<br>Metric: ${esc(o.metric.metric_name)}<br>${esc(hoursText(o))}`;
  els.joinMode.innerHTML=o.modes.map(m=>`<option value="${esc(m)}">${esc(MODE_LABELS[m]||m)}</option>`).join("");
  const pref=o.modes.find(m=>state.profileModes.includes(m));if(pref)els.joinMode.value=pref;
  els.joinHours.value=Math.max(Number(o.min_hours_month||.5),Number(state.profile?.available_hours_month||1));
  els.joinMotivation.value="";els.joinCommitment.checked=false;
  els.joinContact.checked=state.profile?.willing_to_be_contacted!==false;
  message(els.joinMessage,"");els.joinModal.hidden=false;
}

async function submitApplication(){
  const o=state.selectedOpportunity,u=state.session?.user;
  if(!o||!u||!state.profile)throw new Error("Profile atau opportunity tidak tersedia.");
  const payload={opportunity_id:o.id,user_id:u.id,contribution_mode:els.joinMode.value,
    offered_hours_month:Number(els.joinHours.value),motivation:els.joinMotivation.value.trim()||null,
    commitment_confirmed:els.joinCommitment.checked,contact_consent:els.joinContact.checked,status:"pending"};
  const {error}=await db.from("volunteer_applications").insert(payload);if(error)throw error;
  await loadUserData();els.joinModal.hidden=true;
  sessionStorage.removeItem("saiVolunteerPendingJoin");state.pendingJoinId=null;
  els.thankCopy.textContent=`${o.opportunity_title} · Status: Awaiting Review`;
  els.thankModal.hidden=false;renderAuth();applyFilters();
}

async function useProfile(){
  if(!state.session?.user){await signIn();return;}
  if(!state.profile){openProfile("Lengkapi profile supaya filter Personal Capacity bisa diisi otomatis.");return;}
  const fam=new Set(state.skills.filter(s=>state.profileSkillIds.includes(Number(s.id))).map(s=>s.skill_family));
  els.talentPools.querySelectorAll("input[data-family]").forEach(x=>x.checked=fam.has(x.dataset.family));
  els.capTime.value=approxBucket(state.profile.available_hours_month);
  els.capAdvisor.checked=state.profileModes.includes("advisor_sme");
  els.capOperational.checked=state.profileModes.includes("operational_execution");
  els.capLead.checked=state.profileModes.includes("project_lead");applyFilters();
}

async function handlePending(){
  if(!state.pendingJoinId||!state.session?.user)return;
  const o=state.opportunities.find(x=>String(x.id)===String(state.pendingJoinId));
  if(!o){sessionStorage.removeItem("saiVolunteerPendingJoin");state.pendingJoinId=null;return;}
  if(!state.profile){openProfile("Lengkapi profile dulu. Setelah disimpan, form Join akan dibuka otomatis.");return;}
  openJoin(o);
}

function resetKpi(){
  els.search.value="";els.cluster.value="";els.skill.value="";els.priority.value="";els.activity.value="";applyFilters();
}
function resetCapacity(){
  els.talentPools.querySelectorAll("input[data-family]").forEach(x=>x.checked=false);
  els.capTime.value="";els.capAdvisor.checked=false;els.capOperational.checked=false;
  els.capLead.checked=false;els.capPriority.checked=false;els.capActive.checked=false;applyFilters();
}

// Events
els.modeKpi.onclick=()=>{state.mode="kpi";renderMode();};
els.modeCapacity.onclick=()=>{state.mode="capacity";renderMode();};
[els.search,els.cluster,els.skill,els.priority,els.activity].forEach(x=>x.addEventListener(x.tagName==="INPUT"?"input":"change",applyFilters));
[els.capTime,els.capAdvisor,els.capOperational,els.capLead,els.capPriority,els.capActive].forEach(x=>x.addEventListener("change",applyFilters));
els.resetKpi.onclick=resetKpi;els.resetCapacity.onclick=resetCapacity;
els.useProfile.onclick=async()=>{try{await useProfile();}catch(e){alert(e.message);}};
els.login.onclick=async()=>{try{await signIn();}catch(e){alert(e.message);}};
els.logout.onclick=async()=>{await db.auth.signOut({scope:"local"});state.session=null;state.profile=null;state.profileSkillIds=[];state.profileModes=[];state.applications=[];renderAuth();renderList();};
els.profileBtn.onclick=()=>openProfile();
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{if(b.dataset.close==="profile")els.profileModal.hidden=true;if(b.dataset.close==="join")els.joinModal.hidden=true;});
els.profileForm.onsubmit=async e=>{e.preventDefault();message(els.profileMessage,"Saving…");try{await saveProfile();message(els.profileMessage,"Profile tersimpan.","success");els.profileModal.hidden=true;if(state.pendingJoinId)await handlePending();}catch(err){message(els.profileMessage,err.message,"error");}};
els.joinForm.onsubmit=async e=>{e.preventDefault();message(els.joinMessage,"Submitting…");try{await submitApplication();}catch(err){message(els.joinMessage,err.message,"error");}};
els.exploreMore.onclick=()=>els.thankModal.hidden=true;
els.imDone.onclick=()=>location.href="volunteer.html";

db.auth.onAuthStateChange(async(_event,session)=>{
  state.session=session;await loadUserData();renderAuth();renderList();if(session)await handlePending();
});

(async()=>{
  try{
    const {data,error}=await db.auth.getSession();if(error)throw error;state.session=data.session;
    await loadSkills();await loadOpportunities();await loadUserData();populateFilters();renderAuth();renderMode();
    if(state.session)await handlePending();
  }catch(e){
    console.error(e);
    els.list.innerHTML=`<div class="empty-card">Opportunity Explorer gagal dimuat: ${esc(e.message)}</div>`;
  }
})();
