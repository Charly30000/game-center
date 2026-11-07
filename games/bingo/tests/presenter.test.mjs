import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBingoCharacter } from '../../../tests/bingo-character-glb.mjs';

test('el presentador GLB mantiene anatomía, agarre, bolas móviles, sincronización y estados del juego',async()=>{
  const report=await validateBingoCharacter();
  assert.equal(report.animatedCageBalls,18);
  assert.equal(report.ballNumbersTested,90);
});
