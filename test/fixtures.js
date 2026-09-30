// Arrange a real-engine well; dropping a vertical I clears exactly `lines`.
export function prepareClear(game, lines, landed = false) {
  const e = game.engine;
  e._heap = [];
  e._shape = new e._shape.constructor({IShape:e._shapesSet.IShape}, 2, 20);
  e._shape.rotate();
  const column = e._shape.body.find(row => row.some(Boolean)).findIndex(Boolean);
  const hole = e._getAreaIndexXFromShape(column);
  e._heap = Array.from({length:lines}, () => Array.from({length:10}, (_,x) => ({val:x===hole?0:1,class:'fixture'})));
  game.enter();
  if (landed) while (e._canShapeMove(-1,0)) e.moveDown();
}

export function clear(game, lines, action = 'drop') {
  prepareClear(game, lines, action === 'down');
  const before = game.engine.state.statistic.countLinesReduced;
  const attack = game.act(action);
  if (game.engine.state.statistic.countLinesReduced - before !== lines) throw Error('Fixture did not clear expected lines');
  return attack;
}
