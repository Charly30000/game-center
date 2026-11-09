import { qrcode } from '/shared/vendor/qrcode.mjs';
import { connectionUrl } from '/shared/connection-url.js';

export async function mountConnection() {
  const code=document.querySelector('#join-code'),link=document.querySelector('#join-url'),status=document.querySelector('#join-status');
  let network={};
  try {
    const response=await fetch('/api/connection',{cache:'no-store'});
    if (response.ok) network=await response.json();
  } catch { /* Una entrada directa por la dirección LAN también permite compartir. */ }
  const url=connectionUrl(location.href,network);
  if (!url) { status.textContent='Abre el centro con la dirección de red del ordenador para conectar otros dispositivos.';return; }
  try {
    const qr=qrcode(0,'M');qr.addData(url,'Byte');qr.make();
    const image=new Image();image.alt='Código QR para abrir el Game Center';image.width=360;image.height=360;
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr.createSvgTag({cellSize:8,margin:32,scalable:true}));
    code.replaceChildren(image);code.hidden=false;
    link.href=url;link.textContent=url;link.hidden=false;status.hidden=true;
  } catch { link.href=url;link.textContent=url;link.hidden=false;status.textContent='Escribe esta dirección en el navegador de tu móvil.'; }
}
