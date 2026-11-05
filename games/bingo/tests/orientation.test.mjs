import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPlayerPortrait, requestPlayerOrientation, releasePlayerOrientation, restorePlayerFullscreen } from '../public/orientation.js';

async function environment({coarse=true,denied=false,requiresFullscreen=false},run){
  const previous={matchMedia:globalThis.matchMedia,screen:globalThis.screen,document:globalThis.document};
  const calls=[];let fullscreen=false;
  globalThis.matchMedia=()=>({matches:coarse});
  globalThis.screen={orientation:{unlock(){calls.push('unlock');},async lock(value){calls.push(value);if(denied||requiresFullscreen&&!fullscreen)throw new Error('No permitido');}}};
  globalThis.document={get fullscreenElement(){return fullscreen?{}:null;},documentElement:{async requestFullscreen(){calls.push('fullscreen');if(denied)throw new Error('No permitido');fullscreen=true;}}};
  try{await run(calls);}finally{releasePlayerOrientation();for(const[key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}

test('Bingo solicita orientación vertical al preparar el jugador',()=>environment({},async calls=>{
  assert.equal(await requestPlayerPortrait(),true);assert.deepEqual(calls,['portrait']);
}));

test('si el navegador lo exige, pide pantalla completa y reintenta vertical',()=>environment({requiresFullscreen:true},async calls=>{
  assert.equal(await requestPlayerPortrait(),true);assert.deepEqual(calls,['portrait','fullscreen','portrait']);
}));

test('un rechazo no bloquea la partida y no se fuerza la orientación en TV',async()=>{
  await environment({denied:true},async()=>assert.equal(await requestPlayerPortrait(),false));
  await environment({coarse:false},async calls=>{assert.equal(await requestPlayerPortrait(),false);assert.deepEqual(calls,[]);});
});

test('el modo de partida libera vertical antes de solicitar horizontal',()=>environment({},async calls=>{
  await requestPlayerPortrait();
  assert.equal(await requestPlayerOrientation('landscape'),true);
  assert.deepEqual(calls,['portrait','unlock','landscape']);
}));

test('volver a pantalla completa usa primero el gesto y después la orientación actual',()=>environment({requiresFullscreen:true},async calls=>{
  assert.equal(await restorePlayerFullscreen('landscape'),true);
  assert.deepEqual(calls,['fullscreen','landscape']);
}));

test('el botón tolera pantalla completa denegada o bloqueo de orientación no disponible',async()=>{
  await environment({denied:true},async calls=>{assert.equal(await restorePlayerFullscreen('landscape'),false);assert.deepEqual(calls,['fullscreen']);});
  await environment({},async calls=>{delete screen.orientation.lock;assert.equal(await restorePlayerFullscreen('landscape'),true);assert.deepEqual(calls,['fullscreen']);});
});

test('una petición vertical pendiente no vuelve a intentarse tras entrar en partida',()=>environment({},async calls=>{
  let rejectPortrait;
  screen.orientation.lock=value=>{calls.push(value);return value==='portrait'?new Promise((_,reject)=>{rejectPortrait=reject;}):Promise.resolve();};
  const preparing=requestPlayerPortrait();
  await requestPlayerOrientation('landscape');
  rejectPortrait(new Error('Petición anterior cancelada'));
  assert.equal(await preparing,false);
  assert.deepEqual(calls,['portrait','unlock','landscape']);
}));
