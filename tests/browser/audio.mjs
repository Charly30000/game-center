import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.BASE_URL||'http://bingo-audio-review:3000';
const browser=await chromium.launch({args:['--no-sandbox','--no-zygote','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={errors:[],sizes:[]};
await mkdir('/artifacts/audio',{recursive:true});
try {
  const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
  await context.addInitScript(()=>{
    window.__audioEvents=[];
    const fetchOriginal=window.fetch,decodeOriginal=AudioContext.prototype.decodeAudioData,startOriginal=AudioBufferSourceNode.prototype.start,stopOriginal=AudioBufferSourceNode.prototype.stop;
    const urls=new WeakMap();
    window.fetch=async(...args)=>{const response=await fetchOriginal(...args);const original=response.arrayBuffer.bind(response);response.arrayBuffer=async()=>{const data=await original();urls.set(data,String(args[0]));return data;};return response;};
    AudioContext.prototype.decodeAudioData=async function(data){const url=urls.get(data);const buffer=await decodeOriginal.call(this,data);buffer.__url=url;return buffer;};
    AudioBufferSourceNode.prototype.start=function(...args){window.__audioEvents.push({event:'start',url:this.buffer?.__url,at:performance.now(),loop:this.loop});return startOriginal.apply(this,args);};
    AudioBufferSourceNode.prototype.stop=function(...args){window.__audioEvents.push({event:'stop',url:this.buffer?.__url,at:performance.now()});return stopOriginal.apply(this,args);};
    window.__state={type:'state',role:'guest',phase:'lobby',roundId:'audio-qa',turn:1,settings:{effects:true,cardsPerPlayer:1},players:[{id:'p1',name:'Ana',avatar:0,ready:true,online:true,playing:true,continued:false,wins:1}],called:[28],current:28,winners:['p1'],me:null};
    class Socket {
      static OPEN=1;readyState=1;
      constructor(){window.__socket=this;setTimeout(()=>this.onopen?.(),0);}
      close(){this.readyState=3;}
      send(raw){
        const m=JSON.parse(raw);
        if(m.type==='hello')window.__state.role=m.payload.role;
        if(m.type==='mark'&&!window.__state.me.marks[m.payload.card].includes(m.payload.number))window.__state.me.marks[m.payload.card].push(m.payload.number);
        if(m.type==='continue'){
          window.__state.me.continued=true;
          if(window.__finishOnContinue){window.__state.phase='results';window.__state.winners=['p1'];}
        }
        this.onmessage?.({data:JSON.stringify(window.__state)});
        queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'ack',requestId:m.requestId})}));
      }
    }
    window.WebSocket=Socket;
    window.__emit=patch=>{Object.assign(window.__state,patch);window.__socket.onmessage?.({data:JSON.stringify(window.__state)});};
  });
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)report.errors.push(`${response.status()} ${response.url()}`);});
  await page.goto(base+'/games/bingo/');await page.locator('[data-role="tv"]').click();
  await page.evaluate(()=>window.__emit({phase:'drawing',drawEndsAt:Date.now()+5000}));
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('dice-shake')));
  await page.locator('[data-presenter-model="blender-v8"] canvas').waitFor({timeout:45000});
  await page.evaluate(()=>window.__emit({phase:'marking',drawEndsAt:null}));
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('number-28')),{},{timeout:45000});
  assert.equal(await page.locator('#presenter-stage').getAttribute('data-presenter-animation'),'ShowBall');
  await page.waitForFunction(()=>document.querySelector('#presenter-stage').dataset.presenterSpeaking==='true');
  const articulation=await page.evaluate(async()=>{
    const samples=[];for(let i=0;i<12;i++){const d=document.querySelector('#presenter-stage').dataset;samples.push({mouth:Number(d.presenterMouth),speaking:d.presenterSpeaking});await new Promise(resolve=>setTimeout(resolve,40));}return samples;
  });
  assert.ok(articulation.some(sample=>sample.speaking==='true'&&sample.mouth>.15));
  report.articulation=articulation;
  await page.screenshot({path:'/artifacts/audio/number-28.png'});
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('/voice/continue')),{},{timeout:45000});
  const starts=await page.evaluate(()=>window.__audioEvents.filter(e=>e.event==='start'&&!e.url?.includes('background-calm')).map(e=>e.url.split('/').at(-1)));
  assert.deepEqual(starts.slice(0,5),['dice-shake-1.wav','chip-lay-1.wav','number-28.wav','maximize_001.wav','continue.wav']);
  await page.evaluate(()=>window.__emit({phase:'results'}));
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('/voice/bingo.wav')));
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('victory-fanfare')));
  await page.waitForTimeout(3400);await page.evaluate(()=>window.__emit({players:[...window.__state.players]}));
  assert.equal(await page.evaluate(()=>window.__audioEvents.filter(e=>e.event==='start'&&e.url?.includes('victory-fanfare')).length),1);
  assert.equal(await page.locator('#presenter-stage').getAttribute('data-presenter-animation'),'Celebrate');
  await page.locator('#bingo-sound').click();assert.equal(await page.locator('#bingo-sound').getAttribute('aria-pressed'),'false');
  const mutedCount=await page.evaluate(()=>window.__audioEvents.filter(e=>e.event==='start').length);
  await page.evaluate(()=>window.__emit({phase:'drawing',turn:2,current:null,drawEndsAt:Date.now()+5000}));await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.__audioEvents.filter(e=>e.event==='start').length),mutedCount);
  await page.locator('#bingo-sound').click();
  await page.evaluate(()=>window.__emit({phase:'marking',turn:2,current:90,called:[28,90],settings:{effects:false,cardsPerPlayer:1}}));
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('number-90')));
  assert.equal(await page.locator('canvas').count(),0);
  // Todos los archivos se decodifican con el mismo motor que los reproduce.
  report.decoded=await page.evaluate(async()=>{
    const root='/games/bingo/assets/audio/',effects=await(await fetch(root+'manifest.json')).json(),voices=await(await fetch(root+'voice/manifest.json')).json();
    const context=new OfflineAudioContext(1,1,24000);let count=0;
    for(const [prefix,files] of [['',effects],['voice/',voices]]) for(const file of files){const r=await fetch(root+prefix+file.file);if(!r.ok)throw new Error(file.file);const audio=await context.decodeAudioData(await r.arrayBuffer());if(Math.abs(audio.duration-file.duration)>.003)throw new Error(`Duración: ${file.file}`);count++;}
    return count;
  });assert.equal(report.decoded,101);
  // Cabecera con audio y regreso a pantalla completa en tamaños compactos.
  await page.evaluate(()=>window.__emit({role:'player',phase:'lobby',current:null,me:{id:'p1',name:'Ana',avatar:0,ready:true,playing:false,cards:[],marks:[]}}));
  for(const [width,height] of [[1280,720],[667,375],[568,320],[390,844],[320,568]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(100);
    const metrics=await page.evaluate(()=>{const r=document.querySelector('#bingo-sound').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scrollWidth:document.documentElement.scrollWidth,innerWidth,innerHeight};});
    const fits=metrics.left>=0&&metrics.right<=width&&metrics.top>=0&&metrics.bottom<=height&&metrics.scrollWidth<=width;
    if(!fits)await page.screenshot({path:`/artifacts/audio/overflow-${width}.png`});
    assert.ok(fits,`Cabecera ${width}×${height}: ${JSON.stringify(metrics)}`);report.sizes.push({width,height,fits});
  }
  await page.screenshot({path:'/artifacts/audio/mobile.png'});
  await page.setViewportSize({width:667,height:375});
  await page.evaluate(()=>{
    const card=[1,0,0,28,0,50,60,70,80,0,10,20,30,40,0,0,71,81,2,11,21,0,41,51,61,0,0];
    window.__audioEvents=[];
    window.__emit({phase:'marking',current:28,called:[28],settings:{effects:false,cardsPerPlayer:2},me:{id:'p1',name:'Ana',avatar:0,ready:true,playing:true,cards:[card,card.map(n=>n===28?29:n)],marks:[[],[]],continued:false}});
  });
  await page.locator('[data-number="28"]').click();
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('chip-lay')));
  await page.locator('[data-card="1"]').click();
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('card-slide')));
  await page.locator('#continue').click();
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('card-place')));
  report.mobileEvents=await page.evaluate(()=>window.__audioEvents.filter(e=>e.event==='start').map(e=>e.url.split('/').at(-1)));
  assert.deepEqual(report.mobileEvents,['chip-lay-1.wav','card-slide-1.wav','card-place-1.wav']);
  await page.evaluate(()=>{
    window.__audioEvents=[];window.__finishOnContinue=true;
    window.__emit({roundId:'audio-qa-winning',phase:'marking',me:{...window.__state.me,continued:false}});
  });
  await page.locator('#continue').click();
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('victory-fanfare')));
  assert.ok(await page.evaluate(()=>!window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('card-place'))),'El ACK de Continuar no sustituye el sonido de victoria');
  await page.evaluate(()=>window.__emit({roundId:'audio-qa-lost',winners:['p2']}));
  await page.waitForFunction(()=>window.__audioEvents.some(e=>e.event==='start'&&e.url?.includes('PIZZI03')));
  report.results=await page.evaluate(()=>window.__audioEvents.filter(e=>e.event==='start'&&/victory-fanfare|jingles_PIZZI03/.test(e.url||'')).map(e=>e.url.split('/').at(-1)));
  assert.deepEqual(report.results,['victory-fanfare.wav','jingles_PIZZI03.wav']);
  report.events=await page.evaluate(()=>window.__audioEvents);report.sequence=starts;
  assert.deepEqual(report.errors,[]);
  await writeFile('/artifacts/audio/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
