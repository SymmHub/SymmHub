import {
    ParamGroup,
    ParamBool,
    ParamFloat,
    ParamColor,
    hexToPremult,
    DataPacking,
} from '../modules.js';
import { makeOverlayItem } from './OverlayItem.js';
import {
    generatorElements,
    subgroupGeneratorElements,
    packGeneratorElementsToSampler,
} from '../../grouplib/GeneratorElements.js';

const MYNAME = 'OverlayGenerators';
const DEBUG = false;

//
//  generators: the pairing sides of the fundamental domain with a shadow, and
//  the symmetry elements of the generators (lib/grouplib/GeneratorElements.js):
//  cone points as hurricane symbols with as many arms as the order of the
//  rotation, mirrors as lines, glide axes as dashed lines with the glide vector
//  as an arrow, translations as arrows.  With a subgroup symmetry the elements
//  are those of the generators of the subgroup, the pairings of its domain.
//
//  The elements are computed from the group of the render pass (the
//  renderer's transformed group) when it changes, and packed into the item's
//  own data texture (uGenData).
//
export function OverlayGenerators(par = {}) {

    let mSampler    = null;    // the packed elements
    let mLastGroup  = null;    // the group the elements were computed from
    let mLastDomain = null;    // the subgroup domain they were computed from, null for the group itself
    let mElements   = [];

    /** the elements of the generators of the group, or of the subgroup of the item's symmetry, in the sampler */
    function ensureElements(rpar, ctx) {
        const gl = ctx.glCtx ? ctx.glCtx.gl : null;
        if (!gl || !rpar.group) return null;
        if (!mSampler) mSampler = DataPacking.createGroupDataSampler(gl);
        const sym = ctx.symmetry;
        const domain = (sym && sym.usesSubgroup) ? sym.getDomain() : null;
        if (rpar.group !== mLastGroup || domain !== mLastDomain) {
            mLastGroup  = rpar.group;
            mLastDomain = domain;
            try {
                mElements = domain ? subgroupGeneratorElements({ group: rpar.group, domain })
                                   : generatorElements({ group: rpar.group });
            } catch (e) {
                console.warn(`${MYNAME}: no generator elements: ${e.message}`);
                mElements = [];
            }
            if (DEBUG) console.log(`${MYNAME}: ${mElements.length} elements`, mElements);
            packGeneratorElementsToSampler(gl, mSampler, mElements);
        }
        return mSampler;
    }

    return makeOverlayItem({
        className: MYNAME,
        program:   'overlayGenerators',
        symmetry:  true,
        defaults: {
            showSides: true,
            width: 2,
            color: '#0000AAAA',
            shadow: {
                enabled: true,
                width:   10,
                color:   '#0000AA55',
            },
            elements: {
                enabled: true,
                width:   2,
                cone: {
                    enabled: true,
                    size:    12,
                    color2:  '#283CDCCC',
                    color3:  '#F08C14CC',
                    color4:  '#14AA78CC',
                    color6:  '#E61EC8CC',
                    color:   '#808080CC',
                    outline: '#000000C0',
                },
                mirror: {
                    enabled: true,
                    color:   '#AA0000FF',
                },
                glide: {
                    enabled: true,
                    color:   '#AA00AAFF',
                    dash:    8,
                },
                translation: {
                    enabled: true,
                    color:   '#008888FF',
                },
            },
        },
        makeParams: (cfg, oc) => ({
            showSides: ParamBool({ obj: cfg, key: 'showSides', name: 'sides', onChange: oc }),
            width:  ParamFloat({ obj: cfg, key: 'width', onChange: oc }),
            color:  ParamColor({ obj: cfg, key: 'color', onChange: oc }),
            shadow: ParamGroup({
                name: 'shadow',
                params: {
                    enabled: ParamBool({ obj: cfg.shadow, key: 'enabled', onChange: oc }),
                    color:   ParamColor({ obj: cfg.shadow, key: 'color', onChange: oc }),
                    width:   ParamFloat({ obj: cfg.shadow, key: 'width', onChange: oc }),
                }
            }),
            elements: ParamGroup({
                name: 'elements',
                params: {
                    enabled: ParamBool({ obj: cfg.elements, key: 'enabled', onChange: oc }),
                    width:   ParamFloat({ obj: cfg.elements, key: 'width', min: 0, max: 20, step: 0.1, onChange: oc }),
                    cone: ParamGroup({
                        name: 'cone points',
                        params: {
                            enabled: ParamBool({ obj: cfg.elements.cone, key: 'enabled', onChange: oc }),
                            size:    ParamFloat({ obj: cfg.elements.cone, key: 'size', min: 1, max: 100, step: 0.5, onChange: oc }),
                            color2:  ParamColor({ obj: cfg.elements.cone, key: 'color2', name: 'order 2', onChange: oc }),
                            color3:  ParamColor({ obj: cfg.elements.cone, key: 'color3', name: 'order 3', onChange: oc }),
                            color4:  ParamColor({ obj: cfg.elements.cone, key: 'color4', name: 'order 4', onChange: oc }),
                            color6:  ParamColor({ obj: cfg.elements.cone, key: 'color6', name: 'order 6', onChange: oc }),
                            color:   ParamColor({ obj: cfg.elements.cone, key: 'color', name: 'other orders', onChange: oc }),
                            outline: ParamColor({ obj: cfg.elements.cone, key: 'outline', onChange: oc }),
                        }
                    }),
                    mirror: ParamGroup({
                        name: 'mirrors',
                        params: {
                            enabled: ParamBool({ obj: cfg.elements.mirror, key: 'enabled', onChange: oc }),
                            color:   ParamColor({ obj: cfg.elements.mirror, key: 'color', onChange: oc }),
                        }
                    }),
                    glide: ParamGroup({
                        name: 'glides',
                        params: {
                            enabled: ParamBool({ obj: cfg.elements.glide, key: 'enabled', onChange: oc }),
                            color:   ParamColor({ obj: cfg.elements.glide, key: 'color', onChange: oc }),
                            dash:    ParamFloat({ obj: cfg.elements.glide, key: 'dash', min: 0, max: 100, step: 0.5, onChange: oc }),
                        }
                    }),
                    translation: ParamGroup({
                        name: 'translations',
                        params: {
                            enabled: ParamBool({ obj: cfg.elements.translation, key: 'enabled', onChange: oc }),
                            color:   ParamColor({ obj: cfg.elements.translation, key: 'color', onChange: oc }),
                        }
                    }),
                }
            }),
        }),
        getUniforms: (cfg, rpar, ctx) => {
            const el = cfg.elements;
            const uni = {
                uGensSidesEnabled:   cfg.showSides,
                uGensWidth:          cfg.width,
                uGensColor:          hexToPremult(cfg.color),
                uGensShadowsEnabled: cfg.shadow.enabled,
                uGensShadowsColor:   hexToPremult(cfg.shadow.color),
                uGensShadowsWidth:   cfg.shadow.width,
                uGenElemEnabled:     false,
            };
            if (el.enabled) {
                const sampler = ensureElements(rpar, ctx);
                if (sampler && mElements.length > 0) {
                    Object.assign(uni, {
                        uGenElemEnabled:    true,
                        uGenData:           sampler,
                        uGenElemWidth:      el.width,
                        uGenConeEnabled:    el.cone.enabled,
                        uGenConeSize:       el.cone.size,
                        uGenConeColor2:     hexToPremult(el.cone.color2),
                        uGenConeColor3:     hexToPremult(el.cone.color3),
                        uGenConeColor4:     hexToPremult(el.cone.color4),
                        uGenConeColor6:     hexToPremult(el.cone.color6),
                        uGenConeColorN:     hexToPremult(el.cone.color),
                        uGenConeOutline:    hexToPremult(el.cone.outline),
                        uGenMirrorEnabled:  el.mirror.enabled,
                        uGenMirrorColor:    hexToPremult(el.mirror.color),
                        uGenGlideEnabled:   el.glide.enabled,
                        uGenGlideColor:     hexToPremult(el.glide.color),
                        uGenGlideDash:      el.glide.dash,
                        uGenTransEnabled:   el.translation.enabled,
                        uGenTransColor:     hexToPremult(el.translation.color),
                    });
                }
            }
            return uni;
        },
    }, par);
}
