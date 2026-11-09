import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {WebSocket} from 'ws';
import {generateGame,validateOptions} from '../scripts/game-scaffold.mjs';
import {registeredGames} from '../server/catalog-registry.mjs';
import {collectGameAnswers} from '../scripts/game-questions.mjs';
const options={id:'prueba-base',name:'Prueba en familia',rooms:false,avatars:'own'};
const execute=promisify(execFile);
const initialRegistry=await readFile(new URL('../server/games.json',import.meta.url),'utf8');
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'gamecenter-scaffold-'));
  t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'games'));await mkdir(join(root,'server'));await writeFile(join(root,'server/games.json'),initialRegistry);return root;
}
test('el asistente exige decisiones explícitas y rechaza rutas, IDs y configuraciones inválidos',()=>{
  for(const patch of [{rooms:undefined},{avatars:undefined},{id:'../fuera'},{maxPlayers:41},{minPlayers:3,maxPlayers:2},{orientation:'auto'}])assert.throws(()=>validateOptions({...options,...patch}));
  assert.throws(()=>registeredGames([{id:'otro',title:'Otro juego',port:3001}]));
});
test('simular no escribe; generar registra portada propia, carpetas completas y sistemas independientes',async t=>{
  const root=await fixture(t),dry=await generateGame({root,...options,dryRun:true});assert.ok(dry.files.includes('domain/hub.mjs'));
  assert.deepEqual(await readdir(join(root,'games')),[]);assert.equal(await readFile(join(root,'server/games.json'),'utf8'),initialRegistry);
  const result=await generateGame({root,...options});assert.equal(result.config.port,3002);
  for(const path of ['README.md','game.json','server.mjs','domain/hub.mjs','transport/server.mjs','public/index.html','public/connection.js','public/assets/cover.svg','public/assets/icon.svg','docs/protocol.md','tests/setup.test.mjs'])assert.ok((await readFile(join(result.directory,path))).length,path);
  const config=JSON.parse(await readFile(join(result.directory,'game.json'),'utf8'));assert.ok(config.avatars.every(path=>path.startsWith('/games/prueba-base/')));
  assert.equal(registeredGames(JSON.parse(await readFile(join(root,'server/games.json'),'utf8')))[1].cover,'/games/prueba-base/assets/cover.svg');
  const before=await readFile(join(root,'server/games.json'),'utf8');await assert.rejects(generateGame({root,...options}),/No se sobrescribe/);assert.equal(await readFile(join(root,'server/games.json'),'utf8'),before);
});
test('la copia autorizada de avatares crea archivos propios y no enlaza el origen',async t=>{
  const root=await fixture(t),source=join(root,'games','origen','public','assets','avatars');await mkdir(source,{recursive:true});await writeFile(join(source,'1.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
  const result=await generateGame({root,...options,avatars:'origen'});assert.equal(result.config.avatars[0],'/games/prueba-base/assets/avatars/0.svg');
  await rm(join(root,'games','origen'),{recursive:true,force:true});assert.match(await readFile(join(result.directory,'public/assets/avatars/0.svg'),'utf8'),/<svg/);
});
test('salas generadas: nombres simultáneos, privacidad, múltiples TV, permisos y reset aislado',async t=>{
  const root=await fixture(t),result=await generateGame({root,...options,rooms:true});
  const {GameHub}=await import(pathToFileURL(join(result.directory,'domain/hub.mjs'))),hub=new GameHub(result.config);
  hub.connect('entrada',{role:'guest'});const a=hub.action('entrada','create-room',{name:'Familia A'}).roomId,b=hub.action('entrada','create-room',{name:'Familia B'}).roomId;
  hub.connect('tv1',{role:'tv',roomId:a});hub.connect('tv2',{role:'tv',roomId:a});hub.connect('tvB',{role:'tv',roomId:b});
  const s1=hub.connect('p1',{role:'player',roomId:a});hub.connect('p2',{role:'player',roomId:a});hub.connect('pB',{role:'player',roomId:b});
  const results=await Promise.allSettled(['p1','p2'].map(id=>Promise.resolve().then(()=>hub.action(id,'profile',{name:' Ana ',avatar:0}))));assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.throws(()=>hub.action('pB','profile',{name:'ANA',avatar:0}),{code:'NAME_TAKEN'});
  hub.action('pB','profile',{name:'Beto',avatar:0});assert.equal(hub.view('tvB').players.length,1);
  hub.rooms.get(a).players.get(s1.playerId).privateData={secret:42};assert.equal(hub.view('p1').me.privateData.secret,42);assert.equal(JSON.stringify(hub.view('tv1')).includes('secret'),false);
  assert.throws(()=>hub.connect('wrong',{role:'player',roomId:b,token:s1.token}),{code:'SESSION_EXPIRED'});
  let roundId=hub.view('tv1').roundId;hub.action('tv2','settings',{roundId,rounds:3});assert.equal(hub.view('tv1').settings.rounds,3);
  hub.action('tv1','start',{roundId});assert.equal(hub.view('tv2').phase,'playing');assert.equal(hub.view('tvB').phase,'lobby');
  roundId=hub.view('tv1').roundId;hub.action('tv2','finish',{roundId});hub.action('tv1','reset',{roundId});assert.equal(hub.view('tv2').role,'guest');assert.equal(hub.view('tvB').players.length,1);
});
test('el servidor generado ofrece salud y WebSocket real y deduplica solicitudes',async t=>{
  const root=await fixture(t),result=await generateGame({root,...options});await symlink(resolve('node_modules'),join(root,'node_modules'),'dir');
  const {createGameServer}=await import(pathToFileURL(join(result.directory,'transport/server.mjs'))),server=createGameServer(result.config);
  server.listen(0,'127.0.0.1');await once(server,'listening');
  let socket;t.after(()=>{socket?.terminate();return new Promise(resolve=>server.close(resolve));});
  const port=server.address().port;assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status,200);
  socket=new WebSocket(`ws://127.0.0.1:${port}/socket`);await once(socket,'open');
  const request=message=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Sin respuesta')),2000);const receive=raw=>{const result=JSON.parse(raw);if(result.requestId===message.requestId){clearTimeout(timeout);socket.off('message',receive);resolve(result);}};socket.on('message',receive);socket.send(JSON.stringify(message));});
  const hello={type:'hello',requestId:'1',payload:{role:'player'}};const first=await request(hello),second=await request(hello);assert.equal(first.result.token,second.result.token);assert.equal(server.hub.view([...server.hub.clients.keys()][0]).players.length,1);
  const bad=await request({...hello,payload:{role:'tv'}});assert.equal(bad.type,'error');socket.close();await once(socket,'close');
});

test('el CLI funciona sin TTY con decisiones completas y los tests generados admiten un único jugador',async t=>{
  const root=await fixture(t),script=resolve('scripts/create-game.mjs');
  const result=await execute(process.execPath,[script,'--id','solo','--name','Juego individual','--rooms','no','--avatars','own','--max-players','1'],{cwd:root});
  assert.match(result.stdout,/Juego creado/);
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>key!=='NODE_TEST_CONTEXT'));
  const tests=await execute(process.execPath,['--test','--test-reporter=tap',join(root,'games/solo/tests/setup.test.mjs')],{cwd:root,env});assert.match(tests.stdout,/# pass 2/);
  const rooms=await execute(process.execPath,[script,'--id','salas-base','--name','Con salas','--rooms','yes','--avatars','own','--dry-run'],{cwd:root});assert.match(rooms.stdout,/Simulación/);
  const help=await execute(process.execPath,[script,'--help'],{cwd:root});assert.ok(!help.stdout.includes('name-scope'));
  await assert.rejects(execute(process.execPath,[script,'--id','incompleto','--name','Sin decisiones'],{cwd:root}),error=>/Falta --rooms/.test(error.stderr));
  assert.deepEqual((await readdir(join(root,'games'))).sort(),['solo']);
});

test('el bloqueo no se sobrescribe y el ámbito global de nombres también se aplica entre salas',async t=>{
  const root=await fixture(t);await writeFile(join(root,'.game-create.lock'),'otra ejecución');
  await assert.rejects(generateGame({root,...options}),/otra creación/);assert.equal(await readFile(join(root,'.game-create.lock'),'utf8'),'otra ejecución');
  await rm(join(root,'.game-create.lock'));
  const result=await generateGame({root,...options,rooms:true}),{GameHub}=await import(pathToFileURL(join(result.directory,'domain/hub.mjs'))),hub=new GameHub(result.config);
  hub.connect('entry',{role:'guest'});const a=hub.action('entry','create-room',{name:'Sala uno'}).roomId,b=hub.action('entry','create-room',{name:'Sala dos'}).roomId;
  hub.connect('a',{role:'player',roomId:a});hub.connect('b',{role:'player',roomId:b});hub.action('a','profile',{name:'Ana',avatar:0});
  hub.detach('a');
  assert.throws(()=>hub.action('b','profile',{name:'ANA',avatar:0}),{code:'NAME_TAKEN'});
});

test('el diálogo repite inmediatamente cada respuesta inválida y ofrece orientación y juegos numerados',async t=>{
  const root=await fixture(t),labels=[],errors=[];
  const source=join(root,'games/bingo/public/assets/avatars');await mkdir(source,{recursive:true});await writeFile(join(source,'0.svg'),'<svg/>');
  await mkdir(join(root,'games/ocupado'));
  const replies=['','ab','Juego nuevo','../fuera','bingo','ocupado','juego-nuevo','quizá','no','90','1','0','2','1','5','auto','3','2'];
  const result=await collectGameAnswers({root,interactive:true,question:async label=>{labels.push(label);assert.ok(replies.length,'No debe preguntar indefinidamente');return replies.shift();},report:error=>errors.push(error)});
  assert.equal(replies.length,0);assert.equal(errors.length,11);
  assert.deepEqual(result,{name:'Juego nuevo',id:'juego-nuevo',rooms:'no',avatars:'bingo','min-players':2,'max-players':5,orientation:'portrait'});
  assert.equal(labels[0],labels[1]);assert.equal(labels[1],labels[2]);assert.equal(labels[3],labels[4]);assert.equal(labels[4],labels[5]);assert.equal(labels[5],labels[6]);
  assert.match(labels[9],/0\. Crear avatares propios/);assert.match(labels[9],/1\. Copiar de Bingo en familia \(bingo\)/);
  assert.match(labels.at(-1),/1\. Horizontal \(landscape\)\n2\. Vertical \(portrait\)/);
  const defaults=await collectGameAnswers({root,interactive:true,flags:{name:'Otro juego',id:'otro-juego',rooms:'yes'},question:async label=>label.startsWith('Avatares')?'0':'',report:error=>assert.fail(error)});
  assert.equal(defaults.avatars,'own');assert.equal(defaults.orientation,'landscape');
  await assert.rejects(collectGameAnswers({root,flags:{name:'ab'},question:()=>assert.fail('No debe preguntar')}),/--name/);
});

test('Bingo y las altas usan el mismo registro: números crecientes, orden estable y colisiones uniformes',async t=>{
  const root=await fixture(t),first=await generateGame({root,...options});
  const second=await generateGame({root,...options,id:'otro-juego'});
  assert.equal(first.config.number,2);assert.equal(second.config.number,3);assert.equal(second.config.port,3003);
  const entries=JSON.parse(await readFile(join(root,'server/games.json'),'utf8'));
  assert.deepEqual(registeredGames(entries.toReversed()).map(game=>[game.number,game.id]),[[1,'bingo'],[2,'prueba-base'],[3,'otro-juego']]);
  for(const field of ['number','id','port'])assert.throws(()=>registeredGames([...entries,{...second.entry,number:4,id:'otro-mas',port:3004,[field]:entries[0][field]}]),/repetido/);
  await assert.rejects(generateGame({root,...options,id:'bingo'}),/Ya existe ese identificador/);
  const empty=await fixture(t);await writeFile(join(empty,'server/games.json'),'[]');
  const bingo=await generateGame({root:empty,...options,id:'bingo'});assert.equal(bingo.config.number,1);assert.equal(bingo.config.port,3001);
});
