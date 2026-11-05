import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base=process.env.BASE_URL||'http://host.docker.internal:3002';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const contexts=[],errors=[];
async function page(viewport,mobile=false){
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});contexts.push(context);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});return page;
}
async function online(page){await page.locator('#connection').getByText('En directo',{exact:true}).waitFor({state:'attached'});}
async function click(page,selector){await page.locator(selector).click();}
async function fit(page,label){
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  const result=await page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight}));
  assert.ok(result.x<=1&&result.y<=1,`${label}: ${JSON.stringify(result)}`);
}
async function join(page,name){
  await click(page,'button[data-role="player"]');await page.locator('#profile').waitFor();assert.equal(await page.locator('.selection-grid').count(),0);
  await page.locator('#player-name').fill(name);await click(page,'[data-avatar="6"]');await page.getByRole('button',{name:'Confirmar jugador'}).click();await page.getByRole('heading',{name:'¡Todo listo!'}).waitFor();
}
async function start(tv){await click(tv,'#start');await click(tv,'#modal-confirm');}
try{
  await mkdir('/artifacts',{recursive:true});
  const tv=await page({width:1280,height:720});await tv.goto(base);await tv.getByRole('button',{name:/Jugar a/}).waitFor();
  await tv.screenshot({path:'/artifacts/01-gamecenter.png'});
  await tv.getByRole('button',{name:/Jugar a/}).click();await online(tv);await tv.locator('button[data-role="tv"]').waitFor();
  await tv.screenshot({path:'/artifacts/02-role-selection.png'});
  await tv.goBack();await tv.locator('.game-card:not([disabled])').waitFor();
  assert.ok(await tv.locator('.game-info').isVisible());await tv.locator('.game-card').click();await online(tv);
  await click(tv,'button[data-role="tv"]');await tv.getByRole('heading',{name:'¿Estamos todos?'}).waitFor();
  assert.equal(await tv.locator('.player-card').count(),0,'La sala de pruebas debe estar vacía');
  await tv.goBack();await tv.locator('button[data-role="tv"]').waitFor();await click(tv,'button[data-role="tv"]');await fit(tv,'TV lobby tras Atrás');
  const tv2=await page({width:960,height:540});await tv2.goto(base+'/games/bingo/');await online(tv2);await click(tv2,'button[data-role="tv"]');
  const expired=await page({width:390,height:844},true);await expired.addInitScript(()=>localStorage.setItem('bingo.token','expired-session'));await expired.goto(base+'/games/bingo/');await online(expired);await expired.locator('button[data-role="player"]').waitFor();assert.equal(await expired.evaluate(()=>localStorage.getItem('bingo.token')),null);
  const player=await page({width:320,height:568},true);await player.goto(base+'/games/bingo/');await online(player);await join(player,'María');await fit(player,'Espera móvil 320px');
  for(let i=0;i<2;i++){await click(tv,'[data-step="1"]');await tv.locator('.stepper>strong').filter({hasText:String(4+i)}).waitFor();}
  await tv.locator('#effects').uncheck();await tv2.waitForFunction(()=>!document.querySelector('#effects').checked);
  await click(tv,'#start');await click(tv,'#modal-cancel');await start(tv);
  await player.locator('.player-playfield').waitFor();await player.locator('.draw-overlay').waitFor({state:'hidden'});
  assert.equal(await player.locator('.ticket-cell').count(),27);assert.equal(await player.locator('.ticket-cell.blank').count(),12);assert.equal(await player.locator('.ticket-tab').count(),5);assert.equal(await tv.locator('canvas').count(),0);
  if(await player.locator('[aria-modal="true"]').count())await player.keyboard.press('Escape');
  await fit(player,'Cartón vertical 320px');await player.screenshot({path:'/artifacts/04-ticket-portrait.png'});
  for(const viewport of [{width:568,height:320},{width:667,height:375},{width:844,height:390}]){await player.setViewportSize(viewport);await fit(player,`Cartón ${viewport.width}×${viewport.height}`);}
  await player.screenshot({path:'/artifacts/05-ticket-landscape.png'});await fit(tv,'TV 720p');await fit(tv2,'TV 540p');await tv2.screenshot({path:'/artifacts/06-tv-static.png'});
  assert.equal(await player.locator('#app a[href="/"]').count(),0,'No se sale al centro durante la partida');
  const recovered=await page({width:390,height:844},true);
  await recovered.addInitScript(()=>{window.__orientationRequests=[];Object.defineProperty(screen.orientation,'lock',{value:async value=>window.__orientationRequests.push(value)});});
  await recovered.goto(base+'/games/bingo/');await online(recovered);await click(recovered,'button[data-role="player"]');
  await recovered.locator('[data-claim]').click();await recovered.getByRole('heading',{name:'¿Eres tú?'}).waitFor();await click(recovered,'#modal-confirm');await recovered.locator('.player-playfield').waitFor();await player.getByRole('heading',{name:'Tu jugador está en otro dispositivo'}).waitFor();
  const savedToken=await recovered.evaluate(()=>localStorage.getItem('bingo.token'));assert.ok(savedToken);
  await recovered.reload();await online(recovered);await recovered.locator('.player-playfield').waitFor();assert.equal(await recovered.locator('button[data-role="player"]').count(),0,'La sesión válida se recupera automáticamente');
  assert.ok(await recovered.evaluate(()=>window.__orientationRequests.includes('landscape')),'La sesión recuperada en partida solicita orientación horizontal');
  if(await recovered.getByRole('heading',{name:'No ha salido tu número'}).count())await recovered.keyboard.press('Escape');
  await click(recovered,'[data-back]');await click(recovered,'#modal-confirm');await recovered.locator('button[data-role="tv"]').waitFor();assert.ok(await recovered.evaluate(()=>localStorage.getItem('bingo.token')),'Volver al selector no elimina una sesión válida');
  await recovered.locator('#app a[href="/"]').click();await recovered.locator('.game-card').click();await online(recovered);await recovered.locator('.player-playfield').waitFor();
  await click(tv,'#cancel');await click(tv,'#modal-confirm');await recovered.locator('button[data-role="player"]').waitFor();
  await join(recovered,'María 3D');await tv.locator('#start:not([disabled])').waitFor();await start(tv);
  await tv.locator('canvas').waitFor();await recovered.locator('.draw-overlay').waitFor({state:'hidden'});await tv.waitForTimeout(400);
  await fit(tv,'TV 3D');await tv.screenshot({path:'/artifacts/07-tv-3d.png'});
  const firstFrame=await tv.locator('canvas').screenshot();await tv.waitForTimeout(650);const nextFrame=await tv.locator('canvas').screenshot();assert.ok(!firstFrame.equals(nextFrame),'El presentador debe tener animación de espera');
  if(process.env.FULL_GAME==='true'){
    let turns=0;
    while(await recovered.locator('#app').getAttribute('data-screen')!=='results'&&turns++<90){
      await recovered.locator('.draw-overlay').waitFor({state:'hidden'});
      const previousTurn=Number(await recovered.locator('#app').getAttribute('data-turn'));
      if(await recovered.getByRole('heading',{name:'No ha salido tu número'}).count())await click(recovered,'#modal-confirm');
      else{
        const pending=await recovered.locator('.ticket-tab.pending').evaluateAll(items=>items.map(item=>item.dataset.card));
        for(const card of pending){
          await click(recovered,`[data-card="${card}"]`);
          while(await recovered.locator('[data-number]').count()){
            const number=await recovered.locator('[data-number]').first().getAttribute('data-number');await recovered.locator(`[data-number="${number}"]`).click();await recovered.locator(`[data-number="${number}"]`).waitFor({state:'hidden'});
          }
        }
        await recovered.locator('#continue:not([disabled])').waitFor();await click(recovered,'#continue');
      }
      await recovered.waitForFunction(turn=>document.querySelector('.draw-overlay')||Number(document.querySelector('#app').dataset.turn)>turn||document.querySelector('#app').dataset.screen==='results',previousTurn);
      if(turns%15===0)console.log(`Partida real en navegador: ${turns} turnos completados.`);
    }
    await tv.locator('#reset').waitFor();await recovered.getByRole('heading',{name:'¡Ganaste!'}).waitFor();
    assert.equal(await tv.locator('#app a[href="/"]').count(),0);await tv.screenshot({path:'/artifacts/08-results.png'});await click(tv2,'#reset');
    for(const screen of [tv,tv2,recovered])await screen.locator('button[data-role="tv"]').waitFor();
    await click(tv,'button[data-role="tv"]');await tv.getByRole('heading',{name:'¿Estamos todos?'}).waitFor();assert.equal(await tv.locator('.player-card').count(),0);await tv.goBack();await tv.locator('a[href="/"]').click();await tv.locator('.game-card:not([disabled])').waitFor();await tv.locator('.game-card').click();await tv.locator('button[data-role="tv"]').waitFor();
    console.log(`OK: partida completa en navegador (${turns} turnos), resultado y vuelta simultánea de todas las pantallas a selección.`);
  }else{await click(tv,'#cancel');await click(tv,'#modal-confirm');}
  assert.deepEqual(errors,[]);console.log('OK: Atrás/entrar de nuevo, selección independiente de jugador, dos TV, cinco cartones, 320px y horizontal, recuperación, modo estático, modelo 3D sin intersección y espera animada.');
}catch(error){
  for(let i=0;i<contexts.length;i++)for(const page of contexts[i].pages())await page.screenshot({path:`/artifacts/smoke-failure-${i}.png`}).catch(()=>{});
  throw error;
}finally{for(const context of contexts)await context.close();await browser.close();}
