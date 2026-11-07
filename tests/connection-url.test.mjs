import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionUrl } from '../public/shared/connection-url.js';
import { qrcode } from 'qrcode-generator';

test('el enlace usa la IP detectada del anfitrión y conserva el puerto publicado',()=>{
  const network={addresses:['127.0.0.1','169.254.1.2','192.168.1.64']};
  for(const origin of ['http://localhost:3000/games/bingo/?x=1#game','http://127.0.0.1:3000/','http://gamecenter-center-1:3000/','http://172.18.0.2:3000/']){
    assert.equal(connectionUrl(origin,network),'http://192.168.1.64:3000/');
  }
  assert.equal(connectionUrl('http://localhost:8080/',network),'http://192.168.1.64:8080/');
  assert.equal(connectionUrl('http://localhost:3000/',{addresses:['192.168.1.65']}),'http://192.168.1.65:3000/');
  assert.equal(connectionUrl('http://192.168.2.64:3000/',{addresses:['192.168.1.64','192.168.2.64']}),'http://192.168.2.64:3000/');
  assert.equal(connectionUrl('http://[::1]:3000/',network),'http://192.168.1.64:3000/');
});

test('sin dirección detectada no ofrece localhost ni nombres internos de Docker',()=>{
  for(const origin of ['http://localhost:3000/','http://127.0.0.1:3000/','http://127.0.0.2:3000/','http://[::1]:3000/','http://0.0.0.0:3000/','http://host.docker.internal:3000/','http://gamecenter-center-1:3000/']){
    assert.equal(connectionUrl(origin),null,origin);
  }
  assert.equal(connectionUrl('http://localhost:3000/',null),null);
  assert.equal(connectionUrl('http://localhost:3000/',{addresses:['not-an-ip','256.1.1.1','224.1.1.1']}),null);
});

test('una entrada LAN directa y un origen HTTPS accesible se comparten correctamente',()=>{
  assert.equal(connectionUrl('http://192.168.1.64:3000/?x=1#game'),'http://192.168.1.64:3000/');
  assert.equal(connectionUrl('https://juegos.example.org/games/bingo/',{addresses:['192.168.1.64']}),'https://juegos.example.org/');
  assert.equal(connectionUrl('file:///index.html'),null);
  assert.equal(connectionUrl('http://user:password@localhost:3000/',{addresses:['192.168.1.64']}),null);
});

test('el QR utiliza un SVG de alto contraste con cuatro módulos de margen',()=>{
  const url=connectionUrl('http://localhost:3000/',{addresses:['192.168.1.64']});
  const qr=qrcode(0,'M');qr.addData(url,'Byte');qr.make();
  const size=(qr.getModuleCount()+8)*8;
  const svg=qr.createSvgTag({cellSize:8,margin:32,scalable:true});
  assert.ok(svg.includes(`viewBox="0 0 ${size} ${size}"`));
  assert.ok(svg.includes('fill="white"')&&svg.includes('fill="black"'));
  assert.equal(qr.isDark(0,0),true);
});
