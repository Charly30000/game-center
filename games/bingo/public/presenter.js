import * as THREE from '/vendor/three/three.module.js';
import { createPresenterModel } from './presenter-model.js';

function woodTexture() {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const context=canvas.getContext('2d');context.fillStyle='#c99158';context.fillRect(0,0,512,128);
  for(let i=0;i<80;i++) {
    context.strokeStyle=`rgba(94,50,22,${.025+(i%5)*.012})`;context.lineWidth=.4+(i%3)*.3;context.beginPath();
    for(let x=0;x<=512;x+=8){const y=i*1.7+Math.sin(x*.017+i)*1.6;x?context.lineTo(x,y):context.moveTo(x,y);}context.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}
function numberedBalls() {
  return [7,12,24,38,56,82].map((number,i)=>{
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const ctx=canvas.getContext('2d');
    ctx.fillStyle=['#fff2ce','#efaf76','#72bcac'][i%3];ctx.fillRect(0,0,128,64);
    for(const x of [32,96]){ctx.fillStyle='#fffaf0';ctx.beginPath();ctx.arc(x,32,20,0,Math.PI*2);ctx.fill();ctx.fillStyle='#413c32';ctx.font='bold 23px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(number),x,33);}
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({map,roughness:.3,metalness:.04});
  });
}
export function mountPresenter(element) {
  const renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));renderer.setClearColor(0xeeeade,1);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  element.append(renderer.domElement);
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfffbeb,0xa3b19a,2.5));
  const light=new THREE.DirectionalLight(0xffeed4,3.4);light.position.set(-3,6,5);light.castShadow=true;
  light.shadow.mapSize.set(512,512);light.shadow.camera.left=-3;light.shadow.camera.right=3;light.shadow.camera.top=3;light.shadow.camera.bottom=-3;light.shadow.bias=-.001;
  light.target.position.set(0,1,0);scene.add(light,light.target);
  const fill=new THREE.DirectionalLight(0xdcefff,1.3);fill.position.set(4,3,-4);scene.add(fill);
  const model=createPresenterModel(THREE,{woodTexture:woodTexture(),ballMaterials:numberedBalls()});scene.add(model.root);
  const camera=new THREE.PerspectiveCamera(32,1,.1,100);
  const target=new THREE.Vector3(0,1.16,0);
  let phase='marking',deadline=null,frame,disposed=false,previous=0;
  const started=performance.now();
  function resize() {
    if(disposed||!element.clientWidth||!element.clientHeight)return;
    const aspect=element.clientWidth/element.clientHeight;
    renderer.setSize(element.clientWidth,element.clientHeight,false);camera.aspect=aspect;
    const distance=Math.max(2.55/(Math.tan(THREE.MathUtils.degToRad(16))*aspect),1.65/Math.tan(THREE.MathUtils.degToRad(16)));
    camera.position.copy(target).add(new THREE.Vector3(.16,.16,1).normalize().multiplyScalar(distance));camera.lookAt(target);camera.updateProjectionMatrix();
  }
  function animate(time) {
    if(disposed)return;
    frame=requestAnimationFrame(animate);
    const interval=phase==='drawing'?1000/30:1000/20;
    if(document.hidden||time-previous<interval)return;
    previous=time;
    const progress=deadline?Math.max(0,Math.min(1,1-(deadline-Date.now())/1400)):1;
    model.pose({time:(time-started)/1000,phase,progress});renderer.render(scene,camera);
  }
  const observer=new ResizeObserver(resize);observer.observe(element);resize();frame=requestAnimationFrame(animate);
  renderer.domElement.addEventListener('webglcontextlost',()=>{cancelAnimationFrame(frame);renderer.domElement.style.display='none';});
  return {
    update(next,drawEndsAt){phase=next;deadline=drawEndsAt;},
    dispose(){
      disposed=true;cancelAnimationFrame(frame);observer.disconnect();
      const geometries=new Set(),materials=new Set(),textures=new Set();
      scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
      for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
      geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());textures.forEach(item=>item.dispose());
      light.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    },
  };
}
