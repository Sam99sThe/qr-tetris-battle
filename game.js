import pkg from 'tetris-engine';

// Keep the pinned engine's internal extensions in one adapter.
export class Game {
  constructor() {
    this.engine = new pkg.Engine(10, 20, () => {});
    this.score = 0;
    this.pending = 0;
    this.combo = 0;
    this.comboEvent = 0;
    this.held = null;
    this.holdUsed = false;
    this.engine.start();
    this.enter();
  }
  enter() {
    const e = this.engine;
    for (let i = 0; i < 6 && !e.state.body.some(r => r.some(c => c.val === 1)); i++) e.moveDown();
  }
  act(action) {
    const e = this.engine;
    if (e._gameStatus !== 1) return 0;
    if (action === 'hold') {
      if (this.holdUsed) return 0;
      const current = e._shape.name;
      if (this.held) {
        e._shape = new e._shape.constructor({[this.held]:e._shapesSet[this.held]}, 2, 20);
      } else e._newFigure();
      this.held = current;
      this.holdUsed = true;
      this.enter();
      return 0;
    }
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
    let attack = 0;
    if (e._shape !== piece) {
      this.combo = lines ? this.combo + 1 : 0;
      if (this.combo >= 2) this.comboEvent++;
      // First single/double clears do not attack. Every later clear uses
      // (lines - 1) * consecutive clearing pieces, measured in garbage rows.
      if (lines && !(this.combo === 1 && lines <= 2)) {
        attack = Math.max(0, (lines - 1) * this.combo);
      }
      if (this.pending > 0) this.garbage(this.pending);
      this.pending = 0;
      this.holdUsed = false;
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
  snapshot() {
    const e = this.engine;
    let delta = 0;
    while (delta > -30 && e._canShapeMove(delta - 1, 0)) delta--;
    const ghost = [];
    e._shape.body.forEach((row,y)=>row.forEach((cell,x)=>{
      if (cell) ghost.push({x:e._getAreaIndexXFromShape(x),y:19-e._getAreaIndexYFromShape(y,delta)});
    }));
    return {...e.state,score:this.score,pending:this.pending,ghost,
      combo:this.combo,comboEvent:this.comboEvent,holdUsed:this.holdUsed,
      held:this.held?{name:this.held,body:e._shapesSet[this.held]}:null};
  }
}
