import express from 'express';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { Game } from './game.js';

const token = () => randomBytes(18).toString('hex');
export function createApp() {
  const app = express();
  const http = createServer(app);
  const io = new Server(http, {maxHttpBufferSize:4096});
  const rooms = new Map();
  app.get('/health', (_,res)=>res.json({ok:true}));
  app.get('/api/network', (req,res)=>{
    const port=http.address()?.port;
    const addresses=Object.values(networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal).map(a=>`http://${a.address}:${port}`);
    res.json({addresses,publicUrl:process.env.PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||null});
  });
  app.get('/api/qr',async(req,res)=>{
    const value=req.query.value;
    if(typeof value!=='string'||value.length>600) return res.sendStatus(400);
    res.type('svg').send(await QRCode.toString(value,{type:'svg',margin:2,width:240}));
  });
  app.use('/icons',express.static(fileURLToPath(new URL('./node_modules/lucide/dist/umd',import.meta.url))));
  app.use(express.static(fileURLToPath(new URL('./public',import.meta.url))));
  const view=r=>({id:r.id,mode:r.mode,status:r.status,winner:r.winner,hostOnline:!!r.host,players:r.players.map(p=>({online:!!p.socket,game:p.game?.snapshot()||null}))});
  const send=r=>io.to(r.id).emit('state',view(r));
  const ready=r=>!!r.host&&r.players.every(p=>p.socket);
  function finish(r) {
    const lost=r.players.map((p,i)=>p.game?.engine._gameStatus===3?i:-1).filter(i=>i>=0);
    if(lost.length){r.status='over';r.winner=r.mode===1?null:lost.length===2?null:1-lost[0];}
  }
  io.on('connection',socket=>{
    const fail=(ack,msg)=>typeof ack==='function'&&ack({error:msg});
    socket.on('create',({mode}={},ack)=>{
      if(socket.data.room) return fail(ack,'請先離開目前房間');
      if(![1,2].includes(mode)) return fail(ack,'無效模式');
      if(rooms.size>=200) return fail(ack,'房間已滿，請稍後再試');
      const id=randomBytes(4).toString('hex').toUpperCase();
      const r={id,mode,host:socket.id,hostKey:token(),status:'waiting',winner:null,updated:Date.now(),players:Array.from({length:mode},()=>({key:token(),socket:null,game:null,last:0}))};
      rooms.set(id,r); socket.join(id);socket.data={room:id,role:'host'};
      ack?.({id,hostKey:r.hostKey,keys:r.players.map(p=>p.key)});send(r);
    });
    socket.on('join',({id,key,role}={},ack)=>{
      if(socket.data.room) return fail(ack,'已加入房間');
      const r=rooms.get(id);
      if(!r) return fail(ack,'房間不存在或已過期');
      if(role==='host'){
        if(key!==r.hostKey) return fail(ack,'無效主機憑證');
        if(r.host) return fail(ack,'主機已連線');
        r.host=socket.id;socket.data={room:id,role:'host'};
        ack?.({id,hostKey:key,keys:r.players.map(p=>p.key)});
      }else{
        const index=r.players.findIndex(p=>p.key===key);
        if(index<0) return fail(ack,'無效玩家連結');
        if(r.players[index].socket) return fail(ack,'這個玩家席位已被使用');
        r.players[index].socket=socket.id;socket.data={room:id,role:'player',index};ack?.({index});
      }
      socket.join(id);r.updated=Date.now();send(r);
    });
    socket.on('start',(_,ack)=>{
      const r=rooms.get(socket.data.room);
      if(!r||socket.data.role!=='host')return fail(ack,'只有主機可開始');
      if(!ready(r))return fail(ack,'請等待所有控制器連線');
      if(r.status==='running')return;
      if(r.status!=='paused')r.players.forEach(p=>{p.game=new Game();});
      r.status='running';r.winner=null;r.updated=Date.now();ack?.({ok:true});send(r);
    });
    socket.on('pause',()=>{const r=rooms.get(socket.data.room);if(r&&socket.data.role==='host'&&r.status==='running'){r.status='paused';send(r);}});
    socket.on('input',action=>{
      const r=rooms.get(socket.data.room);
      if(!r||r.status!=='running'||socket.data.role!=='player'||!['left','right','rotate','down','drop'].includes(action))return;
      const p=r.players[socket.data.index];const now=Date.now();if(now-p.last<35)return;p.last=now;
      const attack=p.game.act(action);
      if(r.mode===2)r.players[1-socket.data.index].game.pending=Math.min(20,r.players[1-socket.data.index].game.pending+attack);
      finish(r);send(r);
    });
    socket.on('closeRoom',()=>{const r=rooms.get(socket.data.room);if(r&&socket.data.role==='host'){io.to(r.id).emit('closed');io.in(r.id).disconnectSockets();rooms.delete(r.id);}});
    socket.on('disconnect',()=>{
      const r=rooms.get(socket.data.room);if(!r)return;
      if(socket.data.role==='host')r.host=null;else r.players[socket.data.index].socket=null;
      if(r.status==='running')r.status='paused';r.updated=Date.now();send(r);
    });
  });
  const timer=setInterval(()=>{
    for(const r of rooms.values()){
      if(r.status==='running'){
        r.updated=Date.now();
        const attacks=r.players.map(p=>p.game.act('down'));
        if(r.mode===2)r.players.forEach((p,i)=>{p.game.pending=Math.min(20,p.game.pending+attacks[1-i]);});
        finish(r);send(r);
      }else if(Date.now()-r.updated>3600000){io.to(r.id).emit('closed');io.in(r.id).disconnectSockets();rooms.delete(r.id);}
    }
  },650);
  http.on('close',()=>clearInterval(timer));
  return {http,io,rooms};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {http}=createApp();http.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Tetris console listening on ${http.address().port}`));
}
