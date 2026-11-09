import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {GameHub,GameError} from '../domain/hub.mjs';
export function createGameServer(config){
  const clients=new Map();
  const send=(id,message)=>{const socket=clients.get(id);if(socket?.readyState===WebSocket.OPEN){if(socket.bufferedAmount>1048576)return socket.close(1013,'Conexión lenta');socket.send(JSON.stringify(message));}};
  const hub=new GameHub(config,{notify:send,revoke:id=>{send(id,{type:'revoked'});clients.get(id)?.close(4001,'Sesión recuperada');}});
  const server=http.createServer((request,response)=>{response.writeHead(request.url==='/health'?200:404,{'Content-Type':'application/json'});response.end(JSON.stringify({ok:request.url==='/health'}));});
  const wss=new WebSocketServer({server,path:'/socket',maxPayload:8192,perMessageDeflate:false});
  wss.on('connection',socket=>{
    const id=randomUUID(),requests=new Map();clients.set(id,socket);socket.alive=true;
    const deadline=setTimeout(()=>{if(!hub.clients.has(id))socket.close(1008,'Falta identificación');},10000);
    let since=Date.now(),count=0;
    socket.on('pong',()=>socket.alive=true);socket.on('error',()=>{});
    socket.on('message',raw=>{
      if(Date.now()-since>1000){since=Date.now();count=0;}
      if(++count>35)return socket.close(1008,'Demasiadas acciones');
      let message;
      try{
        message=JSON.parse(raw.toString());
        if(!message||typeof message.type!=='string'||typeof message.requestId!=='string'||message.requestId.length>80||!message.payload||typeof message.payload!=='object'||Array.isArray(message.payload))throw new GameError('Mensaje inválido.');
        const previous=requests.get(message.requestId),fingerprint=JSON.stringify([message.type,message.payload]);
        if(previous){if(previous.fingerprint!==fingerprint)throw new GameError('Identificador de solicitud reutilizado.');send(id,previous.response);return;}
        const result=message.type==='hello'?hub.connect(id,message.payload):hub.action(id,message.type,message.payload);
        if(message.type==='hello')clearTimeout(deadline);
        const response={type:'ack',requestId:message.requestId,result};requests.set(message.requestId,{fingerprint,response});
        if(requests.size>50)requests.delete(requests.keys().next().value);send(id,response);
      }catch(error){send(id,{type:'error',requestId:message?.requestId,message:error instanceof GameError?error.message:'No se pudo completar la acción.',code:error.code||'INTERNAL'});if(!(error instanceof GameError))console.error(error);}
    });
    socket.on('close',()=>{clearTimeout(deadline);clients.delete(id);hub.detach(id);});
  });
  const heartbeat=setInterval(()=>{for(const socket of wss.clients){if(!socket.alive){socket.terminate();continue;}socket.alive=false;socket.ping();}hub.collectRooms();},15000);heartbeat.unref();
  server.on('close',()=>clearInterval(heartbeat));server.hub=hub;
  return server;
}
