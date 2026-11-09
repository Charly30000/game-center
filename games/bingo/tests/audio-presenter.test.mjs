import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBingoCharacter } from '../public/bingo-character.js';
import { bingoNumberText } from '../public/bingo-speech.js';

test('el GLB real articula con la voz, cierra en silencio y espera su final sin alterar el turno',async()=>{
  const bytes=await readFile(new URL('../public/assets/models/bingo_character_animated.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let mouth={width:.7,open:.8,pending:true};const frames=[];
  const controller=createBingoCharacter(gltf,{speech:()=>mouth,onAnimationFrame:(name,time)=>frames.push({name,time})});
  try {
    controller.showBingoBall(28);controller.playBingoAnimation('ShowBall',{restart:true});controller.update(.5);
    const jaw=controller.root.getObjectByName('Jaw');assert.equal(jaw.scale.x,.7);assert.equal(jaw.scale.y,.8);
    controller.update(3);assert.equal(controller.currentAnimation,'ShowBall','La pose espera la locución real');
    mouth={width:1,open:.13,pending:false};controller.update(.01);assert.equal(controller.currentAnimation,'DropBall');
    controller.playBingoAnimation('Talk',{restart:true});controller.update(.5);assert.equal(jaw.scale.y,.13,'No habla visualmente sin voz');
    mouth={width:1,open:.7,pending:true};controller.updateFromGame({roundId:'next',turn:2,phase:'drawing',drawDurationMs:5000});
    assert.equal(controller.currentAnimation,'SpinDrum','El nuevo turno interrumpe el gesto sin esperar la frase');
    assert.ok(frames.some(frame=>frame.name==='ShowBall'));assert.ok(frames.some(frame=>frame.name==='Talk'));
    controller.playBingoAnimation('Celebrate',{restart:true,loop:true,after:false});controller.update(.5);
    assert.equal(jaw.scale.y,.7,'La locución de bingo también articula durante la victoria');
    controller.update(3);assert.equal(controller.currentAnimation,'Celebrate','La locución no detiene el bucle de victoria');
  } finally {controller.dispose();}
});

test('los nueve efectos y las 92 locuciones locales coinciden con sus manifiestos y números',async()=>{
  const root=new URL('../public/assets/audio/',import.meta.url);
  for(const [prefix,count] of [['',9],['voice/',92]]) {
    const manifest=JSON.parse(await readFile(new URL(prefix+'manifest.json',root),'utf8'));assert.equal(manifest.length,count);
    for(const item of manifest){
      const bytes=await readFile(new URL(prefix+item.file,root));
      assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
      assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);assert.ok(item.duration>0&&item.duration<(prefix?6:8));assert.ok(item.rms>.005&&item.peak<1);
      if(prefix&&item.file.startsWith('number-'))assert.equal(item.text,`El número ${bingoNumberText(Number(item.file.match(/\d+/)[0]))}.`);
    }
  }
});
