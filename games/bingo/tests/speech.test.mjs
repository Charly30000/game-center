import test from 'node:test';
import assert from 'node:assert/strict';
import { bingoNumberText,createVisemes,sampleViseme } from '../public/bingo-speech.js';

test('la articulación visual anuncia los 90 números en español y distingue labios, vocales y pausas',()=>{
  assert.equal(bingoNumberText(28),'veintiocho');assert.equal(bingoNumberText(42),'cuarenta y dos');assert.equal(bingoNumberText(90),'noventa');
  for(let n=1;n<=90;n++){
    const frames=createVisemes(`El número ${bingoNumberText(n)}`);
    for(let i=0;i<=100;i++){const pose=sampleViseme(frames,i/100);assert.ok(pose.width>=.6&&pose.width<=1.1&&pose.open>=.05&&pose.open<=1);}
  }
  const shapes=createVisemes('ma i o u f');
  assert.ok(shapes.some(frame=>frame.open<.1));assert.ok(shapes.some(frame=>frame.width<.7));assert.ok(shapes.some(frame=>frame.open>.9));
});
