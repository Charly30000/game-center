import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({args:['--no-sandbox','--no-zygote']});
const report={errors:[],sizes:[]};
try{
  const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
  await context.addInitScript(()=>{
    window.__musicEvents=[];window.__gains=[];
    const buffers=new WeakMap(),fetchOriginal=fetch,decode=AudioContext.prototype.decodeAudioData,start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop,target=AudioParam.prototype.linearRampToValueAtTime,createGain=AudioContext.prototype.createGain;
    window.fetch=async(...args)=>{const response=await fetchOriginal(...args),read=response.arrayBuffer.bind(response);response.arrayBuffer=async()=>{const data=await read();buffers.set(data,String(args[0]));return data;};return response;};
    AudioContext.prototype.decodeAudioData=async function(data){const url=buffers.get(data),buffer=await decode.call(this,data);buffer.__url=url;return buffer;};
    AudioBufferSourceNode.prototype.start=function(...args){window.__musicEvents.push({type:'start',url:this.buffer?.__url,duration:this.buffer?.duration,loop:this.loop,when:args[0]||0,contextTime:this.context.currentTime});return start.apply(this,args);};
    AudioBufferSourceNode.prototype.stop=function(...args){window.__musicEvents.push({type:'stop',url:this.buffer?.__url});return stop.apply(this,args);};
    AudioContext.prototype.createGain=function(){const node=createGain.call(this);node.gain.__context=this;return node;};
    AudioParam.prototype.linearRampToValueAtTime=function(value,time){const duration=time-(this.__context?.currentTime||0);if(Math.abs(duration-.6)<.01||Math.abs(duration-1.2)<.01)window.__gains.push(value);return target.call(this,value,time);};
    window.__state={type:'state',role:'guest',phase:'lobby',roundId:'music-qa',turn:0,settings:{effects:false,cardsPerPlayer:1},players:[{id:'p1',name:'Ana',avatar:0,ready:true,online:true,playing:true,continued:false,wins:1}],called:[],current:null,winners:['p1'],me:null};
    class Socket{static OPEN=1;readyState=1;constructor(){window.__socket=this;setTimeout(()=>this.onopen?.(),0);}close(){}send(raw){const m=JSON.parse(raw);if(m.type==='hello')window.__state.role=m.payload.role;this.onmessage?.({data:JSON.stringify(window.__state)});queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'ack',requestId:m.requestId})}));}}
    window.WebSocket=Socket;window.__emit=patch=>{Object.assign(window.__state,patch);window.__socket.onmessage?.({data:JSON.stringify(window.__state)});};
  });
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto((process.env.BASE_URL||'http://bingo-music-review:3000')+'/games/bingo/');
  await page.locator('[data-role="tv"]').click();
  await page.waitForFunction(()=>window.__musicEvents.some(e=>e.type==='start'&&e.url?.includes('background-calm')));
  assert.equal(await page.locator('#bingo-music').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>window.__emit({phase:'drawing',drawEndsAt:Date.now()+5000,drawDurationMs:5000}));
  await page.waitForFunction(()=>window.__musicEvents.some(e=>e.type==='start'&&e.url?.includes('dice-shake')));
  assert.equal(await page.evaluate(()=>window.__gains.at(-1)),.25,'El bombo conserva el volumen normal de música');
  await page.evaluate(()=>window.__emit({phase:'marking',turn:1,current:28,called:[28]}));
  await page.waitForFunction(()=>window.__musicEvents.some(e=>e.type==='start'&&e.url?.includes('number-28')));
  assert.ok(await page.evaluate(()=>{const e=window.__musicEvents.find(e=>e.type==='start'&&e.url?.includes('number-28'));return e.when-e.contextTime>.58;}),'El número espera al fundido de bajada');
  assert.ok(await page.evaluate(()=>window.__gains.includes(.05)),'La voz reduce la música');
  assert.equal(await page.evaluate(()=>window.__musicEvents.filter(e=>e.type==='start'&&e.url?.includes('background-calm')).length),1,'El turno conserva el bucle');
  await page.locator('#bingo-music').click();assert.equal(await page.locator('#bingo-music').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('#bingo-sound').getAttribute('aria-pressed'),'true','La música no silencia la voz');
  await page.evaluate(()=>window.__emit({turn:2,current:90,called:[28,90]}));
  await page.waitForFunction(()=>window.__musicEvents.some(e=>e.type==='start'&&e.url?.includes('number-90')));
  await page.locator('#bingo-music').click();
  await page.waitForFunction(()=>window.__musicEvents.filter(e=>e.type==='start'&&e.url?.includes('background-calm')).length===2);
  for(const [width,height]of [[1280,720],[667,375],[568,320],[390,844],[320,568]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(100);
    const fits=await page.evaluate(()=>['#bingo-music','#bingo-sound'].every(id=>{const r=document.querySelector(id).getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})&&document.documentElement.scrollWidth<=innerWidth);
    assert.ok(fits,`Controles en ${width}×${height}`);report.sizes.push({width,height,fits});
  }
  await mkdir('/artifacts/music',{recursive:true});await page.screenshot({path:'/artifacts/music/tv-compact.png'});
  await page.evaluate(()=>window.__emit({phase:'results'}));
  const events=await page.evaluate(()=>window.__musicEvents);
  assert.equal(events.filter(e=>e.type==='stop'&&e.url?.includes('background-calm')).length,2,'Resultados detiene la música');
  await page.evaluate(()=>window.__emit({role:'player',phase:'lobby',me:{id:'p1',name:'Ana',avatar:0,ready:true,playing:false,cards:[],marks:[]}}));
  assert.equal(await page.locator('#bingo-music').isVisible(),false);
  assert.deepEqual(report.errors,[]);report.events=events;report.gains=await page.evaluate(()=>window.__gains);
  await writeFile('/artifacts/music/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
