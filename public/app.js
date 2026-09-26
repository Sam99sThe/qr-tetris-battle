const app=document.querySelector('#app'), socket=io();
const params=new URLSearchParams(location.search);
const controller=params.has('room');
let mode=1,credentials=null,state=null,player=null,base=location.origin,screen='',toastTimer;
const icons=()=>window.lucide?.createIcons();
const icon=name=>`<i data-lucide="${name}"></i>`;
function message(text){document.querySelector('#message').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>document.querySelector('#message').textContent='',6000);}
const ack=result=>{if(result?.error)message(result.error);};
function setup(){
  screen='setup';
  app.innerHTML=`<div class="setup"><section><p class="eyebrow">01 / ARCADE</p><h1>TETRIS<br>BATTLE</h1><p>選擇玩家人數</p><div class="mode-options"><button class="mode" data-mode="1" aria-pressed="${mode===1}"><strong>1P</strong><span>單人挑戰</span></button><button class="mode" data-mode="2" aria-pressed="${mode===2}"><strong>2P</strong><span>雙人對戰</span></button></div><button class="primary wide" id="create">${icon('qr-code')} 建立遊戲房間</button></section><div class="setup-art"><canvas id="art" width="600" height="440"></canvas></div></div>`;
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=Number(b.dataset.mode);setup();});
  document.querySelector('#create').onclick=()=>{socket.timeout(5000).emit('create',{mode},(error,r)=>{if(error)return message('房間建立逾時，請重新整理再試');if(r.error)return message(r.error);credentials=r;sessionStorage.setItem('host',JSON.stringify(r));screen='';});};
  const c=document.querySelector('#art').getContext('2d');c.clearRect(0,0,600,440);
  const pieces=[{x:80,y:210,color:'#c5ef77',cells:[[0,0],[1,0],[2,0],[1,1]]},{x:300,y:70,color:'#79d5e8',cells:[[0,0],[0,1],[0,2],[0,3]]},{x:390,y:250,color:'#fa8ba9',cells:[[0,0],[1,0],[1,1],[2,1]]},{x:120,y:40,color:'#c4b2ef',cells:[[0,0],[1,0],[0,1],[1,1]]}];
  pieces.forEach(p=>p.cells.forEach(([x,y])=>{c.fillStyle=p.color;c.fillRect(p.x+x*48,p.y+y*48,43,43);c.fillStyle='#ffffff45';c.fillRect(p.x+x*48+4,p.y+y*48+4,35,4);}));icons();
}
function joinUrl(i){const url=new URL(base);url.pathname='/';url.search='';url.searchParams.set('room',credentials.id);url.searchParams.set('key',credentials.keys[i]);return url.href;}
function updateQr(){document.querySelectorAll('[data-qr]').forEach(img=>img.src='/api/qr?value='+encodeURIComponent(joinUrl(Number(img.dataset.qr))));}
function hostView(){
  const lobby=state.status==='waiting';
  const next=lobby?'lobby':'arena';
  if(screen!==next){screen=next;app.innerHTML=`<div class="titlebar"><div><p class="eyebrow">${state.mode}P / ${state.mode===1?'SOLO':'BATTLE'}</p><h1>TETRIS BATTLE</h1></div><div class="actions"><span class="room-id">ROOM ${state.id}</span><button id="leave" title="結束房間" aria-label="結束房間">${icon('log-out')}</button><button id="pause" title="暫停" aria-label="暫停">${icon('pause')}</button><button class="primary" id="start">開始遊戲</button></div></div><div class="game-banner" id="banner"></div>${lobby?`<div class="lobby">${state.players.map((_,i)=>`<section class="join-card"><div class="player-head p${i+1}"><span>PLAYER ${i+1}</span><span class="badge" id="online${i}"></span></div><img class="qr" data-qr="${i}" alt="玩家 ${i+1} 控制器 QR code"><button data-copy="${i}">${icon('copy')} 複製控制器連結</button></section>`).join('')}</div><div class="network"><label for="base">手機連線網址</label><input id="base" type="url"><p>本機遊玩時，手機與電腦需使用相同 Wi-Fi。</p></div>`:`<div class="arena ${state.mode===1?'solo':''}">${state.players.map((_,i)=>`<section class="board-wrap"><div class="player-head p${i+1}"><span>PLAYER ${i+1}</span><span class="badge" id="online${i}"></span></div><canvas id="board${i}" width="300" height="600" aria-label="玩家 ${i+1} 棋盤"></canvas><div class="score-row"><div><span>SCORE</span><strong id="score${i}">0</strong></div><div><span>LINES</span><strong id="lines${i}">0</strong></div><div><span>INCOMING</span><strong id="pending${i}">0</strong></div></div></section>`).join('')}</div>`}`;
    document.querySelector('#start').onclick=()=>socket.emit('start',{},ack);
    document.querySelector('#pause').onclick=()=>socket.emit('pause');
    document.querySelector('#leave').onclick=()=>{if(confirm('結束目前房間？'))socket.emit('closeRoom');};
    if(lobby){const input=document.querySelector('#base');input.value=base;input.onchange=()=>{try{const url=new URL(input.value);if(!['http:','https:'].includes(url.protocol))throw Error();base=url.origin;updateQr();}catch{message('請輸入有效的 http 或 https 網址');}};updateQr();document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(joinUrl(Number(b.dataset.copy)));message('已複製控制器連結');}catch{message(joinUrl(Number(b.dataset.copy)));}});}
    icons();
  }
  const ready=state.players.every(p=>p.online);
  const start=document.querySelector('#start');start.hidden=state.status==='running';start.disabled=!ready;start.textContent=state.status==='paused'?'繼續遊戲':state.status==='over'?'再玩一次':'開始遊戲';
  document.querySelector('#pause').hidden=state.status!=='running';
  document.querySelector('#banner').textContent=state.status==='waiting'?(ready?'玩家已就緒':'等待手機控制器加入'):state.status==='paused'?'已暫停 · 等待就緒後繼續':state.status==='over'?(state.mode===1?'挑戰結束':state.winner===null?'平手':`PLAYER ${state.winner+1} 獲勝`):'';
  state.players.forEach((p,i)=>{const status=document.querySelector('#online'+i);status.textContent=p.online?'已連線':'未連線';status.classList.toggle('joined',p.online);if(!lobby&&p.game){draw(document.querySelector('#board'+i),p.game.body);document.querySelector('#score'+i).textContent=p.game.score;document.querySelector('#lines'+i).textContent=p.game.statistic.countLinesReduced;document.querySelector('#pending'+i).textContent=p.game.pending;}});
}
function draw(canvas,body){const c=canvas.getContext('2d');const colors=['#c5ef77','#79d5e8','#fa8ba9','#c4b2ef','#ffd56b','#73b8f5','#f1a878'];c.fillStyle='#0b0f11';c.fillRect(0,0,300,600);body.forEach((row,y)=>row.forEach((cell,x)=>{c.strokeStyle='#1d272a';c.strokeRect(x*30,y*30,30,30);if(cell.val){const name=cell.cssClasses.filter(Boolean).at(-1)||'x';c.fillStyle=name==='garbage'?'#758285':colors[[...name].reduce((a,s)=>a+s.charCodeAt(0),0)%colors.length];c.fillRect(x*30+1,y*30+1,28,28);c.fillStyle='#ffffff40';c.fillRect(x*30+4,y*30+4,22,3);}}));}
function controllerView(){
  if(screen!=='controller'){screen='controller';app.innerHTML=`<section class="controller"><p class="eyebrow">TETRIS BATTLE / CONTROLLER</p><h1 id="playerLabel">手機控制器</h1><p class="controller-status" id="status">正在連線</p><div class="pad"><button class="rotate" data-action="rotate" aria-label="旋轉" title="旋轉">${icon('rotate-cw')}</button><button style="grid-column:1" data-action="left" aria-label="左移" title="左移">${icon('arrow-left')}</button><button data-action="down" aria-label="加速下降" title="加速下降">${icon('arrow-down')}</button><button data-action="right" aria-label="右移" title="右移">${icon('arrow-right')}</button><button class="drop" data-action="drop">${icon('arrow-down-to-line')} 直接落下</button></div><div class="controller-footer" id="roomLabel"></div></section>`;icons();
    document.querySelectorAll('[data-action]').forEach(b=>{let repeat;const stop=()=>{clearInterval(repeat);b.classList.remove('pressed');};b.onpointerdown=e=>{if(b.disabled)return;e.preventDefault();b.setPointerCapture(e.pointerId);stop();b.classList.add('pressed');socket.emit('input',b.dataset.action);if(['left','right','down'].includes(b.dataset.action))repeat=setInterval(()=>socket.emit('input',b.dataset.action),105);};b.onpointerup=stop;b.onpointercancel=stop;b.onlostpointercapture=stop;window.addEventListener('blur',stop);});
  }
  document.querySelector('#playerLabel').textContent=player===null?'手機控制器':`PLAYER ${player+1}`;
  document.querySelector('#roomLabel').textContent='ROOM '+params.get('room');
  document.querySelector('#status').textContent=!socket.connected?'連線中斷，正在重新連線':!state?'等待連線':state.status==='running'?'遊戲進行中':state.status==='waiting'?'已就緒，等待主畫面開始':state.status==='paused'?'遊戲已暫停':state.mode===1?'挑戰結束':state.winner===player?'你獲勝了！':'對戰結束';
  document.querySelectorAll('[data-action]').forEach(b=>b.disabled=!socket.connected||state?.status!=='running');
}
socket.on('connect',async()=>{
  document.querySelector('#connection').textContent='已連線';document.querySelector('#connection').classList.add('online');
  if(controller){controllerView();socket.emit('join',{id:params.get('room'),key:params.get('key')},r=>{if(r.error){document.querySelector('#status').textContent=r.error;return message(r.error);}player=r.index;controllerView();});}
  else{const saved=sessionStorage.getItem('host');if(saved){try{credentials=JSON.parse(saved);socket.emit('join',{id:credentials.id,key:credentials.hostKey,role:'host'},r=>{if(r.error){sessionStorage.removeItem('host');credentials=null;setup();}else credentials=r;});}catch{sessionStorage.removeItem('host');setup();}}else setup();
    try{const net=await fetch('/api/network').then(r=>r.json());base=net.publicUrl||(['localhost','127.0.0.1'].includes(location.hostname)?net.addresses[0]||location.origin:location.origin);if(screen==='lobby'){document.querySelector('#base').value=base;updateQr();}}catch{}
  }
});
socket.on('state',s=>{state=s;if(controller)controllerView();else hostView();});
socket.on('disconnect',()=>{document.querySelector('#connection').textContent='重新連線中';document.querySelector('#connection').classList.remove('online');if(controller)controllerView();else document.querySelectorAll('#start,#create').forEach(b=>b.disabled=true);});
socket.on('closed',()=>{sessionStorage.removeItem('host');state=null;credentials=null;if(controller){controllerView();document.querySelector('#status').textContent='房間已結束，請重新掃描 QR code';}else location.reload();});
if(controller)controllerView();
