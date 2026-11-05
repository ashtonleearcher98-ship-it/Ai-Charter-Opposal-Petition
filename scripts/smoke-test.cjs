const {JSDOM} = require('jsdom');
const fs = require('fs');
const assert = require('node:assert/strict');

const HTML=fs.readFileSync('index.html','utf8');
const APP=fs.readFileSync('app.js','utf8');
const COMMUNITY=fs.readFileSync('community.js','utf8');

function mockResponse(data){
  return {ok:true,status:200,text:async()=>JSON.stringify(data)};
}
async function testPage(query,expected){
  const url='https://scglydnqfaitasfwjucj.supabase.co/functions/v1/greenwick-ai-petition'+query;
  const dom=new JSDOM(HTML,{url,runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom;
  window.fetch=async (url)=>{
    const s=String(url);
    if(s.includes('ai_petition_metrics'))return mockResponse([{approved_count:2}]);
    if(s.includes('ai_petition_public_signers'))return mockResponse([]);
    if(s.includes('ai_petition_updates'))return mockResponse([]);
    if(s.includes('ai_community_petitions'))return mockResponse([]);
    if(s.includes('ai_community_metrics'))return mockResponse([]);
    return mockResponse([]);
  };
  window.eval(APP);
  window.eval(COMMUNITY);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(window.document.getElementById('community-root').hidden,false,'Community root must be visible');
  assert.equal(window.document.getElementById('main').hidden,true,'Featured content must be hidden when browsing/creating');
  const view=window.document.getElementById('community-view');
  assert.ok(view.querySelector(expected),'Missing expected page element '+expected);
  assert.ok(window.document.querySelector('.community-featured-strip'),'Main charter petition must always be promoted');
  console.log('PASS: '+url+' renders '+expected);
  dom.window.close();
}
(async()=>{
  assert.ok(HTML.includes('href="?view=browse"'),'Browse nav link must exist');
  assert.ok(HTML.includes('href="?view=create"'),'Start petition nav link must exist');
  assert.ok(HTML.includes('src="./community.js?v='),'Community JavaScript must load');
  assert.ok(HTML.includes('href="./community.css?v='),'Community styling must load');
  await testPage('?view=browse','.community-searchbox');
  await testPage('?view=create','#community-auth-form');
  console.log('PASS: all community petition smoke tests');
})().catch(e=>{console.error(e);process.exitCode=1;});
