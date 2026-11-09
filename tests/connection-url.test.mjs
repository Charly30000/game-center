import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionUrl } from '../public/shared/connection-url.js';
import { qrcode } from 'qrcode-generator';

test('la URL configurada prevalece y conserva su puerto público',()=>{
  const network={publicUrl:'http://192.168.1.64:8080'};
  for(const origin of ['http://localhost:3000/', 'http://127.0.0.1:3000/', 'http://[::1]:3000/', 'http://gamecenter-center-1:3000/', 'http://192.168.2.64:3000/', 'https://otro.example.org/']){
    assert.equal(connectionUrl(origin,network),'http://192.168.1.64:8080/');
  }
  assert.equal(connectionUrl('http://localhost:3000/',{publicUrl:'http://192.168.1.65:3000'}),'http://192.168.1.65:3000/');
  assert.equal(connectionUrl('http://localhost:3000/',{publicUrl:'  https://juegos.example.org:8443/games/bingo/?x=1#game  '}),'https://juegos.example.org:8443/');
});

test('sin configuración no ofrece localhost ni nombres internos de Docker',()=>{
  for(const origin of ['http://localhost:3000/','http://127.0.0.1:3000/','http://127.0.0.2:3000/','http://[::1]:3000/','http://0.0.0.0:3000/','http://host.docker.internal:3000/','http://gamecenter-center-1:3000/']){
    assert.equal(connectionUrl(origin),null,origin);
    assert.equal(connectionUrl(origin,{publicUrl:''}),null,origin);
  }
  assert.equal(connectionUrl('http://localhost:3000/',null),null);
});

test('rechaza configuraciones inválidas sin sustituirlas por la entrada del navegador',()=>{
  for(const publicUrl of ['not-a-url','192.168.1.64','ftp://192.168.1.64/','http://user:secret@192.168.1.64/','http://localhost:3000/','http://127.0.0.1/','http://[::1]/','http://169.254.1.2/','http://224.1.1.1/','http://256.1.1.1/','http://host.docker.internal/']){
    assert.equal(connectionUrl('http://192.168.1.64:3000/',{publicUrl}),null,publicUrl);
  }
});

test('sin configuración comparte una entrada LAN o HTTPS accesible',()=>{
  assert.equal(connectionUrl('http://192.168.1.64:3000/?x=1#game'),'http://192.168.1.64:3000/');
  assert.equal(connectionUrl('https://juegos.example.org/games/bingo/',{publicUrl:' '}),'https://juegos.example.org/');
  assert.equal(connectionUrl('file:///index.html'),null);
  assert.equal(connectionUrl('not-a-url'),null);
  assert.equal(connectionUrl('http://user:password@192.168.1.64:3000/'),null);
});

test('el QR utiliza un SVG de alto contraste con cuatro módulos de margen',()=>{
  const url=connectionUrl('http://localhost:3000/',{publicUrl:'http://192.168.1.64:3000'});
  const qr=qrcode(0,'M');qr.addData(url,'Byte');qr.make();
  const size=(qr.getModuleCount()+8)*8;
  const svg=qr.createSvgTag({cellSize:8,margin:32,scalable:true});
  assert.ok(svg.includes(`viewBox="0 0 ${size} ${size}"`));
  assert.ok(svg.includes('fill="white"')&&svg.includes('fill="black"'));
  assert.equal(qr.isDark(0,0),true);
});
