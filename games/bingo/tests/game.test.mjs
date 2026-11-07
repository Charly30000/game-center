import test from 'node:test';
import assert from 'node:assert/strict';
import { BingoGame } from '../domain/game.mjs';
import { generateTickets, seededRandom } from '../domain/tickets.mjs';

const catalog = generateTickets(250);
function setup(count = 2) {
  let timer;
  const revoked = [];
  const game = new BingoGame({ tickets: catalog, random: seededRandom(42), schedule: callback => { timer = callback; return 1; }, unschedule: () => { timer = null; }, revoke: id => revoked.push(id) });
  game.connect('tv', { role: 'tv' });
  const sessions = [];
  for (let i = 0; i < count; i++) {
    sessions.push(game.connect(`p${i}`, { role: 'player' }));
    game.action(`p${i}`, 'profile', { name: `Jugador ${i}`, avatar: i % 20 });
  }
  return { game, sessions, revoked, draw() { const callback = timer; timer = null; callback(); }, turn() { return { roundId: game.roundId, turn: game.called.length }; } };
}
function markAll(fixture, client) {
  const me = fixture.game.view(client).me;
  me.cards.forEach((card, index) => card.filter(n => n && fixture.game.called.includes(n) && !me.marks[index].includes(n)).forEach(number => fixture.game.action(client, 'mark', { ...fixture.turn(), card: index, number })));
}
test('la sala empieza con 3 cartones y no permite iniciar sin jugadores', () => {
  const { game } = setup(0);
  assert.equal(game.settings.cardsPerPlayer, 3);
  assert.throws(() => game.action('tv', 'start'));
  assert.throws(() => game.action('tv', 'settings', { cardsPerPlayer: 6 }));
  assert.throws(() => game.action('tv', 'settings', { cardsPerPlayer: 0 }));
});
test('la extracción dura cinco segundos y publica el mismo reloj para todas las pantallas',()=>{
  let scheduled;
  const game=new BingoGame({tickets:catalog,schedule:(callback,ms)=>{scheduled={callback,ms};return 1;}});
  game.connect('tv',{role:'tv'});game.connect('p',{role:'player'});game.action('p','profile',{name:'Andrés',avatar:0});
  game.action('tv','start');
  assert.equal(scheduled.ms,5000);assert.equal(game.view('tv').drawDurationMs,5000);
  assert.equal(game.view('tv').drawEndsAt,game.view('p').drawEndsAt);
  assert.equal(game.phase,'drawing');assert.equal(game.current,null);
  scheduled.callback();assert.equal(game.phase,'marking');assert.ok(game.current>=1&&game.current<=90);
});
test('nombre único sin diferencias de mayúsculas, entre 3 y 40 caracteres', () => {
  const { game } = setup();
  for (const name of ['a', 'x'.repeat(41), 'Juga\u0000dor']) assert.throws(() => game.action('p0', 'profile', { name, avatar: 0 }));
  assert.throws(() => game.action('p0', 'profile', { name: ' jugador  1 ', avatar: 1 }));
  game.action('p0', 'profile', { name: '<María>', avatar: 1 });
  assert.equal(game.view('p0').me.name, '<María>');
});
test('reparte cartones únicos, no expone cartones ni tokens de otros jugadores', () => {
  const { game } = setup(40); game.action('tv', 'settings', { cardsPerPlayer: 5 }); game.action('tv', 'start');
  const cards = [...game.players.values()].flatMap(player => player.cards);
  assert.equal(new Set(cards.map(card => card.join(','))).size, 200);
  assert.equal(game.view('tv').me, null);
  assert.ok(game.view('p0').players.every(player => !('cards' in player) && !('token' in player)));
  assert.equal(game.view('p0').me.cards.length, 5);
  assert.throws(() => game.action('p0', 'cancel'));
  assert.throws(() => game.action('p0', 'settings', { cardsPerPlayer: 1 }));
});
test('no acepta números antes de la bola ni turnos atrasados', () => {
  const f = setup(1); f.game.action('tv', 'start');
  assert.throws(() => f.game.action('p0', 'mark', { ...f.turn(), card: 0, number: 1 }));
  f.draw();
  assert.throws(() => f.game.action('p0', 'continue', { roundId: 'anterior', turn: 1 }));
  const me = f.game.view('p0').me;
  const notCalled = me.cards[0].find(n => n && n !== f.game.current);
  assert.throws(() => f.game.action('p0', 'mark', { ...f.turn(), card: 0, number: notCalled }));
});
test('la barrera espera a todos y excluye a desconectados', () => {
  const f = setup(); f.game.action('tv', 'start'); f.draw(); markAll(f, 'p0');
  f.game.action('p0', 'continue', f.turn()); assert.equal(f.game.phase, 'marking');
  f.game.detach('p1'); assert.equal(f.game.phase, 'drawing');
});
test('si no queda nadie conectado la partida permanece pausada', () => {
  const f = setup(); f.game.action('tv', 'start'); f.draw();
  f.game.detach('p0'); f.game.detach('p1'); assert.equal(f.game.phase, 'marking');
  f.game.connect('new', { role: 'player', token: f.sessions[0].token });
  assert.deepEqual(f.game.view('new').me.cards, f.game.players.get(f.sessions[0].playerId).cards);
});
test('no continúa mientras falten números por marcar en cualquier cartón', () => {
  const f = setup(1); f.game.action('tv', 'start');
  const me = f.game.view('p0').me;
  f.game.bag = [me.cards[0].find(Boolean)]; f.draw();
  assert.throws(() => f.game.action('p0', 'continue', f.turn()));
  markAll(f, 'p0'); f.game.action('p0', 'continue', f.turn());
  assert.notEqual(f.game.phase, 'marking');
});
test('recuperación con confirmación invalida token y conexión anteriores', () => {
  const f = setup(1), session = f.sessions[0];
  f.game.connect('guest', { role: 'guest' });
  assert.throws(() => f.game.connect('guest', { role: 'player', claimPlayerId: session.playerId }), error => error.code === 'CONFIRM_TAKEOVER');
  const recovered = f.game.connect('guest', { role: 'player', claimPlayerId: session.playerId, force: true });
  assert.deepEqual(f.revoked, ['p0']); assert.notEqual(recovered.token, session.token);
  assert.throws(() => f.game.connect('other', { role: 'player', token: session.token }), error => error.code === 'SESSION_EXPIRED');
  f.game.detach('p0'); assert.equal(f.game.view('guest').me.id, session.playerId);
});
test('dos televisiones comparten configuración y un jugador pendiente no inicia', () => {
  const f = setup(0); f.game.connect('tv2', { role: 'tv' }); f.game.connect('draft', { role: 'player' });
  assert.throws(() => f.game.action('tv2', 'start'));
  f.game.action('tv2', 'settings', { cardsPerPlayer: 2, effects: false });
  assert.deepEqual(f.game.view('tv').settings, { cardsPerPlayer: 2, effects: false });
  f.game.detach('draft'); assert.equal(f.game.players.size, 0);
});
test('recargar con un token activo también rota la credencial del dispositivo anterior', () => {
  const f = setup(1); const old = f.sessions[0];
  const next = f.game.connect('reload', { role: 'player', token: old.token });
  assert.notEqual(next.token, old.token); assert.deepEqual(f.revoked, ['p0']);
  assert.throws(() => f.game.connect('stale', { role: 'player', token: old.token }), error => error.code === 'SESSION_EXPIRED');
});
test('bingo simultáneo espera la barrera, puntúa una vez y conserva victorias en revancha', () => {
  const f = setup(); f.game.action('tv', 'start');
  // Forzamos una última bola común, conservando cartones válidos del catálogo.
  const players = [...f.game.players.values()];
  const number = players[0].cards[0].find(n => n && players[1].cards[0].includes(n));
  assert.ok(number);
  for (const player of players) player.marks = player.cards.map((card, i) => i === 0 ? card.filter(n => n && n !== number) : []);
  f.game.bag = [number]; f.draw();
  for (const client of ['p0', 'p1']) markAll(f, client);
  f.game.action('p0', 'continue', f.turn()); assert.equal(f.game.phase, 'marking');
  f.game.action('p1', 'continue', f.turn());
  assert.equal(f.game.phase, 'results'); assert.equal(f.game.winners.length, 2); assert.ok(players.every(player => player.wins === 1));
  f.game.action('tv', 'restart'); assert.equal(f.game.phase, 'drawing'); assert.ok(players.every(player => player.wins === 1));
});
test('cancelar borra todos los datos y cancela la animación pendiente', () => {
  const f = setup(); f.game.action('tv', 'start'); f.game.action('tv', 'cancel');
  assert.equal(f.game.phase, 'lobby'); assert.equal(f.game.players.size, 0); assert.equal(f.game.view('p0').role, 'guest');
  assert.throws(() => f.draw());
});
test('volver a selección al terminar reinicia también las TV y lo recibe todo el mundo',()=>{
  const f=setup(2);f.game.connect('tv2',{role:'tv'});
  assert.throws(()=>f.game.action('tv','reset'));
  f.game.action('tv','start');assert.throws(()=>f.game.action('p0','reset'));
  f.game.finish([...f.game.players.values()].slice(0,1));
  f.game.action('tv2','reset');
  for(const id of ['tv','tv2','p0','p1']){
    const state=f.game.view(id);assert.equal(state.role,'guest');assert.equal(state.phase,'lobby');assert.equal(state.me,null);assert.equal(state.players.length,0);assert.equal(state.called.length,0);
  }
});
test('partida completa: no repite bolas y termina con ganador verificable', () => {
  const f = setup(3); f.game.action('tv', 'start');
  let turns = 0;
  while (f.game.phase !== 'results' && turns++ < 90) {
    f.draw();
    for (let i = 0; i < 3; i++) { markAll(f, `p${i}`); f.game.action(`p${i}`, 'continue', f.turn()); }
  }
  assert.equal(f.game.phase, 'results'); assert.ok(f.game.winners.length > 0);
  assert.equal(new Set(f.game.called).size, f.game.called.length);
  for (const id of f.game.winners) assert.ok(f.game.players.get(id).cards.some(card => card.filter(Boolean).every(n => f.game.called.includes(n))));
});
