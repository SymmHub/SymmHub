import {
    abs,
    sin,
    cos,
    sqrt,
    PI,
    getParam,
    TORADIANS,
    iPlane,
    iSphere,
    iReflectU4,
    iLerpU4,
    ParamInt,
    ParamFloat,
    ParamBool,
    Group,
    EventProcessor,
}
from './modules.js';

const DEBUG = true;

const INC = 1.e-10;
const EPSILON = 1.e-6;
const MY_NAME = 'Group_KLMN';
/*
provides generators for groups KLMN
 */
export class Group_KLMN {

    constructor() {

        this.params = {
            K: 3,
            L: 2,
            M: 2,
            N: 2,
            aspect: 0.5,
            twist: 0,
            shift: 0,
            bend: 0.,
            uhp: true,
        };

        this.mParams = this.makeParams();
        
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

        var par = this.params;
        var opc = this.onParamChanged.bind(this);

        return {
            K:
            ParamInt({
                obj: par,
                key: 'K',
                min: 0,
                max: 20,
                onChange: opc,
            }),
            L:
            ParamInt({
                obj: par,
                key: 'L',
                min: 0,
                max: 20,
                onChange: opc,
            }),
            M:
            ParamInt({
                obj: par,
                key: 'M',
                min: 0,
                max: 20,
                onChange: opc,
            }),
            N:
            ParamInt({
                obj: par,
                key: 'N',
                min: 0,
                max: 20,
                onChange: opc,
            }),
            twist: ParamFloat({
                obj: par, 
                key: 'twist',
                onChange: opc,
                
            }),
            aspect: ParamFloat({
                obj: par, 
                key: 'aspect',
                onChange: opc,
                
            }),
            bend: ParamFloat({
                obj: par, 
                key: 'bend',
                onChange: opc,
                
            }),
            uhp: ParamBool({
                obj: par, 
                key: 'uhp',
                onChange: opc,
                
            }),
                        
        };
    } // makeParams

    //
    // called from UI when any group param was changed
    //
    onParamChanged() {
        if (DEBUG)
            console.log(this.constructor.name + '.onParamChanged()', 'eventProcessor:', this.eventProcessor);
        if (this.eventProcessor) {
            this.eventProcessor.handleEvent({
                type: 'onChanged',
                target: this
            });
        }

    }

    /**
    return map of current parameters
     */
    getParamsMap() {

        var p = this.params;

        return {
            K: p.K,
            L: p.L,
            M: p.M,
            N: p.M,
            aspect: p.aspect,
            twist: p.twist,
            bend: p.bend,
            uhp: p.uhp,
        };
    }

    /**
    set parameters from saved paramMap
     */
    setParamsMap(paramsMap) {

        this.controllers.K.setValue(getParam(paramsMap.K, 3));
        this.controllers.L.setValue(getParam(paramsMap.L, 2));
        this.controllers.M.setValue(getParam(paramsMap.M, 2));
        this.controllers.N.setValue(getParam(paramsMap.N, 2));
        this.controllers.aspect.setValue(getParam(paramsMap.aspect, 0.5));
        this.controllers.twist.setValue(getParam(paramsMap.twist, 0.));
        this.controllers.bend.setValue(getParam(paramsMap.bend, 0));
        this.controllers.uhp.setValue(getParam(paramsMap.uhp, true));

    }
    /**
    create UI
     */
    initGUI(options) {

        var gui = options.gui;
        var folder = options.folder;
        var onc = options.onChanged;
        var par = this.params;
        this.controllers = {};
        this.controllers.K = folder.add(par, 'K', 0, 20, 1).onChange(onc);
        this.controllers.L = folder.add(par, 'L', 0, 20, 1).onChange(onc);
        this.controllers.M = folder.add(par, 'M', 0, 20, 1).onChange(onc);
        this.controllers.N = folder.add(par, 'N', 0, 20, 1).onChange(onc);
        this.controllers.aspect = folder.add(par, 'aspect', 0.01, 0.99, INC).onChange(onc);
        this.controllers.bend = folder.add(par, 'bend', -360, 360, INC).onChange(onc);
        this.controllers.twist = folder.add(par, 'twist', -1, 1, INC).onChange(onc);
        this.controllers.uhp = folder.add(par, 'uhp').onChange(onc);

        gui.remember(par);

    }

    //
    //  return group description
    //
    getGroup() {
        if(DEBUG) console.log(MY_NAME + '.getGroup()', this.params);
        // in case of reflection group we return only fundamental domain
        // pairing transforms are reflections in the domain sides
        var fds = this.getFD_sKLMN();
        var S1 = fds.s[0];
        var S2 = fds.s[1];
        var S3 = fds.s[2];
        var S4 = fds.s[3];

        var S3a = iReflectU4(S2, S3);
        var S1a = iReflectU4(S2, S1);
        var S4a = iReflectU4(S2, S4);

        var twist = this.params.twist;

        var group = {};

        group.s = [S1, S3, S3a, S1a, S4a, S4];
        if (twist == 0.) {
            group.t = [[S1, S2], [S3, S2], [S3a, S2], [S1a, S2], [S4a, S2], [S4, S2]];
        } else {
            var S2t = iLerpU4(S2, S1, twist);
            group.t = [[S1, S2], [S3, S2], [S3a, S2], [S1a, S2], [S4a, S2t], [S4, S2t]];
        }

        group.genNames = ['a', 'b', 'B', 'A', 'C', 'c'];

        return new Group(group);

    }

    //
    //  return fundamental domain
    //
    getFD_sKLMN() {

        var pm = this.params;
        var getAngle = this.getAngle;

        var a13 = getAngle(pm.K);
        var a23 = getAngle(pm.L);
        var a14 = getAngle(pm.M);
        var a24 = getAngle(pm.N);
        var fd = this.getQuadDomain(a13, a23, a14, a24, pm.aspect, pm.bend * TORADIANS);
        //console.log("quadFD.s:", fd.s.length);
        //for(var i = 0; i < fd.s.length; i++){
        //	console.log("quadFD:", arrayToString(fd.s[i].v, 3) + ":" + fd.s[i].type);
        //}

        if (!pm.uhp) {
            // convert into Poincare ball
            var ref = iSphere([0, -1, 0, sqrt(2)]);
            for (var i = 0; i < fd.s.length; i++) {
                fd.s[i] = iReflectU4(ref, fd.s[i]);
            }

        }
        return fd;
    }

    getQuadDomain(a13, a23, a14, a24, ratio, bend4) {

        var shift = 0; // unused

        //var shift = 0; // horizontal shift of origin

        var b4 = bend4;

        var r1 = ratio;
        var r2 = 1.;

        var fd = {
            s: []
        };
        fd.s[0] = iSphere([shift, 0., 0., r2]);
        fd.s[1] = iSphere([shift, 0., 0., -r1]);

        var den3 = (2. * (r1 * cos(a13) + r2 * cos(a23)));
        var r3,
        r4,
        c3,
        c4;

        if (abs(den3) > EPSILON) {
            r3 = (r2 * r2 - r1 * r1) / den3;
            c3 = sqrt(r1 * r1 + 2. * r1 * r3 * cos(a13) + r3 * r3);
            fd.s[2] = iSphere([c3 + shift, 0., 0., -r3]);
        } else {
            fd.s[2] = iPlane([1., 0., 0., shift]);
        }
        var den4 = (2. * (r1 * cos(a14) + r2 * cos(a24)));
        if (abs(den4) > EPSILON) {
            r4 = (r2 * r2 - r1 * r1) / den4;
            c4 = sqrt(r1 * r1 + 2. * r1 * r4 * cos(a14) + r4 * r4);
            fd.s[3] = iSphere([-c4 * cos(b4) + shift, c4 * sin(b4), 0., -r4]);
        } else {
            fd.s[3] = iPlane([-cos(b4), sin(b4), 0., -shift]);
        }

        return fd;

    }

    //
    //  convert fraction to angle
    //
    getAngle(fraction) {

        if (fraction >= 20 || fraction < 2)
            return 0;
        else
            return Math.PI / fraction;
    }

} // class