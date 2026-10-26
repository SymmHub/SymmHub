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
const MYNAME = 'Group_s222222';

/*
  reflection group *222222: a right-angled hexagon bounded by the line x = 0 and a chain
  of five mutually orthogonal circles (chainOfOrthogonalCircles in group_utils.js).

  Imported from the Orb repo (examples/jslibm/Group_S222222.js, 2026-10-26) with its
  parameter names, so the group blocks of the old presets load unchanged:
    R1 .. R4     radii of the first four circles
    A2 .. A5     directions (degrees) of the centres of the circles 2, 3, 4 and of the
                 closing circle, each from the centre of the previous one
    uhp          the domain in the upper half plane (the line x = 0 is a side), or
                 reflected into the unit disk

  With every angle 0 the centres lie on the x axis and the group is a Fuchsian group of
  the upper half plane; other angles bend the chain. Group_6splanes cannot make this
  polygon: a splane at right angles to both of its concentric circles is a line through
  their centre.
*/
export class Group_s222222 {

    constructor() {

        this.params = {
            R1: 0.2,
            R2: 0.2,
            R3: 0.2,
            R4: 0.2,
            A2: 0,
            A3: 0,
            A4: 0,
            A5: 0,
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
        const radius = key => ParamFloat({obj: par, key: key, min: 0, max: 2, step: 0.001, onChange: opc});
        const angle  = key => ParamFloat({obj: par, key: key, min: -180, max: 180, step: 0.01, onChange: opc});

        return {
            R1:  radius('R1'),
            R2:  radius('R2'),
            R3:  radius('R3'),
            R4:  radius('R4'),
            A2:  angle('A2'),
            A3:  angle('A3'),
            A4:  angle('A4'),
            A5:  angle('A5'),
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
        let s = chainOfOrthogonalCircles([p.R1, p.R2, p.R3, p.R4],
                                         [p.A2, p.A3, p.A4, p.A5].map(a => a*TORADIANS));
        if(!p.uhp) s = toPoincareDisk(s);

        // reflection group: the pairing transforms are the reflections in the sides
        return new Group({s: s});
    }

} // class Group_s222222
