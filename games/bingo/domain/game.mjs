import { randomUUID, randomBytes, randomInt } from 'node:crypto';
import { shuffle, validateTicket } from './tickets.mjs';

export class GameError extends Error {
  constructor(message, code = 'INVALID_ACTION', details = {}) { super(message); this.code = code; this.details = details; }
}
const requireThat = (condition, message, code, details) => { if (!condition) throw new GameError(message, code, details); };
const normalizeName = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ');

export class BingoGame {
  constructor({ tickets, notify = () => {}, revoke = () => {}, schedule = setTimeout, unschedule = clearTimeout, drawMs = 1400, random = () => randomInt(0, 0x100000000) / 0x100000000 } = {}) {
    requireThat(Array.isArray(tickets) && tickets.length >= 5 && tickets.every(validateTicket), 'Catálogo de cartones inválido.');
    requireThat(new Set(tickets.map(ticket => ticket.join(','))).size === tickets.length, 'Hay cartones duplicados en el catálogo.');
    this.catalog = tickets; this.notify = notify; this.revoke = revoke;
    this.schedule = schedule; this.unschedule = unschedule; this.drawMs = drawMs; this.random = random;
    this.clients = new Map(); this.players = new Map(); this.settings = { cardsPerPlayer: 3, effects: true };
    this.phase = 'lobby'; this.roundId = randomUUID(); this.called = []; this.current = null; this.winners = []; this.timer = null; this.drawEndsAt = null;
  }

  connect(clientId, input = {}) {
    requireThat(['guest', 'tv', 'player'].includes(input.role), 'Elige televisión o jugador.');
    let player = null;
    if (input.role === 'player') {
      if (input.token) {
        player = [...this.players.values()].find(item => item.token === input.token);
        requireThat(player, 'La sesión anterior ya no está disponible. Elige tu nombre o crea un jugador.', 'SESSION_EXPIRED');
        if (player.clientId && player.clientId !== clientId) player.token = randomBytes(32).toString('hex');
      } else if (input.claimPlayerId) {
        player = this.players.get(input.claimPlayerId);
        requireThat(player?.ready, 'Este jugador ya no está disponible.');
        requireThat(!player.clientId || input.force === true, 'Este jugador está conectado. ¿Quieres recuperar su sesión?', 'CONFIRM_TAKEOVER', { playerId: player.id });
        player.token = randomBytes(32).toString('hex');
      } else {
        requireThat(this.phase === 'lobby', 'La partida ya ha comenzado. Recupera un jugador existente.', 'GAME_STARTED');
        requireThat(this.players.size < 40, 'La sala admite hasta 40 jugadores.');
        player = { id: randomUUID(), token: randomBytes(32).toString('hex'), name: '', avatar: Math.floor(this.random() * 20), ready: false, wins: 0, cards: [], marks: [], continued: false, playing: false, clientId: null };
        this.players.set(player.id, player);
      }
    }
    // Resolver la recuperación antes de desvincular al cliente evita perder su borrador si falla.
    this.detach(clientId, false);
    if (player?.clientId && player.clientId !== clientId) {
      const previous = player.clientId;
      this.clients.delete(previous);
      this.revoke(previous);
    }
    if (player) { player.clientId = clientId; this.players.set(player.id, player); }
    this.clients.set(clientId, { role: input.role, playerId: player?.id || null });
    this.emit();
    return { token: player?.token, playerId: player?.id };
  }

  detach(clientId, emit = true) {
    const client = this.clients.get(clientId);
    this.clients.delete(clientId);
    const player = this.players.get(client?.playerId);
    if (player?.clientId === clientId) {
      player.clientId = null;
      if (!player.ready) this.players.delete(player.id);
    }
    if (emit) { this.advanceIfReady(); this.emit(); }
  }

  action(clientId, type, payload = {}) {
    const client = this.clients.get(clientId);
    requireThat(client, 'Reconecta para continuar.', 'NOT_CONNECTED');
    const player = this.players.get(client.playerId);
    if (type === 'profile') {
      requireThat(client.role === 'player' && player && this.phase === 'lobby', 'No puedes editar el jugador ahora.');
      requireThat(typeof payload.name === 'string', 'Introduce un nombre.');
      const name = normalizeName(payload.name);
      requireThat([...name].length >= 3 && [...name].length <= 40 && !/[\p{Cc}\p{Cf}]/u.test(name), 'El nombre debe tener entre 3 y 40 caracteres.');
      requireThat(![...this.players.values()].some(other => other.id !== player.id && other.ready && other.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es')), 'Este nombre ya está en uso.');
      requireThat(Number.isInteger(payload.avatar) && payload.avatar >= 0 && payload.avatar < 20, 'Selecciona un avatar válido.');
      player.name = name; player.avatar = payload.avatar; player.ready = true;
    } else if (type === 'settings') {
      this.requireTV(client); requireThat(this.phase === 'lobby', 'Las reglas se cambian antes de empezar.');
      if (payload.cardsPerPlayer !== undefined) {
        requireThat(Number.isInteger(payload.cardsPerPlayer) && payload.cardsPerPlayer >= 1 && payload.cardsPerPlayer <= 5, 'Elige entre 1 y 5 cartones.');
        this.settings.cardsPerPlayer = payload.cardsPerPlayer;
      }
      if (payload.effects !== undefined) { requireThat(typeof payload.effects === 'boolean', 'Opción inválida.'); this.settings.effects = payload.effects; }
    } else if (type === 'start') {
      this.requireTV(client); requireThat(this.phase === 'lobby', 'La partida ya ha comenzado.');
      this.startRound();
    } else if (type === 'mark') {
      this.requireTurn(player, payload);
      requireThat(Number.isInteger(payload.card) && player.cards[payload.card], 'Cartón inválido.');
      requireThat(Number.isInteger(payload.number) && payload.number > 0 && this.called.includes(payload.number) && player.cards[payload.card].includes(payload.number), 'Este número todavía no se puede marcar.');
      const marks = player.marks[payload.card];
      if (!marks.includes(payload.number)) marks.push(payload.number);
      player.continued = false;
    } else if (type === 'continue') {
      this.requireTurn(player, payload);
      requireThat(!this.pendingNumbers(player), 'Todavía tienes números por marcar en tus cartones.');
      player.continued = true; this.advanceIfReady();
    } else if (type === 'restart') {
      this.requireTV(client); requireThat(this.phase === 'results', 'La partida todavía no ha terminado.');
      requireThat([...this.players.values()].some(item => item.ready && item.clientId), 'Debe volver al menos un jugador para la revancha.');
      this.toLobby(false); this.startRound();
    } else if (type === 'cancel') {
      this.requireTV(client); requireThat(this.phase !== 'lobby', 'No hay una partida en curso.');
      this.toLobby(true);
    } else if (type === 'reset') {
      this.requireTV(client); requireThat(this.phase === 'results', 'Solo se puede volver a selección al finalizar la partida.');
      this.toLobby(true);
      for (const connected of this.clients.values()) { connected.role = 'guest'; connected.playerId = null; }
    } else throw new GameError('Acción desconocida.');
    this.emit();
  }

  requireTV(client) { requireThat(client.role === 'tv', 'Esta acción se controla desde la televisión.'); }
  requireTurn(player, payload) {
    requireThat(player?.playing && this.phase === 'marking', 'Espera a que salga la bola.');
    requireThat(payload.roundId === this.roundId && payload.turn === this.called.length, 'El turno ha cambiado. Vuelve a intentarlo.', 'STALE_TURN');
  }
  pendingNumbers(player) { return player.cards.some((card, i) => card.some(n => n && this.called.includes(n) && !player.marks[i].includes(n))); }

  startRound() {
    const players = [...this.players.values()].filter(player => player.ready && player.clientId);
    requireThat(players.length > 0, 'Hace falta al menos un jugador confirmado y conectado.');
    requireThat(players.length * this.settings.cardsPerPlayer <= this.catalog.length, 'No hay suficientes cartones.');
    const tickets = shuffle(this.catalog, this.random);
    let offset = 0;
    for (const player of this.players.values()) {
      player.playing = players.includes(player); player.continued = false;
      player.cards = player.playing ? tickets.slice(offset, offset += this.settings.cardsPerPlayer).map(card => [...card]) : [];
      player.marks = player.cards.map(() => []);
    }
    this.roundId = randomUUID(); this.called = []; this.winners = [];
    this.bag = shuffle(Array.from({ length: 90 }, (_, i) => i + 1), this.random);
    this.draw();
  }

  draw() {
    if (!this.bag.length) { this.finish([]); return; }
    this.phase = 'drawing'; this.current = null;
    for (const player of this.players.values()) player.continued = false;
    this.drawEndsAt = Date.now() + this.drawMs;
    this.timer = this.schedule(() => {
      this.timer = null; this.current = this.bag.pop(); this.called.push(this.current);
      this.phase = 'marking'; this.drawEndsAt = null; this.emit();
    }, this.drawMs);
  }

  advanceIfReady() {
    if (this.phase !== 'marking') return;
    const online = [...this.players.values()].filter(player => player.playing && player.clientId);
    if (!online.length || online.some(player => !player.continued)) return;
    const winners = [...this.players.values()].filter(player => player.playing && player.cards.some((card, i) => card.filter(Boolean).every(n => player.marks[i].includes(n))));
    if (winners.length) this.finish(winners);
    else this.draw();
  }

  finish(winners) {
    this.phase = 'results'; this.winners = winners.map(player => player.id);
    for (const player of winners) player.wins++;
  }

  toLobby(clear) {
    if (this.timer !== null) this.unschedule(this.timer);
    this.timer = null; this.current = null; this.drawEndsAt = null; this.phase = 'lobby'; this.called = []; this.winners = []; this.roundId = randomUUID();
    for (const player of this.players.values()) { player.cards = []; player.marks = []; player.playing = false; player.continued = false; }
    if (clear) {
      this.players.clear(); this.settings = { cardsPerPlayer: 3, effects: true };
      for (const client of this.clients.values()) if (client.role === 'player') { client.role = 'guest'; client.playerId = null; }
    }
  }

  view(clientId) {
    const client = this.clients.get(clientId) || { role: 'guest' };
    const player = this.players.get(client.playerId);
    return {
      type: 'state', role: client.role, phase: this.phase, roundId: this.roundId, turn: this.called.length,
      settings: { ...this.settings }, current: this.current, called: [...this.called], drawEndsAt: this.drawEndsAt,
      winners: [...this.winners],
      players: [...this.players.values()].map(item => ({ id: item.id, name: item.ready ? item.name : '', avatar: item.ready ? item.avatar : null, ready: item.ready, online: Boolean(item.clientId), wins: item.wins, playing: item.playing, continued: item.continued })),
      me: player ? { id: player.id, name: player.name, avatar: player.avatar, ready: player.ready, playing: player.playing, cards: player.cards.map(card => [...card]), marks: player.marks.map(marks => [...marks]), continued: player.continued } : null,
    };
  }
  emit() { for (const clientId of this.clients.keys()) this.notify(clientId, this.view(clientId)); }
}
