import {config} from './game-config.js';
import {createConnection} from './connection.js';
import {installRemoteNavigation,captureFocus,restoreFocus} from '/shared/remote-navigation.js';
const app=document.querySelector('#app'),notice=document.querySelector('#notice'),fullscreen=document.querySelector('#fullscreen');
document.title=config.title+' · Game Center';document.querySelector('#game-title').textContent=config.title;
let state,online=false,view='choose',revoked=false,name='',avatar=0,profileId,editing=false,scrollTimer,toastTimer;
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const image=(index,size='')=>`<img class="avatar ${size}" src="${escape(config.avatars[index]||config.avatars[0])}" alt="" width="64" height="64">`;
const button=(action,label,extra='')=>`<button data-action="${action}" ${extra}>${label}</button>`;
function toast(error){notice.textContent=error?.message||String(error);clearTimeout(toastTimer);toastTimer=setTimeout(()=>notice.textContent='',6000);}
const net=createConnection({
  onState(next){
    const previous=state;state=next;
    if(next.me&&next.me.id!==previous?.me?.id){name=next.me.name;avatar=next.me.avatar??0;}
    if(!previous&&next.role==='player'){view='session';history.replaceState({view,roomId:next.room?.id},'',location.href);}
    if(previous?.role!=='guest'&&next.role==='guest'){view='choose';editing=false;}
    if(!next.room){view='choose';const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({view},'',url);}
    render();orient();
  },
  onStatus(value){online=value;document.querySelector('#connection').textContent=value?'En directo':'Reconectando…';document.body.classList.toggle('offline',!value);updateFullscreen();},
  onError:toast,onRevoked(){revoked=true;render();},
});
history.replaceState({view,roomId:new URL(location.href).searchParams.get('room')},'',location.href);
installRemoteNavigation({preferred:()=>app.querySelector('[data-role="tv"],button,input'),onBack:()=>{back();return true;}});
function currentOrientation(){return state?.me?.playing&&state.phase!=='lobby'?config.orientation:'portrait';}
async function orient(){if(state?.role==='player'&&document.fullscreenElement)await screen.orientation?.lock?.(currentOrientation()).catch(()=>{});}
function requestFullscreen(){document.documentElement.requestFullscreen?.().then(orient).catch(()=>{});}
function updateFullscreen(){fullscreen.hidden=state?.role!=='player'||view!=='session'||Boolean(document.fullscreenElement)||revoked;}
fullscreen.onclick=requestFullscreen;document.addEventListener('fullscreenchange',()=>{updateFullscreen();orient();});
async function identify(payload){
  try{await net.hello({...payload,roomId:state?.room?.id||payload.roomId});editing=false;navigate('session');return true;}
  catch(error){
    if(error.code==='CONFIRM_TAKEOVER'&&confirm('Ese jugador sigue conectado. ¿Quieres recuperar sus datos y cerrar la otra pantalla?'))return identify({...payload,force:true});
    if(error.code==='SESSION_EXPIRED')net.clearToken(state.room?.id);toast(error);return false;
  }
}
function navigate(next,replace=false){view=next;history[replace?'replaceState':'pushState']({view,roomId:state.room?.id||null},'',location.href);render();}
async function selectRoom(roomId){
  try{await net.hello({role:'guest',roomId});const url=new URL(location.href);url.searchParams.set('room',roomId);history.pushState({view:'choose',roomId},'',url);view='choose';render();}catch(error){toast(error);}
}
async function back(){
  if(revoked){location.reload();return;}
  if(!state?.room||view==='choose'){
    if(config.rooms&&state?.room){await net.hello({role:'guest',roomId:null}).catch(toast);return;}
    location.href='/';return;
  }
  if(state.role==='tv'&&state.phase==='results'){await action('reset');return;}
  if(state.phase==='playing'&&!confirm('La partida seguirá con los demás. ¿Volver a elegir dispositivo?'))return;
  await net.hello({role:'guest',roomId:state.room.id}).catch(toast);navigate('choose');
}
window.addEventListener('popstate',async event=>{
  if(!state)return;view=event.state?.view==='recover'?'recover':'choose';editing=false;
  const roomId=config.rooms?(event.state?.roomId||null):'main';
  await net.hello({role:'guest',roomId}).catch(toast);render();
});
async function action(type,payload={}){try{await net.request(type,{...payload,roundId:state.roundId});return true;}catch(error){toast(error);return false;}}
function cards(players){return players.map(player=>`<article class="player-card">${player.ready?image(player.avatar):'<span class="avatar pending">…</span>'}<div><strong>${escape(player.ready?player.name:'Eligiendo perfil…')}</strong><small>${player.online?'Conectado':'Desconectado'}${player.ready?'':' · Pendiente'}</small></div></article>`).join('')||'<p class="muted">Esperando a los jugadores…</p>';}
function toolbar(title){return `<div class="toolbar">${button('back','← Volver')}<h1>${title}</h1>${state.room?`<span class="room-label">${escape(state.room.name)}${config.rooms?' · '+escape(state.room.id):''}</span>`:''}</div>`;}
function render(){
  clearInterval(scrollTimer);updateFullscreen();if(!state){app.innerHTML='<p>Conectando con el juego…</p>';return;}
  if(revoked){app.innerHTML='<h1>Tu jugador está en otro dispositivo</h1><p>Sus datos están a salvo.</p>'+button('reload','Volver a selección');return;}
  if(view==='session'&&state.role==='player'&&state.phase==='lobby'&&(!state.me.ready||editing)&&profileId===state.me.id&&app.querySelector('#profile'))return;
  const focus=captureFocus(app);profileId=null;
  let html;
  if(!state.room){
    html=toolbar('Elige una sala')+`<div class="layout"><section class="panel room-list scroll">${state.rooms.map(room=>button('room',`<strong>${escape(room.name)}</strong><small>${room.count} jugadores · ${room.phase==='lobby'?'En espera':'Partida iniciada'} · ${escape(room.id)}</small>`,`data-room="${escape(room.id)}"`)).join('')||'<p>Todavía no hay salas.</p>'}</section><form id="room-form" class="panel"><h2>Crear sala</h2><label>Nombre de sala<input name="room-name" minlength="3" maxlength="40" required autocomplete="off"></label><button>Crear sala</button></form></div>`;
  }else if(view==='choose'||state.role==='guest'&&view!=='recover'){
    html=toolbar(escape(config.title))+`<div class="roles"><button data-role="tv"><img src="./assets/tv.svg" alt=""><strong>Televisión</strong><span>Pantalla compartida y reglas</span></button><button data-role="player"><img src="./assets/player.svg" alt=""><strong>Jugador</strong><span>Tu nombre, tu avatar y tu partida</span></button></div>`;
  }else if(view==='recover'){
    html=toolbar('Elige tu jugador')+`<div class="scroll players">${state.players.filter(player=>player.ready).map(player=>`<button data-claim="${escape(player.id)}">${image(player.avatar)}<strong>${escape(player.name)}</strong><small>${player.online?'Conectado':'Desconectado'}</small></button>`).join('')||'<p>No hay jugadores que recuperar.</p>'}</div>`;
  }else if(state.role==='player'&&state.phase==='lobby'&&(!state.me.ready||editing)){
    profileId=state.me.id;
    html=toolbar('¿Cómo te llamas?')+`<form id="profile"><label>Tu nombre<input id="player-name" value="${escape(name)}" minlength="3" maxlength="40" required autocomplete="nickname"></label><h2>Elige tu avatar</h2><div class="avatars scroll">${config.avatars.map((_,index)=>`<button type="button" data-avatar="${index}" aria-label="Avatar ${index+1}" aria-pressed="${index===avatar}">${image(index)}</button>`).join('')}</div><button>Confirmar y esperar</button></form>`;
  }else if(state.role==='tv'&&state.phase==='lobby'){
    const ready=state.players.filter(player=>player.ready&&player.online).length;
    html=toolbar('Esperando a los jugadores')+`<div class="layout"><section class="panel roster"><h2>Jugadores · ${ready}/${config.maxPlayers}</h2><div class="players scroll auto-scroll">${cards(state.players)}</div></section><section class="panel rules"><h2>Reglas</h2><label>Número de rondas<input id="rounds" type="number" min="1" max="20" value="${state.settings.rounds}"></label><p>Se jugarán las rondas configuradas. Puedes cambiarlas antes de empezar.</p>${button('start','Empezar partida',ready<config.minPlayers?'disabled':'')}${state.players.length?button('cancel','Vaciar jugadores'):''}${config.rooms?button('close-room','Cerrar sala'):''}</section></div>`;
  }else if(state.role==='player'&&state.phase==='lobby'){
    html=toolbar('¡Todo listo!')+`<section class="waiting panel">${image(state.me.avatar)}<h2>${escape(state.me.name)}</h2><p>La partida empieza desde la televisión.</p>${button('edit','Cambiar nombre o avatar')}</section>`;
  }else{
    const results=state.phase==='results';
    html=toolbar(results?'Partida terminada':'Partida en curso')+`<div class="layout"><section class="panel roster"><h2>${results?'Participantes':'Jugadores'}</h2><div class="players scroll ${state.role==='tv'?'auto-scroll':''}">${cards(state.players.filter(player=>player.playing))}</div></section><section class="panel rules"><h2>${results?'Gracias por jugar':`${state.settings.rounds} rondas`}</h2><p>${state.role==='player'&&!state.me.playing?'Estás mirando esta partida. Podrás jugar en la siguiente.':results?'La televisión puede preparar otra partida.':'La partida está en marcha.'}</p>${state.role==='tv'?(results?button('restart','Otra partida')+button('reset','Volver a selección'):button('finish','Finalizar partida')+button('cancel','Cancelar partida')):''}</section></div>`;
  }
  app.innerHTML=html;bind();restoreFocus(app,focus);
  const rail=app.querySelector('.auto-scroll');
  if(rail&&!matchMedia('(prefers-reduced-motion: reduce)').matches){let direction=1,pause=Date.now()+1800;scrollTimer=setInterval(()=>{
    if(Date.now()<pause||rail.matches(':hover')||rail.contains(document.activeElement))return;
    rail.scrollTop+=direction;
    if(rail.scrollTop+rail.clientHeight>=rail.scrollHeight-1){direction=-1;pause=Date.now()+1800;}else if(rail.scrollTop<=0){direction=1;pause=Date.now()+1800;}
  },40);}
}
function bind(){
  app.querySelector('[data-role="tv"]')?.addEventListener('click',()=>identify({role:'tv'}));
  app.querySelector('[data-role="player"]')?.addEventListener('click',async()=>{
    requestFullscreen();const token=net.token(state.room.id);
    if(token&&await identify({role:'player',token}))return;
    if(state.phase!=='lobby'){navigate('recover');return;}identify({role:'player'});
  });
  app.querySelectorAll('[data-claim]').forEach(node=>node.onclick=()=>identify({role:'player',claimPlayerId:node.dataset.claim}));
  app.querySelectorAll('[data-room]').forEach(node=>node.onclick=()=>selectRoom(node.dataset.room));
  app.querySelector('#room-form')?.addEventListener('submit',async event=>{
    event.preventDefault();try{const result=await net.request('create-room',{name:new FormData(event.target).get('room-name').trim()});await selectRoom(result.roomId);}catch(error){toast(error);}
  });
  app.querySelector('#player-name')?.addEventListener('input',event=>name=event.target.value);
  app.querySelectorAll('[data-avatar]').forEach(node=>node.onclick=()=>{
    document.querySelector('#player-name')?.blur();avatar=Number(node.dataset.avatar);
    for(const item of app.querySelectorAll('[data-avatar]'))item.setAttribute('aria-pressed',String(Number(item.dataset.avatar)===avatar));
  });
  app.querySelector('#profile')?.addEventListener('submit',async event=>{
    event.preventDefault();name=name.normalize('NFKC').trim().replace(/\s+/gu,' ');app.querySelector('#player-name').value=name;
    if([...name].length<3||[...name].length>40){toast('El nombre debe tener entre 3 y 40 caracteres.');return;}
    if(await action('profile',{name,avatar})){editing=false;render();}
  });
  app.querySelector('#rounds')?.addEventListener('change',event=>action('settings',{rounds:Number(event.target.value)}));
  app.querySelectorAll('[data-action]').forEach(node=>node.onclick=async()=>{
    const type=node.dataset.action;
    if(type==='back')return back();if(type==='reload')return location.reload();
    if(type==='edit'){editing=true;profileId=null;render();return;}
    if(['start','cancel','reset','close-room','finish'].includes(type)&&!confirm(type==='start'?'¿Estamos todos? ¿Empezamos?':'¿Confirmas esta acción?'))return;
    await action(type);
  });
}
window.addEventListener('pagehide',()=>{clearInterval(scrollTimer);net.stop();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
