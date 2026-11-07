"""Anatomía de la manivela: postura, bisagra del codo y eje de agarre."""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector


def audit():
    scene=bpy.context.scene;rig=bpy.data.objects['BingoCharacter_Rig'];rotor=bpy.data.objects['BingoDrum_Rotor']
    for obj,name in [(rig,'SpinDrum'),(rotor,'DrumSpin')]:
        action=bpy.data.actions[name];obj.animation_data.action=action;obj.animation_data.action_slot=action.slots[0];obj.animation_data.use_nla=False
    r={'samples':301,'character_root':list(bpy.data.objects['Character_Root'].location),'min_hand_ahead_m':10,'min_hand_across_dot':1,'min_forearm_forward':1,'elbow_flex_deg':[180,0],'min_elbow_below_m':10,'hand_pitch_deg':[180,-180],'min_elbow_hinge_sign':1}
    pitches=[]
    for i in range(301):
        f=1+i/2;scene.frame_set(math.floor(f),subframe=f%1);bpy.context.view_layer.update()
        s=rig.pose.bones['UpperArm_R'].head;e=rig.pose.bones['Forearm_R'].head;h=rig.pose.bones['Hand_R'].head
        u=(e-s).normalized();v=(h-e).normalized();m=rig.pose.bones['Hand_R'].matrix.to_3x3()
        r['min_hand_ahead_m']=min(r['min_hand_ahead_m'],s.y-h.y)
        r['min_hand_across_dot']=min(r['min_hand_across_dot'],-m.col[0].x)
        r['min_forearm_forward']=min(r['min_forearm_forward'],-m.col[1].y)
        r['min_elbow_below_m']=min(r['min_elbow_below_m'],s.z-e.z)
        flex=math.degrees(u.angle(v));r['elbow_flex_deg']=[min(r['elbow_flex_deg'][0],flex),max(r['elbow_flex_deg'][1],flex)]
        r['min_elbow_hinge_sign']=min(r['min_elbow_hinge_sign'],-u.cross(v).normalized().x)
        pitch=math.degrees(math.atan2(m.col[1].z,-m.col[1].y));pitches.append(pitch)
    r['hand_pitch_deg']=[min(pitches),max(pitches)];r['hand_pitch_span_deg']=max(pitches)-min(pitches)
    r['pitch_loop_error_deg']=abs(pitches[0]-pitches[-1])
    assert r['min_hand_ahead_m']>.005,r
    assert r['min_hand_across_dot']>.995,r
    assert r['min_forearm_forward']>.075,r
    assert r['min_elbow_below_m']>-.005 and 25<r['elbow_flex_deg'][0]<r['elbow_flex_deg'][1]<155,r
    # El húmero tiene separación lateral; el plano no necesita ser paralelo a X,
    # pero su signo debe mantenerse y nunca pasar al lado de hiperextensión.
    assert r['min_elbow_hinge_sign']>.05 and r['hand_pitch_span_deg']<100 and r['pitch_loop_error_deg']<.01,r
    r['ok']=True
    (Path(__file__).resolve().parent/'crank-anatomy-validation.json').write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8');print(json.dumps(r))
    return r


if __name__=='__main__':audit()
