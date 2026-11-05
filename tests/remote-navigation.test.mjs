import test from 'node:test';
import assert from 'node:assert/strict';
import { remoteKey, directionalTarget } from '../public/shared/remote-navigation.js';

test('normaliza flechas, OK y Atrás de Samsung, LG y navegador', () => {
  for (const [keyCode, expected] of [[37,'ArrowLeft'],[38,'ArrowUp'],[39,'ArrowRight'],[40,'ArrowDown'],[13,'Enter'],[10009,'Back'],[461,'Back']]) assert.equal(remoteKey({ key: 'Unidentified', keyCode }), expected);
  assert.equal(remoteKey({ key: 'Escape' }), 'Back');
  assert.equal(remoteKey({ key: 'Left' }), 'ArrowLeft');
});
test('elige el control alineado en cada dirección y no salta hacia atrás', () => {
  const origin = { left: 100, top: 100, width: 40, height: 40 };
  const candidate = (element, left, top) => ({ element, rect: { left, top, width: 40, height: 40 } });
  const items = [candidate('right',200,100),candidate('left',0,100),candidate('up',100,0),candidate('down',100,200),candidate('diagonal',145,145)];
  for (const [direction, expected] of [['ArrowRight','right'],['ArrowLeft','left'],['ArrowUp','up'],['ArrowDown','down']]) assert.equal(directionalTarget(origin,items,direction),expected);
  assert.equal(directionalTarget(origin,[items[0]],'ArrowLeft'),null);
});
