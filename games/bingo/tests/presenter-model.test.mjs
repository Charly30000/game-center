import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPresenterModel } from '../public/presenter-model.js';

test('el cuerpo queda detrás de la mesa en extracción y espera',()=>{
  const model=createPresenterModel(THREE);
  for(const phase of ['drawing','marking'])for(let step=0;step<=20;step++){
    model.pose({time:step*.25,phase,progress:step/20});
    const body=new THREE.Box3().setFromObject(model.torso),table=new THREE.Box3().setFromObject(model.tabletop);
    assert.equal(body.intersectsBox(table),false,`${phase} / ${step}`);
    assert.ok(body.max.z<table.min.z,'El cuerpo está detrás del borde posterior');
  }
  for(const name of ['chair','left-leg','right-leg','left-foot','right-foot','crank','ball-tray'])assert.ok(model.root.getObjectByName(name),name);
  for(const name of ['crank-arm-hand','showing-arm-hand']){
    const hand=model.root.getObjectByName(name),palm=hand.children.filter(child=>child.name.endsWith('-palm'));
    assert.equal(palm.length,1);assert.equal(palm[0].geometry.type,'SphereGeometry');
    assert.equal(hand.children.filter(child=>child.material===palm[0].material).length,1,'La mano es una única pelota sin dedos');
  }
});
test('las bolas permanecen dentro del bombo y la pose de espera tiene animación',()=>{
  const model=createPresenterModel(THREE);
  for(let step=0;step<60;step++){
    model.pose({time:step*.05,phase:'drawing',progress:step/60});
    assert.ok(model.balls.every(ball=>ball.position.length()+ball.geometry.parameters.radius<.64));
  }
  model.pose({time:0,phase:'marking'});const first=model.head.rotation.y;
  model.pose({time:1,phase:'marking'});assert.notEqual(model.head.rotation.y,first);
});
