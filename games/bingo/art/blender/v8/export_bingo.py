"""Exportación glTF 2.0 del modelo animado actual."""
import bpy
import json
import struct
from pathlib import Path
from mathutils import Matrix

FOLDER=Path(__file__).resolve().parent
PUBLIC=FOLDER.parents[2]/'public'
GLB=PUBLIC/'assets'/'models'/'bingo_character_animated.glb'


def export_glb(replace=False):
    rig=bpy.data.objects['BingoCharacter_Rig'];rotor=bpy.data.objects['BingoDrum_Rotor']
    scene=bpy.context.scene
    library=bpy.data.objects['BingoBallLibrary'];library_scale=library.scale.copy()
    # Guardar y restaurar la pose: el exportador evalúa NLA, no la pose visible.
    actions={obj.name:obj.animation_data.action if obj.animation_data else None for obj in (rig,rotor)}
    slots={obj.name:obj.animation_data.action_slot if obj.animation_data else None for obj in (rig,rotor)}
    frame=scene.frame_current
    balls=[obj for obj in bpy.data.collections['BingoBalls'].objects if obj.get('animated_cage_ball')]
    ball_state={obj.name:(obj.matrix_basis.copy(),obj.animation_data.action,obj.animation_data.action_slot) for obj in balls}
    for obj in (rig,rotor):
        obj.animation_data.action=None;obj.animation_data.use_nla=False
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    rotor.rotation_quaternion=(1,0,0,0);scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    collections=['BingoCharacter','BingoDrum','BingoBalls','BingoBallLibrary']
    for name in collections:
        for obj in bpy.data.collections[name].objects:obj.hide_set(False);obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    GLB.parent.mkdir(parents=True,exist_ok=True)
    if GLB.exists() and not replace:raise RuntimeError('El GLB ya existe; revisarlo antes de reemplazarlo.')
    properties=bpy.ops.export_scene.gltf.get_rna_type().properties
    settings=dict(filepath=str(GLB),export_format='GLB',use_selection=True,use_active_scene=True,use_visible=False,use_renderable=False,
        export_cameras=False,export_lights=False,export_extras=True,export_yup=True,export_apply=False,
        export_skins=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_merge_animation='NLA_TRACK',
        export_force_sampling=True,export_frame_step=1,export_frame_range=False,export_anim_slide_to_zero=True,
        export_bake_animation=False,export_optimize_animation_size=True,export_anim_single_armature=False)
    settings={key:value for key,value in settings.items() if key in properties}
    try:
        # Evitar matrices singulares: el exportador propaga escala cero a los hijos.
        library.scale=(1,1,1);bpy.context.view_layer.update()
        bpy.ops.export_scene.gltf(**settings)
    finally:
        library.scale=library_scale
        for obj in (rig,rotor):
            obj.animation_data.use_nla=False;obj.animation_data.action=actions[obj.name]
            if slots[obj.name]:obj.animation_data.action_slot=slots[obj.name]
        for obj in bpy.data.collections['BingoBallLibrary'].objects:obj.hide_set(True)
        scene.frame_set(frame);bpy.context.view_layer.update()
        for obj in balls:
            matrix,action,slot=ball_state[obj.name]
            obj.animation_data.use_nla=False;obj.animation_data.action=action
            if slot:obj.animation_data.action_slot=slot
            obj.matrix_basis=matrix
        bpy.context.view_layer.update()
    blob=GLB.read_bytes();magic,version,length=struct.unpack_from('<III',blob)
    assert magic==0x46546C67 and version==2 and length==len(blob)
    json_size,kind=struct.unpack_from('<II',blob,12);assert kind==0x4E4F534A
    data=json.loads(blob[20:20+json_size])
    # Ocultar únicamente la raíz en el GLB ya serializado; prototipos clonables a 1:1.
    library_node=next(n for n in data['nodes'] if n.get('name')=='BingoBallLibrary')
    library_node.pop('matrix',None);library_node['scale']=[0,0,0]
    templates=[n for n in data['nodes'] if n.get('name','').startswith('BingoBallTemplate_')]
    assert templates and all(all(abs(v-1)<1e-5 for v in n.get('scale',[1,1,1])) for n in templates)
    payload=json.dumps(data,separators=(',',':')).encode('utf-8');payload+=b' '*((-len(payload))%4)
    tail=blob[20+json_size:]
    blob=struct.pack('<III',magic,version,20+len(payload)+len(tail))+struct.pack('<II',len(payload),kind)+payload+tail
    GLB.write_bytes(blob)
    names=[a.get('name') for a in data.get('animations',[])]
    expected=['Idle','SpinDrum','PickBall','ShowBall','DropBall','Celebrate','Wave','Talk','DrumSpin']
    assert sorted(names)==sorted(expected),names
    assert data.get('skins') and not data.get('cameras')
    assert len(data['scenes'])==1 and not any(n.get('name')=='Cube' or n.get('name','').startswith('Review_') for n in data['nodes'])
    targets={a['name']:{(ch['target']['node'],ch['target']['path']) for ch in a['channels']} for a in data['animations']}
    assert not targets['SpinDrum']&targets['DrumSpin'],'Canales del brazo y del bombo duplicados.'
    animated_balls={data['nodes'][index]['name'] for index,path in targets['DrumSpin'] if path=='translation' and data['nodes'][index].get('name','').startswith('BingoBall_')}
    assert len(animated_balls)==18,animated_balls
    report={'file':str(GLB),'bytes':len(blob),'clips':names,'skins':len(data['skins']),'nodes':len(data['nodes']),
            'meshes':len(data['meshes']),'cameras':len(data.get('cameras',[])),'spin_tracks_disjoint':True,'animated_cage_balls':len(animated_balls),'ball_templates_unit_scale':True,'model_version':8}
    (FOLDER/'glb-export-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    export_glb(replace=True)
