import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { BingoGame, GameError } from './domain/game.mjs';

const tickets = JSON.parse(await readFile(new URL('./data/tickets.json', import.meta.url), 'utf8'));
const clients = new Map();
const send = (id, message) => {
  const socket = clients.get(id);
  if (socket?.readyState === WebSocket.OPEN) {
    if (socket.bufferedAmount > 1048576) return socket.close(1013, 'Conexión lenta');
    socket.send(JSON.stringify(message));
  }
};
const game = new BingoGame({ tickets, notify: send, revoke: id => { send(id, { type: 'revoked' }); clients.get(id)?.close(4001, 'Sesión recuperada en otro dispositivo'); } });
const server = http.createServer((request, response) => { response.writeHead(request.url === '/health' ? 200 : 404, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ ok: request.url === '/health' })); });
const wss = new WebSocketServer({ server, path: '/socket', maxPayload: 8192, perMessageDeflate: false });
wss.on('connection', socket => {
  const id = randomUUID(); clients.set(id, socket); socket.alive = true;
  let windowStart = Date.now(); let messages = 0;
  const helloTimeout = setTimeout(() => { if (!game.clients.has(id)) socket.close(1008, 'Falta identificación'); }, 10000);
  socket.on('pong', () => { socket.alive = true; });
  socket.on('error', () => {});
  socket.on('message', raw => {
    if (Date.now() - windowStart > 1000) { windowStart = Date.now(); messages = 0; }
    if (++messages > 35) return socket.close(1008, 'Demasiadas acciones');
    let message;
    try {
      message = JSON.parse(raw.toString());
      if (!message || typeof message !== 'object' || typeof message.type !== 'string' || (message.payload !== undefined && (!message.payload || typeof message.payload !== 'object' || Array.isArray(message.payload)))) throw new GameError('Mensaje inválido.');
      let result;
      if (message.type === 'hello') { result = game.connect(id, message.payload); clearTimeout(helloTimeout); }
      else result = game.action(id, message.type, message.payload);
      send(id, { type: 'ack', requestId: message.requestId, result });
    } catch (error) {
      send(id, { type: 'error', requestId: message?.requestId, message: error instanceof GameError ? error.message : 'No se pudo completar la acción.', code: error.code || 'INTERNAL', details: error.details });
      if (!(error instanceof GameError)) console.error(error);
    }
  });
  socket.on('close', () => { clearTimeout(helloTimeout); clients.delete(id); game.detach(id); });
});
setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.alive) { socket.terminate(); continue; }
    socket.alive = false; socket.ping();
  }
}, 15000).unref();
server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log('Bingo listo; estado en memoria, una sola sala.'));
