import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://scaffold-review:3000';
const browser=await chromium.launch({args:['--no-sandbox','--no-zygote']});
const contexts=[],report={errors:[],sizes:[]};
async function page(width=1280,height=720){const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});contexts.push(context);const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));page.on('dialog',dialog=>dialog.accept());return page;}
async function openPlayer(name,url=base+'/games/demo-base/'){
  const phone=await page(390,844);await phone.goto(url);await phone.locator('[data-role="player"]').click();await phone.locator('#player-name').fill(name);await phone.locator('#profile button:not([type="button"])').click();return phone;
}
try{
  await mkdir('/artifacts/scaffold',{recursive:true});
  const tv=await page(),tv2=await page();await tv.goto(base+'/');
  await tv.locator('.game-card').first().waitFor();
  assert.deepEqual(await tv.locator('.game-card').evaluateAll(cards=>cards.map(card=>Number(card.dataset.gameNumber))),[1,2,3]);
  const bingoCover=tv.locator('.game-card').first().locator('img');
  assert.ok((await bingoCover.getAttribute('src')).endsWith('/bingo/assets/cover.svg'));
  const coverResponse=await tv.request.get(base+'/games/bingo/assets/cover.svg'),coverSvg=await coverResponse.text();
  assert.ok(coverSvg.includes('>BIN<')&&coverSvg.includes('>GO!<')&&coverSvg.includes('data:font/woff2;base64,')&&!coverSvg.includes('{{'));
  for(const [width,height]of [[1920,1080],[1280,720],[667,375],[568,320],[390,844],[320,568]]){
    await tv.setViewportSize({width,height});await bingoCover.evaluate(image=>image.decode());
    assert.ok(await bingoCover.evaluate(image=>image.naturalWidth>0&&image.getBoundingClientRect().height>0));
    assert.ok(await tv.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await tv.screenshot({path:`/artifacts/scaffold/catalog-${width}x${height}.png`});
  }
  await tv.setViewportSize({width:1280,height:720});
  const card=tv.getByRole('button',{name:'Jugar a Base de prueba',exact:true});assert.ok((await card.locator('img').getAttribute('src')).includes('/games/demo-base/'));assert.equal(await card.locator('svg').count(),0);
  await card.click();await tv.locator('[data-role="tv"]').click();
  await tv2.goto(base+'/games/demo-base/');await tv2.locator('[data-role="tv"]').click();
  const ana=await openPlayer('  Ana  ');await ana.getByRole('heading',{name:'¡Todo listo!'}).waitFor();
  const beto=await openPlayer('ana');await beto.locator('#notice').filter({hasText:'Ya hay otro jugador'}).waitFor();
  await beto.locator('#player-name').fill('Beto');await beto.locator('#profile button:not([type="button"])').click();
  await tv.getByText('Ana',{exact:true}).waitFor();await tv.getByText('Beto',{exact:true}).waitFor();
  await tv2.locator('#rounds').fill('3');await tv2.locator('#rounds').dispatchEvent('change');await tv.waitForFunction(()=>document.querySelector('#rounds')?.value==='3');
  await tv.locator('[data-action="start"]').click();await ana.getByRole('heading',{name:'Partida en curso'}).waitFor();
  const recover=await page(390,844);await recover.goto(base+'/games/demo-base/');await recover.locator('[data-role="player"]').click();
  await recover.getByRole('heading',{name:'Elige tu jugador'}).waitFor();await recover.locator('[data-claim]').filter({hasText:'Ana'}).click();
  await ana.getByRole('heading',{name:'Tu jugador está en otro dispositivo'}).waitFor();await recover.getByRole('heading',{name:'Partida en curso'}).waitFor();
  await recover.reload();await recover.getByRole('heading',{name:'Partida en curso'}).waitFor();
  await recover.locator('[data-action="back"]').click();await recover.locator('[data-role="player"]').click();await recover.getByRole('heading',{name:'Partida en curso'}).waitFor();
  await tv2.reload();await tv2.locator('[data-role="tv"]').waitFor();await tv2.locator('[data-role="tv"]').click();
  for(const [width,height]of [[1920,1080],[1280,720],[667,375],[568,320],[390,844],[320,568]]){
    await tv.setViewportSize({width,height});await tv.waitForTimeout(80);
    const metrics=await tv.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,buttons:[...document.querySelectorAll('button:not([hidden])')].filter(node=>node.getClientRects().length).map(node=>{const r=node.getBoundingClientRect();return {text:node.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom};})}));
    const fits=metrics.scrollWidth<=width&&metrics.scrollHeight<=height&&metrics.buttons.every(r=>r.left>=-1&&r.right<=width+1&&r.top>=-1&&r.bottom<=height+1);
    if(!fits)await tv.screenshot({path:`/artifacts/scaffold/overflow-${width}.png`});assert.ok(fits,JSON.stringify(metrics));report.sizes.push({width,height,fits});
  }
  await tv.screenshot({path:'/artifacts/scaffold/tv-compact.png'});
  await tv.locator('[data-action="finish"]').click();await beto.getByRole('heading',{name:'Partida terminada'}).waitFor();
  await tv.locator('[data-action="reset"]').click();await beto.locator('[data-role="player"]').waitFor();await tv2.locator('[data-role="tv"]').waitFor();
  await tv.setViewportSize({width:1280,height:720});await tv.locator('[data-role="tv"]').click();
  await tv.evaluate(async()=>{
    window.__players=[];
    for(let i=0;i<40;i++){
      const socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws/demo-base`);window.__players.push(socket);
      await new Promise(resolve=>socket.onopen=resolve);
      const request=(type,payload,requestId)=>new Promise((resolve,reject)=>{const receive=event=>{const m=JSON.parse(event.data);if(m.requestId===requestId){socket.removeEventListener('message',receive);m.type==='error'?reject(new Error(m.message)):resolve(m.result);}};socket.addEventListener('message',receive);socket.send(JSON.stringify({type,payload,requestId}));});
      await request('hello',{role:'player'},'1');await request('profile',{name:i===0?'Nombre extremadamente largo de prueba':'Jugador '+String(i).padStart(2,'0'),avatar:i%8},'2');
    }
  });
  await tv.waitForFunction(()=>document.querySelectorAll('.player-card').length===40);await tv.mouse.move(0,0);
  await tv.waitForFunction(()=>document.querySelector('.auto-scroll')?.scrollTop>0,{},{timeout:8000});
  assert.ok(await tv.locator('.auto-scroll').evaluate(node=>node.scrollTop>0),'La lista larga se desplaza automáticamente');
  await tv.locator('[data-action="cancel"]').click();await tv.locator('[data-role="tv"]').waitFor();
  await tv.evaluate(()=>window.__players.forEach(socket=>socket.close()));
  const roomA=await page(),roomB=await page();
  for(const [screen,name]of [[roomA,'Sala A'],[roomB,'Sala B']]){await screen.goto(base+'/games/demo-salas/');await screen.locator('#room-form input').fill(name);await screen.locator('#room-form button').click();await screen.locator('[data-role="tv"]').click();}
  const roomAnaA=await openPlayer('Ana',roomA.url()),roomAnaB=await openPlayer('Ana',roomB.url());
  await roomAnaB.locator('#notice').filter({hasText:'Ya hay otro jugador'}).waitFor();
  await roomAnaB.locator('#player-name').fill('Beto');await roomAnaB.locator('#profile button:not([type="button"])').click();
  await roomAnaA.getByRole('heading',{name:'¡Todo listo!'}).waitFor();await roomAnaB.getByRole('heading',{name:'¡Todo listo!'}).waitFor();
  await roomA.locator('[data-action="start"]').click();await roomAnaA.getByRole('heading',{name:'Partida en curso'}).waitFor();assert.equal(await roomB.locator('#rounds').count(),1);
  await roomA.locator('[data-action="cancel"]').click();await roomAnaA.locator('[data-role="player"]').waitFor();assert.equal(await roomB.getByText('Beto',{exact:true}).count(),1);
  await roomB.locator('[data-action="close-room"]').click();await roomB.getByRole('heading',{name:'Elige una sala'}).waitFor();
  assert.deepEqual(report.errors,[]);report.flows=['catálogo y portada propia','dos TV','trim y duplicados','reglas compartidas','inicio','toma y recuperación de sesión','TV no persistida','salas aisladas','resultados y reset'];
  await writeFile('/artifacts/scaffold/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{for(const context of contexts)await context.close();await browser.close();}
