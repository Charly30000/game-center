"""Actualiza únicamente los canales de dedos del archivo editable actual."""
import bpy
import json
import hashlib
from pathlib import Path

FOLDER=Path(__file__).resolve().parent


def load_poses():
    path=FOLDER/'hand_poses.py';ns={'__name__':'hand_poses','__file__':str(path)}
    exec(compile(path.read_text(encoding='utf-8'),str(path),'exec'),ns);return ns


def protected_hash():
    channels=[]
    for action in sorted(bpy.data.actions,key=lambda a:a.name):
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        if curve.data_path.endswith('rotation_quaternion') and any(f'pose.bones["{label}_' in curve.data_path for label in ('Index','Middle','Ring','Little','Thumb')):continue
                        channels.append((action.name,getattr(bag,'slot_handle',0),curve.data_path,curve.array_index,[(tuple(k.co),k.interpolation) for k in curve.keyframe_points]))
    return hashlib.sha256(json.dumps(channels,sort_keys=True).encode()).hexdigest()


def update():
    poses=load_poses();rig=bpy.data.objects['BingoCharacter_Rig'];scene=bpy.context.scene
    before=protected_hash();report={'protected_before_sha256':before,'clips':{}}
    for action in list(bpy.data.actions):
        if action.name=='DrumSpin':continue
        rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0];rig.animation_data.use_nla=False
        end=round(action.frame_range[1]);duration=(end-1)/30;first={};previous={}
        for frame in range(1,end+1):
            scene.frame_set(frame)
            for side in ('L','R'):poses['pose'](rig,action.name,side,(frame-1)/30,duration)
            if frame==1:first={b.name:b.rotation_quaternion.copy() for b in rig.pose.bones if poses['finger_name'](b.name)}
            if frame==end and action.name in ('Idle','SpinDrum','Wave','Celebrate'):
                for name,q in first.items():rig.pose.bones[name].rotation_quaternion=q
            for bone in rig.pose.bones:
                if not poses['finger_name'](bone.name):continue
                q=bone.rotation_quaternion.copy()
                if bone.name in previous:q.make_compatible(previous[bone.name]);bone.rotation_quaternion=q
                previous[bone.name]=q.copy();bone.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=bone.name)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        if any(f'pose.bones["{label}_' in curve.data_path for label in ('Index','Middle','Ring','Little','Thumb')):
                            for key in curve.keyframe_points:key.interpolation='LINEAR'
        action['hand_revision']=8;report['clips'][action.name]={'seconds':duration,'frames':end}
    after=protected_hash();assert before==after,'Se ha alterado un canal ajeno a los dedos'
    report['protected_after_sha256']=after;report['only_finger_channels_changed']=True
    rig['hand_revision']=8;scene['model_version']=8
    action=bpy.data.actions['Idle'];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0];scene.frame_set(1)
    (FOLDER/'hands-update-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))


if __name__=='__main__':update()
