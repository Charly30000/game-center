import {chromium} from 'playwright';
import jsQR from 'jsqr';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.BASE_URL||'http://gamecenter-center-1:3000';
const sizes=[[1920,1080],[1280,720],[960,540],[800,480],[667,375],[568,320],[390,844],[320,568]];
const browser=await chromium.launch({args:['--no-sandbox','--no-zygote']});
const report={sizes:[],errors:[]};
try{
  await mkdir('/artifacts/connection',{recursive:true});
  const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
  let publicUrl='http://192.168.1.64:3000';
  // El navegador entra por localhost; las respuestas se sirven desde la pasarela.
  await context.route('http://localhost:3000/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/connection')return route.fulfill({json:{publicUrl}});
    const response=await route.fetch({url:base+path});await route.fulfill({response});
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://localhost:3000/');
  await page.waitForFunction(()=>document.querySelector('#join-code img')?.complete);
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#join-url').textContent(),'http://192.168.1.64:3000/');
  await page.locator('#catalog .game-card').first().waitFor();
  await page.locator('#catalog').evaluate(catalog=>{
    const original=catalog.querySelector('.game-card');
    for(let i=0;i<18;i++)catalog.append(original.cloneNode(true));
  });
  for(const [width,height]of sizes){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(()=>{scrollTo(0,0);document.querySelector('#catalog').scrollTop=0;});
    const code=page.locator('#join-code img'),box=await code.boundingBox(),url=await page.locator('#join-url').boundingBox();
    assert.ok(box.width>=224&&box.height>=224,`${width}x${height}: QR suficientemente grande`);
    assert.ok(Math.abs(box.width-box.height)<1, 'QR cuadrado');
    assert.ok(url.y>=box.y+box.height-1,'La URL aparece justo debajo');
    assert.ok(box.x>=0&&box.x+box.width<=width+1);
    const panel=await page.locator('.join-panel').boundingBox(),catalog=await page.locator('#catalog').boundingBox();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(width>850){
      assert.ok(url.y+url.height<=height+1,`${width}x${height}: QR y URL completos sin desplazamiento`);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
      assert.ok(panel.x+panel.width<=catalog.x,'QR siempre a la izquierda en pantallas amplias');
      assert.ok(await page.locator('.join-panel').evaluate(el=>parseFloat(getComputedStyle(el).borderRightWidth)>=1&&el.scrollHeight<=el.clientHeight+1),'Separador visible y panel sin scroll');
      assert.ok(await page.locator('#catalog').evaluate(el=>el.scrollHeight>el.clientHeight),'Un catálogo largo tiene scroll propio');
      await page.locator('#catalog').evaluate(el=>{el.scrollTop=el.scrollHeight;});
      assert.ok(await page.locator('#catalog').evaluate(el=>el.scrollTop>0));
      const after=await code.boundingBox();assert.ok(Math.abs(after.y-box.y)<1&&Math.abs(after.x-box.x)<1,'El QR no se desplaza al mover las tarjetas');
      await code.hover();await page.mouse.wheel(0,400);assert.equal(await page.evaluate(()=>scrollY),0);
      await page.locator('#catalog').evaluate(el=>{el.scrollTop=0;});
    }else{
      assert.ok(panel.y+panel.height<=catalog.y,'En móvil el QR aparece antes de las tarjetas');
      assert.equal(await page.locator('#catalog').evaluate(el=>getComputedStyle(el).overflowY),'visible');
      await page.evaluate(()=>scrollTo(0,200));assert.ok(await page.evaluate(()=>scrollY)>0,'El listado móvil utiliza scroll normal');
      assert.ok((await code.boundingBox()).y<box.y);await page.evaluate(()=>scrollTo(0,0));
    }
    const image=await code.evaluate(img=>{
      const box=img.getBoundingClientRect(),canvas=document.createElement('canvas');canvas.width=Math.round(box.width);canvas.height=Math.round(box.height);
      const context=canvas.getContext('2d');context.drawImage(img,0,0,canvas.width,canvas.height);
      return {width:canvas.width,height:canvas.height,pixels:[...context.getImageData(0,0,canvas.width,canvas.height).data]};
    });
    const decoded=jsQR(Uint8ClampedArray.from(image.pixels),image.width,image.height);
    assert.equal(decoded?.data,await page.locator('#join-url').textContent(),'Un lector independiente decodifica exactamente la URL visible');
    report.sizes.push({width,height,qr:box.width,decoded:decoded.data});
    if([1920,1280,568,320].includes(width))await page.screenshot({path:`/artifacts/connection/${width}x${height}.png`});
  }
  publicUrl='http://192.168.1.65:3000';await page.reload();await page.waitForFunction(()=>document.querySelector('#join-url').textContent==='http://192.168.1.65:3000/');
  publicUrl='https://juegos.example.org:8443';await page.reload();await page.waitForFunction(()=>document.querySelector('#join-url').textContent==='https://juegos.example.org:8443/');
  publicUrl='http://localhost:3000';await page.reload();await page.waitForFunction(()=>document.querySelector('#join-status').textContent.includes('dirección de red'));
  assert.equal(await page.locator('#join-code img').count(),0,'La configuración tampoco puede ofrecer un QR de localhost');
  publicUrl='';await page.reload();await page.waitForFunction(()=>document.querySelector('#join-status').textContent.includes('dirección de red'));
  assert.equal(await page.locator('#join-code img').count(),0,'No se ofrece un QR de localhost si no se conoce la dirección LAN');
  assert.deepEqual(report.errors,[]);report.ok=true;report.networkChange=true;report.noLocalhostFallback=true;
  await writeFile('/artifacts/connection/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
