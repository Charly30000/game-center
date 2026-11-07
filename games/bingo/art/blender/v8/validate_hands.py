"""Comprueba cascada de reposo, continuidad y cierres de los dedos horneados."""
import bpy
import math
import json
from pathlib import Path

FOLDER=Path(__file__).resolve().parent


def validate():
    rig=bpy.data.objects['BingoCharacter_Rig'];scene=bpy.context.scene
    report={'rest':{},'clips':{}}
    labels=('Index','Middle','Ring','Little','Thumb')
    names=[f'{label}_{joint:02}_{side}' for side in ('L','R') for label in labels for joint in (1,2)]
    for action in bpy.data.actions:
        if action.name=='DrumSpin':continue
        rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
        end=round(action.frame_range[1]);previous={};first={};step=0
        for frame in range(1,end+1):
            scene.frame_set(frame)
            if frame==1:first={n:rig.pose.bones[n].rotation_quaternion.copy() for n in names}
            if action.name=='Idle' and frame==1:
                for side in ('L','R'):
                    angles=[-math.degrees(rig.pose.bones[f'{label}_01_{side}'].rotation_quaternion.to_euler('XYZ').x) for label in labels[:4]]
                    assert 12<angles[0] and angles[-1]<40
                    assert all(b-a>2 for a,b in zip(angles,angles[1:]))
                    hand=rig.pose.bones['Hand_'+side]
                    tips=[(hand.matrix.inverted()@rig.pose.bones[f'{label}_02_{side}'].tail).z for label in labels[:4]]
                    assert all(z<0 for z in tips),'Los dedos deben flexionar hacia la palma'
                    report['rest'][side]={'proximal_flex_deg':angles,'tip_palmward_z_m':tips}
            for name in names:
                q=rig.pose.bones[name].rotation_quaternion.copy()
                if name in previous:step=max(step,math.degrees(previous[name].rotation_difference(q).angle))
                previous[name]=q
        assert step<12,(action.name,step)
        loop=max(math.degrees(first[n].rotation_difference(previous[n]).angle) for n in names)
        if action.name in ('Idle','SpinDrum','Wave','Celebrate'):assert loop<.01
        report['clips'][action.name]={'max_frame_rotation_deg':step,'end_start_rotation_deg':loop}
    report['ok']=True
    (FOLDER/'hands-validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report))


if __name__=='__main__':validate()
