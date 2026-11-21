
import {
    iPackTransforms, 
    //iGetFactorizationU4,  
    iLerpU4,  
    iDrawCircle,  
    eDistance, 
    ITransform,
    iSphere,
    iPlane,
    iPoint,
    GroupUtils,
    Group,
    splaneToString,
    U4toH4,
    getReflectionMatrixH4,
    getMatrixH4,
    analyzeTransformH4,
    iDistanceU4,
    makeTransformClassificationU4,
    TRANSFORM_TYPES,
    
    ParamChoice,
    ParamInt, 
    ParamBool, 
    ParamFloat, 
    ParamFunc,
    ParamGroup, 
    ParamObj,
    ParamColor,
    ParamString,
    ParamCustom,
    ParamUiRow,
    ParamUiFolder,
    createParamUI,
    getParamValues,
    setParamValues,

    TreeNode,
    createTreeWindow,

    PI,atan2, abs, sqrt, sin, cos, exp, isDefined,TORADIANS,

    cross, dot, add,eDistanceSquared,
    eLength,
    normalize,

    moebiusSteps,

}
from './modules.js';

       
const DEBUG = false;
const MYNAME = 'FixedPointTransform';
const INC = 0.00000000000001;
const MAXFP = 50;
// factor convert period of hyperbolic transforms 
// to make period the same as after applying band transform
const SCALE_FACTOR = (PI/2.);

//
// return transformation which moves [p1,p2] to [0, oo] 
//
function getTransform_0_INF(p1, p2){
   
   let s1 = iSphere([p2[0], p2[1], 0, eDistance(p1, p2)]);
   let s2 = iPlane([p1[0], p1[1],0, 0.5*eDistance([0,0], p1)])
   return new ITransform([s1,s2]);
   
}

function getTransform_1_1(p1, p2){
  return  ITransform.getTransform_1_1(p1, p2);
}

function getTransform_1_1_(p1, p2){
    
    let tr1 = getTransform_0_INF(p1, p2);
    let tr2 = getTransform_0_INF([-1,0], [1,0]);    
    
    return tr1.concat(tr2);
    
}


//
//  order of the classification bucket keys '[1.4267]', '[0.0979,0.1092]': by their numbers
//
function compareBucketKeys(a, b){
    let na = (a.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    let nb = (b.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    for(let i = 0; i < Math.min(na.length, nb.length); i++){
        if(na[i] !== nb[i]) return na[i] - nb[i];
    }
    return (na.length - nb.length) || ((a < b) ? -1 : (a > b) ? 1 : 0);
}

// the classification's limits (makeTransformClassificationU4)
const ANALYZE_PARAMS = {maxPeriod:10, maxCount:10000};

//  the window of the group's transformations by their kinds (Analyze…), one for
//  every row: its words go to the row that asked last
let sTransformsWindow = null;

function getTransformsWindow(){
    if (!sTransformsWindow) {
        sTransformsWindow = createTreeWindow({
            title:     'group transformations',
            storageId: 'group_transformations',
            left:      '60px',
            top:       '120px',
            width:     '320px',
            height:    '60%',
        });
    }
    return sTransformsWindow;
}

const OR_NONE = 'none';
const OR_1_1  = '1,-1';
const OR_0_INF  = '0,oo';
const OR_NAMES = [OR_NONE,OR_1_1, OR_0_INF];

//
//  controls inversive transform which moves selected fixed points inot canonical positions
//  (-1,0) (1,0)   or (0,0,) (oo)
//
//  A row of the list of conformal transformations (ProjectionTransform.js,
//  conformal/ConformalMapFactory.js): it has the rows' interface, getId() / setId() /
//  setOnIdChange(), the id param, init(par), enabled, tick(timestamp) and getSteps(), its
//  part of the shaders' chain (a moebius step, conformal/ConformalKinds.js).
//
export class FixedPointsTransform {

    //
    //  options: {groupMaker, onChange, id}
    //
    constructor(options = {}) {

        this.groupMaker = options.groupMaker;
        this.onChanged = options.onChange;
        // from the list (init): how a change of its own is run, and how the next frame is asked for
        this.own = options.own || ((fn) => fn());
        this.onFrame = options.onFrame || null;
        this.idRef = { id: options.id ?? 'fixedPoints' };
        this.onIdChange = null;

        this.params = {
            // navigation
            showUI: false,
            animate: false,
            enabled: false,
            fp0x: -1,
            fp0y: 0,
            fp1x: 1,
            fp1y: 0,
            basex: 0,
            basey: 0,
            word: 'ac',
            translation: 1,
            rotation: 0,
            logScale: 0,  // scale = exp(logScale)
            twist:    0,  // rotation = exp(twist*PI);
            fraction: 0,
            loopTime: 5,
            orientation: OR_NONE,

        }
        
        this.groupChanged = true;
        
        //this.controls = {}; // obsolete 
        
        this.mParams = this.makeParams();

    }

    //
    //   return map of parameters
    //
    //_getParamsMap() {
    //    let map = getParamValues(this.mParams);
    //    console.log(`${MYNAME}.getParamMap(): `, map);
    //    return map;
    //}
    
    //
    //    set parameters value from the map
    //
    //_setParamsMap(paramsMap) {

    //    console.log(`${MYNAME}.setParamsMap()`, paramsMap);
        //let oldPar = getParamValues(this.mParams);
        //Object.assign(oldPar, paramsMap);        
    //    setParamValues(this.mParams, paramsMap);        
    //}

    //
    //  
    // 
    getParams(){

        return this.mParams;

    }

    // ── a row of the list of conformal transformations ───────────────────────────

    getId(){
        return this.idRef.id;
    }

    setId(id){
        this.idRef.id = id;
    }

    setOnIdChange(fn){
        this.onIdChange = fn;
    }

    // par: {onChange, own, onFrame, groupMaker}, as the list gives them to its rows:
    // onChange() after an edit of its values; own(fn) runs a change the row makes
    // itself (the points found again from the group, a frame of the animation), which
    // is no edit of the user's (no undo step); onFrame() asks for the next frame
    init(par){
        if (!par) return;
        if (par.onChange) this.onChanged = par.onChange;
        if (par.own) this.own = par.own;
        if (par.onFrame) this.onFrame = par.onFrame;
        if (par.groupMaker) this.groupMaker = par.groupMaker;
    }

    get enabled(){
        return !!this.params.enabled;
    }

    //
    //  the steps of the shaders' chain: the reflections applied to a screen point
    //  (getScreenChain) as moebius steps; none while it is off or does nothing
    //
    getSteps(){
        const chain = this.getScreenChain();
        return chain ? moebiusSteps(chain) : [];
    }

    //
    //  a frame at the time stamp (the list calls it for the rows that are on, once a
    //  frame): the animation's fraction follows the time, and the next frame is
    //  asked for
    //
    tick(timestamp){
        const par = this.params;
        if (!par.animate) return;
        let fract = ((timestamp * 0.001) / par.loopTime);
        fract -= Math.floor(fract);
        fract -= 0.5;
        // the clock's value, not the user's: the row's own change
        this.own(() => {
            par.fraction = fract;
            this.mParams.fraction.updateDisplay();
        });
        // request new repaint
        if (this.onFrame) this.onFrame();
        else this.informListener();
    }

    makeParams(){
        
        let par = this.params;
        let onc = this.onParamChanged.bind(this);
        let oat = this.onAnalyzeTransforms.bind(this);
        let ota = this.onTest.bind(this);
        let owc = this.onWordChanged.bind(this);
        let p = {
            id:      ParamString({obj: this.idRef, key: 'id', name: 'id', onChange: () => { if (this.onIdChange) this.onIdChange(); }}),
            enabled: ParamBool({obj:par, key: 'enabled', onChange: onc}),
            showUI:  ParamBool({obj:par, key: 'showUI',     name: 'show UI', onChange: onc}),
            animate: ParamBool({obj:par, key: 'animate',    onChange: onc}),  
            analyze: ParamFunc({func: oat, name: 'analyze'}),
            ota:     ParamFunc({func: ota, name: 'test'}),
            word:    ParamString({obj:par, key: 'word',             onChange: owc}),
            orientation:  ParamChoice({obj:par, key: 'orientation', choice: OR_NAMES,     onChange:onc}),
            fp0x:  ParamFloat({obj:par, key:'fp0x', min:-MAXFP, max:MAXFP, name:'fp0 X',  onChange:onc}),
            fp0y:  ParamFloat({obj:par, key:'fp0y', min:-MAXFP, max:MAXFP, name:'fp0 Y',  onChange:onc}),
            fp1x:  ParamFloat({obj:par, key:'fp1x', min:-MAXFP, max:MAXFP, name:'fp1 X',  onChange:onc}),
            fp1y:  ParamFloat({obj:par, key:'fp1y', min:-MAXFP, max:MAXFP, name:'fp1 Y',  onChange:onc}),
            basex: ParamFloat({obj:par, key:'basex', min:-MAXFP, max:MAXFP, name:'base X',onChange:onc}),
            basey: ParamFloat({obj:par, key:'basey', min:-MAXFP, max:MAXFP, name:'base Y',onChange:onc}),
            translation: ParamFloat({obj:par, key:'translation', min:-MAXFP, max:MAXFP,   onChange:onc}),
            rotation:    ParamFloat({obj:par, key:'rotation',    min:-MAXFP, max:MAXFP,   onChange:onc}),
            fraction:    ParamFloat({obj:par, key:'fraction',    min:-MAXFP, max:MAXFP,   onChange:onc}),
            loopTime:    ParamFloat({obj:par, key:'loopTime',    min:-MAXFP, max:MAXFP, name: 'loop time', onChange:onc}),
            
        };  
        return p;
    }

    //
    //  the params as the panel shows them (plan 5.3): the word with its menu (the words of
    //  the group by their kinds, to choose one), the orientation, and in a closed folder
    //  what is found from the word and the group: the two fixed points, the translation
    //  and the rotation. Only the UI: getParams() is what a document saves.
    //  Left out, with their values kept: show UI, animate, fraction, loop time, the base and
    //  test. They move nothing in the picture (the row's part of the chain is its
    //  orientation transform alone); the marks of the fixed points are on the canvas while
    //  the row is selected in its window (getMarks)
    //
    getPanelParams(){
        if (this.mPanelParams) return this.mPanelParams;
        const p = this.mParams;
        const word = ParamUiRow({ name: 'word', labelWidth: '3.6em',
            tooltip: 'a word of the group\'s generators: the element whose fixed points are taken',
            menu: () => [{ label: 'Analyze…', title: 'the elements of the group by their kinds and periods: a click on one takes its word',
                           action: () => this.onAnalyzeTransforms() }],
            menuTooltip: 'find a word' });
        const found = ParamUiFolder({ name: 'found from the word' });
        const fp0 = ParamUiRow({ name: 'fp0', labelWidth: '3.6em', tooltip: 'the first fixed point (the orientation shows it at 1, or at 0)' });
        const fp1 = ParamUiRow({ name: 'fp1', labelWidth: '3.6em', tooltip: 'the second fixed point (the orientation shows it at -1, or at infinity)' });
        const move = ParamUiRow({ name: 'move', labelWidth: '3.6em', tooltip: 'the element\'s translation along its axis and its rotation about it' });
        this.mPanelParams = {
            id:          p.id,
            enabled:     p.enabled,
            wordRow:     word,
            word:        word.contain(p.word),
            orientation: p.orientation,
            found,
            fp0:         found.contain(fp0),
            fp0x:        found.contain(fp0.contain(p.fp0x, { tooltip: 'x' })),
            fp0y:        found.contain(fp0.contain(p.fp0y, { tooltip: 'y' })),
            fp1:         found.contain(fp1),
            fp1x:        found.contain(fp1.contain(p.fp1x, { tooltip: 'x' })),
            fp1y:        found.contain(fp1.contain(p.fp1y, { tooltip: 'y' })),
            move:        found.contain(move),
            translation: found.contain(move.contain(p.translation, { tooltip: 'the translation' })),
            rotation:    found.contain(move.contain(p.rotation, { tooltip: 'the rotation' })),
        };
        return this.mPanelParams;
    }

    //
    //  the marks of the two fixed points, in the plane on the pattern's side of the row
    //  (handlesPlane 'world'): where the picture shows them, the first green and the second
    //  red (as render() had them). With the orientation on they are at the places it takes
    //  them to: (1, 0) and (-1, 0), or 0 and infinity
    //
    getMarks(){
        // a row that is off finds its points too: its marks say where it would act
        if (this.groupChanged) this.updateGroupData();
        const par = this.params;
        const mark = (p, fill) => [
            { p, kind: 'disc', size: 8.5, color: null, fill: [1, 1, 1, 0.7], width: 0 },
            { p, kind: 'disc', size: 7, color: [0, 0, 0, 0.9], fill, width: 1.5 },
        ];
        return { points: [...mark([par.fp0x, par.fp0y], [0.55, 0.95, 0.55, 0.95]), ...mark([par.fp1x, par.fp1y], [1, 0.55, 0.55, 0.95])] };
    }

    get handlesPlane(){
        return 'world';
    }

    //
    //  init GUI controls
    //
    initGUI(options){
        
      //this.onChanged = options.onChanged;
      createParamUI(options.folder, this.mParams);      
        
    }

    //
    // render UI onto canvas
    //
    render(context, transform) {

        if (this.params.animationRunnig) {
            // inform parent we have changes
            informListener();
        }
        if (!this.params.showUI)
            return;

        // var thickLine = {lineStyle:"#2222FF7",lineWidth:3,shadowWidth:0};
        // var thinLine = {lineStyle:"#2222FF",lineWidth:1,shadowWidth:0};
        // var superThinLine = {lineStyle:"#2222FF",lineWidth:0.2,shadowWidth:0};
        let par = this.params;

        const opt_fp0 = {
            radius: 10,
            stroke: "#000",
            fill: '#AFAA'
        };
        const opt_fp1 = {
            radius: 10,
            stroke: "#000",
            fill: '#FAAA'
        };
        const opt_base = {
            radius: 10,
            stroke: "#000",
            fill: '#FFAA'
        };
        const opt_trans = {
            radius: 10,
            stroke: "#000",
            fill: '#FFA'
        };
        const opt_fract = {
            radius: 7,
            stroke: "#000",
            fill: '#0FA'
        };

        let fp0 = [par.fp0x, par.fp0y];
        let fp1 = [par.fp1x, par.fp1y];
        let basePnt = [par.basex, par.basey];
        let trans = par.translation;
        let fract = par.fraction;
        let rot = par.rotation * TORADIANS;

        let p0 = iPoint(fp0);
        let p1 = iPoint(fp1);
        let pBase = iPoint(basePnt);

        // let's build transformation which has given fixed points and rotation and translation parameters
        //
        // inversion sphere
        var ri = sqrt(eDistanceSquared(p0.v, p1.v));
        // inversion sphere
        var si = iSphere([p1.v[0], p1.v[1], p1.v[2], ri]);
        // si keep p0 fixed and moves p1 to infinity
        // two concentric spheres performing hyperbolic translation
        var s1 = iSphere([p0.v[0], p0.v[1], p0.v[2], 1]);
        var s2p = iSphere([p0.v[0], p0.v[1], p0.v[2], exp(trans)]);
        var s2f = iSphere([p0.v[0], p0.v[1], p0.v[2], exp(fract * trans)]);

        var transp;
        var transf;

        let rotp = par.rotation * PI;

        if (rotp != 0) {

            let cosp = cos(rotp);
            let sinp = sin(rotp);

            let rotf = rotp * fract;

            let cosf = cos(rotf);
            let sinf = sin(rotf);

            var rp1 = iPlane([1, 0, 0, par.fp0x]);
            var rp2p = iPlane([cosp, sinp, 0, cosp * par.fp0x + sinp * par.fp0y]); // plane which rotates the whole period
            var rp2f = iPlane([cosf, sinf, 0, cosf * par.fp0x + sinf * par.fp0y]); // plane which rotates the fraction of period

            transp = new ITransform([si, s1, s2p, rp1, rp2p, si]); // the whole transformation
            transf = new ITransform([si, s1, s2f, rp1, rp2f, si]); // fraction of the whole transformation

        } else {

            transp = new ITransform([si, s1, s2p, si]); // the whole transformation
            transf = new ITransform([si, s1, s2f, si]); // fraction of the whole transformation

        }

        let fBase = transf.transform(pBase);

        let fractPnt = [fBase.v[0], fBase.v[1]];

        //let periodVect = mul(sub(fp1,fp0),0.1*translation);
        //let transPnt = add(basePnt, periodVect);
        //let fractPnt = add(basePnt, mul(periodVect, fract));

        iDrawCircle(fp0, context, transform, opt_fp0);
        iDrawCircle(fp1, context, transform, opt_fp1);
        iDrawCircle(basePnt, context, transform, opt_base);

        let tBase = pBase; // points transfomed by iterations
        let iBase = pBase; // points invwerse transformed by iterations

        for (let i = 0; i < 5; i++) {

            tBase = transp.transform(tBase);
            iBase = transp.inverseTransform(iBase);
            iDrawCircle([tBase.v[0], tBase.v[1]], context, transform, opt_trans);
            iDrawCircle([iBase.v[0], iBase.v[1]], context, transform, opt_trans);
        }

        iDrawCircle(fractPnt, context, transform, opt_fract);

    } // render

    setListener(listener) {
        this.listener = listener;
    }

    onParamChanged(){
        
        if(DEBUG)console.log(`${MYNAME}.onParamChanged()`);
        this.informListener();
        
    }

    //
    //  inform listener that navigation param was changed
    //
    informListener() {

        if (isDefined(this.onChanged)) {
            this.onChanged();
        }
    }

    //
    //  return parameters used for animation 
    //
    getTransformParams(){
        
        let par = this.params;
        
        return {
           translation: par.translation,
           rotation:    par.rotation,
        }
       
    }

    /**
    return transformation which puts fixed [points into canonocal position
     */
    getOrientationTransform() {

        let par = this.params;

        let fp0 = [par.fp0x, par.fp0y];
        let fp1 = [par.fp1x, par.fp1y];
        switch (par.orientation) {
        default:
        case OR_NONE:
            return [];
        case OR_0_INF:
            return getTransform_0_INF(fp0, fp1);
        case OR_1_1:
            return getTransform_1_1(fp0, fp1);
        }

    }

    //
    //  return transformation due to animation
    //
    getAnimationTransform() {

        let par = this.params;
        let fp0 = [par.fp0x, par.fp0y];
        let fp1 = [par.fp1x, par.fp1y];
        let basePnt = [par.basex, par.basey];
        let trans = par.translation;
        let fract = par.fraction;

        let p0 = iPoint(fp0);
        let p1 = iPoint(fp1);
        let pBase = iPoint(basePnt);

        // let's build transformation which has given fixed points and rotation and translation parameters
        //
        // inversion sphere
        var ri = sqrt(eDistanceSquared(p0.v, p1.v));
        // inversion sphere
        var si = iSphere([p1.v[0], p1.v[1], p1.v[2], ri]);
        // si keep p0 fixed and moves p1 to infinity
        // two concentric spheres performing hyperbolic translation
        var s1 = iSphere([p0.v[0], p0.v[1], p0.v[2], 1]);
        //var s2p = iSphere([p0.v[0],p0.v[1],p0.v[2],exp(trans)]);
        var s2f = iSphere([p0.v[0], p0.v[1], p0.v[2], exp(fract * trans)]);
        let rotp = par.rotation * PI;

        if (rotp != 0.0) {
            let rotf = rotp * fract;

            let cosf = cos(rotf);
            let sinf = sin(rotf);

            var rp1 = iPlane([1, 0, 0, par.fp0x]);
            var rp2f = iPlane([cosf, sinf, 0, cosf * par.fp0x + sinf * par.fp0y]); // plane which rotates the fraction of period

            return new ITransform([si, s1, s2f, rp1, rp2f, si]); // the fraction whole transformation

        } else {
            return new ITransform([si, s1, s2f, si]); // fraction of the whole transformation
        }

    }

    //
    //  
    //
    /**
     * the reflections the GPU applies to a screen point (u_fpTransformData): the
     * inverse of the orientation transform, factorized; null while the map is off.
     * The CPU's view chain (ViewChain.js) applies the same
     */
    getScreenChain() {
        if (!this.params.enabled) return null;
        if (this.groupChanged) this.updateGroupData();
        const trans = ITransform.getIdentity().concat(this.getOrientationTransform());
        trans.doFactorization();
        // a word the group lacks leaves holes in the chain: those are left out
        return GroupUtils.getInverseTransform(trans.getRef().filter(s => s && s.v));
    }

    //
    //  the uniforms of the fixed chain of maps the shaders had before the list
    //  (u_fpTransformEnabled, u_fpTransformData). The list uses getSteps(); this stays
    //  for the frozen copy of that chain the tests compare with (tests/symhublib/legacy)
    //
    getUniforms(uniforms, timestamp) {

        let par = this.params;
        this.tick(timestamp);

        if(this.groupChanged){
            this.updateGroupData();
        }

        var un = uniforms;
        if (!isDefined(un))
            un = {};

        un.u_fpTransformEnabled = (par.enabled) ? 1 : 0;
        if (un.u_fpTransformEnabled) {

            // the GPU works from the pixel to the world: it gets the inverse transform
            un.u_fpTransformData = iPackTransforms([this.getScreenChain()], 1, 5);
            //console.log("transformArray: " + iArrayToString(un.u_fpTransformData,3));
        }

        return un;

    }

    onGroupChanged() {
        // called when group was changed
        if(DEBUG)console.log(`${MYNAME}.onGroupChanged()`);
        this.groupChanged = true;
        //this.calculateTransform(this.params.word);
    }
    
    //
    //  the points, the translation and the rotation found again from the word and the
    //  group. After the group changed (asOwn) it is the row's own change, no edit of the
    //  user's; after the word changed it is a part of that edit
    //
    updateGroupData(asOwn = true){
        if(DEBUG)console.log('updateGroupData()');
        // no group yet (a page starting, a test): the values stay, to be found when it comes
        if (!this.groupMaker || !this.groupMaker.getGroup || !this.groupMaker.getGroup()) return;
        if (asOwn) this.own(() => this.calculateTransform(this.params.word));
        else this.calculateTransform(this.params.word);
        this.groupChanged = false;
    }

    onParamChanged(){
        this.informListener();
    }

    onWordChanged() {

        if(DEBUG)console.log(`${MYNAME}.onWordChanged()`);
        this.groupChanged = true;
        this.informListener();
        // found right away, with the word: nothing is left for the next frame to find
        this.updateGroupData(false);

    }
    
    calculateTransform(word){
        
        let debug = false;
        if(!this.groupMaker) {
            console.error(`${MYNAME}.calculateTransform(), this.groupMaker undefined`);
            return;
        }
        if(debug)console.log(`calculateTransform(${word})`);
        let group = this.getGroup();
        if(!group) return;      // no group yet
        let par = this.params;


        if(!group.word2trans){
            console.error(`${MYNAME}.calculateTransform(), group.word2trans undefined, group: `, group);
            return;            
        }
        let tr = group.word2trans(word);
        let itr = new ITransform(tr); 
        if(debug)console.log('tr: ', tr);
        
        let pnt = iPoint([par.basex, par.basey]);
        if(debug)console.log('pnt:', splaneToString(pnt,6));
        let pnt1 = pnt;
        let pnt2 = pnt;
        if(DEBUG){
            for(let i = 0; i < 2; i++){
                pnt1 = itr.transform(pnt1);
                pnt2 = itr.inverseTransform(pnt2);
                console.log('pnt1:', splaneToString(pnt1,6), splaneToString(pnt2,6));
            }
        }
        let m = getMatrixH4(itr);
        let res = analyzeTransformH4(m);
        if(debug) console.log('res: ', res);
        if(res.hasTranslation){
            let fp1 = res.fp[0];
            let fp0 = res.fp[1];
            let par = {
                fp0x: fp0.v[0],
                fp0y: fp0.v[1],
                fp1x: fp1.v[0],
                fp1y: fp1.v[1],
                translation: res.periods[0],  
                rotation: 0.0,
            };
            if(res.hasRotation){
                par.rotation = -res.rotations[0];
            }
            //this.setParamsMap(par);
            setParamValues(this.mParams, par);
        }
        this.informListener();
    }


    onTest() {
        
    }
    
    getGroup(){
        let gm = this.groupMaker;
        let group = (gm && gm.getGroup) ? gm.getGroup() : null;
        if(DEBUG)console.log(`${MYNAME}.getGroup(): `, group);
        if(!group) return null;
        if(!(group instanceof Group)){
          group = new Group(group);
        }                    
        return group;
    }
    onAnalyzeTransforms() {

        if(DEBUG)console.log('onAnalyzeTransforms()');
        if(!this.groupMaker) {
            console.error(`${MYNAME}.onAnalyzeTransforms(), this.groupMaker undefined`);
            return;
        }
        let group = this.getGroup();

        if(DEBUG)console.log('group: ', group);
        if(!group || !group.getTransforms) {
            console.error(`${MYNAME}.onAnalyzeTransforms(), group.getTransforms undefined, group: `, group);
            return;
        }
        let gens = group.getTransforms();
        if(DEBUG)console.log('gens: ', gens);

        let transClass = makeTransformClassificationU4(gens, ANALYZE_PARAMS);
        if(DEBUG)console.log('transClass: ', transClass);
        let tree = this.createClassificationTree(transClass);
        const count = transClass.acceptedCount;
        getTransformsWindow().show(tree, {
            note: `${count} element${count === 1 ? '' : 's'} of the group with periods up to ${ANALYZE_PARAMS.maxPeriod}, ` +
                  `by their kinds; a click on a word takes it, on a group its first word`,
        });

    }

    //
    // creates a UI tree from transform classification data: the kinds (with their
    // counts, greyed when empty), in each the groups of the powers of one element
    // (named by its period and rotation), in each the words; a click on a word sets
    // it, on a group the group's first word (the shortest element)
    //
    createClassificationTree(transClass){

        const setWord = (word) => this.mParams.word.setValue(word);
        let root = new TreeNode({txt: 'transforms classification'});
        let types = TRANSFORM_TYPES;
        for(let i = 0; i < types.length; i++){
            let type = types[i];
            let tdata = transClass[type];
            let tnode = new TreeNode({txt: type, note: String(tdata.count), dim: !tdata.count});
            root.appendChild(tnode);
            let keys = Object.keys(tdata).filter(key => key !== 'count');
            keys = keys.sort(compareBucketKeys);

            for(let k = 0; k < keys.length; k++){
                let key = keys[k];
                let tarray = tdata[key];
                let tanode = new TreeNode({txt: key, note: String(tarray.length), userData: tarray,
                                           title: 'the powers of one element; a click takes the first word: ' + tarray[0].word});
                tanode.setCallback(() => setWord(tarray[0].word));
                tnode.appendChild(tanode);
                for(let j = 0; j < tarray.length; j++){
                    let transdata = tarray[j];
                    let transNode = new TreeNode({txt: transdata.word, userData: transdata});
                    transNode.setCallback(() => setWord(transdata.word));
                    tanode.appendChild(transNode);
                }
            }
        }
        return root;

    }
    
    getClassName(){
        return MYNAME;
    }
  
  
    onTestAnalyzer_3() {
        
        let s1 = iSphere([0.5, 0,0,0.1]);
        let s2 = iSphere([-0.5, 0,0,-0.1]);
        for(let i = 0; i <= 10; i++){
            let st = iLerpU4(s1,s2,0.1*i);
            console.log('st:',splaneToString(st));                
        }       
        
    }
    
    //
    //  testing combination of hyperbolic translation and elliptical rotation having common  fixed points 
    //  (R,0) and (-R,0)
    //  
    onTestAnalyzer_2() {
        let R = 0.9; // distance from origin to fixed point
        let r = 3;   // radius of hyperbolic translation 
        let c = Math.sqrt(R * R + r * r); // center of translation sphere 
        let a = Math.PI / 4; // total rotation
        let sina = Math.sin(a);
        let cosa = Math.cos(a);
        let beta = Math.PI / 5; // half angle of elliptical rotation
        let cosb = Math.cos(beta);
        let sinb = Math.sin(beta);
        let rd = R / sinb; // radius of elliptical transform generator
        let d = rd * cosb; // center of elliptical transform generator (0,d)
        console.log('c: ', c, ' r:', r, 'R:', R);
        console.log('d: ', d, ' rd:', rd);
        console.log('sinb: ', sinb, cosb);
        console.log('sina: ', sina, cosa);
        let s1 = new iSphere([-c, 0, 0, r]);
        let s2 = new iSphere([c, 0, 0, r]);
        let s3 = new iSphere([0, d, 0, rd]);
        let s4 = new iSphere([0, -d, 0, rd]);
        let s3r = new iSphere([d * sina, d * cosa, 0, rd]);
        let s4r = new iSphere([-d * sina, -d * cosa, 0, rd]);
        let s1r = new iSphere([-c * cosa, c * sina, 0, r]);
        let s2r = new iSphere([c * cosa, -c * sina, 0, r]);

        //let itr = new ITransform([s1,s2]);
        //let itr = new ITransform([s3,s4]);
        //let itr = new ITransform([s1r,s2r]);
        //let itr = new ITransform([s3r,s4r]);
        //let itr = new ITransform([s3r,s4r, s3r, s4r]);
        //let itr = new ITransform([s1,s2, s3, s4]);
        let itr = new ITransform([s1r, s2r, s3r, s4r]);
        //let itr = new ITransform([s1r, s3r, s2r, s4r]);
        //let itr = new ITransform([s3r,s4r, s1r, s2r]);

        // fixed points
        let fp = iPoint([R * cosa, -R * sina, 0, 0]);
        console.log('fp:', splaneToString(fp));

        let p1 = iPoint([0, 0, 0, 0]);
        console.log('p1:', splaneToString(p1));
        for (let i = 0; i < 6; i++) {
            p1 = itr.transform(p1);
            console.log('p1:', splaneToString(p1));
        }

        let m = getMatrixH4(itr);
        let res = analyzeTransformH4(m);
    }

  
} // class FixedPointsTransform