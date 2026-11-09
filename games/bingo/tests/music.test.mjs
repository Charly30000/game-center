import test from 'node:test';
import assert from 'node:assert/strict';
import {createBingoMusic} from '../public/bingo-music.js';
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(){
  const nodes=[],volumes=[],requests=[],anchors=[],ramps=[];
  const context={currentTime:0,destination:{},decodeAudioData:async()=>({duration:20}),
    createBufferSource(){const node={connect(){},disconnect(){},start(...args){node.args=args;nodes.push(node);},stop(){node.stopped=true;}};return node;},
    createGain(){return {connect(){},disconnect(){},gain:{cancelScheduledValues(){},setValueAtTime(value,time){anchors.push({value,time});},linearRampToValueAtTime(value,time){volumes.push(value);ramps.push({value,time});}}};}};
  const host={fetch:async url=>{requests.push(String(url));return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}};
  return {host,context,nodes,volumes,requests,anchors,ramps,music:createBingoMusic({host,getContext:()=>context})};
}
test('música: un único bucle continuo, control propio y volumen reducido durante el primer plano',async()=>{
  const f=fixture();f.music.sync({active:true,ducked:false});await flush();assert.equal(f.nodes.length,1);assert.equal(f.nodes[0].loop,true);assert.equal(f.volumes.at(-1),.25);
  f.music.sync({active:true,ducked:true});assert.equal(f.volumes.at(-1),.05);
  f.music.sync({active:true,ducked:false});assert.equal(f.volumes.at(-1),.25);assert.equal(f.nodes.length,1,'El cambio de turno no reinicia la pista');
  f.context.currentTime=7;f.music.toggle();assert.equal(f.nodes[0].stopped,true);assert.equal(f.music.enabled,false);
  f.music.sync({active:true});await flush();assert.equal(f.nodes.length,1);
  f.music.toggle();f.music.sync({active:true});await flush();assert.equal(f.nodes.length,2);assert.equal(f.nodes[1].args[1],7,'Reanuda por donde iba');assert.equal(f.requests.length,1);
  f.music.sync({active:false});assert.equal(f.nodes[1].stopped,true);f.music.dispose();
});
test('música: no descarga en móvil/inactivo y cancela cargas que terminan después de salir',async()=>{
  const f=fixture();f.music.sync({active:false});await flush();assert.equal(f.requests.length,0);
  let complete;f.host.fetch=()=>new Promise(resolve=>complete=()=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}));
  f.music.sync({active:true});f.music.sync({active:false});complete();await flush();assert.equal(f.nodes.length,0);f.music.dispose();
});

test('las transiciones duran 0,6 y 1,2 segundos y retoman el nivel intermedio sin saltos',async()=>{
  const f=fixture();f.music.sync({active:true});await flush();f.context.currentTime=1.2;
  f.music.sync({active:true,ducked:true});assert.equal(f.anchors.at(-1).value,.25);assert.ok(Math.abs(f.ramps.at(-1).time-1.8)<1e-8);
  f.context.currentTime=1.5;f.music.sync({active:true,ducked:false});
  assert.ok(Math.abs(f.anchors.at(-1).value-.15)<1e-8,'La recuperación parte del volumen real de la bajada');
  assert.equal(f.ramps.at(-1).time,2.7);f.music.dispose();
});
