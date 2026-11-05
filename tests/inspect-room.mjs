import { WebSocket } from 'ws';
const socket=new WebSocket(process.env.ROOM_URL||'ws://center:3000/ws/bingo');
const timeout=setTimeout(()=>{socket.close();process.exitCode=1;},10000);
socket.on('open',()=>socket.send(JSON.stringify({type:'hello',requestId:'inspect',payload:{role:'guest'}})));
socket.on('message',raw=>{
  const message=JSON.parse(raw);
  if(message.type==='state'){
    console.log(JSON.stringify({phase:message.phase,players:message.players.length,onlinePlayers:message.players.filter(player=>player.online).length,called:message.called.length}));
    clearTimeout(timeout);socket.close();
  }
});
socket.on('error',error=>{clearTimeout(timeout);console.error(error.message);process.exitCode=1;});
