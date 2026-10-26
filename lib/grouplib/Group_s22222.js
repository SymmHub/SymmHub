import {
    TORADIANS,
    Group,
    EventProcessor,
    ParamFloat,
    ParamBool,
    setParamValues,
    chainOfOrthogonalCircles,
    toPoincareDisk,
}
from './modules.js';

const DEBUG = false;
const MYNAME = 'Group_s22222';

/*
  reflection group *22222: a right-angled pentagon bounded by the line x = 0 and a chain
  of four mutually orthogonal circles (chainOfOrthogonalCircles in group_utils.js).

  Imported from the Orb repo (examples/jslibm/Group_S22222.js, 2026-10-26) with its
  parameter names, so the group blocks of the old presets load unchanged:
    R1, R2, R3   radii of the first three circles
    A2, A3, A4   directions (degrees) of the centres of the circles 2 and 3 and of the
                 closing circle, each from the centre of the previous one
    uhp          the domain in the upper half plane (the line x = 0 is a side), or
                 reflected into the unit disk

  With A2 = A3 = A4 = 0 every centre lies on the x axis: the pentagon is a hyperbolic
  polygon of the upper half plane and the group is Fuchsian (the orbifold builder's
  *22222 for some lengths). Other angles bend the chain and the group leaves the disk.
*/
export class Group_s22222 {

    constructor() {

        this.params = {
            R1: 0.2,
            R2: 0.2,
            R3: 0.2,
            A2: 0,
            A3: 0,
            A4: 0,
            uhp: true,
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
        const radius = key => ParamFloat({obj: par, key: key, min: 0, max: 2, step: 1e-10, onChange: opc});
        const angle  = key => ParamFloat({obj: par, key: key, min: -180, max: 180, step: 1e-10, onChange: opc});

        return {
            R1:  radius('R1'),
            R2:  radius('R2'),
            R3:  radius('R3'),
            A2:  angle('A2'),
            A3:  angle('A3'),
            A4:  angle('A4'),
            uhp: ParamBool({obj: par, key: 'uhp', onChange: opc}),
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
        let s = chainOfOrthogonalCircles([p.R1, p.R2, p.R3],
                                         [p.A2, p.A3, p.A4].map(a => a*TORADIANS));
        if(!p.uhp) s = toPoincareDisk(s);

        // reflection group: the pairing transforms are the reflections in the sides
        return new Group({s: s});
    }

} // class Group_s22222
