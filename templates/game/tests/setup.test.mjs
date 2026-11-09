import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GameHub} from '../domain/hub.mjs';
const config=JSON.parse(await readFile(new URL('../game.json',import.meta.url),'utf8'));
function setup(){
  const revoked=[],hub=new GameHub(config,{revoke:id=>revoked.push(id)});
  hub.connect('tv',{role:'guest'});
  const roomId=config.rooms?hub.action('tv','create-room',{name:'Sala de prueba'}).roomId:'main';
  hub.connect('tv',{role:'tv',roomId});return {hub,roomId,revoked};
}
test('perfiles normalizados, nombres únicos y reglas reservadas a TV',()=>{
  const {hub,roomId}=setup();hub.connect('p1',{role:'player',roomId});
  if(config.maxPlayers>1)hub.connect('p2',{role:'player',roomId});else assert.throws(()=>hub.connect('p2',{role:'player',roomId}));
  assert.throws(()=>hub.action('p1','profile',{name:' Al ',avatar:0}));
  hub.action('p1','profile',{name:' Ana ',avatar:0});assert.equal(hub.view('p1').me.name,'Ana');
  if(config.maxPlayers>1)assert.throws(()=>hub.action('p2','profile',{name:'ANA',avatar:0}),{code:'NAME_TAKEN'});
  assert.throws(()=>hub.action('p1','settings',{rounds:2,roundId:hub.view('p1').roundId}),{code:'FORBIDDEN'});
});
test('recuperar una sesión no duplica al jugador y revoca la pantalla anterior',()=>{
  const {hub,roomId,revoked}=setup(),session=hub.connect('p1',{role:'player',roomId});hub.action('p1','profile',{name:'Ana',avatar:0});
  assert.throws(()=>hub.connect('p2',{role:'player',roomId,claimPlayerId:session.playerId}),{code:'CONFIRM_TAKEOVER'});
  const next=hub.connect('p2',{role:'player',roomId,claimPlayerId:session.playerId,force:true});
  assert.equal(hub.view('tv').players.length,1);assert.deepEqual(revoked,['p1']);assert.notEqual(next.token,session.token);
  assert.throws(()=>hub.connect('p3',{role:'player',roomId,token:session.token}),{code:'SESSION_EXPIRED'});
  hub.detach('p2');hub.connect('p3',{role:'player',roomId,token:next.token});assert.equal(hub.view('p3').me.name,'Ana');
});
