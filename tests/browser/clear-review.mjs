import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://host.docker.internal:3002';
assert.equal(new URL(base).port,'3002','Esta utilidad solo puede dirigirse a la vista aislada de revisión.');
const socket=new WebSocket(base.replace(/^http/,'ws')+'/ws/bingo');
let state,serial=0;const pending=new Map();
socket.onmessage=event=>{
  const message=JSON.parse(event.data);if(message.type==='state')state=message;
  if(pending.has(message.requestId)){const {resolve,reject}=pending.get(message.requestId);pending.delete(message.requestId);message.type==='error'?reject(new Error(message.message)):resolve();}
};
const request=type=>new Promise((resolve,reject)=>{const requestId=String(++serial);pending.set(requestId,{resolve,reject});socket.send(JSON.stringify({type,requestId,payload:type==='hello'?{role:'tv'}:{}}));});
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
try{
  await request('hello');
  assert.ok(state.players.every(player=>player.name.startsWith('María')),'Hay jugadores ajenos a esta prueba; no se modifican.');
  if(state.phase!=='lobby')await request('cancel');
  console.log('Instancia de revisión lista.');
}finally{socket.close();}
