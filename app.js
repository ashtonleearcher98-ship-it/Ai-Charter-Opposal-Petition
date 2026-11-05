/* Greenwick Petition — secure client for a moderated Supabase petition.
   Publishable/anon keys are intentionally public. Never place service-role keys here. */
'use strict';

const CONFIG = Object.freeze({
  url: 'https://scglydnqfaitasfwjucj.supabase.co',
  publicKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjZ2x5ZG5xZmFpdGFzZndqdWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NTM5NzgsImV4cCI6MjEwOTMyOTk3OH0.4Z2PE8IGwV3tkC5ocq28peN-GRo47xaUfo09_F3f2Wk'
});
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readableDate = (v) => new Date(v).toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});
let adminSession = null;
let toastTimeout;

function showToast(message){
  const el=$('#toast');
  if(!el)return;
  el.textContent=message;
  el.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>el.classList.remove('visible'),3700);
}
function showAlert(selector, message, positive=false){
  const el=$(selector);
  if(!el)return;
  el.hidden=false;
  el.textContent=message;
  el.classList.toggle('success',positive);
}
function clearAlert(selector){const el=$(selector);if(el){el.hidden=true;el.textContent='';}}
function isEmail(email){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}

async function request(path,{method='GET',body,token=CONFIG.publicKey,headers={}}={}){
  const response=await fetch(CONFIG.url+path,{
    method, mode:'cors',
    headers:{
      apikey:CONFIG.publicKey,
      Authorization:'Bearer '+token,
      ...((body!==undefined)?{'Content-Type':'application/json'}:{}),
      ...headers,
    },
    ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  let data=null;
  const raw=await response.text();
  try{data=raw?JSON.parse(raw):null}catch{data={message:raw}}
  if(!response.ok){
    const error=new Error(data?.message || data?.error_description || data?.msg || 'Request failed. Please try again.');
    error.status=response.status;
    error.code=data?.code || '';
    throw error;
  }
  return data;
}

function getGoal(count){
  const goals=[25,50,100,250,500,1000,2500,5000,10000,25000];
  return goals.find(x=>x>count) || Math.ceil((count+1)/25000)*25000;
}
async function loadMetrics(){
  try{
    const rows=await request('/rest/v1/ai_petition_metrics?select=approved_count&id=eq.1');
    const count=Number(rows?.[0]?.approved_count??0);
    const goal=getGoal(count);
    $('#signature-count').textContent=count.toLocaleString();
    $('#signature-goal').textContent=goal.toLocaleString()+' signatures';
    $('#goal-percentage').textContent=Math.round(count/goal*100)+'% of goal';
    $('#progress-fill').style.width=Math.min(count/goal*100,100)+'%';
    $('#supporter-total-label').textContent=count.toLocaleString()+' approved';
  }catch(error){
    console.warn('Unable to load count:',error.message);
    $('#signature-count').textContent='—';
    $('#supporter-total-label').textContent='Count unavailable';
  }
}
async function loadSupporters(){
  const list=$('#supporters-list');
  try{
    const rows=await request('/rest/v1/ai_petition_public_signers?select=representative_name,nation_name,nation_role,representative_type,approved_at&order=approved_at.desc&limit=12');
    if(!rows.length){
      list.innerHTML='<div class="empty-list"><span class="empty-icon">◎</span><p>Approved public supporters will appear here.</p><small>Be among the first to sign.</small></div>';
      return;
    }
    list.innerHTML=rows.map(row=>{
      const initials=String(row.representative_name||'S').split(/\s+/).slice(0,2).map(p=>p.charAt(0)).join('').toUpperCase();
      const place=row.representative_type==='individual'?'Individual supporter':row.nation_name;
      return '<div class="supporter-row"><span class="supporter-avatar">'+escapeHtml(initials)+'</span><div><strong>'+escapeHtml(row.representative_name)+'</strong><p>'+escapeHtml(place)+' · '+escapeHtml(row.nation_role)+'</p></div><time>'+escapeHtml(readableDate(row.approved_at))+'</time></div>';
    }).join('');
  }catch(error){
    console.warn('Unable to load supporters:',error.message);
    list.innerHTML='<div class="empty-list">Public supporter list unavailable right now.</div>';
  }
}
async function loadUpdates(){
  const container=$('#updates-list');
  try{
    const rows=await request('/rest/v1/ai_petition_updates?select=id,title,body,created_at&published=eq.true&order=created_at.desc&limit=10');
    container.innerHTML=rows.length?rows.map(row=>
      '<article class="update-card"><time>'+escapeHtml(readableDate(row.created_at))+'</time><h3>'+escapeHtml(row.title)+'</h3><p>'+escapeHtml(row.body)+'</p></article>'
    ).join(''):'<div class="empty-list">Updates will appear here.</div>';
  }catch(error){
    console.warn('Unable to load updates:',error.message);
    container.innerHTML='<div class="empty-list">Campaign updates unavailable at the moment.</div>';
  }
}

function updateSignerType(){
  const nation=$('input[name="representative_type"]:checked')?.value==='nation';
  $('#nation-field').hidden=!nation;
  $('#role-field').hidden=!nation;
  $('#authority-box').hidden=!nation;
  $('#nation_name').required=nation;
  $('#nation_role').required=nation;
  $('#nation_authorized').required=nation;
  $('#type-nation-label').classList.toggle('selected',nation);
  $('#type-individual-label').classList.toggle('selected',!nation);
}
async function submitPetition(event){
  event.preventDefault();
  clearAlert('#form-alert');
  const form=event.currentTarget;
  const btn=$('#submit-button');
  const type=$('input[name="representative_type"]:checked').value;
  const nation=type==='nation';
  const payload={
    representative_name:$('#representative_name').value.trim(),
    email:$('#email').value.trim().toLowerCase(),
    nation_name:nation?$('#nation_name').value.trim():'Independent supporter',
    nation_role:nation?$('#nation_role').value.trim():'Individual supporter',
    region:$('#region').value.trim()||null,
    statement:$('#statement').value.trim()||null,
    representative_type:type,
    nation_authorized:nation?$('#nation_authorized').checked:false,
    show_public:$('#show_public').checked,
    consent:$('#consent').checked
  };
  if(!form.checkValidity()){
    form.reportValidity();
    showAlert('#form-alert','Please complete the required fields before signing.');
    return;
  }
  if(payload.representative_name.length<2 || !isEmail(payload.email) || payload.nation_name.length<2 || payload.nation_role.length<2){
    showAlert('#form-alert','Please check your name, email and affiliation details.');
    return;
  }
  if(nation&&!payload.nation_authorized){
    showAlert('#form-alert','Please confirm you are authorised to represent the nation or organisation.');
    return;
  }
  if(!payload.consent){
    showAlert('#form-alert','Please agree to the petition and privacy statement.');
    return;
  }
  btn.disabled=true;btn.textContent='Submitting…';
  try{
    await request('/rest/v1/ai_petition_signatures',{method:'POST',body:payload,headers:{Prefer:'return=minimal'}});
    $('#petition-form').hidden=true;
    $('#signature-success').hidden=false;
    showToast('Signature submitted for review.');
  }catch(error){
    const duplicate=error.status===409 || error.code==='23505';
    showAlert('#form-alert',duplicate?'This email address has already submitted a signature.':'Unable to submit your signature. '+(error.status===0?'Check your connection.':'Please check the fields and try again.'));
  }finally{
    btn.disabled=false;btn.innerHTML='Sign this petition <span aria-hidden="true">↗</span>';
  }
}
async function sharePetition(){
  const url=location.origin+location.pathname;
  const title='Keep micronationalism free — Sign the petition';
  try{
    if(navigator.share && !navigator.userAgent.includes('Firefox')){
      await navigator.share({title,text:'Support a reconsideration of Article V of the AI Charter.',url});
    }else if(navigator.clipboard){
      await navigator.clipboard.writeText(url);
      showToast('Petition link copied.');
    }else{window.prompt('Copy this petition link',url);}
  }catch(error){if(error.name!=='AbortError')showToast('Unable to share. Try copying the page URL.');}
}
function setupMobileNav(){
  const btn=$('.mobile-menu-toggle');const menu=$('#mobile-nav');
  btn.addEventListener('click',()=>{
    const expanded=btn.getAttribute('aria-expanded')==='true';
    btn.setAttribute('aria-expanded',String(!expanded));
    menu.hidden=expanded;
  });
  $$('#mobile-nav a').forEach(link=>link.addEventListener('click',()=>{menu.hidden=true;btn.setAttribute('aria-expanded','false');}));
}

function adminState(show){
  $('#admin-root').hidden=!show;
  document.body.style.overflow=show?'hidden':'';
  if(show){window.scrollTo({top:0,behavior:'instant'});}
}
function onHashChange(){
  adminState(location.hash==='#admin');
  if(location.hash==='#admin'&&adminSession){loadAdminDashboard();}
}
async function adminLogin(event){
  event.preventDefault();
  clearAlert('#admin-login-status');
  const btn=$('#admin-login-btn');btn.disabled=true;btn.textContent='Signing in…';
  const email=$('#admin-email').value.trim().toLowerCase();
  const password=$('#admin-password').value;
  try{
    const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
    if(!data.access_token || !data.user?.id)throw new Error('No session returned.');
    const admins=await request('/rest/v1/ai_petition_admins?select=user_id&user_id=eq.'+encodeURIComponent(data.user.id),{token:data.access_token});
    if(!admins.length)throw new Error('This account is not authorised to moderate this petition.');
    adminSession={token:data.access_token,refreshToken:data.refresh_token,userId:data.user.id,expiresAt:Date.now()+((data.expires_in||3600)-60)*1000};
    $('#admin-login-panel').hidden=true;
    $('#admin-dashboard').hidden=false;
    await loadAdminDashboard();
  }catch(error){showAlert('#admin-login-status',error.message||'Sign-in failed.');}
  finally{btn.disabled=false;btn.textContent='Sign in securely';}
}
async function ensureAdminToken(){
  if(!adminSession)throw new Error('Sign in again.');
  if(Date.now()<adminSession.expiresAt)return adminSession.token;
  const response=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:adminSession.refreshToken}});
  adminSession.token=response.access_token;
  adminSession.refreshToken=response.refresh_token;
  adminSession.expiresAt=Date.now()+((response.expires_in||3600)-60)*1000;
  return adminSession.token;
}
async function loadAdminDashboard(){
  clearAlert('#admin-status');
  const container=$('#admin-submissions');
  container.innerHTML='<p>Loading pending signatures…</p>';
  try{
    const token=await ensureAdminToken();
    const rows=await request('/rest/v1/ai_petition_signatures?select=id,representative_name,nation_name,nation_role,email,region,statement,representative_type,nation_authorized,show_public,status,created_at&order=created_at.desc&limit=150',{token});
    if(!rows.length){container.innerHTML='<p class="empty-list">No submissions yet.</p>';return;}
    container.innerHTML=rows.map(row=>{
      const statusText=row.status==='pending'?'Pending review':row.status==='approved'?'Approved':'Declined';
      const buttons=row.status==='pending'?'<div class="admin-buttons"><button data-review="approved" data-id="'+escapeHtml(row.id)+'">Approve signature</button><button class="decline" data-review="declined" data-id="'+escapeHtml(row.id)+'">Decline</button></div>':'';
      return '<article class="admin-row"><h3>'+escapeHtml(row.representative_name)+'</h3><p class="personal-data">'+escapeHtml(row.nation_name)+' · '+escapeHtml(row.nation_role)+'</p><p>'+escapeHtml(row.email)+' · '+escapeHtml(row.region||'Region not provided')+'</p><p>Type: '+escapeHtml(row.representative_type)+' · Public listing: '+(row.show_public?'Yes':'No')+' · Authority confirmed: '+(row.nation_authorized?'Yes':'No')+'</p><p>Status: <strong>'+statusText+'</strong> · Submitted '+escapeHtml(readableDate(row.created_at))+'</p>'+(row.statement?'<p>“'+escapeHtml(row.statement)+'”</p>':'')+buttons+'</article>';
    }).join('');
    $$('[data-review]').forEach(btn=>btn.addEventListener('click',()=>reviewSubmission(btn.dataset.id,btn.dataset.review)));
  }catch(error){
    container.innerHTML='<div class="empty-list">Could not load submissions.</div>';
    showAlert('#admin-status',error.message);
  }
}
async function reviewSubmission(id,status){
  if(!adminSession)return;
  if(!['approved','declined'].includes(status))return;
  const question=status==='approved'?'Approve this signature for the public count?':'Decline this signature?';
  if(!confirm(question))return;
  try{
    const token=await ensureAdminToken();
    await request('/rest/v1/ai_petition_signatures?id=eq.'+encodeURIComponent(id),{method:'PATCH',token,body:{status,reviewed_at:new Date().toISOString(),reviewed_by:adminSession.userId},headers:{Prefer:'return=minimal'}});
    showAlert('#admin-status','Submission '+status+'.',true);
    await Promise.all([loadAdminDashboard(),loadMetrics(),loadSupporters()]);
  }catch(error){showAlert('#admin-status',error.message);}
}
async function publishUpdate(event){
  event.preventDefault();
  const title=$('#admin-update-title').value.trim();
  const body=$('#admin-update-body').value.trim();
  if(title.length<5||body.length<20)return;
  try{
    const token=await ensureAdminToken();
    await request('/rest/v1/ai_petition_updates',{method:'POST',token,body:{title,body,published:true},headers:{Prefer:'return=minimal'}});
    event.currentTarget.reset();
    showAlert('#admin-status','Update published successfully.',true);
    await loadUpdates();
  }catch(error){showAlert('#admin-status',error.message);}
}
function setupAdmin(){
  $('#admin-close').addEventListener('click',()=>{history.pushState('',document.title,location.pathname+location.search);adminState(false);});
  $('#admin-login-form').addEventListener('submit',adminLogin);
  $('#admin-refresh').addEventListener('click',loadAdminDashboard);
  $('#admin-update-form').addEventListener('submit',publishUpdate);
  $('#admin-signout').addEventListener('click',async()=>{
    if(adminSession){try{await request('/auth/v1/logout',{method:'POST',token:adminSession.token});}catch{}}
    adminSession=null;
    $('#admin-dashboard').hidden=true;
    $('#admin-login-panel').hidden=false;
    $('#admin-password').value='';
    showToast('Signed out.');
  });
  $$('[data-admin-tab]').forEach(button=>button.addEventListener('click',()=>{
    $$('[data-admin-tab]').forEach(el=>el.classList.toggle('active',el===button));
    $('#admin-submissions-view').hidden=button.dataset.adminTab!=='submissions';
    $('#admin-updates-view').hidden=button.dataset.adminTab!=='updates';
  }));
  window.addEventListener('hashchange',onHashChange);
  onHashChange();
}

document.addEventListener('DOMContentLoaded',()=>{
  setupMobileNav();
  $$('[data-share]').forEach(button=>button.addEventListener('click',sharePetition));
  $$('input[name="representative_type"]').forEach(input=>input.addEventListener('change',updateSignerType));
  updateSignerType();
  $('#petition-form').addEventListener('submit',submitPetition);
  setupAdmin();
  loadMetrics();loadSupporters();loadUpdates();
});
