// scripts/build-site.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.build-preview');

function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function slugOk(s){return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);}
function urlOk(u){if(typeof u!=='string'||!u)return false;if(u.startsWith('https://'))return true;if(u.startsWith('/assets/')||u.startsWith('/_'))return true;return false;}

const SU=process.env.SUPABASE_URL, SK=process.env.SUPABASE_PUBLISHABLE_KEY;
const WRITE=process.env.VERCEL==='1'||process.argv.includes('--write');
function warn(m){console.warn('[build-site] WARNING: '+m);}
function exit0(){process.exit(0);}

async function sb(p,q){
  const u=new URL(SU+p);
  if(q)Object.entries(q).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u.toString(),{headers:{apikey:SK,Authorization:'Bearer '+SK}});
  if(!r.ok)throw new Error('HTTP '+r.status+' '+p);
  return r.json();
}

function region(html,name){
  const s='<!-- CMS:'+name+':START -->',e='<!-- CMS:'+name+':END -->';
  const i=html.indexOf(s),j=html.indexOf(e);
  if(i===-1||j===-1||j<i)return null;
  if(html.indexOf(s,i+1)!==-1||html.indexOf(e,j+1)!==-1)return 'dup';
  return {s,e,i,j};
}

(async()=>{
  try{
    if(!SU||!SK){warn('missing env; untouched');return exit0();}
    let projects,tools,stats,settings;
    try{
      projects=await sb('/rest/v1/projects',{select:'*',is_visible:'eq.true',order:'sort_order.asc'});
      tools=await sb('/rest/v1/tools',{select:'*',order:'sort_order.asc'});
      stats=await sb('/rest/v1/stats',{select:'*',order:'sort_order.asc'});
      settings=await sb('/rest/v1/site_settings',{select:'*'});
    }catch(e){warn('request failed: '+e.message);return exit0();}
    if(!Array.isArray(projects)||!projects.length){warn('projects empty; untouched');return exit0();}

    const setMap={};(settings||[]).forEach(r=>{setMap[r.key]=r.value;});
    const hero=setMap.hero||{},vision=setMap.vision||{},social=setMap.social||{},images=setMap.images||{};
    const profile=images.profile||{};

    let html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    const results=[];

    // cms-projects json before script.js script tag
    const validProjects=projects.filter(p=>{if(!p||!slugOk(p.slug)){warn('skip bad slug '+ (p&&p.slug));return false;}return true;});
    const cmsProjects=validProjects.map(p=>({
      slug:p.slug,title:p.title,tag:(Array.isArray(p.tags)&&p.tags[0])||'',
      description:p.description,features:[],stack:Array.isArray(p.tags)?p.tags:[],
      images:Array.isArray(p.images)?p.images.filter(i=>i&&urlOk(i.url)).map(i=>i.url):[],
      links:[].concat(urlOk(p.live_url)?[{label:p.button_label||'Live',url:p.live_url}]:[]).concat(urlOk(p.code_url)?[{label:'Code',url:p.code_url}]:[]),
      aspect:'16 / 9',fit:'contain'
    }));
    const safeJson=JSON.stringify(cmsProjects).replace(/<\//g,'<\\/');
    const cmsScript='<script type="application/json" id="cms-projects">'+safeJson+'</script>';
    const cmsRoles=Array.isArray(hero.roles)?hero.roles:[];
    const cmsRolesScript='<script type="application/json" id="cms-roles">'+JSON.stringify(cmsRoles).replace(/<\//g,'<\\/')+'</script>';

    // place cms scripts immediately before script.js script tag
    const sj=/(\s*<script[^>]*src=["'][^"']*script\.js["'][^>]*><\/script>)/;
    if(sj.test(html)){
      html=html.replace(sj, '\n'+cmsScript+'\n'+cmsRolesScript+'$1');
    }else{
      html=html.replace('</body>', cmsScript+'\n'+cmsRolesScript+'\n</body>');
    }
    results.push('cms-projects: FILLED ('+cmsProjects.length+')');
    results.push('cms-roles: FILLED ('+cmsRoles.length+')');

    // TYPING_ROLES region replace text with roles joined
    const tr=region(html,'TYPING_ROLES');
    results.push('TYPING_ROLES: SKIPPED (left untouched)');

    // HERO_PARAGRAPH
    const hp=region(html,'HERO_PARAGRAPH');
    if(hp==='dup'||!hp){results.push('HERO_PARAGRAPH: SKIPPED ('+(hp==='dup'?'duplicate':'no markers')+')');}
    else{
      const inner=html.slice(hp.i+hp.s.length,hp.j);
      if(/<[a-z]/i.test(inner)){results.push('HERO_PARAGRAPH: SKIPPED (inline tags)');}
      else{html=html.slice(0,hp.i+hp.s.length)+esc(hero.paragraph||'')+html.slice(hp.j);results.push('HERO_PARAGRAPH: FILLED');}
    }
    // HERO_SKILLS
    const hs=region(html,'HERO_SKILLS');
    if(hs==='dup'||!hs){results.push('HERO_SKILLS: SKIPPED ('+(hs==='dup'?'duplicate':'no markers')+')');}
    else{
      const inner=html.slice(hs.i+hs.s.length,hs.j);
      if(/<[a-z]/i.test(inner)){results.push('HERO_SKILLS: SKIPPED (inline tags)');}
      else{html=html.slice(0,hs.i+hs.s.length)+esc(hero.skills_line||'')+html.slice(hs.j);results.push('HERO_SKILLS: FILLED');}
    }
    // VISION
    const vs=region(html,'VISION');
    if(vs==='dup'||!vs){results.push('VISION: SKIPPED ('+(vs==='dup'?'duplicate':'no markers')+')');}
    else{
      const inner=html.slice(vs.i+vs.s.length,vs.j);
      if(/<[a-z]/i.test(inner)){results.push('VISION: SKIPPED (inline tags)');}
      else{html=html.slice(0,vs.i+vs.s.length)+esc((vision&&vision.paragraph)||'')+html.slice(vs.j);results.push('VISION: FILLED');}
    }

    // SOCIAL: only update href of github & linkedin anchors
    const so=region(html,'SOCIAL');
    if(so==='dup'||!so){results.push('SOCIAL: SKIPPED ('+(so==='dup'?'duplicate':'no markers')+')');}
    else{
      if(social.github&&urlOk(social.github))html=html.replace(/(<a[^>]*class="[^"]*social-link[^"]*social-link--github[^"]*"[^>]*href=")[^"]*(")/, '$1'+social.github+'$2');
      if(social.linkedin&&urlOk(social.linkedin))html=html.replace(/(<a[^>]*class="[^"]*social-link[^"]*social-link--linkedin[^"]*"[^>]*href=")[^"]*(")/, '$1'+social.linkedin+'$2');
      results.push('SOCIAL: FILLED (hrefs)');
    }

    // TOOLKIT: template detection report only (no auto replace to avoid guessing)
    const tk=region(html,'TOOLKIT');
    if(tk==='dup'||!tk){results.push('TOOLKIT: SKIPPED ('+(tk==='dup'?'duplicate':'no markers')+')');}
    else{results.push('TOOLKIT: SKIPPED (template detection not implemented)');}

    // STATS: skip auto
    const st=region(html,'STATS');
    if(st==='dup'||!st){results.push('STATS: SKIPPED ('+(st==='dup'?'duplicate':'no markers')+')');}
    else{results.push('STATS: SKIPPED (template detection not implemented)');}

    // ABOUT
    const about=setMap.about||{};
    // highlight helper: **text** -> <span class="section-heading-accent">text</span>
    function highlight(s){
      const escd=esc(s);
      let count=0;
      return escd.replace(/\*\*([^*]+)\*\*/g,(m,t)=>{if(count>=6)return m;count++;return '<span class="section-heading-accent">'+t+'</span>';});
    }
    const ah=region(html,'ABOUT_HEADING');
    if(ah==='dup'||!ah){results.push('ABOUT_HEADING: SKIPPED ('+(ah==='dup'?'duplicate':'no markers')+')');}
    else{
      const inner=html.slice(ah.i+ah.s.length,ah.j);
      if(/<[a-z]/i.test(inner.replace(/<!--.*?-->/g,''))){/* check raw inner for tags excluding markers */
        // allow only if it matches expected span? We still replace with highlight.
      }
      html=html.slice(0,ah.i+ah.s.length)+highlight(about.heading||'')+html.slice(ah.j);
      results.push('ABOUT_HEADING: FILLED');
    }
    const asu=region(html,'ABOUT_SUBTITLE');
    if(asu==='dup'||!asu){results.push('ABOUT_SUBTITLE: SKIPPED ('+(asu==='dup'?'duplicate':'no markers')+')');}
    else{
      const inner=html.slice(asu.i+asu.s.length,asu.j);
      if(/<[a-z]/i.test(inner)){results.push('ABOUT_SUBTITLE: SKIPPED (inline tags)');}
      else{html=html.slice(0,asu.i+asu.s.length)+esc(about.subtitle||'')+html.slice(asu.j);results.push('ABOUT_SUBTITLE: FILLED');}
    }
    const ast=region(html,'ABOUT_STORY');
    if(ast==='dup'||!ast){results.push('ABOUT_STORY: SKIPPED ('+(ast==='dup'?'duplicate':'no markers')+')');}
    else{
      const inner=html.slice(ast.i+ast.s.length,ast.j);
      // extract p tags
      const pOpen=inner.match(/<p\b[^>]*>/);
      const pOpens=[...inner.matchAll(/<p\b[^>]*>/g)].map(m=>m[0]);
      const unique=new Set(pOpens);
      const hasInline=/<(strong|em|a|br|span|b|i|u)\b/i.test(inner.replace(/<p\b[^>]*>/g,''));
      if(!pOpen){results.push('ABOUT_STORY: SKIPPED (no p template)');}
      else if(unique.size>1){results.push('ABOUT_STORY: SKIPPED (mixed p attributes)');}
      else if(hasInline){results.push('ABOUT_STORY: SKIPPED (inline tags)');}
      else if(!Array.isArray(about.story)||!about.story.length){results.push('ABOUT_STORY: SKIPPED (no data)');}
      else{
        const tpl=pOpen[0];
        // preserve layout: each paragraph separated by blank line
        const out=about.story.map(p=>tpl+esc(p)+'</p>').join('\n\n            ');
        html=html.slice(0,ast.i+ast.s.length)+'\n            '+out+'\n          '+html.slice(ast.j);
        results.push('ABOUT_STORY: FILLED ('+about.story.length+')');
      }
    }
    const pr=region(html,'PROJECTS');
    if(pr==='dup'||!pr){results.push('PROJECTS: SKIPPED ('+(pr==='dup'?'duplicate':'no markers')+')');}
    else{results.push('PROJECTS: FILLED (cms-projects embedded)');}

    // PROFILE skipped
    results.push('PROFILE: SKIPPED (explicit)');

    if(WRITE){fs.writeFileSync(path.join(ROOT,'index.html'),html);}
    else{fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'index.html'),html);}
    results.forEach(r=>console.log(r));
  }catch(e){warn('unexpected: '+e.message);}
  exit0();
})();
