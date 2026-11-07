import * as THREE from 'three';

export function createPresenterCamera(){return new THREE.OrthographicCamera(-1,1,1,-1,.01,30);}

// Se encuadran personaje y bombo. La profundidad del decorado no reduce su tamaño.
export function fitPresenterCamera(camera,bounds,width,height){
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  camera.position.copy(center).add(new THREE.Vector3(0,.045,1).normalize().multiplyScalar(8));camera.lookAt(center);camera.updateMatrixWorld(true);
  const projected=new THREE.Box3();
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  const view=projected.getSize(new THREE.Vector3()),aspect=width/height,frameHeight=Math.max(view.y,view.x/aspect)*1.04;
  camera.left=-frameHeight*aspect/2;camera.right=frameHeight*aspect/2;
  camera.top=frameHeight/2;camera.bottom=-frameHeight/2;
  camera.updateProjectionMatrix();
  return {frameHeight,subjectHeight:size.y};
}
