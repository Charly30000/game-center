import {readFile,writeFile,readdir,mkdir,lstat,realpath,rename,rm,open} from 'node:fs/promises';
import {resolve,join,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {registeredGames} from '../server/catalog-registry.mjs';
const templateRoot=fileURLToPath(new URL('../templates/game/',import.meta.url));
const exists=async path=>{try{await lstat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
export function validateOptions(options){
  const {id,name,rooms,avatars}=options;
  if(typeof id!=='string'||!/^[a-z]+(?:-[a-z]+)*$/.test(id)||id.length>40)throw new Error('El identificador debe tener letras minúsculas y guiones, máximo 40 caracteres.');
  if(typeof name!=='string'||[...name.trim()].length<3||name.length>80||/[\p{C}]/u.test(name))throw new Error('El nombre del juego debe tener entre 3 y 80 caracteres válidos.');
  if(typeof rooms!=='boolean')throw new Error('Debes decidir explícitamente si habrá salas: --rooms yes/no.');
  if(typeof avatars!=='string'||!(avatars==='own'||/^[a-z]+(?:-[a-z]+)*$/.test(avatars)))throw new Error('Debes elegir --avatars own o el identificador del juego cuyos avatares autorizas copiar.');
  const minPlayers=Number(options.minPlayers??1),maxPlayers=Number(options.maxPlayers??40),orientation=options.orientation??'landscape';
  if(!Number.isInteger(minPlayers)||!Number.isInteger(maxPlayers)||minPlayers<1||maxPlayers<minPlayers||maxPlayers>40)throw new Error('Los límites deben ser enteros entre 1 y 40, con mínimo ≤ máximo.');
  if(!['portrait','landscape'].includes(orientation))throw new Error('La orientación debe ser portrait o landscape.');
  return {id,title:name.trim(),rooms,avatarSource:avatars,minPlayers,maxPlayers,orientation};
}
async function readTemplates(path=templateRoot,prefix=''){
  const files=[];
  for(const entry of await readdir(path,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw new Error('La plantilla no puede contener enlaces simbólicos.');
    const name=prefix+entry.name;
    if(entry.isDirectory())files.push(...await readTemplates(join(path,entry.name),name+'/'));
    else if(entry.isFile())files.push({path:name,bytes:await readFile(join(path,entry.name))});
  }
  return files;
}
function svg(body,width=360,height=230){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>\n`;}
export async function avatarFiles(root,config){
  if(config.avatarSource==='own')return Array.from({length:8},(_,i)=>({path:`public/assets/avatars/${i}.svg`,bytes:Buffer.from(svg(`<rect width="96" height="96" rx="24" fill="hsl(${(i*43+config.hue)%360} 55% 80%)"/><circle cx="48" cy="48" r="28" fill="#fff8e9"/><circle cx="38" cy="44" r="3" fill="#18324b"/><circle cx="58" cy="44" r="3" fill="#18324b"/><path d="M36 57 Q48 ${66+i%3*2} 60 57" fill="none" stroke="#18324b" stroke-width="3" stroke-linecap="round"/>`,96,96))}));
  const folder=join(root,'games',config.avatarSource,'public','assets','avatars');
  if(resolve(await realpath(folder))!==resolve(folder))throw new Error('No se copian avatares desde carpetas enlazadas.');
  const entries=(await readdir(folder,{withFileTypes:true})).filter(entry=>/\.(svg|webp|png|jpe?g)$/i.test(entry.name)).sort((a,b)=>a.name.localeCompare(b.name,'en',{numeric:true}));
  if(!entries.length||entries.length>40)throw new Error('La carpeta de origen debe contener entre 1 y 40 avatares.');
  const files=[];let total=0;
  for(const [index,entry]of entries.entries()){
    if(!entry.isFile()||entry.isSymbolicLink())throw new Error('Solo se copian archivos de avatar normales.');
    if(total+(await lstat(join(folder,entry.name))).size>16*1024*1024)throw new Error('Los avatares superan 16 MB. Optimízalos antes de copiarlos.');
    const bytes=await readFile(join(folder,entry.name));total+=bytes.length;
    if(total>16*1024*1024)throw new Error('Los avatares superan 16 MB. Optimízalos antes de copiarlos.');
    files.push({path:`public/assets/avatars/${index}${extname(entry.name).toLowerCase()}`,bytes});
  }
  return files;
}
function documentation(c){
  return {
    'README.md':`# ${c.title}\n\nBase de juego generada: entrada, ${c.rooms?'salas públicas, ':''}TV/Jugador, perfiles, espera, reglas e inicio sincronizados. **La mecánica específica y las puntuaciones todavía deben implementarse.** Finalizar desde TV permite comprobar el flujo de resultados, sin adjudicar ganadores.\n\n## Decisiones iniciales\n\n- Número del catálogo: ${c.number}. Identificador: \`${c.id}\`; puerto interno: ${c.port}. Solo el centro publica puerto.\n- Salas: ${c.rooms?'sí, públicas en LAN; máximo 24, código de seis caracteres, cierre desde TV en lobby y retirada tras 24 horas vacías':'no, partida compartida'}.\n- Nombres únicos: en todo el juego, también entre salas, de 3 a 40 caracteres después de normalizar y aplicar \`.trim()\`; se reservan hasta borrar su identidad. No se garantiza reserva histórica tras reinicios.\n- Participantes: ${c.minPlayers}–${c.maxPlayers}. Varias TV pueden configurar e iniciar. Llegadas tardías: recuperación de jugador existente; no se crean participantes nuevos durante la partida.\n- Avatares: ${c.avatarSource==='own'?'ocho SVG geométricos provisionales propios, sustituibles por el diseño del juego':`copia autorizada de ${c.avatarSource}, alojada localmente y sin dependencia de ese juego`}.\n- Móvil: vertical en preparación, ${c.orientation==='landscape'?'horizontal':'vertical'} en partida; pantalla completa opcional.\n- Estado en memoria: se pierde al reiniciar el contenedor. Sin SQLite ni volumen de persistencia.\n\n## Probar\n\nReconstruir la imagen y recrear el centro solo con autorización, conforme a [operación general](../../docs/operations.md). Entrar en el catálogo, abrir ${c.title}, ${c.rooms?'crear/elegir una sala, ':''}elegir Televisión y conectar los móviles como Jugador. La TV configura rondas e inicia tras confirmación.\n\n[Arquitectura y ampliación](docs/architecture.md) · [Interfaz](docs/interface.md) · [Protocolo](docs/protocol.md) · [Operación](docs/operations.md) · [Verificación](docs/verification.md) · [Recursos](art/README.md).\n`,
    'docs/architecture.md':`# Arquitectura de ${c.title}\n\n- \`domain/hub.mjs\`: autoridad de salas, participantes, nombres, sesiones y fases. No importa transporte ni otros juegos.\n- \`transport/server.mjs\`: HTTP de salud, WebSocket, latidos, límites y deduplicación de solicitudes.\n- \`public/\`: interfaz, conexión y recursos propios. Solo comparte navegación por mando con la infraestructura del centro.\n- \`game.json\`: decisiones iniciales del servidor; \`public/game-config.js\` contiene únicamente configuración pública.\n\n## Completar la mecánica\n\nSustituir el flujo demostrativo \`playing → finish → results\` por reglas autoritativas propias, manteniendo permisos y \`roundId\`. La opción inicial \`rounds\` es un ejemplo configurable (1–20): no ejecuta automáticamente rondas. Implementar puntuaciones y ganadores en dominio; nunca aceptarlos del cliente. Para turnos, añadir identificador de turno, validación de mensajes atrasados y barrera de jugadores. Los datos privados deben seguir exclusivamente en \`me.privateData\`.\n\nNo importar código ni recursos de otro juego. Si se necesita persistencia, acordarla, usar SQLite y añadir un volumen exclusivo y permisos antes de guardar archivos. El contenedor actual es de solo lectura.\n`,
    'docs/interface.md':`# Interfaz y sesiones\n\n${c.rooms?'Selección/creación de sala → ':''}Televisión/Jugador → perfil → espera → partida → resultados. La salida al centro está en la entrada. El rol no se guarda. Una credencial de jugador válida recupera su identidad; con salas se resuelve primero la sala mediante la URL. Las salas son públicas, sin contraseña; esta base está pensada para una LAN de confianza, no para Internet.\n\nNombre y avatar se confirman antes de jugar. El formulario conserva su input al recibir estados ajenos y nunca se enfoca automáticamente. Nombres normalizados y recortados en cliente y servidor, sin duplicados en todo el juego, incluidas las demás salas. Los avatares pueden repetirse. La TV muestra tarjetas pendientes, preparadas y desconectadas; las listas largas tienen scroll interno y desplazamiento automático pausado al interactuar.\n\nLas reglas e inicio pertenecen a TV y al servidor. Varias TV ven el mismo estado. Una recuperación activa requiere confirmación, rota la credencial y revoca la pantalla anterior. Los nombres desconectados permanecen reservados. Atrás permite volver al selector sin cancelar la partida; cancelar/reset actúan sobre la sala y notifican a todas sus pantallas.\n\nDiseño adaptable sin scroll de página, con listas internas. Flechas, Enter y Atrás mediante navegación general del centro. Pantalla completa y orientación son opcionales; si el navegador las rechaza se puede seguir jugando y aparece un botón para recuperarla. La base no incluye 3D ni audio y no descarga recursos de otros juegos.\n`,
    'docs/protocol.md':`# Protocolo\n\nRuta pública \`/ws/${c.id}\` → contenedor independiente, WebSocket \`/socket\`. Cada mensaje lleva \`type\`, \`requestId\` (cadena) y \`payload\` (objeto). Límite 8 KB y 35 mensajes/s. Salud \`GET /health\`.\n\n- \`hello\`: \`role: guest|tv|player\`, \`roomId\` si hay salas; opcional \`token\` o \`claimPlayerId\` y \`force\`. ACK de jugador contiene token privado.\n- \`create-room\`: \`name\`, desde entrada de salas; devuelve \`roomId\`. Salas públicas y límite 24.\n- \`profile\`: \`name\`, \`avatar\`, solo jugador en lobby.\n- \`settings\`: \`rounds\`, solo TV en lobby.\n- \`start\`, \`finish\`, \`restart\`, \`reset\`, \`cancel\`, \`close-room\`: TV, fase y permisos validados. Todas las acciones de TV incluyen \`roundId\`. \`finish\` solo termina la demostración de la plantilla; no decide puntuaciones.\n\nRespuestas \`ack\` / \`error\` por solicitud; fotografías personalizadas \`state\`, y \`revoked\` si cambia el dispositivo de un jugador. Solo el receptor recibe \`me.privateData\`; los tokens nunca están en fotografías. Solicitudes repetidas con el mismo ID y contenido reciben su ACK sin repetir la acción; un ID reutilizado con otro contenido se rechaza. Caché limitada a 50 por conexión. Latidos cada 15 s; reconexión exponencial hasta 12 s. No se reenvían acciones automáticamente.\n`,
    'docs/operations.md':`# Operación\n\nTodo el servidor funciona en Docker; el centro lo inicia bajo demanda con \`node games/${c.id}/server.mjs\`, puerto interno ${c.port}, sin socket Docker ni puertos públicos propios. El gestor general controla salud y retirada tras 24 horas sin conexiones. No detener/reiniciar servicios ajenos ni partidas sin autorización.\n\nDesde la raíz: \`docker run --rm gamecenter-runtime:local npm test\` incluye las pruebas de todos los juegos generados. Tras modificar código o recursos, reconstruir la imagen. Los cambios de catálogo requieren recrear el centro con autorización; esta herramienta no lo hace automáticamente.\n\nEstado volátil en memoria. ${c.rooms?'Cada sala se aísla; las vacías se retiran tras 24 horas y las TV pueden cerrarlas en lobby.':'Una sola sala compartida.'} No se garantiza persistencia de identidades tras reiniciar.\n`,
    'docs/verification.md':`# Verificación pendiente de este juego\n\nLa plantilla incluye pruebas reutilizables de nombres, permisos y sesiones. **La generación no ejecuta pruebas ni certifica este juego.** Ejecutar \`npm test\` dentro de Docker y registrar aquí qué verificaciones se realizaron.\n\nAntes de entregar, comprobar dos TV, varios móviles, duplicados simultáneos, desconexión, toma de sesión, Atrás, reglas e inicio, resultados/reset y aislamiento de salas si corresponde. Revisar tamaños, foco, listas y orientación en navegadores reales o emulados. Completar y probar la mecánica específica antes de presentarlo como juego terminado.\n`,
    'art/README.md':`# Recursos propios\n\nPortada e icono iniciales SVG generados para ${c.title}, editables en \`public/assets/\`. Son recursos provisionales de la plantilla, no la dirección artística final.\n\nAvatares: ${c.avatarSource==='own'?'SVG geométricos creados por el generador para este juego':`copiados con autorización de games/${c.avatarSource}/public/assets/avatars; las copias pertenecen a esta carpeta y no enlazan al origen`}. Mantener licencias y atribuciones que correspondan al sustituir recursos. El contenido propio sigue la licencia general Apache 2.0; los componentes de terceros mantienen sus licencias.\n`,
    'data/README.md':'# Datos privados\n\nEsta base guarda el estado en memoria. Esta carpeta no se sirve al navegador. No añadir SQLite sin configurar previamente un volumen exclusivo y acordar persistencia.\n',
  };
}
export async function generateGame({root=process.cwd(),dryRun=false,...options}){
  root=await realpath(root);const c=validateOptions(options);c.hue=[...c.id].reduce((sum,char)=>sum+char.charCodeAt(0)*7,0)%360;
  for(const folder of ['games','server'])if((await lstat(join(root,folder))).isSymbolicLink())throw new Error('Las carpetas del proyecto no pueden ser enlaces simbólicos.');
  const registryPath=join(root,'server/games.json'),destination=join(root,'games',c.id);
  if(await exists(destination))throw new Error('Ya existe esa carpeta de juego. No se sobrescribe.');
  if((await lstat(registryPath)).isSymbolicLink())throw new Error('El registro no puede ser un enlace simbólico.');
  const original=await readFile(registryPath,'utf8'),entries=JSON.parse(original);registeredGames(entries);
  if(entries.some(entry=>entry.id===c.id))throw new Error('Ya existe ese identificador en el catálogo.');
  c.number=Math.max(0,...entries.map(entry=>entry.number))+1;
  const ports=new Set(entries.map(entry=>entry.port));c.port=3001;while(ports.has(c.port))c.port++;
  const avatars=await avatarFiles(root,c);c.avatars=avatars.map(file=>`/games/${c.id}/`+file.path.slice('public/'.length));
  const files=[...await readTemplates(),...avatars];
  const text=(path,value)=>files.push({path,bytes:Buffer.from(value)});
  text('game.json',JSON.stringify(c,null,2)+'\n');text('public/game-config.js',`export const config = Object.freeze(${JSON.stringify(c,null,2)});\n`);
  const background=`<rect width="360" height="230" rx="20" fill="hsl(${c.hue} 45% 25%)"/>`;
  text('public/assets/cover.svg',svg(background+`<circle cx="280" cy="70" r="85" fill="#ffffff18"/><path d="M135 50 L172 72 L172 116 L135 138 L98 116 L98 72 Z" fill="#ffffffdd"/><text x="24" y="185" fill="white" font-size="22" font-family="system-ui,sans-serif">${xml(c.title.slice(0,26))}</text><text x="24" y="211" fill="#ffffffbb" font-size="13" font-family="system-ui,sans-serif">TV + jugadores</text>`));
  text('public/assets/icon.svg',svg(`<rect width="96" height="96" rx="22" fill="hsl(${c.hue} 45% 25%)"/><path d="M48 14 L76 30 L76 64 L48 82 L20 64 L20 30 Z" fill="#fff"/>`,96,96));
  text('public/assets/tv.svg',svg('<rect x="12" y="16" width="136" height="84" rx="10" fill="#dcebf4" stroke="#18324b" stroke-width="6"/><path d="M60 104v14m40-14v14M45 122h70" stroke="#18324b" stroke-width="6"/>',160,140));
  text('public/assets/player.svg',svg('<rect x="47" y="10" width="66" height="120" rx="12" fill="#dcebf4" stroke="#18324b" stroke-width="6"/><circle cx="80" cy="56" r="15" fill="#007a86"/><path d="M60 94q20-24 40 0" fill="#007a86"/><circle cx="80" cy="117" r="3" fill="#18324b"/>',160,140));
  for(const [path,value]of Object.entries(documentation(c)))text(path,value);
  const entry={number:c.number,id:c.id,title:c.title,port:c.port,minPlayers:c.minPlayers,maxPlayers:c.maxPlayers};
  registeredGames([...entries,entry]);
  if(dryRun)return {config:c,entry,directory:destination,files:files.map(file=>file.path),dryRun:true};
  const lock=await open(join(root,'.game-create.lock'),'wx').catch(()=>{throw new Error('Ya hay otra creación en curso (.game-create.lock).');});
  const stage=join(root,`.game-template-${randomUUID()}`),registryTemp=join(root,'server',`.games-${randomUUID()}.json`);
  let moved=false,committed=false;
  try{
    if(await exists(destination))throw new Error('El destino apareció mientras se preparaba la plantilla.');
    if(await readFile(registryPath,'utf8')!==original)throw new Error('El catálogo cambió; vuelve a intentarlo.');
    await mkdir(stage);
    for(const file of files){const path=join(stage,file.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,file.bytes,{flag:'wx'});}
    await writeFile(registryTemp,JSON.stringify([...entries,entry],null,2)+'\n',{flag:'wx'});
    await rename(stage,destination);moved=true;
    if(await readFile(registryPath,'utf8')!==original)throw new Error('El catálogo cambió; se cancela la creación.');
    await rename(registryTemp,registryPath);committed=true;
    return {config:c,entry,directory:destination,files:files.map(file=>file.path),dryRun:false};
  }finally{
    await lock.close();
    if(!committed&&moved)await rm(destination,{recursive:true,force:true});
    await rm(stage,{recursive:true,force:true});await rm(registryTemp,{force:true});await rm(join(root,'.game-create.lock'),{force:true});
  }
}
