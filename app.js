(function(){
const {DEFAULTS,COLORS,MODE_LABEL,LS_DATA,LS_TIMER}=APP_CONFIG;
const $=id=>document.getElementById(id);

function lsGet(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

let settings={...DEFAULTS}; let months={}; let tasks=[];
(function(){const d=lsGet(LS_DATA); if(d){settings={...DEFAULTS,...(d.settings||{})}; months=d.months||{}; tasks=Array.isArray(d.tasks)?d.tasks:[];}})();

let t=lsGet(LS_TIMER)||{};
t={mode:'focus',running:false,endAt:0,remainingMs:null,accMs:0,resumedAt:0,startAt:0,cycle:0,subject:null,...t};

/* ---------- utils ---------- */
const pad=n=>String(n).padStart(2,'0');
const dayKey=ts=>{const d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const monthKey=ts=>{const d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)};
const hm=ts=>{const d=new Date(ts);return pad(d.getHours())+':'+pad(d.getMinutes())};
function fmt(m){m=Math.round(m); if(m<60) return m+'分'; const h=Math.floor(m/60), r=m%60; return h+'時間'+(r?r+'分':'')}
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function startOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
function weekStart(){const d=startOfDay(new Date()); const w=(d.getDay()+6)%7; d.setDate(d.getDate()-w); return d}
function colorOf(sub){const i=settings.subjects.indexOf(sub); return COLORS[(i<0?settings.subjects.length:i)%COLORS.length]}
function allSessions(){return Object.values(months).flat()}
let toastTimer;
function toast(msg){const el=$('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),3200)}
function setSync(msg){$('sync').textContent=msg}

/* ---------- storage（ブラウザのlocalStorageのみ） ---------- */
function saveLocal(){
  try{localStorage.setItem(LS_DATA,JSON.stringify({settings,months,tasks})); setSync('')}
  catch(e){setSync('ブラウザに保存できませんでした。容量不足かプライベートモードの可能性があります。設定 → バックアップで書き出してください')}
}
const persistMonth=()=>saveLocal(), persistSettings=()=>saveLocal(), persistTasks=()=>saveLocal();
addEventListener('storage',e=>{ // 同じ端末の別タブでの変更を反映
  if(e.key!==LS_DATA||!e.newValue) return;
  try{const d=JSON.parse(e.newValue); settings={...DEFAULTS,...(d.settings||{})}; months=d.months||{}; tasks=Array.isArray(d.tasks)?d.tasks:[]; renderAll()}catch(err){}
});
function addSession(s){const k=monthKey(s.start); months[k]=[...(months[k]||[]),s]; persistMonth(k); renderAll()}
function deleteSession(id,k){months[k]=(months[k]||[]).filter(x=>x.id!==id); persistMonth(k); renderAll()}

/* ---------- audio ---------- */
let actx=null;
function ensureAudio(){try{if(!actx) actx=new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==='suspended') actx.resume()}catch(e){}}
function chime(){
  if(!actx) return;
  [880,1175,1568].forEach((f,i)=>{
    const o=actx.createOscillator(), g=actx.createGain(), s=actx.currentTime+i*0.22;
    o.frequency.value=f; o.type='sine';
    g.gain.setValueAtTime(0.0001,s); g.gain.exponentialRampToValueAtTime(0.25,s+0.02); g.gain.exponentialRampToValueAtTime(0.0001,s+0.6);
    o.connect(g).connect(actx.destination); o.start(s); o.stop(s+0.65);
  });
}

/* ---------- timer ---------- */
function saveT(){lsSet(LS_TIMER,t)}
const dur=m=>Math.max(1,Number(settings[m])||DEFAULTS[m])*60000;
function remaining(){return t.running?Math.max(0,t.endAt-Date.now()):(t.remainingMs??dur(t.mode))}
function currentSubject(){if(!settings.subjects.includes(t.subject)) t.subject=settings.subjects[0]; return t.subject}
function start(){if(t.running) return; ensureAudio(); const rem=remaining(); const now=Date.now(); t.running=true; t.endAt=now+rem; t.resumedAt=now; if(!t.startAt) t.startAt=now; saveT(); renderTimer()}
function pause(){if(!t.running) return; const now=Date.now(); t.accMs+=now-t.resumedAt; t.remainingMs=Math.max(0,t.endAt-now); t.running=false; saveT(); renderTimer()}
function resetTo(mode){t.mode=mode; t.running=false; t.remainingMs=null; t.accMs=0; t.startAt=0; t.resumedAt=0; saveT(); renderTimer()}
function recordFocus(endTs,countPomo){
  const min=Math.round(t.accMs/60000); if(min<1) return 0;
  const tk=activeTask();
  const sess={id:genId(),start:t.startAt||endTs-t.accMs,end:endTs,min,subject:tk?tk.subject:currentSubject(),memo:$('memo').value.trim()};
  if(tk){sess.taskId=tk.id; sess.task=tk.title}
  if(tk&&countPomo){tasks=tasks.map(x=>x.id===tk.id?{...x,done:(x.done||0)+1}:x); persistTasks()}
  addSession(sess);
  $('memo').value=''; return min;
}
function afterFocus(){t.cycle=(t.cycle||0)+1; const every=Math.max(2,Number(settings.longEvery)||4); resetTo(t.cycle%every===0?'long':'short')}
function complete(){
  const end=t.endAt;
  if(t.running){t.accMs+=t.endAt-t.resumedAt; t.running=false}
  chime();
  if(t.mode==='focus'){
    const m=recordFocus(end,true); afterFocus(); celebrate();
    toast((m?m+'分を記録しました。':'')+MODE_LABEL[t.mode]+'に入りましょう');
    if(settings.autoBreak) start();
  }else{ resetTo('focus'); toast('休憩終了。次の集中を始めましょう'); }
}
function finishEarly(){
  if(t.mode!=='focus'){ resetTo('focus'); toast('休憩をスキップしました'); return }
  if(t.running) pause();
  const m=recordFocus(Date.now(),false);
  if(m){ afterFocus(); toast(m+'分を記録しました') } else { resetTo('focus'); toast('1分未満のため記録しませんでした') }
}
function tick(){ if(t.running&&Date.now()>=t.endAt) complete(); renderTime() }

/* ---------- render: timer ---------- */
const ring=$('ring'); const ticks=[]; const CIRC=2*Math.PI*140;
(function(){const ns='http://www.w3.org/2000/svg';
  for(let i=0;i<60;i++){const l=document.createElementNS(ns,'line'); const a=(i/60)*Math.PI*2-Math.PI/2;
    const r1=i%5===0?116:122, r2=138;
    l.setAttribute('x1',150+r1*Math.cos(a)); l.setAttribute('y1',150+r1*Math.sin(a));
    l.setAttribute('x2',150+r2*Math.cos(a)); l.setAttribute('y2',150+r2*Math.sin(a));
    l.setAttribute('class','tick'); ring.appendChild(l); ticks.push(l)}
  ['prog-track','prog'].forEach(c=>{const ci=document.createElementNS(ns,'circle');
    ci.setAttribute('cx',150);ci.setAttribute('cy',150);ci.setAttribute('r',140);ci.setAttribute('class',c);
    if(c==='prog'){ci.setAttribute('transform','rotate(-90 150 150)');ci.setAttribute('stroke-dasharray',CIRC);ci.id='progC'}
    ring.appendChild(ci)})})();
let lastOn=-1;
function renderTime(){
  const rem=remaining(), total=dur(t.mode);
  const s=Math.ceil(rem/1000); const txt=pad(Math.floor(s/60))+':'+pad(s%60);
  $('time').textContent=txt;
  document.title=(t.running?txt+' '+MODE_LABEL[t.mode]+' | ':'')+'集中タイマー';
  const on=Math.ceil(Math.min(1,rem/total)*60);
  if(on!==lastOn){ticks.forEach((l,i)=>l.classList.toggle('on',i<on)); lastOn=on}
  $('progC').setAttribute('stroke-dashoffset',CIRC*(1-Math.min(1,rem/total)));
}
function renderTimer(){
  if(typeof wake==='function'){ if(canIdle()) wake(); else {document.body.classList.remove('idle'); clearTimeout(idleTimer)} }
  $('tab-timer').dataset.mode=t.mode;
  if(typeof pillText==='function') pillText();
  $('modeLabel').textContent=t.running?(t.mode==='focus'?'Focusing':'On break'):(t.remainingMs!==null?'Paused':'Ready');
  const every=Math.max(2,Number(settings.longEvery)||4), done=(t.cycle||0)%every;
  $('cycleDots').innerHTML=Array.from({length:every},(_,i)=>'<i class="'+(i<done?'done':'')+'"></i>').join('');
  $('cycleDots').setAttribute('aria-label',every+'回中'+done+'回完了');
  const started=t.running||t.remainingMs!==null;
  const lbl=t.running?'一時停止':(started?'再開':'開始');
  $('dialBtn').setAttribute('aria-label',lbl+'（タイマーを押して切り替え）');
  const paused=!t.running&&t.remainingMs!==null;
  $('icoPath').setAttribute('d',t.running?'M12 7a5 5 0 1 0 0.001 0z':(paused?'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z':'M8 5.5v13l10.5-6.5z'));
  document.querySelector('.state').classList.toggle('live',t.running);
  document.body.dataset.mode=t.mode; if(typeof applyLook==='function') applyLook(); renderNow();
  $('btnFinish').textContent=t.mode==='focus'?'記録して終了':'休憩をスキップ';
  $('btnFinish').disabled=t.mode==='focus'&&!started;
  $('btnDiscard').disabled=!started;
  lastOn=-1; renderTime();
}
function renderChips(){
  const cur=currentSubject();
  $('subjectChips').innerHTML='';
  settings.subjects.forEach(sub=>{
    const b=document.createElement('button'); b.className='chip'; b.setAttribute('aria-pressed',sub===cur);
    const d=document.createElement('span'); d.className='dot'; d.style.background=colorOf(sub);
    b.append(d,document.createTextNode(sub));
    b.onclick=()=>{t.subject=sub; saveT(); renderChips()};
    $('subjectChips').appendChild(b);
  });
  const sel=$('mSubject'); sel.innerHTML='';
  settings.subjects.forEach(sub=>{const o=document.createElement('option'); o.value=o.textContent=sub; sel.appendChild(o)});
  sel.value=cur;
}

/* ---------- render: stats ---------- */
function renderStats(){
  const all=allSessions(); const today=dayKey(Date.now());
  const ws=weekStart().getTime(); const mk=monthKey(Date.now());
  let tToday=0,tWeek=0,tMonth=0; const byDay={};
  all.forEach(s=>{const dk=dayKey(s.start); byDay[dk]=(byDay[dk]||0)+s.min;
    if(dk===today) tToday+=s.min; if(s.start>=ws) tWeek+=s.min; if(monthKey(s.start)===mk) tMonth+=s.min});
  let streak=0; const d=startOfDay(new Date()); if(!byDay[dayKey(d)]) d.setDate(d.getDate()-1);
  while(byDay[dayKey(d)]){streak++; d.setDate(d.getDate()-1)}
  const goal=(Number(settings.weeklyGoalH)||15)*60;
  $('todayTotal').textContent=$('sToday').textContent=fmt(tToday);
  $('weekTotal').textContent=$('sWeek').textContent=fmt(tWeek);
  $('weekGoalLbl').textContent=fmt(goal);
  $('sWeekBar').style.width=Math.min(100,tWeek/goal*100)+'%';
  $('sMonth').textContent=fmt(tMonth); $('sStreak').textContent=streak+'日';

  // 14日チャート
  const days=[]; for(let i=13;i>=0;i--){const x=startOfDay(new Date()); x.setDate(x.getDate()-i); days.push(x)}
  const per=days.map(x=>{const k=dayKey(x); const m={}; all.forEach(s=>{if(dayKey(s.start)===k) m[s.subject]=(m[s.subject]||0)+s.min}); return m});
  const totals=per.map(m=>Object.values(m).reduce((a,b)=>a+b,0));
  const max=Math.max(60,...totals); const top=Math.ceil(max/60)*60;
  const W=560,H=190,L=34,B=24,T=8,bw=(W-L)/14;
  let svg='';
  for(let g=0;g<=top;g+=Math.max(60,Math.ceil(top/4/60)*60)){const y=H-B-(g/top)*(H-B-T);
    svg+='<line x1="'+L+'" x2="'+W+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/><text x="'+(L-6)+'" y="'+(y+4)+'" text-anchor="end">'+(g/60)+'h</text>'}
  const subjOrder=[...settings.subjects]; all.forEach(s=>{if(!subjOrder.includes(s.subject)) subjOrder.push(s.subject)});
  per.forEach((m,i)=>{let y=H-B; const x=L+i*bw+bw*0.2, w=bw*0.6;
    subjOrder.forEach(sub=>{if(!m[sub]) return; const h=(m[sub]/top)*(H-B-T); y-=h;
      svg+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+colorOf(sub)+'"><title>'+sub+' '+fmt(m[sub])+'</title></rect>'});
    const lbl=(days[i].getMonth()+1)+'/'+days[i].getDate();
    svg+='<text x="'+(x+w/2)+'" y="'+(H-6)+'" text-anchor="middle"'+(i===13?' style="font-weight:700;fill:var(--ink)"':'')+'>'+lbl+'</text>'});
  $('chart').innerHTML=svg;
  $('legend').innerHTML=subjOrder.map(s=>'<span><i style="background:'+colorOf(s)+'"></i>'+esc(s)+'</span>').join('');

  // 科目別（今週）
  const bySub={}; all.forEach(s=>{if(s.start>=ws) bySub[s.subject]=(bySub[s.subject]||0)+s.min});
  const ent=Object.entries(bySub).sort((a,b)=>b[1]-a[1]); const bmax=Math.max(1,...ent.map(e=>e[1]));
  $('breakdown').innerHTML=ent.length?ent.map(([s,m])=>'<div class="brk"><span>'+esc(s)+'</span><div class="track"><span style="width:'+(m/bmax*100)+'%;background:'+colorOf(s)+'"></span></div><span class="n">'+fmt(m)+'</span></div>').join('')
    :'<div class="empty">今週の記録はまだありません。タイマーで集中を1回終えると、ここに積み上がります。</div>';

  // 履歴
  const list=all.slice().sort((a,b)=>b.start-a.start).slice(0,60);
  const groups={}; list.forEach(s=>{(groups[dayKey(s.start)]=groups[dayKey(s.start)]||[]).push(s)});
  const h=$('history'); h.innerHTML='';
  if(!list.length){h.innerHTML='<div class="empty">まだ記録がありません。</div>';return}
  Object.entries(groups).forEach(([dk,arr])=>{
    const box=document.createElement('div'); box.className='day';
    const sum=arr.reduce((a,b)=>a+b.min,0);
    const [y,mo,da]=dk.split('-'); const wd='日月火水木金土'[new Date(+y,+mo-1,+da).getDay()];
    box.innerHTML='<h3><span>'+(+mo)+'月'+(+da)+'日（'+wd+'）</span><span>'+fmt(sum)+'</span></h3>';
    arr.forEach(s=>{
      const r=document.createElement('div'); r.className='row';
      r.innerHTML='<span class="tm">'+hm(s.start)+'</span><span><span style="display:inline-flex;align-items:center;gap:6px"><i style="width:8px;height:8px;border-radius:50%;background:'+colorOf(s.subject)+';display:inline-block"></i>'+esc(s.subject)+(s.manual?'（手動）':'')+'</span>'+((s.task||s.memo)?'<span class="memo">'+esc([s.task,s.memo].filter(Boolean).join(' ／ '))+'</span>':'')+'</span><span>'+fmt(s.min)+'</span>';
      const del=document.createElement('button'); del.className='del'; del.textContent='削除'; del.setAttribute('aria-label',hm(s.start)+'の記録を削除');
      del.onclick=()=>{deleteSession(s.id,monthKey(s.start)); toast('記録を削除しました')};
      r.appendChild(del); box.appendChild(r);
    });
    h.appendChild(box);
  });
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function renderSettings(){
  $('sFocus').value=settings.focus; $('sShort').value=settings.short; $('sLong').value=settings.long;
  $('sEvery').value=settings.longEvery; $('sAuto').checked=!!settings.autoBreak;
  $('sGoal').value=settings.weeklyGoalH; $('sSubjects').value=settings.subjects.join('\n');
  $('sBgFocus').value=settings.bgFocus; $('sBgBreak').value=settings.bgBreak; $('sBgSpeed').value=settings.bgSpeed;
  $('sBgSpeedOut').textContent=settings.bgSpeed+'%'; $('sFireworks').checked=!!settings.fireworks;
}
/* ---------- tasks ---------- */
let editing=null, draft=null;
function activeTask(){return tasks.find(x=>x.id===t.taskId&&!x.completed)||null}
function todayPomos(){const k=dayKey(Date.now()); return allSessions().filter(s=>!s.manual&&dayKey(s.start)===k).length}
function renderNow(){
  const tk=activeTask(), n=todayPomos();
  if(t.mode==='focus'){$('nowN').textContent='#'+(n+1); $('nowT').textContent=tk?tk.title:'タスクを選択'}
  else {$('nowN').textContent='#'+n; $('nowT').textContent='休憩しましょう'}
  $('noTaskSubject').hidden=!!tk; renderFoot();
}
function openForm(id){
  editing=id; const tk=tasks.find(x=>x.id===id);
  draft=tk?{title:tk.title,subject:tk.subject,est:tk.est||1,done:tk.done||0}:{title:'',subject:currentSubject(),est:1,done:0};
  renderTasks(); setTimeout(()=>{const i=$('tfTitle'); if(i) i.focus()},0);
}
function formEl(){
  const f=document.createElement('div'); f.className='tform';
  const opts=[...new Set([...settings.subjects,draft.subject])].map(s=>'<option'+(s===draft.subject?' selected':'')+'>'+esc(s)+'</option>').join('');
  f.innerHTML='<div><label for="tfTitle">タスク名</label><input type="text" id="tfTitle" maxlength="60" placeholder="例：簿記論 過去問 第3問"></div>'
   +'<div><label for="tfSub">科目</label><select id="tfSub">'+opts+'</select></div>'
   +'<div><label for="tfEst">見積もりポモドーロ数（1回＝'+settings.focus+'分）</label><div class="est"><button type="button" id="tfMinus" aria-label="減らす">−</button><input type="number" id="tfEst" min="1" max="50"><button type="button" id="tfPlus" aria-label="増やす">＋</button><span id="tfMin" style="color:var(--sub);font-size:.85rem"></span></div></div>'
   +(editing!=='new'?'<div><label for="tfDone">実績ポモドーロ数</label><input type="number" id="tfDone" min="0" max="99" style="width:6em"></div>':'')
   +'<div class="acts"><span>'+(editing!=='new'?'<button class="btn ghost" id="tfDel" style="color:var(--warn)">削除</button>':'')+'</span><span style="display:flex;gap:8px"><button class="btn" id="tfCancel">キャンセル</button><button class="btn primary" id="tfSave" style="--accent:var(--focus)">保存</button></span></div>';
  const ti=f.querySelector('#tfTitle'), es=f.querySelector('#tfEst'), mi=f.querySelector('#tfMin');
  ti.value=draft.title; es.value=draft.est;
  const upd=()=>{mi.textContent='約'+fmt((Number(es.value)||0)*settings.focus)};
  upd();
  ti.oninput=()=>draft.title=ti.value;
  f.querySelector('#tfSub').onchange=e=>draft.subject=e.target.value;
  es.oninput=()=>{draft.est=Number(es.value)||1; upd()};
  f.querySelector('#tfMinus').onclick=()=>{draft.est=Math.max(1,(Number(es.value)||1)-1); es.value=draft.est; upd()};
  f.querySelector('#tfPlus').onclick=()=>{draft.est=Math.min(50,(Number(es.value)||0)+1); es.value=draft.est; upd()};
  const dn=f.querySelector('#tfDone'); if(dn){dn.value=draft.done; dn.oninput=()=>draft.done=Math.max(0,Math.round(Number(dn.value)||0))}
  ti.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing) f.querySelector('#tfSave').click()};
  f.querySelector('#tfCancel').onclick=()=>{editing=null; draft=null; renderTasks()};
  f.querySelector('#tfSave').onclick=()=>{
    const title=draft.title.trim(); if(!title){toast('タスク名を入力してください'); ti.focus(); return}
    const est=Math.min(50,Math.max(1,Math.round(draft.est)||1));
    if(editing==='new'){
      if(tasks.length>=100){toast('タスクは100件までです。完了済みを消してください');return}
      const nt={id:genId(),title,subject:draft.subject,est,done:0,completed:false};
      tasks=[...tasks,nt]; if(!activeTask()) t.taskId=nt.id;
    } else tasks=tasks.map(x=>x.id===editing?{...x,title,subject:draft.subject,est,done:Math.min(99,draft.done)}:x);
    saveT(); editing=null; draft=null; persistTasks(); renderTasks(); renderNow();
  };
  const del=f.querySelector('#tfDel');
  if(del) del.onclick=()=>{tasks=tasks.filter(x=>x.id!==editing); editing=null; draft=null; persistTasks(); renderTasks(); renderNow(); toast('タスクを削除しました')};
  return f;
}
function blocksHtml(tk){
  const done=tk.done||0, est=tk.est||1, col=colorOf(tk.subject), MAX=20;
  const total=Math.max(done,est), show=Math.min(total,MAX);
  let h='';
  for(let i=0;i<show;i++){
    const cls=i<done?(i<est?'on':'on over'):'';
    h+='<i class="'+cls+'"'+(i<done?' style="background:'+col+';border-color:'+col+'"':'')+'></i>';
  }
  if(total>MAX) h+='<span class="more">+'+(total-MAX)+'</span>';
  const lbl='見積もり'+est+'回中'+done+'回完了'+(done>est?'（'+(done-est)+'回超過）':'');
  return '<div class="blocks" role="img" aria-label="'+lbl+'" title="'+lbl+'">'+h+'</div>';
}
function renderTasks(){
  const list=$('taskList'); list.innerHTML='';
  const act=activeTask();
  tasks.forEach(tk=>{
    if(editing===tk.id){list.appendChild(formEl()); return}
    const r=document.createElement('div'); r.className='task'+(act&&act.id===tk.id?' active':'')+(tk.completed?' done':'');
    r.innerHTML='<button class="chk" aria-label="'+(tk.completed?'未完了に戻す':'完了にする')+'">✓</button>'
      +'<div style="min-width:0"><div class="ttl">'+esc(tk.title)+'</div><div class="ts"><i style="background:'+colorOf(tk.subject)+'"></i>'+esc(tk.subject)+'</div></div>'
      +blocksHtml(tk)
      +'<button class="menu" aria-label="編集">編集</button>';
    r.onclick=e=>{ if(e.target.closest('button')) return; if(tk.completed) return; t.taskId=tk.id; saveT(); renderTasks(); renderNow() };
    r.querySelector('.chk').onclick=()=>{tasks=tasks.map(x=>x.id===tk.id?{...x,completed:!x.completed}:x); persistTasks(); renderTasks(); renderNow()};
    r.querySelector('.menu').onclick=()=>openForm(tk.id);
    list.appendChild(r);
  });
  if(editing==='new') list.appendChild(formEl());
  $('addTask').hidden=editing!==null;
  $('clearDone').hidden=!tasks.some(x=>x.completed);
  renderFoot();
}
function renderFoot(){
  const left=tasks.filter(x=>!x.completed).length; $('taskBadge').textContent=left?String(left):'';
  const doneSum=tasks.reduce((a,x)=>a+(x.done||0),0), estSum=tasks.reduce((a,x)=>a+(x.est||0),0);
  const rem=tasks.filter(x=>!x.completed).reduce((a,x)=>a+Math.max(0,(x.est||0)-(x.done||0)),0);
  if(!tasks.length){$('taskFoot').innerHTML='タスクを追加すると、必要なポモドーロ数と終了予定がわかります';return}
  let bl='', cnt=0; const MAX=40;
  tasks.forEach(tk=>{const done=tk.done||0, n=Math.max(done,tk.est||0), col=colorOf(tk.subject);
    for(let i=0;i<n;i++){cnt++; if(cnt>MAX) continue;
      bl+='<i class="'+(i<done?'on':'')+'"'+(i<done?' style="background:'+col+';border-color:'+col+'"':'')+'></i>'}});
  if(cnt>MAX) bl+='<span class="more">+'+(cnt-MAX)+'</span>';
  const remMin=rem*(Number(settings.focus)||25);
  $('taskFoot').innerHTML='<div class="blocks foot-blocks" role="img" aria-label="見積もり'+estSum+'回中'+doneSum+'回完了">'+bl+'</div>'
    +'<div style="margin-top:6px">'+(rem?'残り <b>'+rem+'</b> ポモ（約'+fmt(remMin)+'）':'見積もり分はすべて完了')+'</div>';
}
setInterval(()=>renderFoot(),30000);
$('addTask').onclick=()=>openForm('new');
function setDrawer(open){
  const dr=$('taskDrawer'); dr.classList.toggle('open',open); dr.setAttribute('aria-hidden',String(!open));
  document.body.classList.toggle('drawer-open',open); $('nowBtn').setAttribute('aria-expanded',String(open));
  lsSet('pomo.drawer.v1',open); if(open) setTimeout(()=>$('closeDrawer').focus(),50);
}
$('nowBtn').onclick=()=>setDrawer(!$('taskDrawer').classList.contains('open'));
$('closeDrawer').onclick=()=>setDrawer(false);
$('drawerScrim').onclick=()=>setDrawer(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('taskDrawer').classList.contains('open')) setDrawer(false)});
setDrawer(lsGet('pomo.drawer.v1')===true);
$('clearDone').onclick=()=>{tasks=tasks.filter(x=>!x.completed); persistTasks(); renderTasks(); toast('完了済みのタスクを消しました')};
function renderAll(){renderTasks(); renderChips(); renderTimer(); renderStats(); if($('tab-settings').hidden) renderSettings()}

/* ---------- events ---------- */
function showTab(name){
  document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.tab===name)));
  ['timer','log','settings'].forEach(n=>$('tab-'+n).hidden=n!==name);
  if(name==='settings') renderSettings();
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showTab(b.getAttribute('aria-pressed')==='true'?'timer':b.dataset.tab));
$('brandBtn').onclick=()=>showTab('timer');
/* ---------- 集中中の自動非表示 ---------- */
const IDLE_MS=3000; let idleTimer=null, suppressTap=false;
function canIdle(){return t.running&&t.mode==='focus'&&!$('tab-timer').hidden&&!$('taskDrawer').classList.contains('open')&&!(document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))}
function wake(){document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer=setTimeout(()=>{if(canIdle()) document.body.classList.add('idle')},IDLE_MS)}
['mousemove','keydown','wheel'].forEach(ev=>document.addEventListener(ev,wake,{passive:true}));
document.addEventListener('pointerdown',e=>{if(document.body.classList.contains('idle')&&e.pointerType!=='mouse'){suppressTap=true; setTimeout(()=>suppressTap=false,600)} wake()},{capture:true,passive:true});
function toggleRun(){
  if(suppressTap){suppressTap=false; return}t.running?pause():start(); const d=$('dialBtn'); d.classList.add('pressed'); setTimeout(()=>d.classList.remove('pressed'),120)}
$('dialBtn').onclick=toggleRun;
$('dialBtn').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault(); e.stopPropagation(); toggleRun()}};
$('btnFinish').onclick=finishEarly;
$('btnDiscard').onclick=()=>{resetTo(t.mode); toast('リセットしました（記録はしていません）')};
document.addEventListener('keydown',e=>{
  if(e.code!=='Space'||$('tab-timer').hidden) return;
  if(/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) return;
  e.preventDefault(); t.running?pause():start();
});
$('mAdd').onclick=()=>{
  const d=$('mDate').value, tm=$('mTime').value||'12:00', min=Math.round(Number($('mMin').value));
  if(!d||!(min>=1&&min<=600)){toast('日付と時間（1〜600分）を入力してください');return}
  const [y,mo,da]=d.split('-').map(Number), [hh,mm]=tm.split(':').map(Number);
  const st=new Date(y,mo-1,da,hh,mm).getTime();
  addSession({id:genId(),start:st,end:st+min*60000,min,subject:$('mSubject').value,memo:$('mMemo').value.trim(),manual:true});
  $('mMemo').value=''; toast(fmt(min)+'を追加しました');
};
$('sSave').onclick=()=>{
  const num=(id,lo,hi,def)=>{const v=Math.round(Number($(id).value)); return v>=lo&&v<=hi?v:def};
  const subs=[...new Set($('sSubjects').value.split('\n').map(s=>s.trim()).filter(Boolean))].slice(0,12);
  settings={...settings,focus:num('sFocus',1,180,25),short:num('sShort',1,60,5),long:num('sLong',1,90,15),
    longEvery:num('sEvery',2,10,4),weeklyGoalH:num('sGoal',1,100,15),autoBreak:$('sAuto').checked,
    subjects:subs.length?subs:DEFAULTS.subjects.slice(),
    bgFocus:$('sBgFocus').value==='glass'?'glass':'snow',bgBreak:$('sBgBreak').value==='same'?'same':'fire',
    bgSpeed:num('sBgSpeed',10,150,50),fireworks:$('sFireworks').checked};
  persistSettings(); renderAll(); renderSettings(); bgInit(); toast('設定を保存しました');
};
(function(){const n=new Date(); $('mDate').value=dayKey(n); $('mTime').value=hm(n)})();
document.addEventListener('visibilitychange',tick);

/* ---------- ファイル保存・バックアップ ---------- */
function saveFile(name,data,mime){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([data],{type:mime})); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove()},1500); return true;
}
function csvText(){
  const rows=[['日付','開始','終了','分','科目','タスク','メモ','手動']];
  allSessions().sort((a,b)=>a.start-b.start).forEach(s=>rows.push([dayKey(s.start),hm(s.start),hm(s.end),s.min,s.subject,s.task||'',s.memo||'',s.manual?'1':'']));
  return '\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
}
$('btnCsv').onclick=()=>saveFile('study-log-'+dayKey(Date.now())+'.csv',csvText(),'text/csv');
$('btnExport').onclick=async()=>{
  const data=JSON.stringify({app:'focus-timer',version:1,exportedAt:new Date().toISOString(),settings,months,tasks},null,1);
  if(saveFile('focus-timer-backup-'+dayKey(Date.now())+'.json',data,'application/json')) toast('書き出しました');
};
$('btnImport').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{
  const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return;
  let d; try{d=JSON.parse(await f.text())}catch(err){toast('ファイルを読み込めませんでした（JSON形式ではありません）');return}
  if(!d||d.app!=='focus-timer'||typeof d.months!=='object'){toast('このアプリのバックアップファイルではありません');return}
  let added=0; const touched=new Set();
  Object.entries(d.months||{}).forEach(([k,arr])=>{ if(!/^\d{4}-\d{2}$/.test(k)||!Array.isArray(arr)) return;
    const cur=months[k]||[], ids=new Set(cur.map(x=>x.id));
    const add=arr.filter(x=>x&&x.id&&typeof x.start==='number'&&typeof x.min==='number'&&!ids.has(x.id));
    if(add.length){months[k]=[...cur,...add]; added+=add.length; touched.add(k)} });
  let tAdded=0;
  if(Array.isArray(d.tasks)){const ids=new Set(tasks.map(x=>x.id)); const add=d.tasks.filter(x=>x&&x.id&&x.title&&!ids.has(x.id)).slice(0,Math.max(0,100-tasks.length)); if(add.length){tasks=[...tasks,...add]; tAdded=add.length; persistTasks()}}
  if(d.settings&&typeof d.settings==='object'){settings={...DEFAULTS,...settings,...d.settings}; persistSettings()}
  touched.forEach(persistMonth); saveLocal(); renderAll(); renderSettings();
  toast('記録'+added+'件、タスク'+tAdded+'件を取り込みました');
};
$('btnCsv').hidden=false;

const LOOKS=['simple','grad','anim'], LOOK_LBL={simple:'シンプル',grad:'グラデーション',anim:'アニメ'};
let look=lsGet('pomo.look.v1'); if(!LOOKS.includes(look)) look='simple';
function sceneNow(){ if(look!=='anim') return 'none';
  if(t.mode==='focus') return settings.bgFocus==='glass'?'glass':'snow';
  return settings.bgBreak==='same'?(settings.bgFocus==='glass'?'glass':'snow'):'fire'; }
function applyLook(){
  const root=document.documentElement; root.dataset.look=look==='simple'?'':'grad';
  const sc=sceneNow(); if(sc==='none') root.removeAttribute('data-scene'); else root.dataset.scene=sc;
  pillText();
  setScene(sc);
}
function pillText(){$('modePill').textContent=MODE_LABEL[t.mode]+'：'+LOOK_LBL[look]; $('modePill').setAttribute('aria-label',MODE_LABEL[t.mode]+'。表示：'+LOOK_LBL[look]+'（押すと切り替え）')}
function lookColor(){
  if(look==='anim') return BGC[sceneNow()]||'#0b1220';
  if(look==='grad') return {focus:'#24357F',short:'#1F8AA6',long:'#8A7ADB'}[t.mode];
  return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||'#EEF1F5';
}
$('modePill').onclick=()=>{
  const f=$('lookFade');
  if(!RM){f.classList.add('hold'); f.style.background=lookColor(); f.style.opacity='1'; void f.offsetWidth; f.classList.remove('hold')}
  look=LOOKS[(LOOKS.indexOf(look)+1)%3]; lsSet('pomo.look.v1',look); applyLook();
  if(!RM) requestAnimationFrame(()=>requestAnimationFrame(()=>{f.style.opacity='0'}));
};
$('sBgSpeed').oninput=()=>{$('sBgSpeedOut').textContent=$('sBgSpeed').value+'%'};

/* ---------- 背景アニメーション ---------- */
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const bg={cv:$('bgc'),cx:$('bgc').getContext('2d'),W:0,H:0,d:1,scene:'none',parts:[],sparks:[],next:0,cele:0,celeN:0,running:false,t0:0};
const BGC={glass:'#16222f',snow:'#040f1f',fire:'#0a0f24'};
const rnd=(a,b)=>a+Math.random()*(b-a);
function bgSize(){bg.d=Math.min(2,window.devicePixelRatio||1); bg.W=bg.cv.width=innerWidth*bg.d; bg.H=bg.cv.height=innerHeight*bg.d}
function bgInit(){const W=bg.W,H=bg.H,d=bg.d; bg.parts=[];
  const n={glass:35,snow:90,fire:70,none:0}[bg.scene];
  for(let i=0;i<n;i++) bg.parts.push({x:rnd(0,W),y:rnd(0,H),r:rnd(1,4),v:rnd(.3,1),p:rnd(0,6.28),hold:rnd(0,200)});
  if(bg.scene==='glass') for(let i=0;i<26;i++) bg.parts.push({bokeh:1,x:rnd(0,W),y:rnd(0,H),r:rnd(15,45)*d,c:['#f2b35a','#e86b6b','#6bb5e8'][i%3],p:rnd(0,6.28)});
  if(bg.scene!=='none'){bg.cx.fillStyle=BGC[bg.scene]; bg.cx.fillRect(0,0,W,H)}
}
function spd(){return (Number(settings.bgSpeed)||50)/100*(RM?.3:1)}
function setScene(sc){ if(sc===bg.scene) return; bg.scene=sc; bgInit(); bgLoop() }
function bgLoop(){ if(!bg.running&&(bg.scene!=='none'||bg.sparks.length||bg.cele)){bg.running=true; bg.t0=performance.now(); requestAnimationFrame(bgDraw)} }
function burst(big){const W=bg.W,H=bg.H,d=bg.d,x=rnd(W*.15,W*.85),y=rnd(H*.12,H*.42);
  const hues=['255,190,120','255,140,160','150,200,255','200,170,255','255,230,150'],c=hues[Math.floor(rnd(0,hues.length))],n=big?110:70;
  for(let i=0;i<n;i++){const a=i/n*6.283+rnd(-.05,.05),v=rnd(.6,1)*(big?2.6:1.8)*d;bg.sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,c,decay:rnd(.006,.01)})}}
function celebrate(){ if(!settings.fireworks||RM) return; bg.celeN=0; bg.cele=performance.now(); if(bg.scene==='none') bg.cv.classList.add('overlay'); bgLoop() }
function bgDraw(now){
  const cx=bg.cx,W=bg.W,H=bg.H,d=bg.d,dt=Math.min(50,now-bg.t0)/16; bg.t0=now; const s=dt*spd();
  if(bg.scene==='none'&&!bg.sparks.length&&!bg.cele){cx.clearRect(0,0,W,H); bg.cv.classList.remove('overlay'); bg.running=false; return}
  if(bg.scene==='none') cx.clearRect(0,0,W,H);
  else if(bg.scene==='fire'){cx.fillStyle='rgba(10,15,36,'+(.12+.1*spd())+')'; cx.fillRect(0,0,W,H);
    bg.parts.forEach(p=>{cx.fillStyle='rgba(255,255,255,'+(.15+.15*Math.sin(now/3000+p.p))+')'; cx.fillRect(p.x,p.y*.6,d,d)});
    if(now>bg.next){ if(bg.next) burst(false); bg.next=now+rnd(3500,6500)/spd() }}
  else { cx.fillStyle=BGC[bg.scene]; cx.fillRect(0,0,W,H);
    if(bg.scene==='glass'){
      bg.parts.forEach(p=>{if(p.bokeh){cx.globalAlpha=.12+.04*Math.sin(now/5000+p.p); cx.fillStyle=p.c; cx.beginPath(); cx.arc(p.x,p.y,p.r,0,7); cx.fill()}}); cx.globalAlpha=1;
      bg.parts.forEach(p=>{if(p.bokeh) return; p.hold-=s; let v=.05*p.v; if(p.hold<0){v=.9*p.v; if(p.hold<-40) p.hold=rnd(150,500)}
        p.y+=v*s*d; if(p.y>H+20){p.y=-10; p.x=rnd(0,W)}
        cx.strokeStyle='rgba(200,220,240,.14)'; cx.lineWidth=p.r*.7*d; cx.beginPath(); cx.moveTo(p.x,p.y-p.r*7*d); cx.lineTo(p.x,p.y); cx.stroke();
        cx.fillStyle='rgba(220,235,250,.5)'; cx.beginPath(); cx.arc(p.x,p.y,p.r*1.3*d,0,7); cx.fill()});
    } else {
      bg.parts.forEach(p=>{p.y+=p.v*.12*s*d; p.x+=Math.sin(now/6000+p.p)*.05*d*spd(); if(p.y>H+5){p.y=-5; p.x=rnd(0,W)}
        cx.fillStyle='rgba(220,235,255,'+(.22+p.r*.07)+')'; cx.beginPath(); cx.arc(p.x,p.y,p.r*.6*d,0,7); cx.fill()});
      const ph=now/1000*spd(), jx=W*.78+Math.sin(ph*.06)*W*.04, jy=H*.62+Math.sin(ph*.09)*H*.05, pu=1+.08*Math.sin(ph*.5), jr=Math.min(W,H)*.08;
      cx.fillStyle='rgba(190,160,255,.24)'; cx.beginPath(); cx.ellipse(jx,jy,jr*pu,jr*.75/pu,0,Math.PI,0); cx.fill();
      cx.strokeStyle='rgba(200,175,255,.28)'; cx.lineWidth=1.5*d;
      for(let i=0;i<6;i++){const tx=jx-jr*.8+i*jr*.32; cx.beginPath(); cx.moveTo(tx,jy); for(let y=0;y<jr*2.6;y+=4*d) cx.lineTo(tx+Math.sin(y/(22*d)+ph*.5+i)*4*d,jy+y); cx.stroke()}
    }}
  if(bg.cele&&now>bg.cele){burst(true); bg.celeN++; bg.cele=bg.celeN>=6?0:now+rnd(280,480)}
  const k=dt*.8;
  bg.sparks.forEach(p=>{p.x+=p.vx*k; p.y+=p.vy*k; p.vx*=Math.pow(.985,k); p.vy=p.vy*Math.pow(.985,k)+.02*k*d; p.life-=p.decay*k;
    cx.fillStyle='rgba('+p.c+','+Math.max(0,p.life)+')'; cx.beginPath(); cx.arc(p.x,p.y,1.6*d,0,7); cx.fill()});
  bg.sparks=bg.sparks.filter(p=>p.life>0&&p.y<H+20);
  requestAnimationFrame(bgDraw);
}
bgSize(); addEventListener('resize',()=>{bgSize(); bgInit()});
applyLook();
renderAll();
setInterval(tick,250);
})();

if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}
