import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { setTimeout as delay } from 'node:timers/promises';

const base = process.env.BASE_URL || 'http://center:3000';
const clients = [];
async function wait(check, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (check()) return; await delay(20); }
  throw new Error('Tiempo agotado esperando estado.');
}
async function connect(identity) {
  const socket = new WebSocket(base.replace(/^http/, 'ws') + '/ws/bingo');
  const client = { socket, state: null, revoked: false, identity, serial: 0, pending: new Map() }; clients.push(client);
  socket.on('error', () => {});
  socket.on('message', raw => {
    const message = JSON.parse(raw);
    if (message.type === 'state') client.state = message;
    if (message.type === 'revoked') client.revoked = true;
    if (client.pending.has(message.requestId)) {
      const pending = client.pending.get(message.requestId); client.pending.delete(message.requestId); clearTimeout(pending.timeout);
      if (message.type === 'error') pending.reject(Object.assign(new Error(message.message), { code: message.code })); else pending.resolve(message.result);
    }
  });
  client.request = (type, payload = {}) => new Promise((resolve, reject) => {
    const requestId = String(++client.serial);
    const timeout = setTimeout(() => { client.pending.delete(requestId); reject(new Error(`Sin respuesta a ${type}`)); }, 10000);
    client.pending.set(requestId, { resolve, reject, timeout });
    socket.send(JSON.stringify({ type, requestId, payload: { ...payload, roundId: client.state?.roundId, turn: client.state?.turn } }));
  });
  await wait(() => socket.readyState === WebSocket.OPEN, 30000);
  client.session = await client.request('hello', identity);
  return client;
}
try {
  const launched = await Promise.all(Array.from({ length: 8 }, () => fetch(base + '/api/games/bingo/launch', { method: 'POST' })));
  assert.ok(launched.every(response => response.ok));
  const tv = await connect({ role: 'tv' });
  const tv2 = await connect({ role: 'tv' });
  if (tv.state.phase !== 'lobby') {
    assert.ok(tv.state.players.every(player => player.name.startsWith('Integración ')), 'Hay una partida ajena a las pruebas; no se modificará.');
    await tv.request('cancel');
  }
  assert.equal(tv.state.players.length, 0);
  let p0 = await connect({ role: 'player' });
  let p1 = await connect({ role: 'player' });
  await p0.request('profile', { name: 'Integración Uno', avatar: 3 });
  await p1.request('profile', { name: 'Integración Dos', avatar: 15 });
  await assert.rejects(p1.request('profile', { name: 'integración uno', avatar: 0 }));
  await assert.rejects(p0.request('settings', { cardsPerPlayer: 5 }));
  await tv.request('settings', { cardsPerPlayer: 1, effects: false });
  await wait(() => tv2.state.settings.cardsPerPlayer === 1);
  await tv.request('start');
  await wait(() => p0.state.me?.playing && p1.state.me?.playing);
  assert.notDeepEqual(p0.state.me.cards, p1.state.me.cards);
  await wait(() => p0.state.phase === 'marking');
  const cardsBefore = structuredClone(p0.state.me.cards);
  p0.socket.close(); await wait(() => !tv.state.players.find(player => player.id === p0.session.playerId).online);
  p0 = await connect({ role: 'player', token: p0.session.token }); assert.deepEqual(p0.state.me.cards, cardsBefore);
  const old = p1;
  const claimant = await connect({ role: 'guest' });
  await assert.rejects(claimant.request('hello', { role: 'player', claimPlayerId: p1.session.playerId }), error => error.code === 'CONFIRM_TAKEOVER');
  claimant.session = await claimant.request('hello', { role: 'player', claimPlayerId: p1.session.playerId, force: true }); p1 = claimant;
  await wait(() => old.revoked);
  let turns = 0;
  while (p0.state.phase !== 'results' && turns++ < 90) {
    await wait(() => p0.state.phase === 'marking' || p0.state.phase === 'results');
    if (p0.state.phase === 'results') break;
    const turn = p0.state.turn;
    for (const player of [p0, p1]) {
      await wait(() => player.state.phase === 'marking' && player.state.turn === turn);
      const state = player.state;
      for (let card = 0; card < state.me.cards.length; card++) for (const number of state.me.cards[card]) {
        if (number && state.called.includes(number) && !state.me.marks[card].includes(number)) await player.request('mark', { card, number });
      }
      await player.request('continue');
    }
    await wait(() => p0.state.phase !== 'marking' || p0.state.turn !== turn);
    if (turn % 15 === 0) console.log(`Partida real: ${turn} bolas, conexiones y turnos sincronizados.`);
  }
  assert.equal(p0.state.phase, 'results'); assert.ok(p0.state.winners.length);
  await wait(() => tv.state.phase === 'results');
  assert.equal(new Set(p0.state.called).size, p0.state.called.length);
  const winnerId = p0.state.winners[0];
  assert.equal(tv.state.players.find(player => player.id === winnerId).wins, 1);
  await tv.request('restart'); await wait(() => p0.state.phase === 'drawing');
  assert.equal(tv.state.players.find(player => player.id === winnerId).wins, 1);
  await tv.request('cancel'); assert.equal(tv.state.phase, 'lobby'); assert.equal(tv.state.players.length, 0);
  const previousRoundId = tv.state.roundId;
  for (const client of clients) client.socket.close();
  if (process.env.TEST_IDLE === 'true') {
    await delay(2500);
    // Tras expirar, una entrada vuelve a crear un contenedor sin la sesión anterior.
    const response = await fetch(base + '/api/games/bingo/launch', { method: 'POST' }); assert.ok(response.ok);
    const fresh = await connect({ role: 'tv' }); assert.equal(fresh.state.phase, 'lobby'); assert.equal(fresh.state.players.length, 0); assert.notEqual(fresh.state.roundId, previousRoundId);
    fresh.socket.close(); console.log('OK: retirada real por inactividad y nuevo arranque bajo demanda.');
  }
  console.log(`OK: partida completa por WebSocket (${turns} turnos), 8 arranques simultáneos, 2 TV, privacidad, reconexión, recuperación, resultado, revancha y cancelación.`);
} finally {
  const television = clients.find(client => client.identity.role === 'tv' && client.socket.readyState === WebSocket.OPEN);
  if (television?.state.phase !== 'lobby' && television?.state.players.every(player => player.name.startsWith('Integración '))) await television.request('cancel').catch(() => {});
  for (const client of clients) client.socket.close();
}
