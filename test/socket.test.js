import {test} from 'node:test';
import assert from 'node:assert/strict';
import {io as connect} from 'socket.io-client';
import {createApp} from '../server.js';
import {prepareClear} from './fixtures.js';

function stateMatching(socket,predicate){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off('state',listen);reject(Error('Timed out waiting for battle state'));},4000);function listen(s){if(predicate(s)){clearTimeout(timer);socket.off('state',listen);resolve(s)}}socket.on('state',listen);});}
test('real socket battle routes exact rows for manual and gravity locks',async t=>{
  const app=createApp();await new Promise(r=>app.http.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${app.http.address().port}`,clients=[];
  t.after(async()=>{clients.forEach(c=>c.disconnect());await new Promise(r=>app.io.close(r));});
  async function client(){const c=connect(base,{transports:['websocket'],reconnection:false});clients.push(c);await new Promise((r,j)=>{c.once('connect',r);c.once('connect_error',j)});return c;}
  const host=await client(),a=await client(),b=await client();
  const room=await host.timeout(3000).emitWithAck('create',{mode:2});
  await a.timeout(3000).emitWithAck('join',{id:room.id,key:room.keys[0]});
  await b.timeout(3000).emitWithAck('join',{id:room.id,key:room.keys[1]});
  await host.timeout(3000).emitWithAck('start',{});
  const [left,right]=app.rooms.get(room.id).players;
  prepareClear(left.game,3);
  let next=stateMatching(host,s=>s.players[1].game?.pending===2);
  a.emit('input','drop');await next;
  assert.equal(left.game.combo,1);assert.equal(right.game.pending,2);
  prepareClear(right.game,0);
  next=stateMatching(host,s=>s.players[1].game?.pending===0);
  b.emit('input','drop');await next;
  assert.equal(right.game.engine._heap.filter(r=>r.some(c=>c.class==='garbage')).length,2);
  prepareClear(left.game,3,true);
  next=stateMatching(host,s=>s.players[0].game?.combo===2&&s.players[1].game?.pending===4);
  await next; // Server gravity locks the prepared piece without controller input.
  assert.equal(right.game.pending,4);
});
