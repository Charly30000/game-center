// Pasarela de pruebas sin acceso a Docker. El Bingo de revisión se ejecuta en
// otro contenedor; este proceso solo sirve recursos y conecta su WebSocket.
import http from 'node:http';
import { WebSocket,WebSocketServer } from 'ws';
import { serveFile } from '../../server/static.mjs';
import { games } from '../../server/catalog.mjs';
const json=(response,data)=>{response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(data));};
const server=http.createServer(async(request,response)=>{
  const path=new URL(request.url,'http://preview').pathname;
  if(path==='/health')return json(response,{ok:true});
  if(path==='/api/games')return json(response,games.map(({command,port,...game})=>game));
  if(path==='/api/games/bingo/launch')return json(response,{url:'/games/bingo/'});
  if(path.startsWith('/games/bingo/'))return serveFile(response,'games/bingo/public',path.slice(13)||'index.html');
  if(path.startsWith('/shared/'))return serveFile(response,'public/shared',path.slice(8));
  if(path.startsWith('/fonts/fredoka/'))return serveFile(response,'node_modules/@fontsource/fredoka/files',path.slice(15));
  if(path.startsWith('/fonts/space-mono/'))return serveFile(response,'node_modules/@fontsource/space-mono/files',path.slice(18));
  if(path.startsWith('/vendor/three/'))return serveFile(response,'node_modules/three/build',path.slice(14));
  return serveFile(response,'public',path==='/'?'index.html':path.slice(1));
});
const sockets=new WebSocketServer({noServer:true});
server.on('upgrade',(request,socket,head)=>sockets.handleUpgrade(request,socket,head,client=>{
  const upstream=new WebSocket(process.env.GAME_SERVER||'ws://gamecenter-review-bingo:3001/socket');
  const queue=[];client.on('message',data=>upstream.readyState===WebSocket.OPEN?upstream.send(data,{binary:false}):queue.push(data));
  upstream.on('open',()=>{for(const data of queue)upstream.send(data,{binary:false});});
  upstream.on('message',data=>{if(client.readyState===WebSocket.OPEN)client.send(data,{binary:false});});
  upstream.on('error',()=>client.close(1013));upstream.on('close',()=>client.close());
  client.on('error',()=>{});client.on('close',()=>upstream.close());
}));
server.listen(3000,'0.0.0.0');
