const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);

const state = { session:null, profile:null, skills:[], skillIds:[], modes:[] };

const els = {
  byKpi:$("by-kpi"), byCapacity:$("by-capacity"),
  login:$("login"), logout:$("logout"),
  authTitle:$("auth-title"), authCopy:$("auth-copy"),
  profile:$("profile"), form:$("profile-form"),
  name:$("name"), email:$("email"), background:$("background"),
  org:$("org"), hours:$("hours"), advisor:$("advisor"), ops:$("ops"),
  lead:$("lead"), skills:$("skills"), contact:$("contact"), msg:$("msg")
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
  if(!state.skills.length){els.skills.innerHTML="<span>Skill catalog belum di-seed.</span>";return;}
  els.skills.innerHTML=state.skills.map(s=>`
    <label class="skill"><input type="checkbox" data-skill="${s.id}" ${state.skillIds.includes(Number(s.id))?"checked":""}>
    ${s.skill_family} · ${s.skill_name}</label>`).join("");
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
}

els.byKpi.onclick=()=>location.href="opportunities.html?mode=kpi";
els.byCapacity.onclick=()=>location.href="opportunities.html?mode=capacity";
els.login.onclick=async()=>{try{await signIn();}catch(e){alert(e.message);}};
els.logout.onclick=async()=>{await db.auth.signOut({scope:"local"});state.session=null;await render();};
els.form.onsubmit=async e=>{
  e.preventDefault();els.msg.textContent="Saving…";
  try{await saveProfile();els.msg.textContent="Profile berhasil disimpan.";}
  catch(err){els.msg.textContent=err.message;}
};

db.auth.onAuthStateChange(async(_event,session)=>{state.session=session;await render();});
(async()=>{
  const {data,error}=await db.auth.getSession();if(error)return console.error(error);
  state.session=data.session;await render();
})();
