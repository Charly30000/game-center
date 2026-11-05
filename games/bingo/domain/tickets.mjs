export const ranges = Array.from({ length: 9 }, (_, col) => [col === 0 ? 1 : col * 10, col === 8 ? 90 : col * 10 + 9]);

export function validateTicket(ticket) {
  if (!Array.isArray(ticket) || ticket.length !== 27 || ticket.some(n => !Number.isInteger(n))) return false;
  const numbers = ticket.filter(Boolean);
  if (numbers.length !== 15 || new Set(numbers).size !== 15) return false;
  for (let row = 0; row < 3; row++) if (ticket.slice(row * 9, row * 9 + 9).filter(Boolean).length !== 5) return false;
  for (let col = 0; col < 9; col++) {
    const values = [ticket[col], ticket[col + 9], ticket[col + 18]].filter(Boolean);
    if (!values.length || values.some((n, i) => n < ranges[col][0] || n > ranges[col][1] || (i && n <= values[i - 1]))) return false;
  }
  return true;
}

export function seededRandom(seed = 42691) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function generateTickets(count, random = seededRandom()) {
  if (!Number.isInteger(count) || count < 1 || count > 1000000) throw new Error('El catálogo debe tener entre 1 y 1.000.000 de cartones.');
  const seen = new Set();
  const tickets = [];
  while (tickets.length < count) {
    const rows = Array.from({ length: 3 }, () => new Set(shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], random).slice(0, 5)));
    if (ranges.some((_, col) => rows.every(row => !row.has(col)))) continue;
    const ticket = Array(27).fill(0);
    ranges.forEach(([low, high], col) => {
      const occupied = rows.map((row, i) => row.has(col) ? i : -1).filter(i => i >= 0);
      const values = shuffle(Array.from({ length: high - low + 1 }, (_, i) => low + i), random).slice(0, occupied.length).sort((a, b) => a - b);
      occupied.forEach((row, i) => { ticket[row * 9 + col] = values[i]; });
    });
    const key = ticket.join(',');
    if (!seen.has(key)) { seen.add(key); tickets.push(ticket); }
  }
  return tickets;
}
