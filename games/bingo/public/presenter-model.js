// Geometría y poses independientes de WebGL: pueden verificarse sin GPU.
export function createPresenterModel(THREE,{woodTexture = null,ballMaterials = null} = {}) {
  const root = new THREE.Group(); root.name = 'bingo-stage';
  const blue = new THREE.MeshStandardMaterial({color:0x3789c9,roughness:.82,metalness:0});
  const dark = new THREE.MeshStandardMaterial({color:0x19334b,roughness:.5});
  const wood = new THREE.MeshStandardMaterial({color:woodTexture ? 0xffffff : 0xc98750,map:woodTexture,roughness:.65});
  const gold = new THREE.MeshStandardMaterial({color:0xc9a457,metalness:.84,roughness:.23});
  const steel = new THREE.MeshStandardMaterial({color:0x949e9e,metalness:.78,roughness:.28});
  const ivory = new THREE.MeshPhysicalMaterial({color:0xfff6df,roughness:.28,clearcoat:.45});
  const sphereGeometry = new THREE.SphereGeometry(1,28,20);
  const boxGeometry = new THREE.BoxGeometry(1,1,1);
  const cylinderGeometry = new THREE.CylinderGeometry(1,1,1,16);
  const vector = (x,y,z) => new THREE.Vector3(x,y,z);
  function sphere(parent,material,x,y,z,sx,sy=sx,sz=sx,name='') {
    const mesh = new THREE.Mesh(sphereGeometry,material); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  function box(parent,material,x,y,z,sx,sy,sz,name='') {
    const mesh = new THREE.Mesh(boxGeometry,material); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
  }
  function rod(parent,material,start,end,radius) {
    const mesh = new THREE.Mesh(cylinderGeometry,material); parent.add(mesh); mesh.castShadow=true;
    mesh.setEndpoints = (from,to) => {
      const direction = to.clone().sub(from);
      mesh.position.copy(from).add(to).multiplyScalar(.5);
      mesh.scale.set(radius,direction.length(),radius);
      mesh.quaternion.setFromUnitVectors(vector(0,1,0),direction.normalize());
    };
    mesh.setEndpoints(start,end); return mesh;
  }
  function arm(name,shoulder) {
    const group = new THREE.Group(); group.name=name; root.add(group);
    function roundedSegment(radius) {
      const mesh=sphere(group,blue,0,0,0,radius);
      mesh.setEndpoints=(from,to)=>{const direction=to.clone().sub(from);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.scale.set(radius,direction.length()*.5+radius*.35,radius);mesh.quaternion.setFromUnitVectors(vector(0,1,0),direction.normalize());};
      return mesh;
    }
    const upper=roundedSegment(.105);
    const lower=roundedSegment(.10);
    sphere(group,blue,shoulder.x,shoulder.y,shoulder.z,.115);
    const joint=sphere(group,blue,0,0,0,.105);
    const hand=new THREE.Group(); hand.name=`${name}-hand`; group.add(hand);
    sphere(hand,blue,0,0,0,.13,.13,.13,`${name}-palm`);
    return {hand,pose(elbow,wrist){upper.setEndpoints(shoulder,elbow);lower.setEndpoints(elbow,wrist);joint.position.copy(elbow);hand.position.copy(wrist);}};
  }
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.8,2.8,.07,64),new THREE.MeshStandardMaterial({color:0xe8e2d2,roughness:1}));
  floor.scale.z=.65; floor.position.y=-.045; floor.receiveShadow=true; floor.name='floor'; root.add(floor);

  const table = new THREE.Group(); table.name='table'; root.add(table);
  const tabletop=box(table,wood,0,1.04,.46,4.3,.14,1.2,'tabletop');
  box(table,wood,0,.92,1.0,4.15,.19,.07,'front-apron');
  for(const x of [-1.92,1.92]) for(const z of [.02,.90]) {
    box(table,wood,x,.49,z,.13,.98,.13);
    sphere(table,wood,x,.045,z,.085,.045,.085);
  }
  const chair=new THREE.Group(); chair.name='chair'; root.add(chair);
  box(chair,wood,1.12,.60,-.69,.85,.12,.85,'chair-seat');
  for(const x of [.80,1.44]) for(const z of [-1.0,-.40]) box(chair,wood,x,.29,z,.09,.58,.09);
  for(const x of [.77,1.47]) box(chair,wood,x,1.00,-1.08,.10,.90,.10);
  for(const y of [.88,1.08,1.28]) box(chair,wood,1.12,y,-1.08,.75,.11,.08);

  const torso=sphere(root,blue,1.12,1.13,-.72,.32,.41,.235,'torso');
  sphere(root,blue,1.12,.73,-.69,.32,.17,.24,'pelvis');
  for(const [side,x] of [['left',.94],['right',1.30]]) {
    const leg=new THREE.Group(); leg.name=`${side}-leg`; root.add(leg);
    rod(leg,blue,vector(x,.73,-.68),vector(x,.66,.20),.125);
    sphere(leg,blue,x,.66,.20,.135);
    rod(leg,blue,vector(x,.64,.20),vector(x,.15,.23),.105);
    sphere(leg,blue,x,.14,.34,.16,.115,.25,`${side}-foot`);
  }
  const head=new THREE.Group(); head.name='head'; head.position.set(1.12,1.83,-.72); root.add(head);
  sphere(head,blue,0,0,0,.46);
  const eyes=[];
  for(const x of [-.14,.14]) {
    const eye=sphere(head,dark,x,.04,.438,.045,.060,.025);eyes.push(eye);
  }
  const smile=new THREE.Mesh(new THREE.TorusGeometry(.12,.016,8,24,Math.PI),dark); smile.rotation.z=Math.PI;smile.position.set(0,-.08,.451);head.add(smile);
  const left=arm('crank-arm',vector(.81,1.43,-.69));
  const right=arm('showing-arm',vector(1.43,1.43,-.69));
  const shownBall=sphere(right.hand,ivory,.02,.17,.02,.13,.13,.13,'shown-ball');

  const machine=new THREE.Group();machine.name='bingo-machine';machine.position.set(-.75,1.84,.40);root.add(machine);
  box(root,gold,-.75,1.16,.40,1.34,.10,.70,'machine-base');
  for(const x of [-1.48,-.02]) {
    box(root,gold,x,1.48,.40,.075,.60,.12);
    sphere(root,steel,x,1.84,.40,.10);
  }
  const rotor=new THREE.Group();rotor.name='rotating-cage';machine.add(rotor);
  const ringGeometry=new THREE.TorusGeometry(.64,.010,8,64);
  for(let i=0;i<14;i++) {
    const ring=new THREE.Mesh(ringGeometry,gold);ring.rotation.y=i*Math.PI/14;rotor.add(ring);
  }
  for(const y of [-.53,-.36,-.18,0,.18,.36,.53]) {
    const ring=new THREE.Mesh(ringGeometry,gold);ring.rotation.x=Math.PI/2;
    const scale=Math.sqrt(.64**2-y**2)/.64;ring.scale.set(scale,scale,1);ring.position.y=y;rotor.add(ring);
  }
  const belt=new THREE.Mesh(new THREE.TorusGeometry(.647,.024,10,64),steel);belt.rotation.y=Math.PI/2;rotor.add(belt);
  rod(machine,steel,vector(-.79,0,0),vector(.86,0,0),.033);
  for(const x of [-.72,.72]) {
    const hub=new THREE.Mesh(new THREE.TorusGeometry(.10,.026,8,24),gold);hub.rotation.y=Math.PI/2;hub.position.x=x;machine.add(hub);
  }
  const crank=new THREE.Group();crank.name='crank';crank.position.x=.86;machine.add(crank);
  rod(crank,gold,vector(0,0,0),vector(0,0,.17),.035);
  rod(crank,wood,vector(0,0,.17),vector(.16,0,.17),.055);
  // Pequeña bandeja de recepción, sin atravesar el cuerpo ni la mesa.
  box(root,gold,.10,1.16,.78,.46,.035,.28,'ball-tray');
  for(const z of [.64,.92]) box(root,gold,.10,1.20,z,.46,.07,.025);
  const palette=ballMaterials || [ivory,new THREE.MeshStandardMaterial({color:0xeaa06c,roughness:.3}),new THREE.MeshStandardMaterial({color:0x58a795,roughness:.3})];
  const ballGeometry=new THREE.SphereGeometry(.095,16,12);
  const balls=Array.from({length:32},(_,i)=>{
    const ball=new THREE.Mesh(ballGeometry,palette[i%palette.length]);ball.castShadow=true;ball.name=`cage-ball-${i}`;machine.add(ball);return ball;
  });
  const restPositions=balls.map((_,i)=>{
    const y=-.46+(i%4)*.105,radius=Math.sqrt(.53**2-y**2)*.9,angle=Math.floor(i/4)*Math.PI/4+(i%2)*.35;
    return vector(Math.sin(angle)*radius,y,Math.cos(angle)*radius);
  });
  let crankAngle=0;
  function pose({time=0,phase='marking',progress=1}={}) {
    const drawing=phase==='drawing';
    torso.scale.y=.41*(1+Math.sin(time*1.5)*.012);
    head.rotation.y=Math.sin(time*.6)*.025;head.rotation.z=Math.sin(time*.8)*.008;
    const blink=time%5.8;const eyelid=blink>5.58?Math.max(.08,Math.abs((blink-5.69)/.11)):1;
    for(const eye of eyes) eye.scale.y=.060*Math.min(1,eyelid);
    if(drawing) crankAngle=time*5;
    crank.rotation.x=crankAngle;rotor.rotation.x=drawing?crankAngle*.75:crankAngle*.75;
    const hand=vector(.11,1.84-Math.sin(crankAngle)*.17,.40+Math.cos(crankAngle)*.17);
    left.pose(vector(.54,1.48,-.13),hand);
    const lift=drawing?THREE.MathUtils.smoothstep(progress,.52,.98):1;
    const wrist=vector(1.70+lift*.22,1.29+lift*.48,.43-lift*.42);
    wrist.y+=drawing?0:Math.sin(time*1.3)*.008;
    right.pose(vector(1.79,1.27+lift*.18,-.20),wrist);
    shownBall.visible=!drawing||progress>.52;
    balls.forEach((ball,i)=>{
      if(drawing){
        const position=vector(Math.sin(time*3+i*2.4)*.45,Math.sin(time*4+i*1.7)*.43,Math.cos(time*2.7+i*2.4)*.42);
        if(position.length()>.53)position.setLength(.53);ball.position.copy(position);
      }else ball.position.lerp(restPositions[i],.08);
    });
    root.updateMatrixWorld(true);
  }
  balls.forEach((ball,i)=>ball.position.copy(restPositions[i]));pose();
  return {root,pose,torso,tabletop,head,balls};
}
