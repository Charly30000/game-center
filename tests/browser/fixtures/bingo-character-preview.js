import * as THREE from 'three';
import { loadBingoCharacter } from '/games/bingo/bingo-character.js';
import { createPresenterCamera,fitPresenterCamera } from '/games/bingo/presenter-framing.js';
import { createPresenterStage } from '/games/bingo/presenter-stage.js';

const stage=document.querySelector('#stage'),status=document.querySelector('#status');
const viewport=stage.querySelector('.presenter-viewport');
const report=error=>{document.querySelector('#error').textContent=error.message;};
let controller,renderer,frame,observer,theatre;
try {
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  renderer.setClearColor(0x0c1d30,0);
  viewport.append(renderer.domElement);
  const scene=new THREE.Scene();theatre=createPresenterStage(scene,renderer);
  const camera=createPresenterCamera();
  controller=await loadBingoCharacter({scene,camera,onAnimationChange:name=>{status.textContent=`Animación: ${name}`;}});
  function resize(){
    const width=viewport.clientWidth,height=viewport.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height,false);fitPresenterCamera(camera,controller.presentationBounds,width,height);
  }
  observer=new ResizeObserver(resize);observer.observe(viewport);resize();
  for(const name of controller.clips){
    const button=document.createElement('button');button.textContent=name;
    button.onclick=()=>{try{if(['ShowBall','DropBall'].includes(name)&&!controller.selectedBall)controller.showBingoBall(Number(document.querySelector('#number').value));controller.playBingoAnimation(name,{restart:true,after:false});}catch(error){report(error);}};
    document.querySelector('#clips').append(button);
  }
  for(const id of ['show','remove','stop'])document.querySelector('#'+id).disabled=false;
  document.querySelector('#show').onclick=()=>{
    try{controller.showBingoBall(Number(document.querySelector('#number').value),{at:'pickup'});controller.playBingoAnimation('PickBall',{restart:true});}catch(error){report(error);}
  };
  document.querySelector('#remove').onclick=()=>controller.removeBingoBall();
  document.querySelector('#stop').onclick=()=>{controller.stopAnimations();status.textContent='Animaciones detenidas';};
  let previous=0;
  function animate(time){
    frame=requestAnimationFrame(animate);
    if(document.hidden||time-previous<1000/30)return;
    previous=time;controller.update(Math.min(.1,controller.clock.getDelta()));renderer.render(scene,camera);
  }
  document.addEventListener('visibilitychange',()=>{controller.clock.getDelta();});
  frame=requestAnimationFrame(animate);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();controller.dispose();theatre.dispose();renderer.dispose();},{once:true});
} catch(error) {
  if(frame)cancelAnimationFrame(frame);observer?.disconnect();controller?.dispose();theatre?.dispose();renderer?.dispose();
  status.textContent='No se pudo abrir el modelo';report(error);
}
