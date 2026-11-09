import {config} from './game-config.js';
export function createConnection({onState,onStatus,onError,onRevoked}){
  let socket,stopped=false,serial=0,retry=0,timer,identifying=0;
  const pending=new Map();
  let identity={role:'guest',roomId:config.rooms?new URL(location.href).searchParams.get('room'):null};
  const key=roomId=>`${config.id}.session.${roomId||'main'}`;
  function token(roomId){try{return localStorage.getItem(key(roomId));}catch{return null;}}
  function save(roomId,value){try{value?localStorage.setItem(key(roomId),value):localStorage.removeItem(key(roomId));}catch{/* Sesión solo en memoria si se bloquea el almacenamiento. */}}
  const remembered=token(identity.roomId);if(remembered&&(!config.rooms||identity.roomId))identity={...identity,role:'player',token:remembered};
  function request(type,payload={}){
    return new Promise((resolve,reject)=>{
      if(socket?.readyState!==WebSocket.OPEN)return reject(new Error('Reconectando. Espera un momento.'));
      const requestId=String(++serial),timeout=setTimeout(()=>{pending.delete(requestId);reject(new Error('La conexión tarda en responder.'));},10000);
      pending.set(requestId,{resolve,reject,timeout});socket.send(JSON.stringify({type,requestId,payload}));
    });
  }
  async function hello(payload){
    identifying++;
    try{
      const result=await request('hello',payload);identity={role:payload.role,roomId:payload.roomId||null,token:result.token};
      if(result.token)save(identity.roomId,result.token);return result;
    }finally{identifying--;}
  }
  function connect(){
    if(stopped)return;onStatus(false);
    socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws/${config.id}`);
    socket.onopen=async()=>{
      retry=0;
      try{await hello(identity);onStatus(true);}catch(error){
        if(['SESSION_EXPIRED','ROOM_NOT_FOUND','GAME_STARTED'].includes(error.code)){
          save(identity.roomId,null);const roomId=error.code==='ROOM_NOT_FOUND'?null:identity.roomId;
          await hello({role:'guest',roomId}).catch(onError);onStatus(true);
        }
        onError(error);
      }
    };
    socket.onmessage=event=>{
      let message;try{message=JSON.parse(event.data);}catch{return;}
      if(message.type==='state'){
        if(message.role==='guest'){if(identity.role==='player'&&!identifying)save(identity.roomId,null);identity={role:'guest',roomId:message.room?.id||null};}
        onState(message);
      }else if(message.type==='revoked'){
        stopped=true;if(token(identity.roomId)===identity.token)save(identity.roomId,null);onRevoked();
      }else if(pending.has(message.requestId)){
        const item=pending.get(message.requestId);pending.delete(message.requestId);clearTimeout(item.timeout);
        message.type==='error'?item.reject(Object.assign(new Error(message.message),{code:message.code})):item.resolve(message.result);
      }
    };
    socket.onclose=()=>{
      for(const item of pending.values()){clearTimeout(item.timeout);item.reject(new Error('Conexión perdida.'));}pending.clear();
      if(!stopped){onStatus(false);timer=setTimeout(connect,Math.min(12000,700*2**retry++));}
    };socket.onerror=()=>{};
  }
  connect();return {request,hello,token,clearToken:roomId=>save(roomId,null),stop(){stopped=true;clearTimeout(timer);socket?.close();}};
}
