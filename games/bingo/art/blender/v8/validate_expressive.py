"""Verifica pesos, bucles, contacto, pies y accesorios, evaluando todos los frames."""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

FOLDER=Path(__file__).resolve().parent
DURATIONS={'Idle':4.5,'SpinDrum':5,'PickBall':2.6,'ShowBall':3,'DropBall':1.4,'Celebrate':3,'Wave':2.5,'Talk':3.2,'DrumSpin':5}


def use(obj,name):
    obj.animation_data.use_nla=False;obj.animation_data.action=bpy.data.actions[name]
    obj.animation_data.action_slot=obj.animation_data.action.slots[0]


def center(obj):return sum((obj.matrix_world@Vector(v) for v in obj.bound_box),Vector())/8


def activate_balls(enabled):
    root=bpy.data.objects['BingoBalls_Root']
    for ball in bpy.data.collections['BingoBalls'].objects:
        if not ball.get('animated_cage_ball'):continue
        ball.animation_data.use_nla=False
        if enabled:
            strip=ball.animation_data.nla_tracks[0].strips[0]
            ball.animation_data.action=strip.action;ball.animation_data.action_slot=strip.action_slot
        else:
            ball.animation_data.action=None
            matrix=ball.matrix_world.copy();matrix.translation=root.matrix_world@Vector(ball['rest_cage_position']);ball.matrix_world=matrix
            ball.rotation_quaternion=(1,0,0,0)


def audit_animation():
    rig=bpy.data.objects['BingoCharacter_Rig'];rotor=bpy.data.objects['BingoDrum_Rotor'];scene=bpy.context.scene
    report={'bones':len(rig.data.bones),'clips':{},'unweighted_vertices':0,'bad_weight_sums':0,'max_influences':0,'max_hand_joint_gap_m':0,'max_spin_contact_error_m':0,'max_static_part_motion_m':0,'max_accessory_drift':0,'max_wrist_axial_twist_deg':0,'max_wrist_bend_deg':0,'max_arm_rotation_step_deg':0,'collision_samples':[]}
    for obj in bpy.data.collections['BingoCharacter'].objects:
        if obj.type!='MESH' or not any(m.type=='ARMATURE' for m in obj.modifiers):continue
        for vertex in obj.data.vertices:
            values=[g.weight for g in vertex.groups]
            report['max_influences']=max(report['max_influences'],len(values))
            if not values:report['unweighted_vertices']+=1
            if abs(sum(values)-1)>1e-5:report['bad_weight_sums']+=1
    assert not report['unweighted_vertices'] and not report['bad_weight_sums'] and report['max_influences']<=4
    use(rig,'Idle');rotor.animation_data.action=None;rotor.rotation_quaternion=(1,0,0,0);scene.frame_set(1);bpy.context.view_layer.update()
    static={n:bpy.data.objects[n].matrix_world.copy() for n in ['BingoDrum_Base','BingoDrum_Support']}
    headworld=rig.matrix_world@rig.pose.bones['Head'].matrix
    accessories={n:headworld.inverted()@bpy.data.objects[n].matrix_world for n in ['Character_Glasses_Rim_Left','Character_Mustache_Lobe_1','Character_HairBack']}
    endpoints={}
    minimum=Vector((float('inf'),)*3);maximum=Vector((-float('inf'),)*3)
    bound_objects=[o for col in ['BingoCharacter','BingoDrum','BingoBalls'] for o in bpy.data.collections[col].objects if o.type=='MESH']
    for name,seconds in DURATIONS.items():
        if name=='DrumSpin':continue
        activate_balls(name=='SpinDrum')
        use(rig,name)
        if name=='SpinDrum':use(rotor,'DrumSpin')
        else:rotor.animation_data.action=None;rotor.rotation_quaternion=(1,0,0,0)
        end=round(seconds*30)+1;first=None;last=None;foot_positions=[];all_finite=True;previous_rotations={}
        for f in range(1,end+1):
            scene.frame_set(f);bpy.context.view_layer.update()
            matrices={b.name:b.matrix.copy() for b in rig.pose.bones}
            if f==1:first=matrices
            if f==end:last=matrices
            for b in rig.pose.bones:
                all_finite=all_finite and all(math.isfinite(v) for row in b.matrix for v in row)
            for side in ('L','R'):
                gap=(rig.pose.bones['Forearm_'+side].tail-rig.pose.bones['Hand_'+side].head).length
                report['max_hand_joint_gap_m']=max(report['max_hand_joint_gap_m'],gap)
                forearm=rig.pose.bones['Forearm_'+side].matrix.to_3x3();hand=rig.pose.bones['Hand_'+side].matrix.to_3x3()
                axis=forearm.col[1].normalized();a=forearm.col[2].normalized();b=hand.col[2];b-=axis*b.dot(axis)
                report['max_wrist_bend_deg']=max(report['max_wrist_bend_deg'],math.degrees(axis.angle(hand.col[1])))
                if b.length>.001:
                    b.normalize();angle=abs(math.degrees(math.atan2(axis.dot(a.cross(b)),a.dot(b))))
                    report['max_wrist_axial_twist_deg']=max(report['max_wrist_axial_twist_deg'],angle)
                for bone in ['UpperArm_'+side,'Forearm_'+side,'Hand_'+side]:
                    q=rig.pose.bones[bone].matrix.to_quaternion()
                    if bone in previous_rotations:
                        step=math.degrees(previous_rotations[bone].rotation_difference(q).angle);step=min(step,360-step)
                        report['max_arm_rotation_step_deg']=max(report['max_arm_rotation_step_deg'],step)
                    previous_rotations[bone]=q
            headworld=rig.matrix_world@rig.pose.bones['Head'].matrix
            for n,relative in accessories.items():
                actual=headworld.inverted()@bpy.data.objects[n].matrix_world
                report['max_accessory_drift']=max(report['max_accessory_drift'],max(abs(actual[i][j]-relative[i][j]) for i in range(4) for j in range(4)))
            if name=='SpinDrum' and .55<=(f-1)/30<=4.45:
                gap=(center(bpy.data.objects['BingoDrum_Grip'])-bpy.data.objects['GripSocket_R'].matrix_world.translation).length
                report['max_spin_contact_error_m']=max(report['max_spin_contact_error_m'],gap)
            for n,matrix in static.items():
                actual=bpy.data.objects[n].matrix_world
                report['max_static_part_motion_m']=max(report['max_static_part_motion_m'],max(abs(actual[i][j]-matrix[i][j]) for i in range(4) for j in range(4)))
            foot_positions.append([bpy.data.objects['Character_'+s+'Shoe'].matrix_world.translation.copy() for s in ('Left','Right')])
            if f in {round(1+i*(end-1)/12) for i in range(13)}:
                deps=bpy.context.evaluated_depsgraph_get()
                for obj in bound_objects:
                    evaluated=obj.evaluated_get(deps)
                    for corner in evaluated.bound_box:
                        p=evaluated.matrix_world@Vector(corner)
                        for axis in range(3):minimum[axis]=min(minimum[axis],p[axis]);maximum[axis]=max(maximum[axis],p[axis])
            if f in {1,round(end*.25),round(end*.5),round(end*.75),end}:
                deps=bpy.context.evaluated_depsgraph_get()
                # Se excluyen hombros: su solape con la camisa es intencionado.
                for limb in ('Character_LeftHandMesh','Character_RightHandMesh','Character_LeftForearm','Character_RightForearm'):
                    ob=bpy.data.objects[limb];lm=ob.evaluated_get(deps).to_mesh()
                    tree=BVHTree.FromPolygons([ob.matrix_world@v.co for v in lm.vertices],[list(p.vertices) for p in lm.polygons])
                    ob.evaluated_get(deps).to_mesh_clear()
                    for n in ('Character_Body','Character_Head'):
                        body=bpy.data.objects[n];me=body.evaluated_get(deps).to_mesh()
                        bt=BVHTree.FromPolygons([body.matrix_world@v.co for v in me.vertices],[list(p.vertices) for p in me.polygons])
                        body.evaluated_get(deps).to_mesh_clear()
                        if tree.overlap(bt):report['collision_samples'].append({'clip':name,'frame':f,'limb':limb,'body':n})
        assert all_finite
        loop_error=max(abs(first[n][i][j]-last[n][i][j]) for n in first for i in range(4) for j in range(4))
        foot_drift=max((p[i]-foot_positions[0][i]).length for p in foot_positions for i in range(2))
        report['clips'][name]={'seconds':seconds,'evaluated_frames':end,'loop_matrix_error':loop_error,'foot_motion_m':foot_drift}
        if name in ('Idle','SpinDrum','Wave','Celebrate'):assert loop_error<1e-5,(name,loop_error)
        if name!='Celebrate':assert foot_drift<1e-5,(name,foot_drift)
        if name=='PickBall':endpoints['pick_end']=bpy.data.objects['BallSocket'].matrix_world.translation.copy()
        if name=='ShowBall':
            scene.frame_set(1);bpy.context.view_layer.update();endpoints['show_start']=bpy.data.objects['BallSocket'].matrix_world.translation.copy()
    report['pick_to_show_socket_error_m']=(endpoints['pick_end']-endpoints['show_start']).length
    report['max_unreachable_target_m']=json.loads((FOLDER/'choreography-report.json').read_text())['maximum_unreachable_m']
    assert report['max_hand_joint_gap_m']<1e-5 and report['max_spin_contact_error_m']<1e-5
    assert report['max_accessory_drift']<1e-5 and report['max_static_part_motion_m']<1e-5
    assert report['pick_to_show_socket_error_m']<1e-5
    assert report['max_unreachable_target_m']==0
    assert report['max_wrist_axial_twist_deg']<.1,report['max_wrist_axial_twist_deg']
    assert report['max_wrist_bend_deg']<70.01,report['max_wrist_bend_deg']
    assert report['max_arm_rotation_step_deg']<25,report['max_arm_rotation_step_deg']
    report['max_anchor_error_m']=rig['max_anchor_error_m']
    assert not report['collision_samples'],report['collision_samples']
    report['clips']['DrumSpin']={'seconds':5,'turns':1,'axis':'X','loop':True}
    use(rig,'Idle');activate_balls(False);rotor.animation_data.action=None;rotor.rotation_quaternion=(1,0,0,0);scene.frame_set(1)
    bpy.context.view_layer.update()
    anatomy={}
    for side,sign in [('L',1),('R',-1)]:
        hand=rig.pose.bones['Hand_'+side]
        dorsal=hand.matrix.to_3x3()@Vector((0,0,1))
        thumb=rig.pose.bones['Thumb_02_'+side].tail-hand.head
        anatomy[side]={'dorsal_outward_dot':dorsal.dot(Vector((sign,0,0))),'thumb_forward_y':thumb.y}
        assert anatomy[side]['dorsal_outward_dot']>.9 and thumb.y<-.01,anatomy[side]
    report['neutral_hand_anatomy']=anatomy
    assert bpy.data.objects['BingoDrum_Root'].matrix_world.translation.x<bpy.data.objects['Character_Root'].matrix_world.translation.x
    report['drum_on_viewer_left']=True
    bounds={'min':[minimum.x-.03,minimum.z-.03,-maximum.y-.03],'max':[maximum.x+.03,maximum.z+.03,-minimum.y+.03]}
    report['presentation_bounds_three']=bounds
    bpy.data.objects['Character_Root']['presentation_bounds']=json.dumps(bounds)
    (FOLDER/'animation-validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))
    return report


if __name__=='__main__':audit_animation()
