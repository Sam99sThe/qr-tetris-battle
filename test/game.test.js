import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game.js';
import {clear,prepareClear} from './fixtures.js';

for (const [lines, expected] of [
  [[1],[0]], [[2],[0]], [[3],[2]], [[4],[3]],
  [[2,2],[0,2]], [[3,3],[2,4]], [[4,1],[3,0]], [[4,2],[3,2]],
  [[2,2,3],[0,2,6]], [[4,0,2],[3,0,0]], [[0,0,3],[0,0,2]],
  [[1,1,2],[0,0,3]], [[3,0,3],[2,0,2]]
]) test(`clears ${lines.join(' → ')} send ${expected.join(' → ')} rows`, () => {
  const game = new Game();
  assert.deepEqual(lines.map(n => clear(game,n)),expected);
});

test('gravity/soft drop locks use the same attack rule', () => {
  const game = new Game();
  assert.equal(clear(game,3,'down'),2);
  assert.equal(clear(game,3,'down'),4);
  assert.equal(game.combo,2);
});

test('movement and hold neither count as a lock nor consume pending rows', () => {
  const game = new Game();
  clear(game,3);
  prepareClear(game,0);
  game.pending=2;
  for(const action of ['left','right','rotate','down','hold']) {
    assert.equal(game.act(action),0);
    assert.equal(game.combo,1);
    assert.equal(game.pending,2);
  }
  assert.equal(game.holdUsed,true);
  assert.equal(game.engine._heap.length,0);
});

test('pending rows are applied one-for-one at the bottom, without outgoing cancellation', () => {
  const game = new Game();
  clear(game,2);
  game.pending=2;
  assert.equal(clear(game,2),2);
  assert.equal(game.pending,0);
  for(const row of game.engine._heap.slice(0,2)) {
    assert.equal(row.filter(c=>c.class==='garbage').length,10);
    assert.equal(row.filter(c=>c.val).length,9);
  }
  assert.equal(game.engine._heap.filter(r=>r.some(c=>c.class==='garbage')).length,2);
});

test('large attacks preserve row count and cause top out instead of being capped to 20', () => {
  const game = new Game();
  for(let i=0;i<7;i++)clear(game,4);
  assert.equal(clear(game,4),24);
  const receiver=new Game();receiver.pending=24;clear(receiver,0);
  assert.equal(receiver.engine._gameStatus,3);
  assert.equal(receiver.pending,0);
});

test('non-clearing locks reset combo and expose second-clear animation events', () => {
  const game=new Game();clear(game,2);assert.equal(game.comboEvent,0);
  clear(game,2);assert.equal(game.comboEvent,1);assert.equal(game.snapshot().combo,2);
  clear(game,0);assert.equal(game.combo,0);assert.equal(clear(game,2),0);
});
