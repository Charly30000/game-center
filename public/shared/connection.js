export function createConnection({ onState, onStatus, onRevoked, onError }) {
  let socket, stopped = false, attempt = 0, reconnectTimer, serial = 0;
  const pending = new Map();
  const credentials = {
    read() { try { return localStorage.getItem('bingo.token'); } catch { return null; } },
    save(token) { try { localStorage.setItem('bingo.token',token); } catch { /* Sesión en memoria. */ } },
    clear(token) { try { if (!token || localStorage.getItem('bingo.token') === token) localStorage.removeItem('bingo.token'); } catch { /* Navegación privada. */ } },
  };
  // La sesión del jugador se valida siempre en el servidor. El modo TV no se guarda.
  try { localStorage.removeItem('bingo.role'); } catch { /* Navegación privada. */ }
  const rememberedToken = credentials.read();
  let identity = rememberedToken ? { role: 'player', token: rememberedToken } : { role: 'guest' };
  function request(type, payload = {}) {
    return new Promise((resolve, reject) => {
      if (socket?.readyState !== WebSocket.OPEN) return reject(new Error('Reconectando. Espera un momento.'));
      const requestId = String(++serial);
      const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error('La conexión tarda en responder.')); }, 10000);
      pending.set(requestId, { resolve, reject, timeout });
      socket.send(JSON.stringify({ type, payload, requestId }));
    });
  }
  async function identify(payload) {
    const result = await request('hello', payload);
    identity = { role: payload.role, token: result?.token };
    if (identity.token) credentials.save(identity.token);
    return result;
  }
  function connect() {
    if (stopped) return;
    onStatus('connecting');
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/bingo`);
    socket.onopen = async () => {
      attempt = 0;
      try { await identify(identity); onStatus('online'); }
      catch (error) {
        if (error.code === 'SESSION_EXPIRED' || error.code === 'GAME_STARTED') {
          if (error.code === 'SESSION_EXPIRED') credentials.clear(identity.token);
          await identify({ role: 'guest' }).catch(onError); onStatus('online'); onError(error);
        } else onError(error);
      }
    };
    socket.onmessage = event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'state') {
        // Cancelar una partida devuelve al selector también tras una pérdida de red.
        if (message.role === 'guest') identity = { role: 'guest' };
        onState(message);
      }
      else if (message.type === 'revoked') {
        stopped = true; if (identity.token) credentials.clear(identity.token); onRevoked();
      } else if (message.requestId && pending.has(message.requestId)) {
        const item = pending.get(message.requestId); clearTimeout(item.timeout); pending.delete(message.requestId);
        if (message.type === 'error') item.reject(Object.assign(new Error(message.message), { code: message.code, details: message.details }));
        else item.resolve(message.result);
      }
    };
    socket.onclose = () => {
      for (const item of pending.values()) { clearTimeout(item.timeout); item.reject(new Error('Se ha perdido la conexión.')); }
      pending.clear();
      if (!stopped) { onStatus('offline'); reconnectTimer = setTimeout(connect, Math.min(12000, 700 * 2 ** attempt++) + Math.random() * 300); }
    };
    socket.onerror = () => {};
  }
  connect();
  return { request, identify, playerToken: () => credentials.read(), clearPlayerToken: token => credentials.clear(token), stop() { stopped = true; clearTimeout(reconnectTimer); socket?.close(); } };
}
