import test from 'node:test';
import assert from 'node:assert/strict';
import { createBingoAudio } from '../public/bingo-audio.js';

const flush = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };
function fixture() {
  const started=[], requests=[], musicStates=[], listeners=new Map();
  let context;
  class Context {
    state='suspended';currentTime=0;destination={};
    constructor(){context=this;}
    async resume(){this.state='running';}
    async close(){this.state='closed';}
    async decodeAudioData(bytes){return {id:new TextDecoder().decode(bytes),duration:1,sampleRate:1000,getChannelData:()=>new Float32Array(1000).fill(.1)};}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createBufferSource(){const node={connect(){},disconnect(){},stop(){node.stopped=true;},start(){started.push(node);}};return node;}
  }
  const host={AudioContext:Context,document:{hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},
    fetch:async url=>{requests.push(url.pathname);return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(url.pathname).buffer};}};
  const audio=createBingoAudio({host,createMusic:()=>({sync(value){musicStates.push(value);},dispose(){},toggle(){},enabled:true})});
  const state={role:'tv',roundId:'r1',turn:0,phase:'drawing',drawDurationMs:5000,drawEndsAt:Date.now()+5000,current:null,winners:['p1']};
  const sync=(patch={},options={})=>{Object.assign(state,patch);audio.sync({...state},{active:true,online:true,animated:true,...options});};
  return {audio,host,started,requests,musicStates,state,sync,get context(){return context;},visibility:()=>listeners.get('visibilitychange')()};
}

test('TV: bombo, recogida, anuncio y estrellas siguen el gesto sin solaparse ni repetirse',async()=>{
  const f=fixture();f.sync();assert.equal(f.requests.length,0,'Sin interacción no hay reproducción ni descarga');
  await f.audio.unlock();await flush();assert.match(f.started.at(-1).buffer.id,/dice-shake-1/);assert.equal(f.started.at(-1).loop,true);
  const drum=f.started.at(-1);f.sync({phase:'marking',turn:1,current:28});await flush();assert.equal(drum.stopped,true);
  f.audio.animation('PickBall',1.2);await flush();assert.equal(f.started.length,1);
  f.audio.animation('PickBall',1.3);await flush();assert.match(f.started.at(-1).buffer.id,/chip-lay-1/);
  f.audio.animation('ShowBall',.3);await flush();const voice=f.started.at(-1);assert.match(voice.buffer.id,/voice\/number-28/);
  assert.ok(f.requests.every(path=>!path.includes('glass_001')),'El anuncio comienza directamente, sin bip ni descarga del efecto retirado');
  f.context.currentTime=.4;assert.equal(f.audio.mouth().speaking,true);assert.ok(f.audio.mouth().open>.13);
  f.audio.animation('ShowBall',1);f.sync();await flush();assert.equal(f.started.at(-1),voice);
  voice.onended();assert.equal(f.audio.mouth().pending,false);assert.equal(f.audio.mouth().speaking,false);
  f.audio.animation('DropBall',.89);await flush();assert.equal(f.started.at(-1),voice);
  f.audio.animation('DropBall',.9);await flush();assert.match(f.started.at(-1).buffer.id,/maximize_001/);
  f.audio.animation('Talk',.3);await flush();assert.match(f.started.at(-1).buffer.id,/voice\/continue/);
  f.sync({phase:'drawing',turn:1,current:null});await flush();assert.equal(f.audio.mouth().pending,false);
  assert.match(f.started.at(-1).buffer.id,/dice-shake-1/);f.audio.dispose();
});

test('móvil: solo respuestas propias; los efectos y la voz de TV nunca se descargan',async()=>{
  const f=fixture();f.sync({role:'player'});await f.audio.unlock();await flush();assert.equal(f.started.length,0);
  f.sync({phase:'marking',current:90});f.audio.animation('ShowBall',2);await flush();assert.equal(f.started.length,0);
  f.audio.feedback('mark');await flush();assert.match(f.started.at(-1).buffer.id,/chip-lay-1/);
  f.sync({phase:'results'});await flush();assert.equal(f.started.length,1);
  assert.ok(f.requests.every(path=>!/voice|dice-shake|jingles|glass|maximize/.test(path)));
  f.audio.dispose();
});

test('silencio, desconexión, pestaña oculta y salida cancelan audio y cargas pendientes',async()=>{
  const f=fixture();f.sync();await f.audio.unlock();await flush();const drum=f.started.at(-1);
  f.audio.toggle();assert.equal(drum.stopped,true);f.audio.animation('ShowBall',1);await flush();assert.equal(f.started.length,1);
  f.audio.toggle();await flush();assert.equal(f.started.length,2);
  f.sync({}, {online:false});assert.equal(f.started.at(-1).stopped,true);
  f.sync({}, {online:true});await flush();f.host.document.hidden=true;f.visibility();assert.equal(f.started.at(-1).stopped,true);
  f.host.document.hidden=false;f.visibility();await flush();f.sync({}, {active:false});assert.equal(f.started.at(-1).stopped,true);
  f.audio.dispose();assert.equal(f.context.state,'closed');
});

test('modo estático anuncia una vez y la victoria no se repite con el bucle del personaje',async()=>{
  const f=fixture();f.sync({phase:'marking',current:90},{animated:false});await f.audio.unlock();await flush();
  assert.match(f.started.at(-1).buffer.id,/voice\/number-90/);const count=f.started.length;
  f.sync({}, {animated:false});await flush();assert.equal(f.started.length,count);
  f.sync({phase:'results'},{animated:false});await flush();assert.match(f.started.at(-1).buffer.id,/voice\/bingo/);
  f.started.at(-1).onended();await flush();assert.match(f.started.at(-1).buffer.id,/victory-fanfare/);
  f.audio.animation('Celebrate',1.4);f.audio.animation('Celebrate',.1);f.sync({}, {animated:false});await flush();assert.equal(f.started.length,count+2);
  f.audio.dispose();
});

test('una carga tardía no reproduce el número de un turno que ya terminó',async()=>{
  const f=fixture();let complete;
  f.host.fetch=url=>new Promise(resolve=>{if(url.pathname.includes('/voice/')) complete=()=>resolve({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url.pathname).buffer});else resolve({ok:false});});
  f.sync({phase:'marking',current:3},{animated:false});await f.audio.unlock();await flush();
  f.sync({phase:'lobby'},{animated:false});complete();await flush();assert.equal(f.started.length,0);assert.equal(f.audio.mouth().pending,false);
  f.audio.dispose();
});

test('las cargas de efectos que llegan desordenadas respetan la acción más reciente',async()=>{
  const f=fixture(),pending=new Map();
  f.host.fetch=url=>new Promise(resolve=>pending.set(url.pathname,()=>resolve({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url.pathname).buffer})));
  f.sync({role:'player'});await f.audio.unlock();
  f.audio.feedback('select');f.audio.feedback('mark');
  [...pending].find(([path])=>path.includes('chip-lay'))[1]();await flush();
  [...pending].find(([path])=>path.includes('card-slide'))[1]();await flush();
  assert.equal(f.started.length,1);assert.match(f.started[0].buffer.id,/chip-lay/);f.audio.dispose();
});

test('resultados personales: victoria, empate, derrota y espectadores respetan el estado del servidor',async()=>{
  for(const [winners,playing,expected] of [[['p1'],true,'victory-fanfare'],[['p2','p1'],true,'victory-fanfare'],[['p2'],true,'PIZZI03'],[['p2'],false,null]]) {
    const f=fixture();f.sync({role:'player',phase:'results',winners,me:{id:'p1',playing}});await f.audio.unlock();f.audio.feedback('continue');await flush();
    if(expected)assert.match(f.started.at(-1).buffer.id,new RegExp(expected));else assert.equal(f.started.length,0);
    assert.ok(f.requests.every(path=>!path.includes('/voice/')),'El móvil no pronuncia el bingo');
    const count=f.started.length;f.sync();f.audio.animation('Celebrate',1.4);await flush();assert.equal(f.started.length,count,'Sin repeticiones por snapshots o bucle');
    f.sync({roundId:'r2'});await flush();assert.equal(f.started.length,count+(expected?1:0),'La siguiente partida sí puede volver a sonar');
    f.audio.dispose();
  }
});

test('una revancha interrumpe la celebración y no deja una fanfarria antigua en cola',async()=>{
  const f=fixture();f.sync({phase:'results'});await f.audio.unlock();await flush();const voice=f.started.at(-1);
  assert.match(voice.buffer.id,/voice\/bingo/);const end=voice.onended;
  f.sync({roundId:'r2',phase:'drawing'});await flush();assert.equal(voice.stopped,true);end();await flush();
  assert.ok(!f.started.some(node=>node.buffer.id.includes('victory-fanfare')));f.audio.dispose();
});

test('la TV no anuncia un bingo si el servidor termina sin ganadores',async()=>{
  const f=fixture();f.sync({phase:'results',winners:[]});await f.audio.unlock();await flush();
  assert.match(f.started.at(-1).buffer.id,/PIZZI03/);assert.ok(!f.requests.some(path=>path.includes('/voice/bingo')));f.audio.dispose();
});

test('la música solo baja durante la reproducción de un número, no por efectos ni otras frases',async()=>{
  const f=fixture();f.sync();await f.audio.unlock();await flush();
  assert.equal(f.musicStates.at(-1).ducked,false,'El bombo no baja la música');
  f.sync({phase:'marking',turn:1,current:28});f.audio.animation('PickBall',1.3);await flush();
  assert.equal(f.musicStates.at(-1).ducked,false,'La recogida no baja la música');
  f.audio.animation('ShowBall',.3);await flush();assert.equal(f.musicStates.at(-1).ducked,true);
  f.started.at(-1).onended();assert.equal(f.musicStates.at(-1).ducked,false,'Recupera el volumen al terminar el número');
  f.audio.animation('DropBall',.9);await flush();assert.equal(f.musicStates.at(-1).ducked,false);
  f.audio.animation('Talk',.3);await flush();assert.equal(f.musicStates.at(-1).ducked,false,'La invitación a continuar no baja la música');
  f.audio.dispose();
});
