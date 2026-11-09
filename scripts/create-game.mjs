import {createInterface} from 'node:readline/promises';
import {generateGame} from './game-scaffold.mjs';
import {collectGameAnswers} from './game-questions.mjs';
const flags={};
try{
  const allowed=new Set(['id','name','rooms','avatars','min-players','max-players','orientation','dry-run','help']);
  const args=process.argv.slice(2);
  for(let i=0;i<args.length;i++){
    const flag=args[i]==='-h'?'help':args[i].replace(/^--/,'');
    if(!args[i].startsWith('--')&&args[i]!=='-h'||!allowed.has(flag))throw new Error(`Opción desconocida: ${args[i]}`);
    if(flag==='dry-run'||flag==='help')flags[flag]=true;
    else{if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Falta valor para --${flag}`);flags[flag]=args[++i];}
  }
  if(flags.help){
    console.log('Crear un juego independiente: npm run game:create -- [opciones]\n\n--id mi-juego --name "Mi juego"\n--rooms yes|no  (sí: salas públicas en LAN, sin contraseña)\n--avatars own|bingo|<otro-id>  (copiar solo con autorización)\n--min-players 1 --max-players 40 --orientation landscape|portrait (o 1|2)\n--dry-run  Muestra archivos y decisiones sin escribir\n\nSin los datos obligatorios, el modo interactivo pregunta. En Docker usar -it. No inicia ni reinicia servicios.');
  }else{
    let prompt;
    let answers;
    try{
      answers=await collectGameAnswers({flags,interactive:Boolean(process.stdin.isTTY),question:label=>{
        prompt||=createInterface({input:process.stdin,output:process.stdout});return prompt.question(label);
      }});
    }finally{prompt?.close();}
    const result=await generateGame({id:answers.id,name:answers.name,rooms:answers.rooms==='yes',avatars:answers.avatars,minPlayers:answers['min-players'],maxPlayers:answers['max-players'],orientation:answers.orientation,dryRun:Boolean(flags['dry-run'])});
    console.log(`${result.dryRun?'Simulación':'Juego creado'}: ${result.directory}\n${result.files.length} archivos · juego ${result.config.number} · puerto interno ${result.config.port}\nSalas: ${result.config.rooms?'públicas':'no'} · avatares: ${result.config.avatarSource}\n${result.files.join('\n')}\n\nSiguiente paso: completar la mecánica y seguir docs/new-game.md. Para probar, reconstruir la imagen y recrear el centro con autorización. No se ha iniciado ni reiniciado ningún servicio.`);
  }
}catch(error){console.error(error.message);process.exitCode=1;}
