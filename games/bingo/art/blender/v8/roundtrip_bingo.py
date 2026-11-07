"""Reimporta el GLB final, evalúa los clips y retira solo los IDs de esa prueba."""
import bpy
import json
import hashlib
from pathlib import Path
from mathutils import Vector

FOLDER=Path(__file__).resolve().parent
GLB=FOLDER.parents[2]/'public'/'assets'/'models'/'bingo_character_animated.glb'


def roundtrip():
    original=bpy.context.scene
    before={kind:set(getattr(bpy.data,kind).keys()) for kind in ['objects','meshes','materials','armatures','actions','collections']}
    scene=bpy.data.scenes.new('Bingo_GLB_Final_Check');bpy.context.window.scene=scene;scene.render.fps=30
    report={'reimported':True,'file_sha256':hashlib.sha256(GLB.read_bytes()).hexdigest(),'clips':{},'max_spin_contact_error_m':0}
    try:
        bpy.ops.import_scene.gltf(filepath=str(GLB))
        rig=next(o for o in scene.objects if o.type=='ARMATURE')
        rotor=next(o for o in scene.objects if o.name.startswith('BingoDrum_Rotor'))
        grip=next(o for o in scene.objects if o.name.startswith('BingoDrum_Grip') and not o.name.startswith('BingoDrum_GripAxle'))
        socket=next(o for o in scene.objects if o.name.startswith('GripSocket_R'))
        tracks={t.name:t.strips[0] for t in rig.animation_data.nla_tracks}
        drum=next(t.strips[0] for t in rotor.animation_data.nla_tracks if t.name=='DrumSpin')
        report['bones']=len(rig.data.bones)
        report['skinned_meshes']=sum(o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers) for o in scene.objects)
        for name,strip in tracks.items():
            rig.animation_data.use_nla=False;rig.animation_data.action=strip.action;rig.animation_data.action_slot=strip.action_slot
            rotor.animation_data.use_nla=False;rotor.animation_data.action=None;rotor.rotation_mode='QUATERNION';rotor.rotation_quaternion=(1,0,0,0)
            if name=='SpinDrum':rotor.animation_data.action=drum.action;rotor.animation_data.action_slot=drum.action_slot
            end=round(strip.action.frame_range[1]);start=None;motion=0
            for frame in range(end+1):
                scene.frame_set(frame);bpy.context.view_layer.update()
                p=rig.pose.bones['Hand_L' if name=='Wave' else 'Hand_R'].head.copy()
                if start is None:start=p
                motion=max(motion,(p-start).length)
                if name=='SpinDrum' and .55<=frame/30<=4.45:
                    center=sum((grip.matrix_world@Vector(v) for v in grip.bound_box),Vector())/8
                    report['max_spin_contact_error_m']=max(report['max_spin_contact_error_m'],(socket.matrix_world.translation-center).length)
            report['clips'][name]={'frames':end+1,'seconds':end/30,'hand_motion_m':motion}
        report['clips']['DrumSpin']={'seconds':5,'independent_rotor_track':True}
        assert len(report['clips'])==9 and report['bones']==45 and report['skinned_meshes']==19
        assert report['max_spin_contact_error_m']<1e-5
        (FOLDER/'glb-roundtrip-validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    finally:
        created={kind:set(getattr(bpy.data,kind).keys())-names for kind,names in before.items()}
        bpy.context.window.scene=original
        for name in created['objects']:
            obj=bpy.data.objects.get(name)
            if obj:bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.scenes.remove(scene)
        for kind in ['actions','collections','meshes','armatures','materials']:
            for name in created[kind]:
                block=getattr(bpy.data,kind).get(name)
                if block and (block.users==0 or kind=='actions'):getattr(bpy.data,kind).remove(block)
    print(json.dumps(report,indent=2))
    return report


if __name__=='__main__':roundtrip()
