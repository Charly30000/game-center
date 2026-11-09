// Conversión reproducible dentro de la imagen de pruebas; sin instalar codecs en el anfitrión.
// Montar los originales OGG/WAV seleccionados en /input y assets/audio en /output.
import { chromium } from 'playwright';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const browser = await chromium.launch({args:['--no-sandbox','--no-zygote']});
try {
  const page = await browser.newPage();
  const report = [];
  for (const file of (await readdir('/input')).filter(name => /\.(ogg|wav)$/.test(name))) {
    const bytes = await readFile(`/input/${file}`);
    const result = await page.evaluate(async data => {
      const context = new OfflineAudioContext(1, 1, 24000);
      const buffer = await context.decodeAudioData(Uint8Array.from(atob(data),char=>char.charCodeAt(0)).buffer);
      const render = new OfflineAudioContext(1, Math.ceil(buffer.duration * 24000), 24000);
      const node = render.createBufferSource(); node.buffer = buffer; node.connect(render.destination); node.start();
      const pcm = (await render.startRendering()).getChannelData(0);
      const wav = new ArrayBuffer(44 + pcm.length * 2), view = new DataView(wav);
      const text = (at, value) => { for (let i=0;i<value.length;i++) view.setUint8(at+i,value.charCodeAt(i)); };
      text(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');
      view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
      view.setUint32(24,24000,true);view.setUint32(28,48000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
      text(36,'data');view.setUint32(40,pcm.length*2,true);
      let energy=0, peak=0;
      for(let i=0;i<pcm.length;i++){energy+=pcm[i]**2;peak=Math.max(peak,Math.abs(pcm[i]));view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),true);}
      const encoded=new Uint8Array(wav);let binary='';
      for(let i=0;i<encoded.length;i+=32768)binary+=String.fromCharCode(...encoded.subarray(i,i+32768));
      return {wav:btoa(binary),duration:pcm.length/24000,rms:Math.sqrt(energy/pcm.length),peak};
    }, bytes.toString('base64'));
    const output = Buffer.from(result.wav,'base64'); await writeFile(`/output/${file.replace('.ogg','.wav')}`,output);
    const {wav,...metrics}=result;
    report.push({source:file,file:file.replace('.ogg','.wav'),sourceSha256:createHash('sha256').update(bytes).digest('hex'),sha256:createHash('sha256').update(output).digest('hex'),...metrics});
  }
  await writeFile('/output/manifest.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.map(({file,duration,rms,peak})=>({file,duration,rms,peak})),null,2));
} finally { await browser.close(); }
