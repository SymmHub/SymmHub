import {
    sin,
    cos,
    sqrt,
    PI,
    TORADIANS,
    Group,
    EventProcessor,
    ParamInt,
    ParamFloat,
    setParamValues,
    iPlane,
    iSphere,
    iLerpU4,
    iTransformU4,
    iGetFixedPoints,
    getInversiveRotation,
}
from './modules.js';

const DEBUG = false;
const MYNAME = 'Group_ON';

/*
  orbifold oN: a torus with one cone point of order N (hyperbolic for every N >= 2;
  the orbifold builder makes its Fuchsian case as '2o', 'o3', ...).

  The fundamental domain is an octagon around the cone point at the origin, built in the
  disk of radius R (alpha = pi/(2N)):
    S4, S4a    lines through the origin at the angles +-2 alpha, paired by the rotation
               [S4, P0] about the origin by 4 alpha = 2 pi/N (P0 is the x axis)
    S2, S2a    circles centred in the directions +-alpha, paired by [S2, P0]
    S1         circle centred on the x axis
    S3, S3a    circles centred in the directions +-2 alpha, each paired with S1 through the
               line P1 (P1a) at the angle +-alpha
  every circle is orthogonal to the circle of radius R, so without bends the group is a
  Fuchsian group of that disk; r1 (relative to tan alpha) and twist are its two moduli.
  bend1 turns S1, S3 and S3a about the ends of S1 on the boundary circle; bend2 turns
  S2 (S2a) about the fixed points of [S1, S3] ([S1, S3a]); bend3 turns S4 and S4a about
  the fixed points of [S3, S3a]. Bends take the group off the disk.

  The side S1 appears twice in the side list (indices 5 and 7): its upper half is paired
  with S3 and its lower half with S3a, through different transforms, which one entry per
  side cannot express. Kept as in the Orb code (decision of 2026-10-26, to be revisited):
  the renderer folds a point by the first side it is outside of, and the fold still
  converges since every transform is a group element.

  Imported from the Orb repo (examples/jslibm/Group_ON.js, 2026-10-26) with its parameter
  names, so the group blocks of the old presets load unchanged. There bend2 and bend3
  threw a ReferenceError (iGetFixedPoints and getInversiveRotation were never imported)
  and no old preset sets them; they work here for the first time and are untested beyond
  the browser.
*/
export class Group_ON {

    constructor() {

        this.params = {
            N: 2,
            twist: 0,
            R: 1,
            r1: 0.5,
            bend1: 0,
            bend2: 0,
            bend3: 0,
        };

        this.mParams = this.makeParams();
        this.state = {
            paramChanged: true,
            group: null,
        };
    }

    getClassName(){
        return MYNAME;
    }

    setOptions(opt){
        if(opt.onChanged){
            this.onGroupChanged = opt.onChanged;
            this.eventProcessor = new EventProcessor();
            this.eventProcessor.addEventListener('onChanged', this.onGroupChanged);
        }
    }

    //
    //  return external params
    //
    getParams(){
        return this.mParams;
    }

    makeParams() {

        const par = this.params;
        const opc = this.onParamChanged.bind(this);
        const bend = key => ParamFloat({obj: par, key: key, min: -180, max: 180, step: 0.01, onChange: opc});

        return {
            N:     ParamInt({obj: par, key: 'N', min: 2, max: 20, onChange: opc}),
            R:     ParamFloat({obj: par, key: 'R', min: 0.1, max: 2, step: 0.001, onChange: opc}),
            r1:    ParamFloat({obj: par, key: 'r1', min: 0.1, max: 0.99, step: 0.001, onChange: opc}),
            twist: ParamFloat({obj: par, key: 'twist', min: -1, max: 1, step: 0.001, onChange: opc}),
            bend1: bend('bend1'),
            bend2: bend('bend2'),
            bend3: bend('bend3'),
        };
    }

    //
    // called from UI when any group param was changed
    //
    onParamChanged() {

        this.state.paramChanged = true;
        if(DEBUG) console.log(`${MYNAME}.onParamChanged()`);
        if(this.eventProcessor){
            this.eventProcessor.handleEvent({type: 'onChanged', target: this});
        }
    }

    //
    // set parameters from saved paramMap
    //
    setParamsMap(paramsMap) {
        setParamValues(this.mParams, paramsMap);
    }

    //
    //  return group description
    //
    getGroup() {

        if(this.state.paramChanged) {
            this.state.group = this.calculateGroup();
            this.state.paramChanged = false;
        }
        return this.state.group;
    }

    calculateGroup(){

        const p = this.params;

        const N = p.N;
        const alpha = PI/(2*N);
        const cos2a = cos(2*alpha);
        const sin2a = sin(2*alpha);
        const cosa = cos(alpha);
        const sina = sin(alpha);
        const tana = sina/cosa;
        const twist = p.twist;
        const R = p.R;
        const bend1 = p.bend1*TORADIANS;
        const bend2 = p.bend2*TORADIANS;
        const bend3 = p.bend3*TORADIANS;

        let r1 = p.r1*tana;
        const r2 = R*sqrt((tana*tana - r1*r1)/(1 + r1*r1));
        r1 *= R;

        const c1 = sqrt(R*R + r1*r1);
        const c2 = sqrt(R*R + r2*r2);

        const P0  = iPlane([0, -1., 0., 0]);
        const P1  = iPlane([-sina, cosa, 0., 0]);
        const P1a = iPlane([-sina, -cosa, 0., 0]);
        let S1  = iSphere([c1, 0, 0, -r1]);
        let S2  = iSphere([c2*cosa, c2*sina, 0, -r2]);
        let S2a = iSphere([c2*cosa, -c2*sina, 0, -r2]);
        let S3  = iSphere([c1*cos2a, c1*sin2a, 0, -r1]);
        let S3a = iSphere([c1*cos2a, -c1*sin2a, 0, -r1]);
        let S4  = iPlane([-sin2a, cos2a, 0., 0]);
        let S4a = iPlane([-sin2a, -cos2a, 0., 0]);

        const P0S2a = iLerpU4(P0, S2a, twist);

        // bend1: rotation of the sides S1, S3, S3a about the ends of S1 on the circle of radius R
        const xb = R*R/c1;
        const yb = R*r1/c1;
        const dx = yb*Math.tan(bend1/2);
        const rb = sqrt(yb*yb + dx*dx);
        const Sb  = iSphere([xb + dx, 0, 0, rb]);
        const Sb1 = iSphere([xb - dx, 0, 0, rb]);
        S1  = iTransformU4([Sb, Sb1], S1);
        S3  = iTransformU4([P1, Sb, Sb1, P1], S3);
        S3a = iTransformU4([P1a, Sb, Sb1, P1a], S3a);

        // bend2: rotation of S2 (S2a) about the fixed points of the transform [S1, S3] ([S1, S3a])
        if(bend2 != 0.){
            const fp13 = iGetFixedPoints(S1, S3);
            S2 = iTransformU4(getInversiveRotation(fp13[0], fp13[1], [0, 0, 1], bend2), S2);
            const fp13a = iGetFixedPoints(S1, S3a);
            S2a = iTransformU4(getInversiveRotation(fp13a[0], fp13a[1], [0, 0, 1], -bend2), S2a);
        }
        // bend3: rotation of S4 and S4a about the fixed points of [S3, S3a]
        if(bend3 != 0.){
            const fp33a = iGetFixedPoints(S3, S3a);
            const bendS4 = getInversiveRotation(fp33a[0], fp33a[1], [0, 0, 1], bend3);
            S4  = iTransformU4(bendS4, S4);
            S4a = iTransformU4(bendS4, S4a);
        }

        // the sides and the transforms mapping the cell across each side back into the domain
        // (S1 twice: see the class comment)
        const s = [S4, S4a, S2, S2a, S3, S1, S3a, S1];
        const t = [
            [S4, P0],
            [P0, S4],
            [S2, P0],
            [P0, S2],
            (twist == 0.) ? [S3, P1]   : [S3, P1, P0S2a, P0],
            (twist == 0.) ? [P1, S3]   : [P0, P0S2a, P1, S3],
            (twist == 0.) ? [S3a, P1a] : [S3a, P1a, P0S2a, P0],
            (twist == 0.) ? [P1a, S3a] : [P0, P0S2a, P1a, S3a],
        ];

        const group = new Group({s: s, t: t});
        if(DEBUG) console.log(`${MYNAME} returning: `, group);
        return group;
    }

} // class Group_ON
