import pkg from 'tetris-engine';

// Keep the pinned engine's internal extensions in one adapter.
export class Game {
  constructor() {
    this.engine = new pkg.Engine(10, 20, () => {});
    this.score = 0;
    this.pending = 0;
    this.engine.start();
    this.enter();
  }
  enter() {
    const e = this.engine;
    for (let i = 0; i < 6 && !e.state.body.some(r => r.some(c => c.val === 1)); i++) e.moveDown();
  }
  act(action) {
    const e = this.engine;
    const before = e.state.statistic.countLinesReduced;
    const piece = e._shape;
    if (action === 'drop') {
      for (let i = 0; i < 30 && e._shape === piece && e._gameStatus === 1; i++) e.moveDown();
    } else {
      const method = {left:'moveLeft',right:'moveRight',rotate:'rotate',down:'moveDown'}[action];
      if (method) e[method]();
    }
    const lines = e.state.statistic.countLinesReduced - before;
    this.score += [0,100,300,500,800][lines] || 0;
    let attack = [0,0,1,2,4][lines] || 0;
    const cancel = Math.min(attack, this.pending);
    attack -= cancel;
    this.pending -= cancel;
    if (e._shape !== piece) {
      if (this.pending) this.garbage(this.pending);
      this.pending = 0;
      this.enter();
    }
    return attack;
  }
  garbage(count) {
    const e = this.engine;
    const hole = Math.floor(Math.random() * 10);
    for (let n = 0; n < count; n++) e._heap.unshift(Array.from({length:10}, (_,x) => ({val:x===hole?0:1,class:'garbage'})));
    if (e._heap.slice(20).some(r=>r.some(c=>c.val))) e._gameStatus = 3;
    e._heap.length = Math.min(20,e._heap.length);
  }
  snapshot() { return {...this.engine.state,score:this.score,pending:this.pending}; }
}
