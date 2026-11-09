import { randomBytes, randomUUID, randomInt } from 'node:crypto';
export class GameError extends Error {
  constructor(message,code='INVALID_ACTION'){super(message);this.code=code;}
}
const requireThat=(condition,message,code)=>{if(!condition)throw new GameError(message,code);};
export function normalizeName(value){
  requireThat(typeof value==='string','Escribe un nombre.');
  const name=value.normalize('NFKC').trim().replace(/\s+/gu,' ');
  requireThat([...name].length>=3&&[...name].length<=40&&!/[\p{C}\p{Zl}\p{Zp}]/u.test(name),'El nombre debe tener entre 3 y 40 caracteres válidos.');
  return name;
}
const nameKey=name=>name.toLocaleLowerCase('es');
export class GameHub {
  constructor(config,{notify=()=>{},revoke=()=>{},now=Date.now}={}){
    this.config=config;this.notify=notify;this.revoke=revoke;this.now=now;
    this.clients=new Map();this.rooms=new Map();this.tokens=new Map();
    if(!config.rooms)this.makeRoom('main',config.title);
  }
  makeRoom(id,name){
    const room={id,name,phase:'lobby',roundId:randomUUID(),settings:{rounds:5},players:new Map(),emptySince:this.now()};
    this.rooms.set(id,room);return room;
  }
  connect(id,payload={}){
    requireThat(['guest','tv','player'].includes(payload.role),'Dispositivo inválido.');
    const roomId=this.config.rooms?(payload.roomId||null):'main';
    const room=roomId?this.rooms.get(roomId):null;
    requireThat(!roomId||room,'La sala ya no existe.','ROOM_NOT_FOUND');
    requireThat(payload.role==='guest'||room,'Elige una sala primero.');
    const old=this.clients.get(id);let player;
    if(payload.role==='player'){
      if(payload.token){
        const session=this.tokens.get(payload.token);
        requireThat(session&&session.roomId===roomId,'La sesión ha caducado.','SESSION_EXPIRED');
        player=room.players.get(session.playerId);
        requireThat(player,'La sesión ha caducado.','SESSION_EXPIRED');
      }else if(payload.claimPlayerId){
        player=room.players.get(payload.claimPlayerId);
        requireThat(player?.ready,'Ese jugador no está disponible.','SESSION_EXPIRED');
        requireThat(!player.clientId||player.clientId===id||payload.force===true,'Este jugador sigue conectado. Confirma para recuperarlo.','CONFIRM_TAKEOVER');
      }else if(old?.role==='player'&&old.roomId===roomId){player=room.players.get(old.playerId);}
      else{
        requireThat(room.phase==='lobby','La partida ya empezó. Elige tu jugador.','GAME_STARTED');
        requireThat(room.players.size<this.config.maxPlayers,'La sala está completa.');
      }
    }
    this.release(id);
    let token;
    if(payload.role==='player'){
      if(!player){player={id:randomUUID(),name:'',avatar:randomInt(this.config.avatars.length),ready:false,playing:false,privateData:{}};room.players.set(player.id,player);}
      if(player.clientId&&player.clientId!==id){this.clients.delete(player.clientId);this.revoke(player.clientId);}
      if(player.token)this.tokens.delete(player.token);
      token=randomBytes(32).toString('hex');player.token=token;player.clientId=id;
      this.tokens.set(token,{roomId,playerId:player.id});
    }
    this.clients.set(id,{role:payload.role,roomId,playerId:player?.id||null});
    this.updateEmpty();this.emit();return token?{token,playerId:player.id}:{};
  }
  release(id){
    const client=this.clients.get(id),player=this.rooms.get(client?.roomId)?.players.get(client?.playerId);
    if(player?.clientId===id)player.clientId=null;
    this.clients.delete(id);
  }
  detach(id){this.release(id);this.updateEmpty();this.emit();}
  updateEmpty(){
    for(const room of this.rooms.values()){
      if([...this.clients.values()].some(client=>client.roomId===room.id))room.emptySince=null;
      else if(room.emptySince===null)room.emptySince=this.now();
    }
  }
  collectRooms(){
    if(!this.config.rooms)return;
    let changed=false;
    for(const room of [...this.rooms.values()])if(room.emptySince!==null&&this.now()-room.emptySince>=86400000){this.deleteRoom(room);changed=true;}
    if(changed)this.emit();
  }
  deleteRoom(room){
    for(const player of room.players.values())this.tokens.delete(player.token);
    this.rooms.delete(room.id);
    for(const client of this.clients.values())if(client.roomId===room.id){client.role='guest';client.roomId=null;client.playerId=null;}
  }
  action(id,type,payload={}){
    const client=this.clients.get(id);requireThat(client,'Identifícate de nuevo.','NOT_CONNECTED');
    this.collectRooms();
    if(type==='create-room'){
      requireThat(this.config.rooms&&!client.roomId,'Vuelve a la selección de salas.');
      requireThat(this.rooms.size<24,'Se ha alcanzado el límite de salas.');
      const name=normalizeName(payload.name);
      requireThat(![...this.rooms.values()].some(room=>nameKey(room.name)===nameKey(name)),'Ya existe una sala con ese nombre.');
      let roomId;do{roomId=randomBytes(3).toString('hex').toUpperCase();}while(this.rooms.has(roomId));
      this.makeRoom(roomId,name);this.emit();return {roomId};
    }
    const room=this.rooms.get(client.roomId);requireThat(room,'Elige una sala.','ROOM_NOT_FOUND');
    const player=room.players.get(client.playerId);
    if(type==='profile'){
      requireThat(client.role==='player'&&room.phase==='lobby','El perfil se confirma antes de empezar.');
      const name=normalizeName(payload.name);
      const rooms=[...this.rooms.values()];
      requireThat(!rooms.some(item=>[...item.players.values()].some(other=>other!==player&&other.ready&&nameKey(other.name)===nameKey(name))),'Ya hay otro jugador con ese nombre.','NAME_TAKEN');
      requireThat(Number.isInteger(payload.avatar)&&payload.avatar>=0&&payload.avatar<this.config.avatars.length,'Elige un avatar válido.');
      Object.assign(player,{name,avatar:payload.avatar,ready:true});
    }else{
      requireThat(client.role==='tv','Esta acción se controla desde la televisión.','FORBIDDEN');
      requireThat(payload.roundId===room.roundId,'La partida ha cambiado.','STALE_ROUND');
      if(type==='settings'){
        requireThat(room.phase==='lobby','Las reglas se cambian antes de empezar.');
        requireThat(Number.isInteger(payload.rounds)&&payload.rounds>=1&&payload.rounds<=20,'Elige entre 1 y 20 rondas.');
        room.settings.rounds=payload.rounds;
      }else if(type==='start'||type==='restart'){
        requireThat(room.phase===(type==='start'?'lobby':'results'),'No se puede iniciar ahora.');
        const online=[...room.players.values()].filter(item=>item.ready&&item.clientId);
        requireThat(online.length>=this.config.minPlayers,`Hacen falta ${this.config.minPlayers} jugadores preparados y conectados.`);
        room.roundId=randomUUID();room.phase='playing';
        for(const item of room.players.values()){item.playing=online.includes(item);item.privateData={};}
      }else if(type==='finish'){
        requireThat(room.phase==='playing','No hay una partida en curso.');room.phase='results';
      }else if(type==='cancel'||type==='reset'){
        requireThat(type!=='reset'||room.phase==='results','No se puede reiniciar ahora.');
        for(const item of room.players.values())this.tokens.delete(item.token);
        room.players.clear();room.phase='lobby';room.roundId=randomUUID();room.settings={rounds:5};
        for(const item of this.clients.values())if(item.roomId===room.id){item.role='guest';item.playerId=null;}
      }else if(type==='close-room'){
        requireThat(this.config.rooms&&room.phase==='lobby','Solo se puede cerrar una sala en espera.');this.deleteRoom(room);
      }else throw new GameError('Acción desconocida.');
    }
    this.updateEmpty();this.emit();return {};
  }
  view(id){
    const client=this.clients.get(id)||{role:'guest',roomId:null},room=this.rooms.get(client.roomId),player=room?.players.get(client.playerId);
    const publicPlayer=item=>({id:item.id,name:item.ready?item.name:'',avatar:item.ready?item.avatar:null,ready:item.ready,online:Boolean(item.clientId),playing:item.playing});
    return {type:'state',role:client.role,rooms:[...this.rooms.values()].map(item=>({id:item.id,name:item.name,phase:item.phase,count:item.players.size})),
      room:room?{id:room.id,name:room.name}:null,phase:room?.phase||'lobby',roundId:room?.roundId||null,settings:room?{...room.settings}:null,
      players:room?[...room.players.values()].map(publicPlayer):[],me:player?{...publicPlayer(player),privateData:structuredClone(player.privateData)}:null};
  }
  emit(){for(const id of this.clients.keys())this.notify(id,this.view(id));}
}
