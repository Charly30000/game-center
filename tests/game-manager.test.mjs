import test from 'node:test';
import assert from 'node:assert/strict';
import { GameManager } from '../server/game-manager.mjs';

test('varias entradas simultáneas comparten una sola creación', async () => {
  const manager = new GameManager({ docker: {} });
  let calls = 0;
  manager.ensureContainer = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); };
  const results = await Promise.all(Array.from({ length: 20 }, () => manager.launch('bingo')));
  assert.equal(calls, 1); assert.ok(results.every(runtime => runtime.socket === 'ws://gamecenter-bingo:3001/socket'));
});
test('solo elimina el contenedor propio vacío después de 24 horas', async () => {
  const calls = [];
  const docker = { async request(method, path) { calls.push([method, path]); return { Config: { Labels: { 'app.gamecenter.owner': 'gamecenter-local' } }, State: { Running: true } }; } };
  const manager = new GameManager({ docker }); manager.ensureContainer = async () => {};
  await manager.launch('bingo'); const runtime = manager.runtimes.get('bingo'); const idleAt = runtime.lastEmptyAt;
  manager.connected('bingo'); await manager.collectIdle(idleAt + 90000000); assert.equal(calls.length, 0);
  manager.disconnected('bingo'); await manager.collectIdle(runtime.lastEmptyAt + 100); assert.equal(calls.length, 0);
  await manager.collectIdle(runtime.lastEmptyAt + 86400000);
  assert.ok(calls.some(([method, path]) => method === 'DELETE' && path === '/containers/gamecenter-bingo'));
  assert.equal(manager.runtimes.size, 0);
});
test('no borra contenedores con propietario diferente', async () => {
  let mutations = 0;
  const manager = new GameManager({ docker: { async request(method) { if (method !== 'GET') mutations++; return { Config: { Labels: {} } }; } } });
  manager.ensureContainer = async () => {}; await manager.launch('bingo'); await manager.collectIdle(Date.now() + 90000000); assert.equal(mutations, 0);
});
test('el recolector no retira un juego mientras se está abriendo', async () => {
  let finish, mutations = 0;
  const manager = new GameManager({ docker: { async request() { mutations++; } } });
  manager.ensureContainer = () => new Promise(resolve => { finish = resolve; });
  const opening = manager.launch('bingo');
  await manager.collectIdle(Date.now() + 90000000); assert.equal(mutations, 0);
  finish(); await opening;
});
