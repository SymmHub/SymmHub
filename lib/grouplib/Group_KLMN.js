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
    derivedPresentation,
    quadHandles,
}
from './modules.js';

const DEBUG = false;

const INC = 1.e-10;
const MYNAME = 'Group_KLMN';
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
            s: false, 
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
            s: ParamBool({obj:par, key:'s', onChange: opc}),
            K: ParamInt({obj: par,key: 'K',min: 0,max: 20,onChange: opc}),
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

    //
    // return map of current parameters (legacy API) 
    //
    _getParamsMap() {
        
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

    //
    // set parameters from saved paramMap
    //
    setParamsMap(paramsMap) {
        setParamValues(this.mParams, paramsMap);
        //this.controllers.K.setValue(getParam(paramsMap.K, 3));
        //this.controllers.L.setValue(getParam(paramsMap.L, 2));
        //this.controllers.M.setValue(getParam(paramsMap.M, 2));
        //this.controllers.N.setValue(getParam(paramsMap.N, 2));
        //this.controllers.aspect.setValue(getParam(paramsMap.aspect, 0.5));
        //this.controllers.twist.setValue(getParam(paramsMap.twist, 0.));
        //this.controllers.bend.setValue(getParam(paramsMap.bend, 0));
        //this.controllers.uhp.setValue(getParam(paramsMap.uhp, true));

    }
    /**
    create UI
     */
    _initGUI(options) {
        /*
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
        */
    }

    //
    //  the presentation of the group, from the domain of its undeformed copy
    //
    getPresentation() {
        const {K, L, M, N, s, twist} = this.params;
        // the twist moves the mirror of the transforms of S4 and S4a, and it still pairs
        // them only when S4 is at right angles with S1 and S2: else the group is another one
        if(twist !== 0 && !s && !(M === 2 && N === 2)) return null;
        return derivedPresentation(this, {
            name:   (s ? '*' : '') + [K, L, M, N].join(''),
            family: 'klmn',
            keep:   ['K', 'L', 'M', 'N', 's'],
        });
    }

    //
    //  return group description
    //
    getGroup() {
        if(DEBUG) console.log(MYNAME + '.getGroup()', this.params);
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
        if(this.params.s){
            return new Group({s:[S1, S2, S3, S4]});            
        }
        group.s = [S1, S3, S3a, S1a, S4a, S4];
        if (twist == 0.) {
            group.t = [[S1, S2], [S3, S2], [S3a, S2], [S1a, S2], [S4a, S2], [S4, S2]];
        } else {
            var S2t = iLerpU4(S2, S1, twist);
            group.t = [[S1, S2], [S3, S2], [S3a, S2], [S1a, S2], [S4a, S2t], [S4, S2t]];
        }

        group.genNames = ['a', 'b', 'B', 'A', 'C', 'c'];
        
        let g = new Group(group);
        if(DEBUG)console.log(`${MYNAME} returning: `, g);
        
        return g;

    }

    //
    //  the handles on the canvas (the Symmetry tool's group handles, GroupHandles.js): the
    //  orders of the quad's corners (getQuadDomain's sides: 0 the outer circle, 1 the inner
    //  one, 2 and 3 the sides that join them: K of 1 and 2, L of 0 and 2, M of 1 and 3, N of
    //  0 and 3) and the aspect on the inner circle
    //
    getHandles() {
        const pm = this.params;
        const quad = getQuadDomain(getAngle(pm.K), getAngle(pm.L), getAngle(pm.M), getAngle(pm.N),
                                   pm.aspect, pm.bend * TORADIANS);
        return quadHandles(this, {
            quad, uhp: pm.uhp,
            orders: [
                { key: 'K', sides: [1, 2] },
                { key: 'L', sides: [0, 2] },
                { key: 'M', sides: [1, 3] },
                { key: 'N', sides: [0, 3] },
            ],
            aspect: { key: 'aspect', min: 0.01, max: 0.99, title: 'aspect: the radius of the inner circle (the outer one\'s is 1)' },
        });
    }

    //
    //  return fundamental domain
    //
    getFD_sKLMN() {

        var pm = this.params;

        var a13 = getAngle(pm.K);
        var a23 = getAngle(pm.L);
        var a14 = getAngle(pm.M);
        var a24 = getAngle(pm.N);
        var fd = getQuadDomain(a13, a23, a14, a24, pm.aspect, pm.bend * TORADIANS);
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

} // class