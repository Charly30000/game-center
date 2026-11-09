// Revisión aislada: genera juegos solo en /tmp y no utiliza Docker ni partidas reales.
import http from 'node:http';
import {mkdtemp,mkdir,writeFile,symlink,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {WebSocket,WebSocketServer} from 'ws';
import {generateGame} from '../../scripts/game-scaffold.mjs';
import {registeredGames} from '../../server/catalog-registry.mjs';
import {games} from '../../server/catalog.mjs';
import {serveFile} from '../../server/static.mjs';
const root=await mkdtemp(join(tmpdir(),'gamecenter-scaffold-browser-'));
await mkdir(join(root,'games'));await mkdir(join(root,'server'));await cp('server/games.json',join(root,'server/games.json'));await symlink(resolve('node_modules'),join(root,'node_modules'),'dir');
await cp('games/bingo/public/assets/avatars',join(root,'games/bingo/public/assets/avatars'),{recursive:true});
const backends=new Map(),entries=[];
for(const [id,name,rooms,avatars]of [['demo-base','Base de prueba',false,'own'],['demo-salas','Prueba con salas',true,'bingo']]){
  const result=await generateGame({root,id,name,rooms,avatars});entries.push(result.entry);
  const {createGameServer}=await import(pathToFileURL(join(result.directory,'transport/server.mjs'))),server=createGameServer(result.config);
  server.listen(0,'127.0.0.1');await once(server,'listening');backends.set(id,server.address().port);
}
const registry=[...games,...registeredGames(entries)];
const json=(response,data)=>{response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(data));};
const server=http.createServer((request,response)=>{
  const path=new URL(request.url,'http://preview').pathname;
  if(path==='/health')return json(response,{ok:true});
  if(path==='/api/games')return json(response,registry.map(({command,port,...entry})=>entry));
  if(path==='/api/connection')return json(response,{publicUrl:''});
  const launch=path.match(/^\/api\/games\/([a-z-]+)\/launch$/);if(launch&&backends.has(launch[1]))return json(response,{url:`/games/${launch[1]}/`});
  const game=path.match(/^\/games\/([a-z-]+)\/(.*)$/);
  if(game&&registry.some(entry=>entry.id===game[1]))return serveFile(response,game[1]==='bingo'?'games/bingo/public':join(root,'games',game[1],'public'),game[2]||'index.html');
  if(path.startsWith('/shared/'))return serveFile(response,'public/shared',path.slice(8));
  if(path.startsWith('/fonts/fredoka/'))return serveFile(response,'node_modules/@fontsource/fredoka/files',path.slice(15));
  if(path.startsWith('/fonts/space-mono/'))return serveFile(response,'node_modules/@fontsource/space-mono/files',path.slice(18));
  return serveFile(response,'public',path==='/'?'index.html':path.slice(1));
});
const sockets=new WebSocketServer({noServer:true});
server.on('upgrade',(request,socket,head)=>{
  const id=request.url?.match(/^\/ws\/([a-z-]+)$/)?.[1];if(!backends.has(id))return socket.destroy();
  sockets.handleUpgrade(request,socket,head,client=>{
    const upstream=new WebSocket(`ws://127.0.0.1:${backends.get(id)}/socket`),queue=[];
    client.on('message',data=>upstream.readyState===WebSocket.OPEN?upstream.send(data,{binary:false}):queue.push(data));
    upstream.on('open',()=>{for(const data of queue)upstream.send(data,{binary:false});});
    upstream.on('message',data=>{if(client.readyState===WebSocket.OPEN)client.send(data,{binary:false});});
    upstream.on('error',()=>client.close());upstream.on('close',()=>client.close());client.on('close',()=>upstream.close());client.on('error',()=>{});
  });
});
setTimeout(()=>process.exit(),300000).unref();server.listen(3000,'0.0.0.0',()=>console.log('Plantillas de revisión listas.'));
