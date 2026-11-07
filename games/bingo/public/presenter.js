import * as THREE from 'three';
import { loadBingoCharacter } from './bingo-character.js';
import { createPresenterCamera,fitPresenterCamera } from './presenter-framing.js';
import { createPresenterStage } from './presenter-stage.js';

export async function mountPresenter(element) {
  const viewport=element.querySelector('.presenter-viewport')||element;
  const scene=new THREE.Scene(),camera=createPresenterCamera();
  const controller=await loadBingoCharacter({scene,camera});
  if(!element.isConnected){controller.dispose();throw new Error('La escena ya se ha cerrado.');}
  let renderer,stage,observer,frame,disposed=false,previous=0;
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.setClearColor(0x0c1d30,0);
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
    stage=createPresenterStage(scene,renderer);
    const bounds=controller.presentationBounds;
    function resize(){
      if(disposed||!viewport.clientWidth||!viewport.clientHeight)return;
      renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);
      const framing=fitPresenterCamera(camera,bounds,viewport.clientWidth,viewport.clientHeight);
      element.dataset.presenterCoverage=(framing.subjectHeight/framing.frameHeight).toFixed(3);
    }
    function animate(time){
      if(disposed)return;
      frame=requestAnimationFrame(animate);
      if(document.hidden){controller.clock.getDelta();return;}
      if(time-previous<1000/(controller.currentAnimation==='Idle'?24:30))return;
      previous=time;controller.update(Math.min(.1,controller.clock.getDelta()));renderer.render(scene,camera);
      element.dataset.presenterAnimation=controller.currentAnimation||'';
      element.dataset.presenterTime=controller.animationTime.toFixed(3);
      element.dataset.presenterBall=String(controller.selectedBall?.userData.number??'');
    }
    function dispose(){
      if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer?.disconnect();
      controller.dispose();stage.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
      delete element.dataset.presenterModel;delete element.dataset.presenterAnimation;
      delete element.dataset.presenterTime;delete element.dataset.presenterBall;
      delete element.dataset.presenterCoverage;
    }
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();dispose();},{once:true});
    renderer.domElement.setAttribute('aria-label','Anfitrión de Bingo con bombo dorado');
    viewport.append(renderer.domElement);element.dataset.presenterModel='blender-v8';
    observer=new ResizeObserver(resize);observer.observe(viewport);resize();frame=requestAnimationFrame(animate);
    return {update(state){if(disposed)return;controller.updateFromGame(state);},dispose};
  }catch(error){
    controller.dispose();observer?.disconnect();stage?.dispose();renderer?.dispose();renderer?.domElement.remove();throw error;
  }
}
