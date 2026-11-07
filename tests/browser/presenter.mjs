import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

// Un solo navegador y estados simulados: no modifica ninguna partida real.
const browser=await chromium.launch({args:['--no-sandbox','--no-zygote','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
const layoutOnly=process.argv.includes('--layout-only');
const viewports=process.argv.includes('--single-size')?[{width:1280,height:720}]:[{width:1280,height:720},{width:960,height:540},{width:800,height:480},{width:667,height:375},{width:568,height:320},{width:360,height:640},{width:320,height:568}];
try{
  await mkdir('/artifacts',{recursive:true});
  const context=await browser.newContext({viewport:{width:1280,height:720}});
  await context.addInitScript(()=>{
    Object.defineProperty(document,'hidden',{get:()=>Boolean(window.__pausePresenter)});
    window.__state={type:'state',role:'guest',phase:'lobby',roundId:'model-qa',turn:1,settings:{effects:true,cardsPerPlayer:1},players:[{id:'p1',name:'Ana',avatar:0,ready:true,online:true,playing:true,continued:false,wins:1}],called:Array.from({length:90},(_,i)=>i+1),current:28,winners:['p1'],me:null};
    class Socket{
      static OPEN=1;readyState=1;
      constructor(){window.__socket=this;setTimeout(()=>this.onopen?.(),0);}
      close(){this.readyState=3;}
      send(raw){const m=JSON.parse(raw);if(m.type==='hello'){window.__state.role=m.payload.role;this.onmessage?.({data:JSON.stringify(window.__state)});}queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'ack',requestId:m.requestId})}));}
    }
    window.WebSocket=Socket;
    window.__emit=patch=>{Object.assign(window.__state,patch);window.__socket.onmessage?.({data:JSON.stringify(window.__state)});};
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto((process.env.BASE_URL||'http://gamecenter-model-review:3000')+'/games/bingo/');
  await page.locator('[data-role="tv"]').click();
  await page.evaluate(layoutOnly=>window.__emit({phase:'drawing',drawEndsAt:null,drawDurationMs:5000,settings:{effects:!layoutOnly,cardsPerPlayer:1}}),layoutOnly);
  if(!layoutOnly){
  await page.locator('[data-presenter-model="blender-v8"] canvas').waitFor({timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#presenter-stage').dataset.presenterAnimation==='SpinDrum');
  assert.equal(await page.locator('canvas').count(),1);
  await page.waitForTimeout(300);const a=await page.locator('canvas').screenshot();
  await page.waitForTimeout(450);const b=await page.locator('canvas').screenshot();assert.ok(!a.equals(b),'El GLB se anima realmente en WebGL');
  }
  for(const viewport of viewports){
    await page.setViewportSize(viewport);
    await page.waitForFunction(()=>Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--visible-height'))-innerHeight)<=1);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if([1280,667,360].includes(viewport.width))await page.screenshot({path:`/artifacts/presenter-${viewport.width}x${viewport.height}.png`});
    const sign=await page.locator('.presenter-sign').boundingBox(),scene=await page.locator('.presenter-viewport').boundingBox();
    assert.ok(sign.y+sign.height<scene.y,'BINGO queda separado de imagen y canvas');
    const signFits=await page.locator('.presenter-sign').evaluate(element=>{const box=element.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(element);const text=range.getBoundingClientRect();return text.left>=box.left&&text.right<=box.right&&text.top>=box.top&&text.bottom<=box.bottom;});
    assert.ok(signFits,'Las cinco letras del rótulo se ven completas');
    const caption=await page.locator('.ball-caption').boundingBox();
    assert.ok(caption.y>=sign.y+sign.height||caption.x+caption.width<=sign.x||caption.x>=sign.x+sign.width,'El aviso de bola no tapa BINGO');
    const bounds=await page.locator(layoutOnly?'#presenter-stage':'canvas').boundingBox();assert.ok(bounds.width>100&&bounds.height>40);
    if(bounds.y+bounds.height>viewport.height+1)await page.screenshot({path:'/artifacts/tv-layout-failure.png'});
    assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1,`${viewport.width}x${viewport.height}: canvas ${JSON.stringify(bounds)}`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1));
    const numbers=await page.locator('.board-ball.called').evaluateAll(elements=>elements.map(element=>{
      const circle=element.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(element);const text=range.getBoundingClientRect();
      return {number:element.textContent,fits:text.left>=circle.left-1&&text.right<=circle.right+1&&text.top>=circle.top-1&&text.bottom<=circle.bottom+1};
    }));
    assert.equal(numbers.length,90);assert.ok(numbers.every(number=>number.fits),`${viewport.width}x${viewport.height}: ${JSON.stringify(numbers.filter(number=>!number.fits))}`);
    if(!layoutOnly)assert.ok(Number(await page.locator('#presenter-stage').getAttribute('data-presenter-coverage'))>.85,'El personaje ocupa el encuadre en pantallas pequeñas');
  }
  if(!layoutOnly){
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>window.__emit({phase:'marking',drawEndsAt:null}));
  await page.waitForFunction(()=>document.querySelector('#presenter-stage').dataset.presenterAnimation==='PickBall');
  await page.waitForFunction(()=>{const d=document.querySelector('#presenter-stage').dataset;if(d.presenterAnimation!=='ShowBall'||Number(d.presenterTime)<1.6)return false;window.__pausePresenter=true;return true;},{},{timeout:45000});
  assert.equal(await page.locator('#presenter-stage').getAttribute('data-presenter-ball'),'28');
  await page.screenshot({path:'/artifacts/presenter-show-ball.png'});
  await page.evaluate(()=>{window.__pausePresenter=false;});
  await page.waitForFunction(()=>{const d=document.querySelector('#presenter-stage').dataset;if(d.presenterAnimation!=='DropBall'||Number(d.presenterTime)<.95)return false;window.__pausePresenter=true;return true;},{},{timeout:45000});
  await page.screenshot({path:'/artifacts/presenter-drop-ball.png'});
  await page.evaluate(()=>{window.__pausePresenter=false;});
  await page.waitForFunction(()=>document.querySelector('#presenter-stage').dataset.presenterAnimation==='Talk',{},{timeout:45000});
  assert.equal(await page.locator('#presenter-stage').getAttribute('data-presenter-ball'),'');
  await page.evaluate(()=>window.__emit({phase:'results'}));
  await page.waitForFunction(()=>document.querySelector('#presenter-stage').dataset.presenterAnimation==='Celebrate');
  await page.waitForTimeout(1700);await page.screenshot({path:'/artifacts/presenter-results.png'});
  await page.waitForFunction(()=>Number(document.querySelector('#presenter-stage').dataset.presenterTime)<.3,{},{timeout:45000});
  await page.waitForFunction(()=>Number(document.querySelector('#presenter-stage').dataset.presenterTime)>1,{},{timeout:45000});
  assert.equal(await page.locator('#presenter-stage').getAttribute('data-presenter-animation'),'Celebrate','La victoria continúa después de terminar el primer ciclo');
  await page.evaluate(()=>window.__emit({phase:'results',players:[...window.__state.players]}));
  assert.equal(await page.locator('#presenter-stage').getAttribute('data-presenter-animation'),'Celebrate');
  assert.equal(await page.locator('canvas').count(),1);
  await page.evaluate(()=>window.__emit({phase:'marking',settings:{effects:false,cardsPerPlayer:1}}));
  await page.locator('canvas').waitFor({state:'detached'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>window.__emit({settings:{effects:true,cardsPerPlayer:1}}));
  await page.waitForTimeout(200);assert.equal(await page.locator('canvas').count(),0);
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(layoutOnly?{ok:true,layoutOnly:true,viewports:viewports.map(v=>`${v.width}x${v.height}`),calledBalls:90}:{ok:true,webgl:true,viewports:viewports.map(v=>`${v.width}x${v.height}`),states:['SpinDrum','PickBall','ShowBall','DropBall','Talk','Celebrate'],staticFallback:true,reducedMotion:true,victoryLoop:true,calledBalls:90}));
}finally{await browser.close();}
