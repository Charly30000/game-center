import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { games, findGame } from './catalog.mjs';
import { GameManager } from './game-manager.mjs';
import { serveFile } from './static.mjs';

const manager = new GameManager();
const json = (response, status, data) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://gamecenter');
    const path = decodeURIComponent(url.pathname);
    if (path === '/health') return json(response, 200, { ok: true });
    if (request.method === 'GET' && path === '/api/connection') return json(response, 200, { publicUrl: process.env.GAMECENTER_URL || '' });
    if (request.method === 'GET' && path === '/api/games') return json(response, 200, games.map(({ command, port, ...game }) => game));
    const launch = path.match(/^\/api\/games\/([a-z-]+)\/launch$/);
    if (request.method === 'POST' && launch) {
      const origin = request.headers.origin;
      if (origin && new URL(origin).host !== request.headers.host) return json(response, 403, { error: 'Origen no permitido.' });
      if (!findGame(launch[1])) return json(response, 404, { error: 'Juego no disponible.' });
      await manager.launch(launch[1]);
      return json(response, 200, { url: `/games/${launch[1]}/` });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Método no admitido.' });
    if (path.startsWith('/assets/source/')) return json(response, 404, { error: 'Recurso privado.' });
    if (path === '/vendor/three/three.module.js') return serveFile(response, 'node_modules/three/build', 'three.module.js', { cache: true });
    if (path === '/vendor/three/three.core.js') return serveFile(response, 'node_modules/three/build', 'three.core.js', { cache: true });
    if (path.startsWith('/vendor/three/addons/')) return serveFile(response, 'node_modules/three/examples/jsm', path.slice('/vendor/three/addons/'.length), { cache: true });
    if (path.startsWith('/fonts/fredoka/')) return serveFile(response, 'node_modules/@fontsource/fredoka/files', path.slice('/fonts/fredoka/'.length), { cache: true });
    if (path.startsWith('/fonts/space-mono/')) return serveFile(response, 'node_modules/@fontsource/space-mono/files', path.slice('/fonts/space-mono/'.length), { cache: true });
    if (path.startsWith('/shared/')) return serveFile(response, 'public/shared', path.slice(8));
    const gameFile = path.match(/^\/games\/([a-z-]+)\/(.*)$/);
    if (gameFile && findGame(gameFile[1])) return serveFile(response, `games/${gameFile[1]}/public`, gameFile[2] || 'index.html');
    return serveFile(response, 'public', path === '/' ? 'index.html' : path.slice(1));
  } catch (error) {
    console.error(error.message);
    if (!response.headersSent) json(response, 503, { error: 'No se pudo iniciar el juego. Comprueba Docker y vuelve a intentarlo.' });
  }
});

const sockets = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
server.on('upgrade', async (request, socket, head) => {
  const match = request.url?.match(/^\/ws\/([a-z-]+)$/);
  const origin = request.headers.origin;
  if (!match || !findGame(match[1]) || (origin && new URL(origin).host !== request.headers.host)) return socket.destroy();
  let runtime;
  try { runtime = await manager.launch(match[1]); } catch { return socket.destroy(); }
  sockets.handleUpgrade(request, socket, head, client => {
    client.alive = true;
    client.on('pong', () => { client.alive = true; });
    const gameId = match[1];
    manager.connected(gameId);
    const upstream = new WebSocket(runtime.socket, { maxPayload: 524288, perMessageDeflate: false });
    const queue = [];
    const send = data => { if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: false }); else if (queue.length < 10) queue.push(data); else client.close(1008, 'Demasiadas peticiones'); };
    client.on('message', send);
    upstream.on('open', () => { for (const item of queue) upstream.send(item, { binary: false }); queue.length = 0; });
    upstream.on('message', data => { if (client.readyState === WebSocket.OPEN) client.send(data, { binary: false }); });
    upstream.on('error', () => { manager.invalidate(gameId); client.close(1013, 'Reconectando con el juego'); });
    upstream.on('close', () => { if (client.readyState === WebSocket.OPEN) client.close(1012, 'Juego reiniciado'); });
    client.on('error', () => {});
    client.on('close', () => { manager.disconnected(gameId); upstream.close(); });
  });
});

setInterval(() => { for (const client of sockets.clients) { if (!client.alive) client.terminate(); else { client.alive = false; client.ping(); } } }, 15000).unref();

await manager.recover().catch(error => console.error('Docker no está disponible todavía:', error.message));
setInterval(() => manager.collectIdle(), Math.max(250, Number(process.env.GAME_GC_INTERVAL_MS || 60000))).unref();
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Game Center disponible en el puerto 3000'));
