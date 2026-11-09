import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base=process.env.BASE_URL||'http://host.docker.internal:3002';
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ticket=[1,10,20,0,0,0,60,70,0,2,11,0,30,40,0,0,0,80,0,0,21,31,0,50,0,71,81];
const players=Array.from({length:40},(_,i)=>({id:`p${i}`,name:i===0?'W'.repeat(40):`Jugador de prueba ${i+1}`,avatar:i%20,ready:true,online:true,playing:true,continued:false,wins:i<8?1:0}));
const fixture={type:'state',role:'guest',phase:'lobby',roundId:'qa-round',turn:1,settings:{cardsPerPlayer:5,effects:false},called:[1],current:1,drawEndsAt:null,winners:players.slice(0,8).map(p=>p.id),players,me:{id:'p0',name:players[0].name,avatar:0,ready:true,playing:true,continued:false,cards:Array.from({length:5},()=>ticket),marks:Array.from({length:5},()=>[])}};

async function fit(page,label){
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  const result=await page.evaluate(()=>{
    const visible=element=>element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden';
    const outside=[...document.querySelectorAll('#app button,#app .scroll-region,#app .ticket-grid,#app .rules,#app h1,#app h2,#app p,.game-info')].filter(visible).filter(element=>!element.closest('.scroll-region')||element.classList.contains('scroll-region')).filter(element=>{const rect=element.getBoundingClientRect();return rect.right>innerWidth+1||rect.bottom>innerHeight+1||rect.left<0||rect.top<0;}).map(element=>element.className||element.id);
    const clipped=[...document.querySelectorAll('.game-info strong,.player-name,.ticket-number')].filter(visible).filter(element=>element.scrollWidth>element.clientWidth+1&&element.clientWidth>0).map(element=>element.className);
    for(const name of document.querySelectorAll('.player-card .player-name')){
      const text=name.getBoundingClientRect(),card=name.closest('.player-card').getBoundingClientRect();
      if(text.bottom>card.bottom+1||text.top<card.top-1)clipped.push('player-name-height');
    }
    const unreadable=[...document.querySelectorAll('.ticket-number,.player-name,.game-info strong')].filter(visible).filter(element=>parseFloat(getComputedStyle(element).fontSize)<(element.classList.contains('ticket-number')?18:14)).map(element=>element.className);
    const tabs=document.querySelector('.ticket-tabs');
    if(tabs){
      const bounds=tabs.getBoundingClientRect();
      if(tabs.scrollWidth>tabs.clientWidth+1||tabs.scrollHeight>tabs.clientHeight+1)outside.push('ticket-selector-scroll');
      for(const button of tabs.querySelectorAll('button')){
        const rect=button.getBoundingClientRect();
        if(rect.left<bounds.left||rect.right>bounds.right+1||rect.top<bounds.top||rect.bottom>bounds.bottom+1)outside.push('ticket-selector-button');
        if(rect.width<44||rect.height<44)unreadable.push('ticket-selector-touch-target');
        for(const text of button.querySelectorAll('strong,small'))if(text.scrollWidth>text.clientWidth+1)clipped.push('ticket-selector-text');
      }
    }
    for(const image of document.querySelectorAll('.game-cover img')){
      const picture=image.getBoundingClientRect(),cover=image.parentElement.getBoundingClientRect();
      if(picture.bottom>cover.bottom+1||picture.right>cover.right+1)outside.push('cover-image');
    }
    return{x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight,outside,clipped,unreadable};
  });
  if(result.x>1||result.y>1||result.outside.length||result.clipped.length||result.unreadable.length)await page.screenshot({path:'/artifacts/usability-failure.png'});
  assert.ok(result.x<=1&&result.y<=1&&!result.outside.length&&!result.clipped.length&&!result.unreadable.length,`${label}: ${JSON.stringify(result)}`);
}
try{
  await mkdir('/artifacts',{recursive:true});
  const context=await browser.newContext();
  await context.addInitScript(data=>{
    localStorage.setItem('bingo.role','tv');localStorage.setItem('bingo.token','remembered-player');window.__messages=[];
    class FakeSocket{
      static OPEN=1;readyState=1;
      constructor(){window.__socket=this;setTimeout(()=>this.onopen?.(),0);}
      close(){this.readyState=3;}
      send(raw){
        const message=JSON.parse(raw);window.__messages.push(message);
        if(message.type==='hello'&&message.payload.token==='remembered-player'){
          queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'error',requestId:message.requestId,code:'SESSION_EXPIRED',message:'Sesión caducada'})}));return;
        }
        if(message.type==='hello'){
          const state=structuredClone(data);state.role=message.payload.role;
          if(state.role!=='player')state.me=null;
          else if(!message.payload.claimPlayerId&&!message.payload.token){state.me.ready=false;state.me.name='';}
          window.__emit(state);
        }
        if(message.type==='settings'){const state=structuredClone(window.__state);Object.assign(state.settings,message.payload);window.__emit(state);}
        if(message.type==='continue'){const state=structuredClone(window.__state);state.me.continued=true;window.__emit(state);}
        if(message.type==='reset'){const state=structuredClone(data);state.role='guest';state.phase='lobby';state.players=[];state.me=null;state.roundId='new-session';window.__emit(state);}
        queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:'ack',requestId:message.requestId,result:message.payload.role==='player'?{token:'qa-token',playerId:'p0'}:undefined})}));
      }
    }
    window.__emit=state=>{window.__state=state;window.__socket.onmessage?.({data:JSON.stringify(state)});};window.WebSocket=FakeSocket;
  },fixture);
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const viewport of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:568,height:320},{width:667,height:375},{width:844,height:390},{width:1280,height:720}]){
    await page.setViewportSize(viewport);await page.goto(base);await page.locator('.game-card').waitFor();await fit(page,`Catálogo ${viewport.width}×${viewport.height}`);
    assert.equal(await page.locator('.game-info').isVisible(),true);await page.screenshot({path:`/artifacts/center-${viewport.width}x${viewport.height}.png`});
    const cover=page.locator('.game-cover img');assert.ok((await cover.getAttribute('src')).endsWith('/bingo/assets/cover.svg'));
    assert.ok(await cover.evaluate(image=>image.complete&&image.naturalWidth>0));
  }
  await page.goto(base+'/games/bingo/');await page.locator('button[data-role="tv"]').waitFor();
  assert.equal(await page.evaluate(()=>window.__messages[0].payload.role),'player');assert.equal(await page.evaluate(()=>localStorage.getItem('bingo.role')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('bingo.token')),null);
  assert.equal(await page.locator('button[data-role="player"] img').count(),0,'Se conserva el logo de cartón, sin sustituirlo por avatares');
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:568,height:320},{width:667,height:375},{width:844,height:390},{width:1280,height:720}]){
    await page.setViewportSize(viewport);await fit(page,`Selector original ${viewport.width}×${viewport.height}`);
    await page.screenshot({path:`/artifacts/roles-${viewport.width}x${viewport.height}.png`});
  }
  await page.setViewportSize({width:1280,height:720});
  await page.locator('button[data-role="player"]').click();await page.locator('#profile').waitFor();assert.equal(await page.locator('.selection-grid').count(),0);
  await page.locator('[data-back]').click();await page.locator('button[data-role="tv"]').waitFor();
  await page.evaluate(data=>{const state=structuredClone(data);state.role='guest';state.phase='marking';state.me=null;window.__emit(state);},fixture);
  await page.locator('button[data-role="player"]').click();await page.locator('.selection-grid').waitFor();assert.equal(await page.locator('[data-claim]').count(),40);
  for(const viewport of [{width:320,height:568},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    const ratios=await page.locator('.selection-grid .player-card>img').evaluateAll(images=>images.map(image=>{const rect=image.getBoundingClientRect();return Math.abs(rect.width-rect.height);}));
    assert.ok(ratios.every(difference=>difference<1),'Los avatares de los nombres conservan su proporción cuadrada');
  }
  assert.equal(await page.getByText('¿Ya estabas jugando?',{exact:true}).count(),0);
  await page.locator('[data-back]').click();await page.locator('button[data-role="tv"]').waitFor();
  await page.evaluate(data=>{const state=structuredClone(data);state.role='guest';state.phase='lobby';state.me=null;window.__emit(state);},fixture);
  await page.setViewportSize({width:1280,height:720});await page.locator('button[data-role="tv"]').click();await page.locator('.lobby-layout').waitFor();
  await page.locator('[data-step="-1"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.stepper>strong').textContent(),'4');assert.ok(await page.locator('[data-step="-1"]').evaluate(el=>el===document.activeElement));
  for(const viewport of [{width:1920,height:1080},{width:1280,height:720},{width:960,height:540},{width:800,height:600},{width:360,height:640}]){
    await page.setViewportSize(viewport);
    for(const phase of ['lobby','drawing','marking','results']){
      await page.evaluate(({fixture,phase})=>{const state=structuredClone(fixture);state.role='tv';state.me=null;state.phase=phase;window.__emit(state);},{fixture,phase});
      await fit(page,`TV ${viewport.width}×${viewport.height} ${phase}, 40 jugadores`);
    }
  }
  await page.setViewportSize({width:960,height:540});await page.evaluate(data=>{const state=structuredClone(data);state.role='tv';state.me=null;window.__emit(state);},fixture);
  const scroll=page.locator('[data-auto-scroll="lobby"]');const first=await scroll.evaluate(el=>el.scrollTop);await page.waitForTimeout(4000);assert.ok(await scroll.evaluate(el=>el.scrollTop)>first,'El listado debe desplazarse automáticamente');
  await page.screenshot({path:'/artifacts/roster-40-players.png'});
  for(const viewport of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:568,height:320},{width:667,height:375},{width:844,height:390},{width:1024,height:600}]){
    await page.setViewportSize(viewport);
    for(const [phase,ready]of [['lobby',false],['lobby',true],['drawing',true],['marking',true],['results',true]]){
      await page.evaluate(({fixture,phase,ready})=>{const state=structuredClone(fixture);state.role='player';state.phase=phase;state.me.ready=ready;window.__emit(state);},{fixture,phase,ready});
      await fit(page,`Jugador ${viewport.width}×${viewport.height} ${phase}/${ready}, cinco cartones`);
      if(phase==='lobby'&&!ready){
        const proportions=await page.locator('.avatar-option img').evaluateAll(images=>images.map(image=>{const rect=image.getBoundingClientRect();return Math.abs(rect.width-rect.height);}));
        assert.ok(proportions.every(difference=>difference<1),'Los personajes del perfil nunca se estiran');
        await page.screenshot({path:`/artifacts/profile-${viewport.width}x${viewport.height}.png`});
      }
    }
  }
  for(const viewport of [{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:568,height:320},{width:667,height:375},{width:844,height:390},{width:960,height:551},{width:1024,height:600}]){
    await page.setViewportSize(viewport);
    for(let count=1;count<=5;count++){
      await page.evaluate(({fixture,count})=>{
        const state=structuredClone(fixture);state.role='player';state.phase='marking';state.roundId=`selector-${count}`;
        state.me.cards=state.me.cards.slice(0,count);state.me.marks=state.me.cards.map((card,i)=>i===count-1?card.filter(Boolean):[]);window.__emit(state);
      },{fixture,count});
      await fit(page,`${count} cartones sin scroll en ${viewport.width}×${viewport.height}`);
      for(let card=0;card<count;card++){
        await page.locator(`[data-card="${card}"]`).click();
        assert.equal(await page.locator(`[data-card="${card}"]`).getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('.traditional-ticket').getAttribute('aria-label'),`Cartón ${card+1}`);
        assert.ok(await page.evaluate(()=>{const tabs=document.querySelector('.ticket-tabs');return tabs.scrollTop===0&&tabs.scrollLeft===0&&scrollX===0&&scrollY===0;}),'Se cambia de cartón sin desplazar ningún contenedor');
      }
      if(count>1){
        await page.locator('[data-card="0"]').focus();
        await page.keyboard.press(await page.locator('#app').getAttribute('data-ticket-layout')==='list'?'ArrowDown':'ArrowRight');
        assert.equal(await page.locator('.ticket-tab:focus').getAttribute('data-card'),'1');
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.traditional-ticket').getAttribute('aria-label'),'Cartón 2');
      }
    }
    await page.screenshot({path:`/artifacts/ticket-selector-${viewport.width}x${viewport.height}.png`});
  }
  await page.setViewportSize({width:568,height:320});
  await page.evaluate(data=>{const state=structuredClone(data);state.role='player';state.phase='drawing';window.__emit(state);},fixture);
  await page.evaluate(data=>{const state=structuredClone(data);state.role='player';state.phase='marking';state.current=90;state.called=[90];state.turn=2;window.__emit(state);},fixture);
  await page.getByRole('heading',{name:'No ha salido tu número'}).waitFor();await fit(page,'Modal sin número');await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>window.__messages.filter(message=>message.type==='continue').length),1);
  await page.evaluate(()=>window.__emit(window.__state));assert.equal(await page.locator('[aria-modal="true"]').count(),0);
  await page.evaluate(data=>{const state=structuredClone(data);state.role='tv';state.phase='results';state.me=null;window.__emit(state);},fixture);
  assert.equal(await page.locator('#app a[href="/"]').count(),0);await page.locator('#reset').click();await page.locator('button[data-role="tv"]').waitFor();
  assert.deepEqual(errors,[]);console.log('OK: tarjetas legibles, catálogo 320px y horizontal, TV 1080p/720p/540p/800×600/vertical, 40 tarjetas con autoscroll, perfiles y cinco cartones en siete tamaños, modal, mando y vuelta a selección.');
  await context.close();
}finally{await browser.close();}
