/* Community petitions · Greenwick Micronational Voices
 * All claims of representation are self-declared. Public keys are intentional;
 * row-level security provides the access boundary for the API.
 */
(() => {
  'use strict';
  const ROOT = document.getElementById('community-root');
  const VIEW = document.getElementById('community-view');
  if (!ROOT || !VIEW) return;

  const E = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const D = (value) => new Date(value).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
  const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const categories = {community:'Community',micronationalism:'Micronationalism',governance:'Governance',technology:'Technology',culture:'Culture & arts',other:'Other'};
  const STORAGE_KEY='mv_community_session';
  const pageParams = new URLSearchParams(location.search);
  const viewType = pageParams.get('petition') ? 'detail' : (pageParams.get('view') || 'home');
  let session = null;
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) session = JSON.parse(saved);
  } catch { sessionStorage.removeItem(STORAGE_KEY); }

  const showNotice=(text,ok=false)=>{
    const el=document.getElementById('community-notice');
    if(!el)return;
    el.textContent=text;
    el.className='community-notice '+(ok?'notice-success':'notice-error');
    el.hidden=false;
  };
  const clearNotice=()=>{const el=document.getElementById('community-notice');if(el)el.hidden=true;};
  const submit=(body,token)=>request('/rest/v1/'+body.path,{
    method:body.method||'GET', token:token||CONFIG.publicKey,
    ...(body.data?{body:body.data}:{}),
    ...(body.data?{headers:{Prefer:'return=minimal'}}:{})
  });
  const sessionToken=async()=>{
    if(!session)throw new Error('Sign in to continue.');
    if(Date.now()<session.expiry)return session.access_token;
    const refreshed=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});
    if(!refreshed.access_token)throw new Error('Your session has expired. Please sign in again.');
    session={...session,...refreshed,user:refreshed.user||session.user,expiry:Date.now()+Math.max(1,(refreshed.expires_in||3600)-60)*1000};
    sessionStorage.setItem(STORAGE_KEY,JSON.stringify(session));
    return session.access_token;
  };
  const currentUser=()=>session?.user?.id;
  const publicUrl=(id)=>location.origin+location.pathname+'?petition='+encodeURIComponent(id);
  const createUrl='?view=create';
  const categoryOptions=Object.entries(categories).map(([value,name])=>'<option value="'+E(value)+'">'+E(name)+'</option>').join('');
  const publicBadge='<span class="community-public-badge">Self-declared support</span>';
  const markupCard=(p,metrics)=>{
    const count=metrics.get(p.id)||0;
    return '<a class="community-petition-card" href="?petition='+E(p.id)+'"><div class="community-petition-card-top"><span class="community-category">'+E(categories[p.category]||'Community')+'</span><span class="community-card-arrow">↗</span></div><div class="community-card-symbol">✦ <span>voices.</span></div><h3>'+E(p.title)+'</h3><p>'+E(p.summary)+'</p><div class="community-petition-card-foot"><div class="community-card-meter"><span style="width:'+Math.min(100,count/p.goal*100)+'%"></span></div><strong>'+count.toLocaleString()+' signatures</strong><span>by '+E(p.creator_name)+'</span></div></a>';
  };
  const featuredCard=()=>'<a class="community-feature-card" href="./#sign"><span class="feature-label">THE FEATURED CAMPAIGN</span><strong>Keep micronationalism free. <em>Oppose Article V.</em></strong><p>Support Greenwick’s call for voluntary AI standards and legislative independence.</p><span class="feature-button">Sign the featured petition ↗</span></a>';
  const shareButton=(url,title='Support this petition')=>{
    if(navigator.share) return navigator.share({title,url,text:'Add your voice to this petition.'}).catch(e=>{if(e.name!=='AbortError')console.warn(e)});
    if(navigator.clipboard)return navigator.clipboard.writeText(url).then(()=>showToast('Petition link copied.'));
    prompt('Copy this petition link:',url);
  };
  const pathQuery=(table,params)=>'/rest/v1/'+table+'?'+params;
  async function browse() {
    VIEW.innerHTML='<div class="community-pagehead"><div class="section-kicker">EXPLORE CAMPAIGNS</div><h1>Petitions started by <span>the community.</span></h1><p>Discover the ideas, issues and campaigns that matter to micronationalists around the world.</p><div class="community-page-actions"><a class="community-action-primary" href="'+createUrl+'">Start your own petition ↗</a><a class="community-action-secondary" href="./#sign">Featured campaign</a></div></div><div class="community-searchbox"><label for="community-search">Explore petitions</label><input id="community-search" type="search" placeholder="Search by topic, title, or campaign creator…" autocomplete="off"/></div><div id="community-cards" class="community-cards"><div class="community-loading">Loading community petitions…</div></div>';
    try{
      const [petitions,metricRows]=await Promise.all([
        request(pathQuery('ai_community_petitions','select=id,creator_name,title,summary,category,goal,created_at&status=eq.published&order=created_at.desc&limit=100')),
        request(pathQuery('ai_community_metrics','select=petition_id,signature_count'))
      ]);
      const metrics=new Map(metricRows.map(m=>[m.petition_id,Number(m.signature_count)]));
      const container=document.getElementById('community-cards');
      function draw(q=''){
        const filtered=petitions.filter(p=>[p.title,p.summary,p.creator_name,p.category].join(' ').toLowerCase().includes(q.trim().toLowerCase()));
        container.innerHTML=featuredCard()+filtered.map(p=>markupCard(p,metrics)).join('')+(filtered.length?'':'<div class="community-empty"><strong>No petitions matched.</strong><p>Try another search, or be the first to create a campaign.</p><a href="'+createUrl+'">Start a petition ↗</a></div>');
      }
      draw();
      document.getElementById('community-search').addEventListener('input',event=>draw(event.target.value));
    }catch(error){
      document.getElementById('community-cards').innerHTML=featuredCard()+'<div class="community-empty">Unable to load community petitions right now. Please try again.</div>';
    }
  }
  async function detail(id){
    if(!ID_RE.test(id)){VIEW.innerHTML='<div class="community-empty">Invalid petition link. <a href="?view=browse">Browse campaigns</a></div>';return;}
    VIEW.innerHTML='<div class="community-loading">Loading petition…</div>';
    try{
      const [rows,metricRows,publicRows,updates]=await Promise.all([
        request(pathQuery('ai_community_petitions','select=id,owner_id,creator_name,title,summary,body,category,goal,created_at&status=eq.published&id=eq.'+encodeURIComponent(id))),
        request(pathQuery('ai_community_metrics','select=signature_count&petition_id=eq.'+encodeURIComponent(id))),
        request(pathQuery('ai_community_public_signatures','select=signer_name,signer_affiliation,created_at&petition_id=eq.'+encodeURIComponent(id)+'&order=created_at.desc&limit=12')),
        request(pathQuery('ai_community_updates','select=title,body,created_at&petition_id=eq.'+encodeURIComponent(id)+'&order=created_at.desc&limit=10'))
      ]);
      if(!rows.length){VIEW.innerHTML='<div class="community-empty"><h2>Petition not found</h2><p>It may have been removed or the link may be incorrect.</p><a href="?view=browse">Browse all petitions ↗</a></div>';return;}
      const p=rows[0],count=Number(metricRows[0]?.signature_count??0);
      const text=p.body.split(/\n\s*\n/).filter(Boolean).map(par=>'<p>'+E(par).replace(/\n/g,'<br>')+'</p>').join('');
      const supporterList=publicRows.length?publicRows.map(s=>'<div class="community-support-row"><span class="community-support-avatar">'+E(s.signer_name.slice(0,1).toUpperCase())+'</span><div><strong>'+E(s.signer_name)+'</strong><span>'+E(s.signer_affiliation||'Supporter')+'</span></div><time>'+E(D(s.created_at))+'</time></div>').join(''):'<div class="community-empty-small">No supporters have chosen public display yet.</div>';
      VIEW.innerHTML='<div class="community-breadcrumb"><a href="?view=browse">← All petitions</a><span>/</span>'+E(categories[p.category]||'Community')+'</div>'+
        '<div class="community-detail-head"><span class="section-kicker">'+E(categories[p.category]||'Community')+' · COMMUNITY PETITION</span><h1>'+E(p.title)+'</h1><p>'+E(p.summary)+'</p><div class="community-author"><span class="community-author-avatar">'+E(p.creator_name.slice(0,1).toUpperCase())+'</span><div>Started by <strong>'+E(p.creator_name)+'</strong><span> · '+E(D(p.created_at))+'</span></div></div></div>'+
        '<div class="community-detail-layout"><div class="community-story">'+
          '<div class="community-hero-panel"><div class="community-hero-symbol">✦</div><span>A COMMUNITY PETITION</span><strong>'+E(p.title)+'</strong></div>'+
          '<section><div class="section-kicker">WHY THIS MATTERS</div><h2>The story behind this petition.</h2>'+text+'</section>'+
          '<div class="community-transparency"><strong>Transparency notice</strong><p>This is a user-created petition. Claims and affiliations are provided by the organiser and have not been independently verified by the platform. A signature expresses support, not an official diplomatic endorsement.</p></div>'+
          '<section id="community-supporters"><div class="section-kicker">PEOPLE SUPPORTING THIS</div><h2>Latest public signers</h2>'+supporterList+'</section>'+
          '<section id="community-updates"><div class="section-kicker">CAMPAIGN UPDATES</div><h2>Latest updates</h2>'+(updates.length?updates.map(u=>'<article class="community-update"><time>'+E(D(u.created_at))+'</time><h3>'+E(u.title)+'</h3><p>'+E(u.body).replace(/\n/g,'<br>')+'</p></article>').join(''):'<p class="community-no-updates">No updates yet.</p>')+'</section>'+
          (session?.user?.id===p.owner_id?'<div class="community-owner-update"><h3>Post a campaign update</h3><form id="community-update-form"><label for="community-update-title">Title</label><input id="community-update-title" maxlength="200" minlength="5" required/><label for="community-update-body">Update</label><textarea id="community-update-body" maxlength="3500" minlength="20" rows="4" required></textarea><button class="community-action-primary" type="submit">Publish update ↗</button></form></div>':'')+
        '</div>'+
        '<aside class="community-detail-side"><div class="community-side-card"><span class="section-kicker">MAKE IT COUNT</span><h2>Sign this petition</h2><div class="community-sign-total"><strong id="community-count">'+count.toLocaleString()+'</strong><span>signatures</span></div><div class="community-meter"><span id="community-meter-fill" style="width:'+Math.min(100,count/p.goal*100)+'%"></span></div><div class="community-meter-caption"><span id="community-progress">'+Math.round(count/p.goal*100)+'% of goal</span><span>'+p.goal.toLocaleString()+' goal</span></div>'+
        '<form id="community-sign-form">'+
          '<label for="community-signer">Your name <span>*</span></label><input id="community-signer" maxlength="120" minlength="2" autocomplete="name" placeholder="Full name" required/>'+
          '<label for="community-email">Email address <span>*</span></label><input id="community-email" type="email" maxlength="240" autocomplete="email" placeholder="Your email" required/><small>Never displayed publicly.</small>'+
          '<label for="community-affiliation">Micronation or affiliation <em>Optional</em></label><input id="community-affiliation" maxlength="160" placeholder="Nation / community"/>'+
          '<label class="community-check"><input id="community-show-name" type="checkbox" checked/><span>Display my name and affiliation publicly.</span></label>'+
          '<label class="community-check"><input id="community-sign-consent" type="checkbox" required/><span>I support this petition and consent to my signature being counted. I understand affiliations are self-declared.</span></label>'+
          '<p class="community-form-message" id="community-sign-message" hidden></p>'+
          '<button class="submit-button" type="submit" id="community-sign-button">Sign this petition ↗</button><p class="community-sign-note">Signatures count immediately. One signature per email per petition.</p>'+
        '</form><div class="community-signed" id="community-signed" hidden><span>✓</span><h3>Signature counted!</h3><p>Thank you for supporting this campaign.</p><button type="button" class="community-action-primary" id="community-share-after">Share this petition ↗</button></div></div>'+
        '<div class="community-side-feature">'+featuredCard()+'</div><button type="button" id="community-share-petition" class="community-share-button">↗ Share this petition</button></aside></div>';
      document.getElementById('community-sign-form').addEventListener('submit',event=>signPetition(event,p));
      document.getElementById('community-share-petition').addEventListener('click',()=>shareButton(publicUrl(p.id),p.title));
      document.getElementById('community-share-after').addEventListener('click',()=>shareButton(publicUrl(p.id),p.title));
      if(session?.user?.id===p.owner_id){
        document.getElementById('community-update-form').addEventListener('submit',event=>postUpdate(event,p.id));
      }
    }catch(error){
      console.error(error);
      VIEW.innerHTML='<div class="community-empty">Unable to load this petition. <a href="?view=browse">Browse campaigns</a></div>';
    }
  }
  async function signPetition(event,p){
    event.preventDefault();
    const form=event.currentTarget,btn=document.getElementById('community-sign-button');
    const message=document.getElementById('community-sign-message');
    message.hidden=true;
    if(!form.reportValidity())return;
    const payload={
      petition_id:p.id,
      signer_name:document.getElementById('community-signer').value.trim(),
      signer_email:document.getElementById('community-email').value.trim().toLowerCase(),
      signer_affiliation:document.getElementById('community-affiliation').value.trim()||null,
      show_public:document.getElementById('community-show-name').checked,
      consent:document.getElementById('community-sign-consent').checked
    };
    if(payload.signer_name.length<2||!payload.signer_email.includes('@')||!payload.consent)return;
    btn.disabled=true;btn.textContent='Counting signature…';
    try{
      await submit({path:'ai_community_signatures',method:'POST',data:payload});
      form.hidden=true;
      document.getElementById('community-signed').hidden=false;
      const countRow=await request(pathQuery('ai_community_metrics','select=signature_count&petition_id=eq.'+encodeURIComponent(p.id)));
      const count=Number(countRow[0]?.signature_count||0);
      document.getElementById('community-count').textContent=count.toLocaleString();
      document.getElementById('community-progress').textContent=Math.round(count/p.goal*100)+'% of goal';
      document.getElementById('community-meter-fill').style.width=Math.min(100,count/p.goal*100)+'%';
      showToast('Your signature is counted.');
    }catch(error){
      message.hidden=false;
      message.textContent=(error.code==='23505'||error.status===409)?'This email has already signed this petition.':'Could not submit your signature. Please retry.';
    }finally{btn.disabled=false;btn.textContent='Sign this petition ↗';}
  }

  async function authPage(message=''){
    VIEW.innerHTML='<div class="community-auth-layout"><div class="community-auth-copy"><div class="section-kicker">START SOMETHING IMPORTANT</div><h1>A good idea can start a movement.</h1><p>Make an account to start your own petition, share it with others, and post campaign updates.</p><div class="community-auth-perks"><span>✓ Your petition gets a dedicated shareable link.</span><span>✓ People can sign without creating accounts.</span><span>✓ The featured AI Charter campaign stays visible site-wide.</span></div></div><div class="community-auth-card"><div class="community-auth-tabs"><button type="button" class="active" data-auth-mode="signup">Create account</button><button type="button" data-auth-mode="signin">Sign in</button></div><h2 id="community-auth-title">Create your account</h2><form id="community-auth-form"><label for="community-auth-email">Email address</label><input id="community-auth-email" type="email" autocomplete="email" required placeholder="Your email"/><label for="community-auth-password">Password</label><input id="community-auth-password" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"/><p class="community-form-message" id="community-auth-message" hidden></p><button id="community-auth-submit" class="submit-button" type="submit">Create account ↗</button></form><small>Your email is not shown publicly. You may need to confirm it before signing in.</small></div></div>';
    let mode='signup';
    const msg=document.getElementById('community-auth-message');
    if(message){msg.textContent=message;msg.hidden=false;}
    VIEW.querySelectorAll('[data-auth-mode]').forEach(btn=>btn.addEventListener('click',()=>{
      mode=btn.dataset.authMode;
      VIEW.querySelectorAll('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b===btn));
      document.getElementById('community-auth-title').textContent=mode==='signup'?'Create your account':'Welcome back';
      document.getElementById('community-auth-submit').textContent=mode==='signup'?'Create account ↗':'Sign in ↗';
      msg.hidden=true;
    }));
    document.getElementById('community-auth-form').addEventListener('submit',async event=>{
      event.preventDefault();
      const btn=document.getElementById('community-auth-submit');
      const email=document.getElementById('community-auth-email').value.trim();
      const password=document.getElementById('community-auth-password').value;
      if(!event.currentTarget.reportValidity())return;
      btn.disabled=true;btn.textContent='Please wait…';msg.hidden=true;
      try{
        const path=mode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
        const data=await request(path,{method:'POST',body:{email,password}});
        if(data.access_token&&data.user?.id){
          session={...data,expiry:Date.now()+Math.max(1,(data.expires_in||3600)-60)*1000};
          sessionStorage.setItem(STORAGE_KEY,JSON.stringify(session));
          location.href='?view=create';
          return;
        }
        msg.textContent='Account request accepted. Check your email for a confirmation link, then return here and sign in.';
        msg.hidden=false;
      }catch(error){msg.textContent=error.message||'Could not sign in.';msg.hidden=false;}
      finally{btn.disabled=false;btn.textContent=mode==='signup'?'Create account ↗':'Sign in ↗';}
    });
  }

  async function createPage(){
    if(!session){await authPage();return;}
    VIEW.innerHTML='<div class="community-create-layout"><div class="community-create-main"><div class="community-breadcrumb"><a href="?view=browse">← Explore all petitions</a></div><div class="section-kicker">YOUR VOICE, YOUR CAMPAIGN</div><h1>Start a petition.</h1><p class="community-create-lead">Tell people what needs to change, who can help, and why the issue matters. Your petition will be published as soon as you submit it.</p><form id="community-create-form">'+
      '<label for="community-creator">Your name or organisation <span>*</span></label><input id="community-creator" minlength="2" maxlength="120" placeholder="Who is organising this petition?" required/>'+
      '<label for="community-new-title">Petition title <span>*</span></label><input id="community-new-title" minlength="12" maxlength="160" required placeholder="Ask for one specific change"/>'+
      '<label for="community-new-summary">Short summary <span>*</span></label><textarea id="community-new-summary" minlength="30" maxlength="400" rows="3" required placeholder="Explain your campaign in one or two sentences."></textarea>'+
      '<label for="community-new-body">Tell your story <span>*</span></label><textarea id="community-new-body" minlength="100" maxlength="8000" rows="10" required placeholder="What is happening? What change are you asking for? Why does it matter?"></textarea>'+
      '<div class="community-create-twocol"><div><label for="community-new-category">Category</label><select id="community-new-category">'+categoryOptions+'</select></div><div><label for="community-new-goal">Signature goal</label><input id="community-new-goal" type="number" min="10" max="100000" value="100" required/></div></div>'+
      '<label class="community-check"><input id="community-create-terms" type="checkbox" required/><span>I confirm this petition is submitted responsibly, does not impersonate another person or government, and will not include threats, doxxing or knowingly false claims.</span></label>'+
      '<p class="community-form-message" id="community-create-message" hidden></p>'+
      '<button type="submit" class="community-action-primary community-full-button" id="community-create-button">Publish my petition ↗</button></form></div>'+
      '<aside class="community-create-aside">'+featuredCard()+'<div class="community-creation-tips"><h3>Before you publish</h3><p>✓ Be specific about the change you want.</p><p>✓ Explain who has the power to act.</p><p>✓ Avoid impersonation or unverifiable accusations.</p><p>✓ Share your petition link once published.</p><p class="community-small-note">Maximum three new petitions per account every 24 hours.</p></div><button type="button" class="community-signout-button" id="community-signout">Sign out</button></aside></div>';
    document.getElementById('community-signout').addEventListener('click',()=>{
      session=null;sessionStorage.removeItem(STORAGE_KEY);authPage('You have signed out.');
    });
    document.getElementById('community-create-form').addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const msg=document.getElementById('community-create-message'),btn=document.getElementById('community-create-button');
      if(!form.reportValidity())return;
      const data={
        owner_id:currentUser(),
        creator_name:document.getElementById('community-creator').value.trim(),
        title:document.getElementById('community-new-title').value.trim(),
        summary:document.getElementById('community-new-summary').value.trim(),
        body:document.getElementById('community-new-body').value.trim(),
        category:document.getElementById('community-new-category').value,
        goal:Number(document.getElementById('community-new-goal').value),
        status:'published'
      };
      msg.hidden=true;btn.disabled=true;btn.textContent='Publishing…';
      try{
        const token=await sessionToken();
        const result=await request('/rest/v1/ai_community_petitions?select=id',{method:'POST',token,body:data,headers:{Prefer:'return=representation'}});
        if(!result?.[0]?.id)throw new Error('The petition was not returned by the database.');
        location.href='?petition='+encodeURIComponent(result[0].id);
      }catch(error){
        msg.hidden=false;msg.textContent=error.message||'Unable to create petition.';
        btn.disabled=false;btn.textContent='Publish my petition ↗';
      }
    });
  }

  async function postUpdate(event,id){
    event.preventDefault();
    if(!session)return;
    const btn=event.currentTarget.querySelector('button[type=submit]');
    btn.disabled=true;btn.textContent='Publishing…';
    try{
      const token=await sessionToken();
      await submit({path:'ai_community_updates',method:'POST',data:{
        petition_id:id,author_id:currentUser(),
        title:document.getElementById('community-update-title').value.trim(),
        body:document.getElementById('community-update-body').value.trim()
      }},token);
      showToast('Campaign update published.');
      await detail(id);
    }catch(error){showToast('Update failed: '+error.message);}
    finally{btn.disabled=false;btn.textContent='Publish update ↗';}
  }

  function init(){
    if(viewType==='home') return;
    document.getElementById('main').hidden=true;
    ROOT.hidden=false;
    if(viewType==='browse')browse();
    else if(viewType==='create')createPage();
    else if(viewType==='detail')detail(pageParams.get('petition'));
    else if(viewType==='account')authPage();
    else browse();
  }
  document.addEventListener('DOMContentLoaded',init);
})();
