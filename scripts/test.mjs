import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const files=[];
async function add(folder){for(const file of await readdir(folder,{withFileTypes:true}))if(file.isFile()&&file.name.endsWith('.test.mjs'))files.push(join(folder,file.name));}
await add('tests');
for(const game of await readdir('games',{withFileTypes:true}))if(game.isDirectory()){
  try{await add(join('games',game.name,'tests'));}catch(error){if(error.code!=='ENOENT')throw error;}
}
const child=spawn(process.execPath,['--test',...files.sort()],{stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=signal?1:code;});
