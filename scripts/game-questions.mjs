import {readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {registeredGames} from '../server/catalog-registry.mjs';
import {validateOptions,avatarFiles} from './game-scaffold.mjs';

// La entrada/salida inyectable permite probar el diálogo sin abrir terminales.
export async function collectGameAnswers({flags={},root=process.cwd(),interactive=false,question,report=console.error}){
  const games=registeredGames(JSON.parse(await readFile(join(root,'server/games.json'),'utf8')));
  const answers={};
  const base={id:'nuevo-juego',name:'Nuevo juego',rooms:false,avatars:'own'};
  const validate=value=>validateOptions({...base,...value});
  async function ask(key,label,parse,defaultValue){
    const supplied=flags[key]!==undefined;
    if(!supplied&&!interactive&&defaultValue===undefined)throw new Error(`Falta --${key}; usa Docker con -it para responder al asistente.`);
    let accepted=false;
    do{
      const raw=supplied?flags[key]:interactive?await question(label+(defaultValue!==undefined?` [${defaultValue}]`:'')+': '):defaultValue;
      try{
        const value=String(raw??'').trim()||defaultValue;
        answers[key]=await parse(value);accepted=true;
      }catch(error){
        if(supplied||!interactive)throw new Error(`--${key}: ${error.message}`);
        report(error.message);
      }
    }while(!accepted);
  }
  await ask('name','Nombre del videojuego',value=>{validate({name:value});return value;});
  await ask('id','Identificador (letras minúsculas y guiones)',async value=>{
    validate({id:value});
    if(games.some(game=>game.id===value))throw new Error('Ya existe ese identificador en el catálogo.');
    try{await lstat(join(root,'games',value));}catch(error){if(error.code==='ENOENT')return value;throw error;}
    throw new Error('Ya existe esa carpeta de juego. Elige otro identificador.');
  });
  await ask('rooms','¿Tendrá salas públicas en la red local? (yes/no)',value=>{
    if(!['yes','no'].includes(value))throw new Error('Responde yes o no.');return value;
  });
  const avatarMenu=['Avatares:','0. Crear avatares propios provisionales',...games.map(game=>`${game.number}. Copiar de ${game.title} (${game.id}), con tu autorización`)].join('\n');
  await ask('avatars',avatarMenu+'\nElige el número',async value=>{
    const source=value==='0'?'own':games.find(game=>String(game.number)===value||game.id===value)?.id??value;
    if(source!=='own'&&!games.some(game=>game.id===source))throw new Error('Elige 0 o el número de un juego del listado.');
    await avatarFiles(root,{avatarSource:source,hue:0});return source;
  });
  await ask('min-players','Mínimo de jugadores',value=>{validate({minPlayers:value});return Number(value);},1);
  await ask('max-players','Máximo de jugadores',value=>{validate({minPlayers:answers['min-players'],maxPlayers:value});return Number(value);},40);
  await ask('orientation','Orientación del móvil durante la partida\n1. Horizontal (landscape)\n2. Vertical (portrait)\nElige 1 o 2',value=>{
    const orientation=({'1':'landscape','2':'portrait'})[value]??value;
    validate({orientation});return orientation;
  },1);
  return answers;
}
