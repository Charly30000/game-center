import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBingoCharacter } from '../games/bingo/public/bingo-character.js';
import { createPresenterCamera,fitPresenterCamera } from '../games/bingo/public/presenter-framing.js';

if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class extends Event{constructor(type,data={}){super(type);Object.assign(this,data);}};
export async function validateBingoCharacter(){
const bytes=await readFile(new URL('../games/bingo/public/assets/models/bingo_character_animated.glb',import.meta.url));
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const expected={Idle:4.5,SpinDrum:5,PickBall:2.6,ShowBall:3,DropBall:1.4,Celebrate:3,Wave:2.5,Talk:3.2,DrumSpin:5};
assert.deepEqual(json.animations.map(clip=>clip.name).sort(),Object.keys(expected).sort());
assert.equal(json.scenes.length,1);assert.equal(json.cameras?.length??0,0);assert.equal(json.skins.length,1);assert.equal(json.skins[0].joints.length,45);
assert.ok(!json.buffers.some(buffer=>buffer.uri),'El GLB es autónomo');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const fingerRest=new Map();
gltf.scene.traverse(bone=>{if(/^(Index|Middle|Ring|Little|Thumb)_0[12]_[LR]$/.test(bone.name))fingerRest.set(bone.name,bone.quaternion.clone());});
const controller=createBingoCharacter(gltf),root=controller.root;
controller.update(0);
assert.ok(root.getObjectByName('BingoDrum_Root').position.x<root.getObjectByName('Character_Root').position.x,'El bombo está a la izquierda del público');
assert.equal(controller.socket.parent.name,'Hand_R','La mano derecha recoge y muestra la bola');
for(const [side,sign]of [['L',1],['R',-1]]){
  const dorsal=new THREE.Vector3(0,0,1).applyQuaternion(root.getObjectByName('Hand_'+side).getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(dorsal.x*sign>.9,`Mano ${side}: el dorso mira hacia fuera y la palma hacia el cuerpo`);
}
const position=name=>root.getObjectByName(name).getWorldPosition(new THREE.Vector3());
function meshCenter(name){
  const mesh=root.getObjectByName(name);mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
}
for(const [name,seconds]of Object.entries(expected))assert.ok(Math.abs(gltf.animations.find(clip=>clip.name===name).duration-seconds)<.001,`${name}: duración`);
const skins=[];root.traverse(obj=>{if(obj.isSkinnedMesh)skins.push(obj);});assert.equal(skins.length,19);
for(const mesh of skins){
  const weights=mesh.geometry.getAttribute('skinWeight');
  for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);
}
// Reposo: flexión progresiva hacia el meñique, sin dejar todos los dedos rectos.
controller.stopAnimations();controller.playBingoAnimation('Idle',{fade:0,restart:true,after:false});controller.update(0);
const restingFingers={};
for(const side of ['L','R']){
  restingFingers[side]=['Index','Middle','Ring','Little'].map(label=>{
    const name=label+'_01_'+side;
    const relative=fingerRest.get(name).clone().invert().multiply(root.getObjectByName(name).quaternion);
    return -THREE.MathUtils.radToDeg(new THREE.Euler().setFromQuaternion(relative,'XYZ').x);
  });
  assert.ok(restingFingers[side][0]>12&&restingFingers[side][3]<40,'Dedos en reposo suavemente flexionados');
  for(let i=1;i<4;i++)assert.ok(restingFingers[side][i]-restingFingers[side][i-1]>2,'Cascada natural de índice a meñique');
}
const movement={};let maxWristTwist=0,maxWristBend=0,maxFingerStep=0;
for(const [name,seconds]of Object.entries(expected)){
  controller.stopAnimations();controller.playBingoAnimation(name,{fade:0,restart:true,after:false});controller.update(0);
  const tracked=()=>name==='DrumSpin'?meshCenter('BingoDrum_Grip'):position(name==='Wave'?'Hand_L':'BallSocket');
  const start=tracked();let max=0;
  for(let i=0;i<24;i++){
    controller.update(seconds/24);
    for(const side of ['L','R']){
      const forearm=root.getObjectByName('Forearm_'+side).getWorldQuaternion(new THREE.Quaternion()),hand=root.getObjectByName('Hand_'+side).getWorldQuaternion(new THREE.Quaternion());
      const axis=new THREE.Vector3(0,1,0).applyQuaternion(forearm),a=new THREE.Vector3(0,0,1).applyQuaternion(forearm),b=new THREE.Vector3(0,0,1).applyQuaternion(hand);
      b.addScaledVector(axis,-b.dot(axis)).normalize();
      maxWristTwist=Math.max(maxWristTwist,THREE.MathUtils.radToDeg(Math.abs(Math.atan2(axis.dot(a.clone().cross(b)),a.dot(b)))));
      maxWristBend=Math.max(maxWristBend,THREE.MathUtils.radToDeg(axis.angleTo(new THREE.Vector3(0,1,0).applyQuaternion(hand))));
    }
    max=Math.max(max,tracked().distanceTo(start));
    for(const mesh of skins){
      const value=mesh.getVertexPosition(Math.floor(mesh.geometry.getAttribute('position').count/2),new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      assert.ok(value.toArray().every(Number.isFinite),`${name}: skin finito`);
    }
  }
  movement[name]=max;
}
assert.ok(maxWristTwist<5,`Muñecas sin giro axial concentrado: ${maxWristTwist}`);
assert.ok(maxWristBend<73,`Flexión de muñecas limitada: ${maxWristBend}`);
// Una muñeca sin torsión puede seguir acompañada de un giro brusco del codo.
// Revisar cada fotograma, incluido el retorno de los bucles, y medias claves.
const temporalMotion={};
for(const [name,seconds]of Object.entries(expected)){
  if(name==='DrumSpin')continue;
  controller.stopAnimations();controller.playBingoAnimation(name,{fade:0,restart:true,after:false});controller.update(0);
  const previous=new Map();let armStep=0,handStep=0;
  for(let i=0;i<=Math.round(seconds*60);i++){
    if(i)controller.update(1/60);
    for(const side of ['L','R'])for(const part of ['UpperArm','Forearm','Hand',...['Index','Middle','Ring','Little','Thumb'].flatMap(label=>[label+'_01',label+'_02'])]){
      const bone=part+'_'+side,obj=root.getObjectByName(bone),finger=fingerRest.has(bone);
      const q=finger?obj.quaternion.clone():obj.getWorldQuaternion(new THREE.Quaternion());
      if(previous.has(bone)){
        const step=THREE.MathUtils.radToDeg(previous.get(bone).angleTo(q));
        if(finger)maxFingerStep=Math.max(maxFingerStep,step);else if(part==='Hand')handStep=Math.max(handStep,step);else armStep=Math.max(armStep,step);
      }
      previous.set(bone,q);
    }
  }
  assert.ok(armStep<10,`${name}: giro brusco de brazo/antebrazo entre medias claves: ${armStep}°`);
  assert.ok(handStep<14,`${name}: giro brusco de mano entre medias claves: ${handStep}°`);
  assert.ok(maxFingerStep<8,`${name}: transiciones de dedos sin saltos: ${maxFingerStep}°`);
  temporalMotion[name]={armHalfFrameDeg:armStep,handHalfFrameDeg:handStep};
}
controller.stopAnimations();controller.playBingoAnimation('SpinDrum',{fade:0,restart:true});controller.update(0);
const base=position('BingoDrum_Base');let maxContact=0,minSeparation=Infinity;
const crankPosture={minHandAheadM:Infinity,minHandleAxisDot:1,minForearmForward:1,minElbowFlexDeg:180,maxElbowFlexDeg:0};
const cage=controller.cage.balls,initialBalls=cage.map(ball=>ball.object.position.clone()),ballMotion=cage.map(()=>0);
assert.equal(cage.length,18);
function validateCage(){
  for(let i=0;i<cage.length;i++){
    const p=cage[i].object.position;
    assert.ok(p.length()+.043<.295,`Bola ${i} contenida en la jaula`);
    assert.ok(Math.hypot(p.y,p.z)>.054,`Bola ${i} separada del eje`);
    for(let j=0;j<i;j++){
      const d=p.distanceTo(cage[j].object.position);minSeparation=Math.min(minSeparation,d);
      assert.ok(d>.081,`Bolas ${i}/${j} separadas: ${d}`);
    }
  }
}
for(let i=0;i<240;i++){
  controller.update(1/48);
  const time=(i+1)/48;
  if(time>=.55&&time<=4.45){
    maxContact=Math.max(maxContact,position('GripSocket_R').distanceTo(meshCenter('BingoDrum_Grip')));
    const shoulder=position('UpperArm_R'),elbow=position('Forearm_R'),hand=position('Hand_R');
    const handRotation=root.getObjectByName('Hand_R').getWorldQuaternion(new THREE.Quaternion());
    const ahead=hand.z-shoulder.z,across=-new THREE.Vector3(1,0,0).applyQuaternion(handRotation).x;
    const forward=new THREE.Vector3(0,1,0).applyQuaternion(handRotation).z;
    const flex=THREE.MathUtils.radToDeg(elbow.clone().sub(shoulder).angleTo(hand.clone().sub(elbow)));
    crankPosture.minHandAheadM=Math.min(crankPosture.minHandAheadM,ahead);
    crankPosture.minHandleAxisDot=Math.min(crankPosture.minHandleAxisDot,across);
    crankPosture.minForearmForward=Math.min(crankPosture.minForearmForward,forward);
    crankPosture.minElbowFlexDeg=Math.min(crankPosture.minElbowFlexDeg,flex);
    crankPosture.maxElbowFlexDeg=Math.max(crankPosture.maxElbowFlexDeg,flex);
    assert.ok(ahead>.005,'Manivela: la muñeca debe permanecer por delante del hombro');
    assert.ok(across>.995,'Manivela: la mano conserva el eje transversal del mango, sin roll antihumano');
    assert.ok(forward>.075,'Manivela: el antebrazo apunta hacia delante durante toda la vuelta');
    assert.ok(elbow.y<shoulder.y+.005&&flex>25&&flex<155,'Manivela: codo bajo y flexión sin inversión');
  }
  assert.ok(position('BingoDrum_Base').distanceTo(base)<1e-6);
  for(let n=0;n<cage.length;n++)ballMotion[n]=Math.max(ballMotion[n],cage[n].object.position.distanceTo(initialBalls[n]));
  validateCage();
}
assert.ok(ballMotion.every(distance=>distance>.03),'Se agitan las 18 bolas, no solo la jaula');
controller.update(.8);const beforeStop=cage.map(ball=>ball.object.position.clone());
controller.playBingoAnimation('Idle',{fade:0});controller.update(0);
assert.ok(cage.every((ball,i)=>ball.object.position.distanceTo(beforeStop[i])<1e-5),'Parar conserva la posición de las bolas, sin salto al reposo');
for(let i=0;i<200;i++){controller.update(1/60);validateCage();}
assert.equal(controller.cage.sleeping,true,'Las bolas se asientan después de girar');
// Entre claves horneadas a 30 fps hay interpolación independiente del brazo y rotor.
assert.ok(maxContact<.001,`Contacto mano/manivela en Three.js: ${maxContact}`);
assert.ok(movement.Idle>.15&&movement.SpinDrum>.15&&movement.Wave>.25&&movement.PickBall>.25&&movement.Celebrate>.35&&movement.Talk>.10,JSON.stringify(movement));
controller.stopAnimations();controller.playBingoAnimation('ShowBall',{fade:0});controller.update(.7);
for(let number=1;number<=90;number++){
  const ball=controller.showBingoBall(number);root.updateMatrixWorld(true);
  assert.equal(ball.userData.number,number);assert.equal(ball.parent,controller.socket);
  assert.ok(ball.getWorldPosition(new THREE.Vector3()).distanceTo(position('BallSocket'))<1e-6);
  const sphere=ball.children.find(child=>child.name.endsWith('_Sphere'));
  assert.ok(sphere?.isMesh);sphere.geometry.computeBoundingSphere();
  assert.ok(sphere.geometry.boundingSphere.radius>.042&&sphere.geometry.boundingSphere.radius<.044);
  const scale=sphere.getWorldScale(new THREE.Vector3());
  assert.ok(scale.toArray().every(value=>Math.abs(value-1)<1e-5),`La bola clonada tiene tamaño visible: escala ${scale.toArray()}, local ${sphere.scale.toArray()}, padre ${ball.scale.toArray()}, socket ${controller.socket.getWorldScale(new THREE.Vector3()).toArray()}`);
  assert.ok(sphere.visible&&ball.visible,'La bola sostenida es visible');
}
assert.throws(()=>controller.showBingoBall(0),RangeError);assert.throws(()=>controller.showBingoBall(91),RangeError);
assert.throws(()=>controller.playBingoAnimation('DoesNotExist'),RangeError);
controller.playBingoAnimation('SpinDrum',{fade:0,restart:true});
assert.equal(controller.selectedBall,null,'Girar la manivela retira la bola que hubiera en la mano');
controller.showBingoBall(28,{at:'pickup'});controller.playBingoAnimation('PickBall',{fade:0,restart:true});
for(let i=0;i<42;i++)controller.update(1/30);
assert.equal(controller.selectedBall.parent,controller.socket);
for(let i=0;i<39;i++)controller.update(1/30);
assert.equal(controller.currentAnimation,'ShowBall');
for(let i=0;i<91;i++)controller.update(1/30);
assert.equal(controller.currentAnimation,'DropBall');
// La cadena ya se comprobó; medir la elevación desde un tiempo conocido del clip.
controller.playBingoAnimation('DropBall',{fade:0,restart:true,after:'Talk'});
controller.update(.45);assert.equal(controller.selectedBall.parent.name,'DropBallSocket');
const releasedHeight=controller.selectedBall.getWorldPosition(new THREE.Vector3()).y;
controller.update(.30);assert.ok(controller.selectedBall.getWorldPosition(new THREE.Vector3()).y>releasedHeight+.08,'La bola asciende antes del destello');
controller.update(.20);assert.ok(root.getObjectByName('DropBall_Star_00').scale.x>.1,'Las estrellas aparecen en DropBall');
const star=root.getObjectByName('DropBall_Star_00');
const starSize=new THREE.Box3().setFromObject(star).getSize(new THREE.Vector3());
assert.ok(Math.max(starSize.x,starSize.y)>.02,`Las estrellas tienen geometría visible: ${starSize.toArray()}`);
const bounds=controller.presentationBounds,camera=createPresenterCamera();fitPresenterCamera(camera,bounds,540,300);
const ray=new THREE.Raycaster();let visibleStars=0;
const visible=object=>{for(let node=object;node;node=node.parent)if(!node.visible)return false;return true;};
for(let i=0;i<9;i++){
  const effect=root.getObjectByName(`DropBall_Star_0${i}`),point=effect.getWorldPosition(new THREE.Vector3());
  const projected=point.project(camera);ray.setFromCamera(new THREE.Vector2(projected.x,projected.y),camera);
  const first=ray.intersectObject(root,true).find(hit=>visible(hit.object)&&hit.object.material?.opacity!==0);
  if(first?.object.userData.drop_effect)visibleStars++;
}
assert.ok(visibleStars>=5,`El destello queda delante del personaje: ${visibleStars}/9 estrellas visibles`);
controller.update(.15);assert.equal(controller.selectedBall,null,'El pop retira la bola');
controller.update(.35);assert.equal(controller.currentAnimation,'Talk');
for(let i=0;i<100;i++)controller.update(1/30);
assert.equal(controller.currentAnimation,'Idle');
controller.updateFromGame({phase:'drawing',roundId:'qa',turn:1,drawEndsAt:Date.now()+5000,drawDurationMs:5000});controller.update(.11);
assert.equal(controller.currentAnimation,'SpinDrum');assert.equal(controller.selectedBall,null);
controller.updateFromGame({phase:'marking',roundId:'qa',turn:1,current:41});controller.update(.1);
assert.equal(controller.currentAnimation,'PickBall');assert.equal(controller.selectedBall.userData.number,41);
controller.updateFromGame({phase:'drawing',roundId:'qa',turn:2,drawEndsAt:Date.now()+5000,drawDurationMs:5000});controller.update(.1);
assert.equal(controller.selectedBall,null,'Un turno nuevo interrumpe la animación anterior');
controller.updateFromGame({phase:'results',roundId:'qa',turn:2});assert.equal(controller.currentAnimation,'Celebrate');
for(let i=0;i<500;i++)controller.update(1/30);
assert.equal(controller.currentAnimation,'Celebrate','La victoria continúa tras más de cinco ciclos');
controller.updateFromGame({phase:'results',roundId:'qa',turn:2});controller.update(.2);
assert.equal(controller.currentAnimation,'Celebrate','Las actualizaciones de resultados mantienen la victoria');
controller.updateFromGame({phase:'drawing',roundId:'new-game',turn:1,drawEndsAt:Date.now()+5000,drawDurationMs:5000});
assert.equal(controller.currentAnimation,'SpinDrum','La nueva partida termina la celebración');
for(const aspect of [.8,1,1.3,1.8,2.8]){
  const framing=fitPresenterCamera(camera,bounds,300*aspect,300);
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const point=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1,'Personaje y bombo completos en el encuadre');
  }
  if(aspect>=1.3)assert.ok(framing.subjectHeight/framing.frameHeight>.85,'El entorno no empequeñece al personaje');
}
controller.stopAnimations();controller.setDrumAngle(.6);assert.ok(root.getObjectByName('BingoDrum_Rotor').quaternion.angleTo(new THREE.Quaternion())>.1);
controller.dispose();controller.dispose();
return {ok:true,bytes:bytes.length,clips:Object.keys(expected),bones:45,skinnedMeshes:skins.length,maxContactErrorM:maxContact,crankPosture,ballNumbersTested:90,animatedCageBalls:18,minCageSeparationM:minSeparation,cageBallMovementM:ballMotion,movement,temporalMotion,restingFingers,maxFingerHalfFrameDeg:maxFingerStep,gameAdapter:true,anatomy:true,drumOnLeft:true,dropBall:true,visibleStars,maxWristTwistDeg:maxWristTwist,maxWristBendDeg:maxWristBend,victoryLoop:true,subjectFraming:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await validateBingoCharacter(),null,2));
