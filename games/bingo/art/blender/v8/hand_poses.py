"""Dedos en reposo, gestos y agarres; no altera brazos ni muñecas."""
import math
from mathutils import Vector,Quaternion

LONG=('Index','Middle','Ring','Little')
# Flexión proximal/distal, en grados, para las dos falanges del rig estilizado.
PROFILES={
    'rest':[(18,22),(22,28),(26,33),(30,38)],
    'present':[(12,16),(16,20),(20,24),(24,28)],
    'wave':[(10,14),(14,18),(18,22),(22,26)],
    'grip':[(34,45),(38,49),(42,53),(46,57)],
    'ball':[(14,20),(17,24),(20,27),(22,29)],
    'point':[(8,10),(30,42),(34,46),(38,50)],
    'fist':[(42,55),(46,59),(50,63),(54,67)],
}
# Flexión base/punta, aducción y oposición: el pulgar tiene su propio gesto.
THUMBS={
    'rest':(6,10,12,8),'present':(5,8,10,6),'wave':(5,9,10,8),
    'grip':(12,24,22,18),'ball':(8,18,20,16),
    'point':(8,14,16,12),'fist':(12,20,22,20),
}


def smooth(x):
    x=max(0.,min(1.,x));return x*x*x*(x*(x*6-15)+10)


def keys(t,points):
    for (a,v),(b,w) in zip(points,points[1:]):
        if t<=b:return v+(w-v)*smooth((t-a)/(b-a))
    return points[-1][1]


def blend(a,b,w):return [v+(u-v)*w for v,u in zip(a,b)]


def weights(name,side,t):
    target='rest';w=0.;point=0.
    if name=='Idle':target='present';w=keys(t,[(0,0),(1,0),(2.15,.7),(3.5,0),(4.5,0)])
    elif name=='SpinDrum':
        if side=='R':target='grip';w=keys(t,[(0,.05),(.5,1),(4.45,1),(5,.05)])
        else:target='present';w=keys(t,[(0,0),(1,.1),(2.5,.5),(3.5,.25),(5,0)])
    elif name=='Wave' and side=='L':target='wave';w=keys(t,[(0,0),(.4,.4),(.8,1),(1.9,1),(2.5,0)])
    elif name=='PickBall' and side=='R':
        target='present';w=keys(t,[(0,0),(.8,1),(1.15,1),(1.45,0),(2.6,0)])
    elif name=='ShowBall':
        if side=='R':target='ball';w=1.
        else:target='present';w=keys(t,[(0,0),(.8,.6),(1.6,1),(2.4,1),(3,.15)])
    elif name=='DropBall':target='present';w=keys(t,[(0,0),(.4,.7),(.7,1),(1.4,0)])
    elif name=='Talk':
        target='present';w=keys(t,[(0,0),(.4,.25),(.8,.6),(1.4,1),(2,.75),(2.8,.15),(3.2,0)])
        if side=='L':point=math.exp(-((t-1.4)/.28)**2)
    elif name=='Celebrate':
        target='fist';w=keys(t,[(0,.1),(.5,0),(1,.55),(1.4,1),(1.8,.75),(2.3,0),(3,.1)])
    return target,w,point


def pose(rig,name,side,t,duration):
    target,w,point=weights(name,side,t)
    angles=[blend(a,b,w) for a,b in zip(PROFILES['rest'],PROFILES[target])]
    thumb=blend(THUMBS['rest'],THUMBS[target],w)
    if name=='PickBall' and side=='R':
        grasp=smooth((t-1.15)/.3)
        angles=[blend(a,b,grasp) for a,b in zip(angles,PROFILES['ball'])]
        thumb=blend(thumb,THUMBS['ball'],grasp)
    if name=='DropBall' and side=='R':
        release=smooth((t-.15)/.3)
        angles=[blend(a,b,release) for a,b in zip(PROFILES['ball'],angles)]
        thumb=blend(THUMBS['ball'],thumb,release)
    if point:
        angles=[blend(a,b,point) for a,b in zip(angles,PROFILES['point'])]
        thumb=blend(thumb,THUMBS['point'],point)
    hand=rig.data.bones['Hand_'+side].matrix_local.to_3x3()
    for index,label in enumerate(LONG):
        # Variaciones pequeñas, diferentes por dedo, y periódicas para los bucles.
        phase=index*.63+(.4 if side=='L' else 0.)
        micro=.65*(math.sin(math.tau*t/duration+phase)-math.sin(phase))
        if target in ('grip','ball'):micro*=1-w
        for joint in (1,2):
            bone=rig.pose.bones[f'{label}_{joint:02}_{side}']
            flex=angles[index][joint-1]+micro*(1 if joint==1 else .7)
            q=Quaternion((1,0,0),-math.radians(flex))
            if joint==1:
                local_z=bone.bone.matrix_local.to_3x3().inverted()@hand@Vector((0,0,1))
                spread=(-1.5,-.3,.5,1.5)[index]*(1 if side=='R' else -1)
                spread*=1-.8*w
                q=Quaternion(local_z,math.radians(spread))@q
            bone.rotation_quaternion=q
    first=rig.pose.bones['Thumb_01_'+side];second=rig.pose.bones['Thumb_02_'+side]
    thumb_in_hand=rig.data.bones['Hand_'+side].matrix_local.inverted()@first.bone.head_local
    sign=1 if thumb_in_hand.x>0 else -1
    to_local=first.bone.matrix_local.to_3x3().inverted()@hand
    adduction=Quaternion(to_local@Vector((0,0,1)),math.radians(sign*thumb[2]))
    opposition=Quaternion(to_local@Vector((0,1,0)),math.radians(sign*thumb[3]))
    first.rotation_quaternion=adduction@opposition@Quaternion((1,0,0),-math.radians(thumb[0]))
    second.rotation_quaternion=Quaternion((1,0,0),-math.radians(thumb[1]))


def finger_name(name):return any(name.startswith(label+'_') for label in (*LONG,'Thumb'))
