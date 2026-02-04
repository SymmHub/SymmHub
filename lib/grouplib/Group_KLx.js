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
    setParamValues,
    getAngle,
    getQuadDomain,    
    iGetBisectorU4,
    iTransformU4,
}
from './modules.js';

const DEBUG = true;

const INC = 1.e-10;
const EPSILON = 1.e-6;
const MYNAME = 'Group_KLx';
/*
provides generators for groups KLx
 */
export class Group_KLx {

    constructor() {

        this.params = {
            K: 3,
            L: 2,
            aspect: 0.5,
            twist: 0,
            shift: 0,
            bend: 0.,
            uhp: true,
            s:  false, 
            
            n35: 2,
            n45: 2,
            a3: 0,
            a4: 180,
            use_n35: false,
            use_n45: false,

            // splanes switches
            s1: true,
            s2: true,
            s3: true,
            s4: true,
            s5: false,
        };

        this.mParams = this.makeParams();
        this.state = {
            paramChanged:   true,
            group:          null, 
            
        }
    }

    setOptions(opt){
        if(opt.onChanged){
            this.onGroupChanged = opt.onChanged;
            this.eventProcessor = new EventProcessor();
            this.eventProcessor.addEventListener('onChanged', this.onGroupChanged);
        }                
    }
    
    getClassName(){
        return MYNAME;
    }
    //
    //  return external params (new API)
    //
    getParams(){
        return this.mParams;      
    }
    
    makeParams() {

        var par = this.params;
        var opc = this.onParamChanged.bind(this);

        return {
            s:      ParamBool({obj:par, key:'s', onChange: opc}),
            K:      ParamInt({obj: par,key: 'K',min: 0,max: 20,onChange: opc}),
            L:      ParamInt({obj: par,key: 'L',min: 0,max: 20,onChange: opc}),

            a3: ParamFloat({obj:par, key:'a3', min:-720,max:720., onChange:opc}),
            n35: ParamInt({obj:par, key:'n35', min: 0, max: 20, onChange: opc}),
            use_n35: ParamBool({obj: par, key: 'use_n35', onChange: opc}),        
            
            a4: ParamFloat({obj:par, key:'a4', min:-720,max:720., onChange:opc}),
            n45: ParamInt({obj:par, key:'n45', min: 0, max: 20, onChange: opc}),            
            use_n45: ParamBool({obj: par, key: 'use_n45', onChange: opc}),        

            twist:  ParamFloat({obj: par, key: 'twist', onChange: opc}),
            aspect: ParamFloat({obj: par, key: 'aspect', onChange: opc}),
            bend:   ParamFloat({obj: par,   key: 'bend',   onChange: opc}),
            uhp:    ParamBool({obj: par, key: 'uhp', onChange: opc}),
            s1: ParamBool({obj: par, key: 's1', onChange: opc}),        
            s2: ParamBool({obj: par, key: 's2', onChange: opc}),        
            s3: ParamBool({obj: par, key: 's3', onChange: opc}),        
            s4: ParamBool({obj: par, key: 's4', onChange: opc}),        
            s5: ParamBool({obj: par, key: 's5', onChange: opc}),                    
        };
    } // makeParams

    //
    // called from UI when any group param was changed
    //
    onParamChanged() {
        
        this.state.paramChanged = true;
        if (DEBUG)console.log(`${MYNAME}.onParamChanged()`);
        
        if (this.eventProcessor) {
            this.eventProcessor.handleEvent({type: 'onChanged',target: this});
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
        if(DEBUG) console.log(`${MYNAME}.getGroup()`, this.params);
        if(this.state.paramChanged) {
            this.state.group = this.calculateGroup();
            this.state.paramChanged = false;
        }
        return this.state.group;
        
    }
    
    //
    //
    //
    calculateGroup(){
        
        if(DEBUG) console.log(`${MYNAME}.calculateGroup()`, this.params);
        // in case of reflection group we return only fundamental domain
        // pairing transforms are reflections in the domain sides
        let pm = this.params;

        var fds = this.getQuad(pm);
        var S1 = fds.s[0];
        var S12 = fds.s[1];
        var S3 = fds.s[2];
        var S4 = fds.s[3];
        var S5 = iPlane([0., -1., 0.,  0]);
        
        //var S2 =  iReflectU4(S12, S1);
        var S34 = iGetBisectorU4(S3, S4);//iReflectU4(S4,S4));
        var S2 = iTransformU4([S12, S34], S1);
        console.log('S34: ', S34);
        //var S1a = iReflectU4(S12, S1);
        //var S6a = iReflectU4(S6, S6);
        var group = {};

        let t34 = [S3, S34, S12];// maps s4 to s3
        let t43 = [S4, S34, S12];// maps s3 to s4
        let t12 = [S1, S12, S34]; //
        let t21 = [S2, S12, S34];//
        let t5 = [S5];
        //group.s = [S1, S2, S3, S4];
        //group.t = [t12, t21, t34, t43];

        //group.genNames = ['a', 'b', 'B', 'A', 'C', 'c'];
        
        
        
        let s = [];
        let t = [];
        if(pm.s1) {
            s.push(S1);
            t.push(t12);
        }
        if(pm.s2) {
            s.push(S2);
            t.push(t21)
        }
        if(pm.s3) {
            s.push(S3);
            t.push(t34);
        }
        if(pm.s4) {
            s.push(S4);
            t.push(t43);
        }
        if(pm.s5) {
            s.push(S5);
            t.push(t5)
        }
        
        group.s = s;
        
        //group.s = [S1, S2, S3, S4];
        if(pm.s){
            if(DEBUG)console.log(`${MYNAME} returning: `, group);
            return new Group(group);            
        }
        
        group.t = t;
        
        let g = new Group(group);
        if(DEBUG)console.log(`${MYNAME} returning: `, g);
        
        return g;

    }

    //
    //  return fundamental domain
    //
    getQuad(pm) {

        var a23 = getAngle(pm.K);
        var a13 = getAngle(2);
        var a24 = getAngle(pm.L);
        var a14 = getAngle(2)
        var fd = getQuadDomain(a13, a23, a14, a24, pm.aspect, pm.bend * TORADIANS);

        if (!pm.uhp) {
            // convert into Poincare ball
            var ref = iSphere([0, -1, 0, sqrt(2)]);
            for (var i = 0; i < fd.s.length; i++) {
                fd.s[i] = iReflectU4(ref, fd.s[i]);
            }

        }
        return fd;
    }


} // class