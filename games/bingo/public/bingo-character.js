import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCageBalls } from './cage-balls.js';
import { bingoNumberText, createVisemes, sampleViseme } from './bingo-speech.js';

const LOOPS = new Set(['Idle','SpinDrum','Wave','DrumSpin','Celebrate']);
const NEXT = {PickBall:'ShowBall',ShowBall:'DropBall',DropBall:'Talk',Talk:'Idle'};
const MODEL_URL = new URL('./assets/models/bingo_character_animated.glb?v=8',import.meta.url).href;
let defaultController;

export async function loadBingoCharacter({url=MODEL_URL,scene,camera,...options}={}) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const controller = createBingoCharacter(gltf,{camera,...options});
  scene?.add(controller.root);
  defaultController = controller;
  return controller;
}

export function playBingoAnimation(name,options) {
  if (!defaultController) throw new Error('Carga primero el personaje con loadBingoCharacter().');
  return defaultController.playBingoAnimation(name,options);
}

export function showBingoBall(number,options) {
  if (!defaultController) throw new Error('Carga primero el personaje con loadBingoCharacter().');
  return defaultController.showBingoBall(number,options);
}

// Separado de WebGL: el mismo controlador se verifica con GLTFLoader en Node.
export function createBingoCharacter(gltf,{camera,autoPlay=true,onAnimationChange=()=>{},onAnimationFrame=()=>{},speech}={}) {
  const root = gltf.scene;
  if (!root) throw new Error('El GLB no contiene una escena.');
  const clips = new Map(gltf.animations.map(clip=>[clip.name,clip]));
  const required = name => {
    const object = root.getObjectByName(name);
    if (!object) throw new Error(`Falta ${name} en el GLB.`);
    return object;
  };
  const socket = required('BallSocket'), rotor = required('BingoDrum_Rotor');
  const pickup = required('BallPickupPoint'), library = required('BingoBallLibrary');
  const dropSocket=required('DropBallSocket'),jaw=required('Jaw'),stars=[];
  root.traverse(object=>{if(object.userData.drop_effect)stars.push(object);});
  // Oro legible sobre el fondo marfil, sin que las luces del escenario lo quemen.
  const starMaterial=new THREE.MeshBasicMaterial({color:0xe7a014,side:THREE.DoubleSide,toneMapped:false});
  const previousStarMaterials=new Set();
  for(const star of stars){previousStarMaterials.add(star.material);star.material=starMaterial;}
  for(const material of previousStarMaterials)material.dispose();
  const declaredBounds=JSON.parse(required('Character_Root').userData.presentation_bounds);
  const presentationBounds=new THREE.Box3(new THREE.Vector3().fromArray(declaredBounds.min),new THREE.Vector3().fromArray(declaredBounds.max));
  library.visible = false;
  const mixer = new THREE.AnimationMixer(root), clock = new THREE.Clock();
  const cage=createCageBalls(root);
  const actions = new Map(), retiring = [];
  const rotorRest = rotor.quaternion.clone();
  const vector = new THREE.Vector3(), quaternion = new THREE.Quaternion(), rootQuaternion = new THREE.Quaternion();
  let current, currentName, followup, pendingFinish, drumAction, warmup=0;
  let ball, ballAt, removeBallIn=null, disposed=false, gameStateKey, gameDrawEndsAt=null, gameDrawDurationMs=5000;
  let ballMaterials=[],announcement=createVisemes('El número veintiocho'),lastNumber=null;

  function actionFor(name) {
    if (!clips.has(name)) throw new RangeError(`Animación desconocida: ${name}. Disponibles: ${[...clips.keys()].join(', ')}.`);
    if (!actions.has(name)) actions.set(name,mixer.clipAction(clips.get(name)));
    return actions.get(name);
  }
  function configure(action,name,{loop=LOOPS.has(name),timeScale=1}={}) {
    action.reset();action.enabled=true;action.clampWhenFinished=!loop;
    action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);
    action.setEffectiveWeight(1);action.setEffectiveTimeScale(timeScale);action.play();
    return action;
  }
  function stopDrum() {
    if (drumAction) {
      const heldRotation=rotor.quaternion.clone(),heldBalls=cage.capture();
      drumAction.stop();drumAction=null;rotor.quaternion.copy(heldRotation);cage.restore(heldBalls);cage.wake();
    }
    warmup=0;
  }
  function playBingoAnimation(name,{fade=.22,restart=false,after,...options}={}) {
    if (disposed) throw new Error('El personaje ya está liberado.');
    const next = actionFor(name);
    gameDrawEndsAt=null;
    if (name==='DrumSpin') {
      drumAction=configure(next,name,options);return next;
    }
    if (current===next&&!restart) return next;
    const previous=current;
    current=configure(next,name,options);currentName=name;pendingFinish=null;
    followup=after===false?null:(after??NEXT[name]??(LOOPS.has(name)?null:'Idle'));
    if (previous&&previous!==next&&fade>0) {
      previous.crossFadeTo(next,fade,false);retiring.push({action:previous,remaining:fade});
    } else if (previous&&previous!==next) previous.stop();
    if (name==='SpinDrum') {
      removeBingoBall();
      // El giro espera al contacto durante la transición; ambos clips parten de la misma fase.
      const phase=drumAction?.time??0;
      drumAction=configure(actionFor('DrumSpin'),'DrumSpin',options);
      current.time=phase%current.getClip().duration;drumAction.time=current.time;
      warmup=previous&&fade>0?fade:0;current.paused=warmup>0;drumAction.paused=warmup>0;
      if(fade>0)drumAction.fadeIn(fade);
    } else stopDrum();
    if (name==='PickBall'&&ball) placeAtPickup();
    if (name==='ShowBall'&&ball) attachBall();
    if (name==='DropBall'&&ball) attachBall();
    if (name==='Talk') announcement=createVisemes(lastNumber===null?'¡Hola! Qué alegría veros.':`Marca tus números y pulsa continuar`);
    if (name==='ShowBall'&&lastNumber!==null) announcement=createVisemes(`El número ${bingoNumberText(lastNumber)}`);
    if (name==='Idle'&&ball) removeBallIn=fade;
    onAnimationChange(name);
    return next;
  }
  function removeBingoBall() {
    ball?.removeFromParent();ball=null;ballAt=null;removeBallIn=null;
    for(const material of ballMaterials)material.dispose();ballMaterials=[];
  }
  function attachBall() {
    if (!ball) return;
    socket.add(ball);ball.position.set(0,0,0);ball.quaternion.identity();ball.scale.setScalar(1);
    ballAt='socket';removeBallIn=null;
  }
  function placeAtPickup() {
    if (!ball) return;
    root.updateMatrixWorld(true);root.add(ball);
    ball.position.copy(root.worldToLocal(pickup.getWorldPosition(vector)));
    ball.quaternion.identity();ball.scale.setScalar(1);ballAt='pickup';removeBallIn=null;
  }
  function showBingoBall(number,{at='socket'}={}) {
    if (disposed) throw new Error('El personaje ya está liberado.');
    if (!Number.isInteger(number)||number<1||number>90) throw new RangeError('El número debe ser un entero del 1 al 90.');
    if (!['socket','pickup'].includes(at)) throw new RangeError('La posición debe ser socket o pickup.');
    const template=required(`BingoBallTemplate_${String(number).padStart(3,'0')}`);
    removeBingoBall();ball=template.clone(true);ball.name='HeldBingoBall';ball.userData.number=number;
    lastNumber=number;const copies=new Map();
    ball.traverse(object=>{if(!object.isMesh)return;const copy=material=>{if(!copies.has(material))copies.set(material,material.clone());return copies.get(material);};object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);});
    ballMaterials=[...copies.values()];
    ball.visible=true;ball.scale.setScalar(1);
    if (at==='pickup') placeAtPickup();else attachBall();
    orientBall();return ball;
  }
  function orientBall() {
    if (!ball||!['socket','drop'].includes(ballAt)) return;
    // Mantener el número derecho aunque la muñeca gire. Las mallas siguen en la mano.
    root.updateMatrixWorld(true);
    if (camera) ball.lookAt(camera.getWorldPosition(vector));
    else ball.quaternion.copy(ball.parent.getWorldQuaternion(quaternion).invert()).multiply(root.getWorldQuaternion(rootQuaternion));
  }
  mixer.addEventListener('finished',event=>{
    if (event.action===current) pendingFinish={action:event.action,next:followup};
  });
  function update(delta=clock.getDelta()) {
    if (disposed) return;
    if (!Number.isFinite(delta)||delta<0) throw new RangeError('Delta de animación no válido.');
    if (warmup>0) {
      warmup=Math.max(0,warmup-delta);
      if (!warmup) { current.paused=false;drumAction.paused=false; }
    }
    mixer.update(delta);
    if(!drumAction)cage.update(delta);
    if (currentName==='SpinDrum'&&drumAction) {
      if (gameDrawEndsAt!==null) {
        const progress=THREE.MathUtils.clamp(1-(gameDrawEndsAt-Date.now())/gameDrawDurationMs,0,1);
        current.time=progress*current.getClip().duration;
      }
      drumAction.time=current.time;drumAction.setEffectiveTimeScale(current.getEffectiveTimeScale());
      mixer.update(0);
    }
    if (currentName==='PickBall'&&ball&&ballAt==='pickup'&&current.time>=1.3) attachBall();
    if(currentName==='DropBall'&&ball){
      const time=current.time;
      if(time>=.4&&ballAt!=='drop'){dropSocket.add(ball);ball.position.set(0,0,0);ball.quaternion.identity();ballAt='drop';}
      const glow=THREE.MathUtils.smoothstep(time,.4,.85),opacity=1-THREE.MathUtils.smoothstep(time,.88,1.05);
      for(const material of ballMaterials){material.transparent=true;material.opacity=opacity;material.emissive?.setRGB(glow*.9,glow*.5,glow*.04);material.emissiveIntensity=1.5;}
      if(time>=1.05)removeBingoBall();
    }
    onAnimationFrame(currentName,current?.time??0);
    const spoken=speech?.();
    if(currentName==='Talk'||currentName==='ShowBall'||currentName==='Celebrate'&&spoken?.pending){
      const viseme=spoken??sampleViseme(announcement,current.time/current.getClip().duration);
      jaw.scale.x=viseme.width;jaw.scale.y=viseme.open;
      // Mantener la pose final mientras acaba la frase; nunca retrasar el servidor.
      if(currentName!=='Celebrate') {
        if(viseme.pending&&pendingFinish?.action===current)pendingFinish=null;
        else if(!viseme.pending&&current.paused&&followup)pendingFinish={action:current,next:followup};
      }
    }
    for (let i=retiring.length-1;i>=0;i--) {
      retiring[i].remaining-=delta;
      if (retiring[i].remaining<=0) {
        if (retiring[i].action!==current) retiring[i].action.stop();
        retiring.splice(i,1);
      }
    }
    if (removeBallIn!==null) { removeBallIn-=delta;if(removeBallIn<=0)removeBingoBall(); }
    const done=pendingFinish;pendingFinish=null;
    if (done?.action===current&&done.next) playBingoAnimation(done.next);
    orientBall();root.updateMatrixWorld(true);
  }
  function stopAnimations() {
    mixer.stopAllAction();current=null;currentName=null;drumAction=null;pendingFinish=null;warmup=0;
    gameDrawEndsAt=null;retiring.length=0;
    cage.reset();
    for(const star of stars)star.scale.setScalar(0);
  }
  function setDrumAngle(radians) {
    if (!Number.isFinite(radians)) throw new RangeError('Ángulo no válido.');
    if (currentName==='SpinDrum') throw new Error('Detén SpinDrum antes de controlar el pivote manualmente.');
    stopDrum();
    rotor.quaternion.copy(rotorRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),radians));
  }
  function updateFromGame(state) {
    // El servidor elige el número y el ritmo. Las animaciones nunca retrasan una partida.
    const key=`${state.roundId}:${state.turn}:${state.phase}`;
    if (key===gameStateKey) return;
    gameStateKey=key;gameDrawEndsAt=null;
    if (state.phase==='drawing') {
      gameDrawDurationMs=Number.isFinite(state.drawDurationMs)&&state.drawDurationMs>0?state.drawDurationMs:5000;
      removeBingoBall();playBingoAnimation('SpinDrum',{fade:.15,restart:true,timeScale:5/(gameDrawDurationMs/1000)});
      gameDrawEndsAt=Number.isFinite(state.drawEndsAt)?state.drawEndsAt:null;
    } else if (state.phase==='marking') {
      showBingoBall(state.current,{at:'pickup'});
      playBingoAnimation('PickBall',{restart:true,after:'ShowBall'});
    } else if (state.phase==='results') {
      removeBingoBall();playBingoAnimation('Celebrate',{restart:true,loop:true,after:false});
    } else {
      removeBingoBall();playBingoAnimation('Idle');
    }
  }
  function dispose() {
    if (disposed) return;
    stopAnimations();removeBingoBall();mixer.uncacheRoot(root);clock.stop();root.removeFromParent();
    const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
    root.traverse(object=>{
      if (object.geometry)geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[])materials.add(material);
      if (object.skeleton)skeletons.add(object.skeleton);
    });
    for (const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());textures.forEach(item=>item.dispose());skeletons.forEach(item=>item.dispose());
    disposed=true;if(defaultController?.root===root)defaultController=null;
  }
  const controller={root,mixer,clock,rotor,socket,pickup,cage,presentationBounds,clips:Object.freeze([...clips.keys()]),
    playBingoAnimation,showBingoBall,removeBingoBall,update,stopAnimations,setDrumAngle,updateFromGame,dispose,
    get currentAnimation(){return currentName;},get animationTime(){return current?.time??0;},get selectedBall(){return ball;}};
  if(autoPlay)playBingoAnimation('Idle',{fade:0});
  return controller;
}
