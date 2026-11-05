import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTickets, validateTicket, seededRandom } from '../domain/tickets.mjs';

test('10.000 cartones distintos cumplen filas, columnas, rangos y orden', () => {
  const tickets = generateTickets(10000);
  assert.equal(tickets.length, 10000);
  assert.equal(new Set(tickets.map(ticket => ticket.join(','))).size, 10000);
  assert.ok(tickets.every(validateTicket));
});
test('el catálogo es reproducible con la misma semilla', () => {
  assert.deepEqual(generateTickets(20, seededRandom(2)), generateTickets(20, seededRandom(2)));
  assert.notDeepEqual(generateTickets(20, seededRandom(2)), generateTickets(20, seededRandom(3)));
});
test('rechaza tamaños imposibles, números repetidos y casillas incorrectas', () => {
  assert.throws(() => generateTickets(-1));
  const [ticket] = generateTickets(1);
  assert.equal(validateTicket(ticket.slice(1)), false);
  const index = ticket.findIndex(Boolean);
  ticket[index] = 91;
  assert.equal(validateTicket(ticket), false);
});
