// Registro local explícito; nunca ejecutar comandos proporcionados por un navegador.
export function registeredGames(entries) {
  if (!Array.isArray(entries)) throw new Error('El registro de juegos debe ser una lista.');
  const ids = new Set(), ports = new Set(), numbers = new Set();
  return entries.map(entry => {
    const {id,title,port,number} = entry;
    if (!Number.isSafeInteger(number) || number < 1 || numbers.has(number)) throw new Error('Número de juego inválido o repetido.');
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(id) || id.length > 40 || ids.has(id)) throw new Error('Identificador de juego inválido o repetido.');
    if (typeof title !== 'string' || title.trim().length < 3 || title.length > 80) throw new Error('Nombre de juego inválido.');
    if (!Number.isInteger(port) || port < 3001 || port > 65535 || ports.has(port)) throw new Error('Puerto de juego inválido o repetido.');
    if (!Number.isInteger(entry.minPlayers) || !Number.isInteger(entry.maxPlayers) || entry.minPlayers < 1 || entry.maxPlayers > 40 || entry.maxPlayers < entry.minPlayers) throw new Error('Límites de jugadores inválidos.');
    ids.add(id); ports.add(port); numbers.add(number);
    return Object.freeze({number,id,title,port,subtitle:entry.subtitle ?? 'Juega en compañía',players:`${entry.minPlayers}–${entry.maxPlayers} jugadores`,badge:entry.badge ?? 'En familia',cover:`/games/${id}/assets/cover.svg`,icon:`/games/${id}/assets/icon.svg`,command:['node',`games/${id}/server.mjs`]});
  }).sort((a,b)=>a.number-b.number);
}
