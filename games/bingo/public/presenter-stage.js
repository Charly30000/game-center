import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createPresenterStage(scene,renderer){
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.65;
  room.dispose();pmrem.dispose();
  const props=new THREE.Group();props.name='BingoTheatre';scene.add(props);
  props.add(new THREE.HemisphereLight(0xffecd1,0x172b44,1.3));
  const key=new THREE.DirectionalLight(0xffdeb0,2.4);key.position.set(-3,4,4);props.add(key);
  const fill=new THREE.DirectionalLight(0xb9d7ff,.8);fill.position.set(3,3,2);props.add(fill);
  const edge=new THREE.DirectionalLight(0xffd77b,1.3);edge.position.set(1,3,-3);props.add(edge);
  const wood=new THREE.Mesh(new THREE.CylinderGeometry(1.16,1.17,.08,64),new THREE.MeshStandardMaterial({color:0x392529,roughness:.78}));
  wood.position.set(.16,-.041,0);props.add(wood);
  const trim=new THREE.Mesh(new THREE.CylinderGeometry(1.18,1.18,.014,64),new THREE.MeshStandardMaterial({color:0xb48532,metalness:.75,roughness:.32}));
  trim.position.set(.16,-.074,0);props.add(trim);
  return {dispose(){props.removeFromParent();props.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});environment.dispose();scene.environment=null;}};
}
