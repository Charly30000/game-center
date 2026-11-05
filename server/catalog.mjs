// Registro explícito: nunca convertir identificadores del navegador en rutas o comandos.
export const games = Object.freeze([
  { id: 'bingo', title: 'Bingo en familia', subtitle: 'Un número. Muchas ganas de cantar bingo.', players: '1–40 jugadores', badge: 'El clásico de siempre', port: 3001, command: ['node', 'games/bingo/server.mjs'] },
]);
export const findGame = id => games.find(game => game.id === id);
