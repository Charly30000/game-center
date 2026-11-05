import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base=process.env.BASE_URL||'http://host.docker.internal:3002';
const browser=await chromium.launch({args:['--no-sandbox']});
const ticket=[1,10,20,0,0,0,60,70,0,2,11,0,30,40,0,0,0,80,0,0,21,31,0,50,0,71,81];
const fixture={type:'state',role:'guest',phase:'lobby',roundId:'mobile-review',turn:1,settings:{cardsPerPlayer:1,effects:false},called:[],current:null,players:[{id:'p1',name:'',avatar:0,ready:false,online:true,playing:false,wins:0}],me:{id:'p1',name:'',avatar:0,ready:false,playing:false,continued:false,cards:[ticket],marks:[[]]}};

async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});}
async function resizeKeyboard(page,height){
  await page.evaluate(height=>{window.__keyboardHeight=height;window.visualViewport.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('resize'));window.__emit(window.__state);},height);
  await settle(page);
}
async function geometry(page){
  const result=await page.evaluate(()=>{
    const rects=[...document.querySelectorAll('[data-avatar]')].map(button=>button.getBoundingClientRect());
    const header=document.querySelector('.site-header').getBoundingClientRect();
    const button=document.querySelector('#restore-fullscreen').getBoundingClientRect();
    return{square:rects.every(rect=>Math.abs(rect.width-rect.height)<1),gap:rects[1].left-rects[0].right,rowGap:rects[5].top-rects[0].bottom,
      overflowX:document.documentElement.scrollWidth-innerWidth,overflowY:document.documentElement.scrollHeight-innerHeight,headerFits:button.right<=header.right&&button.bottom<=header.bottom};
  });
  assert.ok(result.square&&result.gap<=8.1&&result.rowGap<=8.1&&result.gap>=0&&result.rowGap>=0,JSON.stringify(result));
  assert.ok(result.overflowX<=1&&result.overflowY<=1&&result.headerFits,JSON.stringify(result));
}

try{
  await mkdir('/artifacts',{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(data=>{
    let fullscreen=false;window.__orientation=[];window.__allowFullscreen=true;
    Object.defineProperty(screen.orientation,'lock',{value:async value=>window.__orientation.push(value)});
    Object.defineProperty(screen.orientation,'unlock',{value:()=>window.__orientation.push('unlock')});
    Object.defineProperty(document,'fullscreenElement',{get:()=>fullscreen?document.documentElement:null});
    Element.prototype.requestFullscreen=async()=>{
      window.__orientation.push('fullscreen');
      if(!window.__allowFullscreen)throw new Error('Denegado por el navegador');
      fullscreen=true;document.dispatchEvent(new Event('fullscreenchange'));
    };
    window.__exitFullscreen=()=>{fullscreen=false;document.dispatchEvent(new Event('fullscreenchange'));};
    const viewport=new EventTarget();Object.defineProperty(viewport,'height',{get:()=>window.__keyboardHeight??innerHeight});
    Object.defineProperty(window,'visualViewport',{value:viewport});
    class FakeSocket{
      static OPEN=1;readyState=1;
      constructor(){window.__socket=this;setTimeout(()=>this.onopen?.(),0);}
      send(raw){
        const message=JSON.parse(raw);
        if(message.type==='hello'){
          const state=structuredClone(data);state.role=message.payload.role;if(state.role!=='player')state.me=null;window.__emit(state);
        }
        queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'ack',requestId:message.requestId,result:{token:'test-player'}})}));
      }
    }
    window.__emit=state=>{window.__state=state;window.__socket.onmessage?.({data:JSON.stringify(state)});};window.WebSocket=FakeSocket;
  },fixture);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/games/bingo/');await page.locator('[data-role="player"]').click();await page.locator('#profile').waitFor();
  assert.equal(await page.locator('#player-name').evaluate(input=>input===document.activeElement),false,'El perfil no abre el teclado por sí mismo');
  await page.locator('#player-name').fill('Andrés');
  await page.evaluate(()=>{
    window.__nameInput=document.querySelector('#player-name');window.__focusCalls=0;
    const focus=window.__nameInput.focus.bind(window.__nameInput);
    window.__nameInput.focus=(...args)=>{window.__focusCalls++;return focus(...args);};
  });
  await resizeKeyboard(page,470);
  await page.evaluate(()=>window.__nameInput.blur());await resizeKeyboard(page,null);
  assert.ok(await page.evaluate(()=>window.__nameInput===document.querySelector('#player-name')&&document.activeElement!==window.__nameInput&&window.__focusCalls===0),'Cerrar el teclado no reconstruye ni enfoca el input');
  assert.equal(await page.locator('#player-name').inputValue(),'Andrés');
  await geometry(page);
  // Algunos teclados se cierran sin retirar el foco del input.
  await page.locator('#player-name').focus();await page.evaluate(()=>window.__focusCalls=0);
  await resizeKeyboard(page,470);await resizeKeyboard(page,null);
  assert.ok(await page.evaluate(()=>window.__nameInput===document.querySelector('#player-name')&&window.__focusCalls===0),'Un input que conserva el foco tampoco recibe focus() al cambiar la altura');
  await page.locator('[data-avatar="8"]').click();await resizeKeyboard(page,null);
  assert.equal(await page.locator('[data-avatar="8"]').getAttribute('aria-pressed'),'true');
  assert.ok(await page.evaluate(()=>document.activeElement!==window.__nameInput&&window.__focusCalls===0));
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:568,height:320},{width:844,height:390}]){
    await page.setViewportSize(viewport);await settle(page);await geometry(page);
    await page.screenshot({path:`/artifacts/mobile-profile-${viewport.width}x${viewport.height}.png`});
  }
  assert.deepEqual(await page.evaluate(()=>window.__orientation),['portrait']);
  await page.evaluate(()=>{const state=structuredClone(window.__state);state.phase='drawing';state.me.playing=true;state.me.ready=true;state.drawEndsAt=Date.now()+1400;state.players[0].ready=true;state.players[0].playing=true;window.__emit(state);});
  await page.locator('.player-playfield').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__orientation),['portrait','unlock','landscape']);
  await page.getByRole('button',{name:'Volver a pantalla completa',exact:true}).click();
  await page.waitForFunction(()=>document.fullscreenElement!==null);
  assert.deepEqual(await page.evaluate(()=>window.__orientation.slice(-2)),['fullscreen','landscape']);
  assert.equal(await page.locator('#restore-fullscreen').isVisible(),false);
  const before=await page.evaluate(()=>window.__orientation.length);
  await page.evaluate(()=>{window.__exitFullscreen();window.__emit(window.__state);});await settle(page);
  assert.equal(await page.evaluate(()=>window.__orientation.length),before,'Salir de pantalla completa no la vuelve a imponer');
  await page.getByRole('button',{name:'Volver a pantalla completa',exact:true}).waitFor();
  await page.evaluate(()=>window.__allowFullscreen=false);
  await page.locator('#restore-fullscreen').click();await page.locator('#notice').getByText(/no permite activar/).waitFor();
  assert.equal(await page.locator('#restore-fullscreen').isVisible(),true);
  await page.evaluate(()=>window.__allowFullscreen=true);await page.locator('#restore-fullscreen').click();
  assert.deepEqual(await page.evaluate(()=>window.__orientation.slice(-2)),['fullscreen','landscape']);
  assert.deepEqual(errors,[]);
  console.log('OK: input estable al abrir/cerrar teclado y recibir estados, sin reenfoque; avatares cuadrados y agrupados en cuatro tamaños; horizontal al iniciar; salida y recuperación explícita de pantalla completa, incluido rechazo del navegador.');
  await context.close();
}finally{await browser.close();}
