const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);

const state = { session:null, profile:null, skills:[], skillIds:[], modes:[] };

const els = {
  login:$("login"), logout:$("logout"),
  authTitle:$("auth-title"), authCopy:$("auth-copy"),
  profile:$("profile"), form:$("profile-form"),
  name:$("name"), email:$("email"), background:$("background"),
  org:$("org"), hours:$("hours"), advisor:$("advisor"), ops:$("ops"),
  lead:$("lead"), skills:$("skills"), contact:$("contact"), msg:$("msg"),
  matchModal:$("profile-match-modal"),
  matchSummary:$("profile-match-summary"),
  matchedProjectCount:$("matched-project-count"),
  activeProjectCount:$("active-project-count"),
  closeMatchModal:$("close-match-modal")
};

const approxBucket = h => {
  const n=Number(h||0);
  return n<2?"1":n<=4?"3":n<=8?"6.5":n<=16?"12.5":"20";
};

async function signIn(){
  const redirectTo=`${location.origin}${location.pathname}`;
  const {error}=await db.auth.signInWithOAuth({provider:"google",options:{redirectTo}});
  if(error)throw error;
}

async function loadUserData(){
  if(!state.session?.user){state.profile=null;state.skills=[];state.skillIds=[];state.modes=[];return;}
  const uid=state.session.user.id;
  const [p,c,s,m]=await Promise.all([
    db.from("volunteer_profiles")
      .select("user_id,email,display_name,professional_background,current_organization,available_hours_month,willing_to_be_contacted")
      .eq("user_id",uid).maybeSingle(),
    db.from("skill_catalog").select("id,skill_family,skill_name,sort_order")
      .eq("is_active",true).order("skill_family").order("sort_order"),
    db.from("volunteer_profile_skills").select("skill_id").eq("user_id",uid),
    db.from("volunteer_profile_contribution_modes").select("contribution_mode").eq("user_id",uid)
  ]);
  for(const r of[p,c,s,m])if(r.error)throw r.error;
  state.profile=p.data||null;
  state.skills=c.data||[];
  state.skillIds=(s.data||[]).map(x=>Number(x.skill_id));
  state.modes=(m.data||[]).map(x=>x.contribution_mode);
}

function renderSkills(){
  if(!state.skills.length){
    els.skills.innerHTML="<span>Skill catalog belum di-seed.</span>";
    return;
  }

  const byFamily=new Map();
  for(const skill of state.skills){
    if(!byFamily.has(skill.skill_family))byFamily.set(skill.skill_family,[]);
    byFamily.get(skill.skill_family).push(skill);
  }

  els.skills.innerHTML=`
    <div class="skill-tree">
      ${[...byFamily.entries()].map(([family,skills])=>{
        const selectedCount=skills.filter(skill=>
          state.skillIds.includes(Number(skill.id))
        ).length;

        return `
          <details class="skill-family" ${selectedCount?"open":""}>
            <summary>
              <span>${family}</span>
              <span class="skill-family-count">
                ${selectedCount?`${selectedCount} dipilih · `:""}${skills.length} skill
              </span>
            </summary>
            <div class="skill-family-body">
              ${skills.map(skill=>`
                <label class="skill-option">
                  <input type="checkbox" data-skill="${skill.id}"
                    ${state.skillIds.includes(Number(skill.id))?"checked":""}>
                  <span>${skill.skill_name}</span>
                </label>
              `).join("")}
            </div>
          </details>
        `;
      }).join("")}
    </div>
  `;
}

async function render(){
  if(!state.session?.user){
    els.authTitle.textContent="Belum login";
    els.authCopy.textContent="Browse boleh tanpa login. Login diperlukan untuk profile dan Join.";
    els.login.hidden=false;els.logout.hidden=true;els.profile.hidden=true;return;
  }
  await loadUserData();
  const u=state.session.user;
  els.authTitle.textContent=state.profile?.display_name||u.user_metadata?.full_name||u.email;
  els.authCopy.textContent=u.email||"";
  els.login.hidden=true;els.logout.hidden=false;els.profile.hidden=false;

  els.email.value=u.email||"";
  els.name.value=state.profile?.display_name||u.user_metadata?.full_name||"";
  els.background.value=state.profile?.professional_background||"";
  els.org.value=state.profile?.current_organization||"";
  els.hours.value=approxBucket(state.profile?.available_hours_month||3);
  els.contact.checked=state.profile?.willing_to_be_contacted!==false;
  els.advisor.checked=state.modes.includes("advisor_sme");
  els.ops.checked=state.modes.includes("operational_execution");
  els.lead.checked=state.modes.includes("project_lead");
  renderSkills();
}

async function replaceRows(table,uid,rows){
  const {error:de}=await db.from(table).delete().eq("user_id",uid);if(de)throw de;
  if(rows.length){const {error}=await db.from(table).insert(rows);if(error)throw error;}
}


function metricProgress(metric){
  if(metric.progress_pct!==null&&metric.progress_pct!==undefined){
    return Math.max(0,Math.min(100,Number(metric.progress_pct)));
  }
  if(metric.actual===null||metric.actual===undefined)return null;

  const actual=Number(metric.actual);
  const target=metric.target==null?null:Number(metric.target);
  const baseline=metric.baseline==null?null:Number(metric.baseline);

  switch(metric.measurement_direction){
    case "binary":
      return actual>=1?100:0;
    case "milestone":
      return target
        ? Math.max(0,Math.min(100,(actual/target)*100))
        : Math.max(0,Math.min(100,actual));
    case "higher_is_better":
      if(target===null)return null;
      if(baseline!==null&&target!==baseline){
        return Math.max(
          0,
          Math.min(100,((actual-baseline)/(target-baseline))*100)
        );
      }
      return target>0
        ? Math.max(0,Math.min(100,(actual/target)*100))
        : null;
    case "lower_is_better":
      if(baseline===null||target===null||baseline===target)return null;
      return Math.max(
        0,
        Math.min(100,((baseline-actual)/(baseline-target))*100)
      );
    case "target_is_exact":
      return target!==null&&actual===target?100:0;
    default:
      return null;
  }
}

function projectActivityState(projectMetrics,isActiveManual){
  const metrics=Array.isArray(projectMetrics)?projectMetrics:[];

  if(!metrics.length){
    return isActiveManual?"active":"not_active";
  }

  const progressValues=metrics.map(metricProgress);

  const completed=
    progressValues.length>0 &&
    progressValues.every(
      progress=>progress!==null&&progress>=100
    );

  if(completed)return "completed";

  const hasProgress=progressValues.some(
    progress=>progress!==null&&progress>0
  );

  return isActiveManual||hasProgress
    ? "active"
    : "not_active";
}

async function calculateProfileMatches(skillIds,modes,availableHours){
  const {data,error}=await db.rpc(
    "get_open_volunteer_opportunities"
  );

  if(error){
    console.error("Profile match calculation failed:",error);
    return {
      matchedProjects:0,
      activeProjects:0,
      calculationAvailable:false
    };
  }

  const projects=new Map();

  for(const opportunity of data||[]){
    const opportunitySkills=Array.isArray(opportunity.skills)
      ? opportunity.skills
      : [];

    const opportunityModes=Array.isArray(opportunity.contribution_modes)
      ? opportunity.contribution_modes
      : [];

    // Skill overlap is required so the recommendation has a real capability basis.
    const skillMatch=opportunitySkills.some(skill=>
      skillIds.includes(Number(skill.id))
    );

    // No selected mode means "no preference", rather than "match nothing".
    const modeMatch=
      !modes.length ||
      !opportunityModes.length ||
      opportunityModes.some(mode=>modes.includes(mode));

    const minimumHours=Number(opportunity.min_hours_month||0);
    const timeMatch=Number(availableHours||0)>=minimumHours;

    if(!skillMatch||!modeMatch||!timeMatch)continue;

    const kpiId=opportunity.kpi_id;

    if(!projects.has(kpiId)){
      projects.set(kpiId,{
        active:
          projectActivityState(
            opportunity.kpi_metrics,
            Boolean(opportunity.kpi_is_active_manual)
          )==="active"
      });
    }
  }

  const values=[...projects.values()];

  return {
    matchedProjects:values.length,
    activeProjects:values.filter(project=>project.active).length,
    calculationAvailable:true
  };
}

function showProfileMatchModal(result){
  els.matchedProjectCount.textContent=result.matchedProjects;
  els.activeProjectCount.textContent=result.activeProjects;

  if(!result.calculationAvailable){
    els.matchSummary.textContent=
      "Profile kamu sudah tersimpan. Matching opportunity belum bisa dihitung saat ini, tapi kamu tetap bisa melihat opportunity yang tersedia.";
  }else if(result.matchedProjects===0){
    els.matchSummary.textContent=
      "Profile kamu sudah tersimpan. Saat ini belum ada open project yang match langsung dengan kombinasi skill, contribution mode, dan waktu yang kamu pilih.";
  }else{
    els.matchSummary.textContent=
      `Profile kamu match dengan ${result.matchedProjects} project di SAI, `+
      `${result.activeProjects} di antaranya sedang aktif berjalan. `+
      `Klik Cari Opportunity untuk melihat project yang paling sesuai dengan profile kamu.`;
  }

  els.matchModal.hidden=false;
}

async function saveProfile(){
  const u=state.session?.user;if(!u)throw new Error("Login Google dulu.");
  const profile={
    user_id:u.id,email:u.email,display_name:els.name.value.trim(),
    professional_background:els.background.value.trim(),
    current_organization:els.org.value.trim()||null,
    available_hours_month:Number(els.hours.value),
    willing_to_be_contacted:els.contact.checked,is_active:true
  };
  const {error}=await db.from("volunteer_profiles").upsert(profile,{onConflict:"user_id"});
  if(error)throw error;

  const skillIds=[...els.skills.querySelectorAll("input[data-skill]:checked")].map(x=>Number(x.dataset.skill));
  const modes=[];if(els.advisor.checked)modes.push("advisor_sme");if(els.ops.checked)modes.push("operational_execution");if(els.lead.checked)modes.push("project_lead");

  await Promise.all([
    replaceRows("volunteer_profile_skills",u.id,skillIds.map(skill_id=>({user_id:u.id,skill_id}))),
    replaceRows("volunteer_profile_contribution_modes",u.id,modes.map(contribution_mode=>({user_id:u.id,contribution_mode})))
  ]);
  state.profile=profile;state.skillIds=skillIds;state.modes=modes;

  return await calculateProfileMatches(
    skillIds,
    modes,
    profile.available_hours_month
  );
}

els.login.onclick=async()=>{
  try{
    els.login.disabled=true;
    els.login.textContent="Opening Google…";
    await signIn();
  }catch(e){
    console.error("Google sign-in failed:",e);
    alert(`Google sign-in failed: ${e.message}`);
    els.login.disabled=false;
    els.login.textContent="Continue with Google";
  }
};
els.logout.onclick=async()=>{await db.auth.signOut({scope:"local"});state.session=null;await render();};
els.form.onsubmit=async e=>{
  e.preventDefault();
  els.msg.textContent="Saving…";

  try{
    const matchResult=await saveProfile();
    els.msg.textContent="";
    showProfileMatchModal(matchResult);
  }catch(err){
    console.error(err);
    els.msg.textContent=err.message;
  }
};


els.closeMatchModal.onclick=()=>{
  els.matchModal.hidden=true;
};

els.matchModal.addEventListener("click",event=>{
  if(event.target===els.matchModal){
    els.matchModal.hidden=true;
  }
});

db.auth.onAuthStateChange(async(_event,session)=>{state.session=session;await render();});
(async()=>{
  const {data,error}=await db.auth.getSession();if(error)return console.error(error);
  state.session=data.session;await render();
})();
