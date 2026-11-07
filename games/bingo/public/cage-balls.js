import * as THREE from 'three';

// El clip agita las bolas. Al pararse, esta simulación pequeña deja que se asienten.
export function createCageBalls(root) {
  const balls=[];
  root.traverse(object=>{
    if(object.userData.animated_cage_ball)balls.push({object,rest:object.position.clone(),rotation:object.quaternion.clone(),velocity:new THREE.Vector3()});
  });
  if(balls.length!==18)throw new Error('El modelo debe contener 18 bolas interiores animables.');
  const delta=new THREE.Vector3(),normal=new THREE.Vector3();
  let sleeping=true,elapsed=0;
  function contacts(){
    for(let pass=0;pass<8;pass++){
      for(let i=0;i<balls.length;i++){
        const a=balls[i],p=a.object.position;
        let radial=Math.hypot(p.y,p.z);
        if(radial<.058){
          normal.set(0,p.y,p.z);if(radial<1e-7)normal.set(0,-1,0);else normal.divideScalar(radial);
          p.y=normal.y*.058;p.z=normal.z*.058;
          const speed=a.velocity.dot(normal);if(speed<0)a.velocity.addScaledVector(normal,-speed*1.3);
        }
        const length=p.length();
        if(length>.251){normal.copy(p).divideScalar(length);p.copy(normal).multiplyScalar(.251);const speed=a.velocity.dot(normal);if(speed>0)a.velocity.addScaledVector(normal,-speed*1.45);}
        for(let j=0;j<i;j++){
          const b=balls[j];delta.copy(p).sub(b.object.position);const distance=delta.length();
          if(distance<.0866){
            normal.copy(delta);if(distance>1e-7)normal.divideScalar(distance);else normal.set(1,0,0);
            const amount=(.0866-distance)*.5;p.addScaledVector(normal,amount);b.object.position.addScaledVector(normal,-amount);
            const speed=delta.copy(a.velocity).sub(b.velocity).dot(normal);
            if(speed<0){a.velocity.addScaledVector(normal,-speed*.62);b.velocity.addScaledVector(normal,speed*.62);}
          }
        }
      }
    }
    for(const a of balls)if(a.object.position.length()>.251)a.object.position.setLength(.251);
  }
  return {
    balls,
    capture(){return balls.map(({object})=>({position:object.position.clone(),quaternion:object.quaternion.clone()}));},
    restore(states){states.forEach((state,i)=>{balls[i].object.position.copy(state.position);balls[i].object.quaternion.copy(state.quaternion);});},
    wake(){sleeping=false;elapsed=0;for(const a of balls)a.velocity.set(0,0,0);},
    reset(){sleeping=true;elapsed=0;for(const a of balls){a.object.position.copy(a.rest);a.object.quaternion.copy(a.rotation);a.velocity.set(0,0,0);}},
    update(seconds){
      if(sleeping||!seconds)return;
      const steps=Math.max(1,Math.ceil(Math.min(seconds,.1)*120)),dt=Math.min(seconds,.1)/steps;
      for(let step=0;step<steps;step++){
        for(const a of balls){a.velocity.y-=2.4*dt;a.velocity.multiplyScalar(Math.exp(-1.8*dt));a.object.position.addScaledVector(a.velocity,dt);a.object.rotateX(a.velocity.z*dt/0.043);a.object.rotateZ(-a.velocity.x*dt/0.043);}
        contacts();
      }
      elapsed+=seconds;
      if(elapsed>3){sleeping=true;for(const a of balls)a.velocity.set(0,0,0);}
    },
    get sleeping(){return sleeping;},
  };
}
