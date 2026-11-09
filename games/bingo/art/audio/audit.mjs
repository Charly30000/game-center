import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { bingoNumberText } from '../../public/bingo-speech.js';
const root = new URL('../../public/assets/audio/voice/',import.meta.url), report=[];
for(const file of (await readdir(root)).filter(name=>name.endsWith('.wav')).sort()) {
  const bytes=await readFile(new URL(file,root));
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw new Error(`WAV inválido: ${file}`);
  let offset=12,rate,channels,bits,pcm;
  while(offset+8<=bytes.length){const size=bytes.readUInt32LE(offset+4),kind=bytes.toString('ascii',offset,offset+4);
    if(kind==='fmt '){channels=bytes.readUInt16LE(offset+10);rate=bytes.readUInt32LE(offset+12);bits=bytes.readUInt16LE(offset+22);}
    if(kind==='data')pcm=bytes.subarray(offset+8,offset+8+size);
    offset+=8+size+(size%2);
  }
  if(bits!==16||channels!==1||!pcm?.length)throw new Error(`PCM inválido: ${file}`);
  let energy=0,peak=0;for(let i=0;i<pcm.length;i+=2){const value=pcm.readInt16LE(i)/32768;energy+=value**2;peak=Math.max(peak,Math.abs(value));}
  const duration=pcm.length/(rate*2),rms=Math.sqrt(energy/(pcm.length/2));
  if(duration<.5||duration>6||rms<.005||peak>=1)throw new Error(`Señal fuera de límites: ${file}`);
  const number=Number(file.match(/^number-(\d+)/)?.[1]);
  report.push({file,text:number?`El número ${bingoNumberText(number)}.`:file==='bingo.wav'?'¡Bingo! ¡Enhorabuena!':'Marca tus números y pulsa continuar.',bytes:bytes.length,sampleRate:rate,duration,rms,peak,sha256:createHash('sha256').update(bytes).digest('hex')});
}
if(report.length!==92)throw new Error(`Faltan locuciones: ${report.length}/92`);
await writeFile(new URL('manifest.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({voices:report.length,bytes:report.reduce((sum,item)=>sum+item.bytes,0),duration:[Math.min(...report.map(item=>item.duration)),Math.max(...report.map(item=>item.duration))]}));
