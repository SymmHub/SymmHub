import {
    nonNegHashOrbifold,
    WallpaperGroups,
    WallpaperGroupNames,
    getWallpaperGroupIndex,
    iGroup_Trivial,
    iGroup_S442,
    iGroup_442,
    iGroup_4S2,
    iGroup_S632,
    iGroup_632,
    iGroup_3S3,
    iGroup_S333,
    iGroup_333,
    iGroup_S2222,
    iGroup_2222_,
    iGroup_2222,
    iGroup_2S22,
    iGroup_22S,
    iGroup_SS,
    iGroup_SX,
    iGroup_22X,
    iGroup_XX,
    iGroup_O,
    iGroup_SN,
    iGroup_N,
    iGroup_SNN,
    iGroup_NN,
    iGroup_NX,
    iGroup_NS,
    iGroup_S22N,
    iGroup_22N,
    iGroup_2SN,
    iGroup_S532,
    iGroup_532,
    iGroup_S432,
    iGroup_432,
    iGroup_S332,
    iGroup_332,
    iGroup_3S2,
    getNonnegativeGroupData,
    iWallpaperGroup
}
from "./WallpaperGroups_NonNegative.js";

import {
    keys,
    lengthKeys,
    twistKeys,
    hashOrbifoldString,
    countParameters,
    hashOrbifold,
    atomizeOrbifold,
    unfoldAtom,
    assembleFundamentalDomain,
    produceGenerators,
    willOrbifoldFitQ
}
from '../../../lib/invlib/OrbifoldGeometrization.js';

import {
    random,
    isDefined
}
from '../../../lib/invlib/Utilities.js';

import {
    sPlaneThrough
}
from '../../../lib/invlib/ComplexArithmetic.js';

const DEFAULT_INCREMENT = 1.e-8;

/*
provides generators for general wallpaper group
 */

export const TWISTMAXVALUE = .5;
export const TWISTMINVALUE =  - .5;
export const LENGTHMAXVALUE = 4;
export const LENGTHMINVALUE = .3;

const MYNAME = 'WallPaperGroup_General';

export class WallPaperGroup_General {

    constructor(options) {

        this.generalHyperbolicGroupGuiParams = [];
        this.guiParams = [];
        this.guiParams["name"] = "32x";
        this.curvature = -1; // for switching as needed.
        this.standardName = ""; // for the Euclidean and spherical groups; ignored in hyperbolic case
        this.nnn = 0; // to stash a possible parameter for spherical groups;

        this.errorLog = "";
        this.parN = 0;
        this.parCounts = [];
        this.atomList = [];
        this.defaultIncrement = DEFAULT_INCREMENT;
        this.randomOffsetRange = .001; // to put the group into general position by default

        this.symmetryUIController = options.symmetryUI;
        this.fundamentalDomainPoints; // if the transform is not conformal, this is an
        // array of arrays of points; otherwise, a list of splanes.
        // If the fundamental domain is not being shown, it is empty.
        this.needsShiftQ = false;
        this.paramGuiFolder = null;

    }

    initGUI(options) {
        this.gui = options.gui;
        this.paramGui = options.folder;
        var me = this;
        this.paramGui.gpname = this.paramGui.add(this.guiParams, "name").onChange(function () {
            me.groupNameChanged();
        })
            this.groupNameChanged();

        this.onChanged = options.onChanged; // At the moment, this is the only one used.
        this.canvas = options.overlayCanvas;
        this.groupConfig = options.groupConfig;
        this.renderer = options.renderer;
        this.transform = this.renderer.myNavigator;

        //this.gui.remember(this.guiParams);

        this.symmetryUIController.init({
            renderer: this.renderer,
            transform: this.transform,
            onChanged: this.onChanged
        });

    };

    handleEvent(evt) { //just pass these along...
        this.symmetryUIController.handleEvent(evt);
    }

    groupParamsChanged() {
        // console.time("paramsChanged")
        this.updateTheGroupGeometry();
        // the first time we hit this is when the constructor is called,
        // before initGUI; consequently, onChanged will not yet be defined.

        // some of the parameters changing require a shift which needs to be calculated
        if (this.needsShiftQ) {
            this.symmetryUIController.setShift();
            // does not seem to force an update from InversiveNavigator
        }

        if (isDefined(this.onChanged)) {
            this.onChanged();
        }
        //   console.timeEnd("paramsChanged")
    };

    groupNameChanged() {
        var okQ = this.updateTheGroup();
        if (okQ) {
            this.groupParamsChanged()
        };
        // else what? Not really clear what the right behavior should be.
        // the group doesn't change, but the symbol in the text box is wrong.
    };

    getParamsMap() {
        var returnP = {
            "name": this.guiParams["name"]
        }
        var label;
        var me = this;
        var i;
        //return this.guiParams; // will save too much
        // there might be labels hanging around from other groups,
        // so only save the ones we actually want:
        lengthKeys.forEach(function (key) {
            for (i = 1; i <= me.parCounts[key]; i++) {
                label = key + "_" + i.toString() + "_l";
                returnP[label] = me.guiParams[label]
            }
        })

        twistKeys.forEach(function (key) {
            for (i = 1; i <= me.parCounts[key]; i++) {
                label = key + "_" + i.toString() + "_t";
                returnP[label] = me.guiParams[label]
            }
        })

        return returnP;
    }

    setParamsMap(paramsMap) {

        // we are assuming nothing malicious is going on!

        if (paramsMap.name != undefined) {
            this.guiParams.name = paramsMap.name;
        }

        var me = this;

        // first figure out which parameters we have to work with:
        // only use parameters of the correct form, currently, "name" or
        // KEY+"_"+N+"_t" or KEY+"_"+N+"_l"
        // we'll assume that _t and _l are sufficient to
        // ensure the rest is well-formed

        var params = {};
        Object.keys(paramsMap).map(x => {
            var y = x.split('_');
            if ((y.length) == 3 && ((y[2] == 't') || (y[2] == 'l'))) {
                me.guiParams[x] = paramsMap[x]
            }
        })
        // this.paramGui.__controllers[0].setValue(this.guiParams.name)
        this.paramGui.gpname.setValue(this.guiParams.name);
        this.rebuildGui();
        this.updateTheGroup();

    }

    rebuildGui(text = "") { // this.guiParams[name] is presumed defined

        console.log(`${MYNAME}.rebuildGui(${text})`, this.paramGuiFolder);
        if (this.paramGuiFolder)
            this.paramGui.removeFolder(this.paramGuiFolder);
        if (text == "") {
            this.paramGuiFolder = this.paramGui.addFolder('Parameters for ' + this.guiParams["name"]);
            this.paramGuiFolder.open()
        } else {
            this.paramGuiFolder = this.paramGui.addFolder(text)
        }
    }

    updateTheGroup() {
        // re-initialize these global variables
        // this will be worked out as we proceed in Step 1
        this.parCounts = [];
        var pparCounts = this.parCounts; //because scope of this not clear in:
        keys.forEach(function (key) {
            pparCounts[key] = 0
        })
        this.parN = 0;

        var orbifoldString = this.guiParams["name"];
        var hashed = hashOrbifoldString(orbifoldString);
        this.curvature = hashed.curvature;

        this.errorLog = hashed.errorMessage;
        if (this.errorLog != "") // is there an error?
        {
            console.log(this.errorLog)
            this.rebuildGui(this.errorLog)
            return false; //not Ok
        }

        var rehashed;

        if (this.curvature < 0) {
            this.parN = countParameters(hashed);
            rehashed = hashOrbifold(hashed, this.parCounts)
                this.outMessage = "orbifold area = 2pi*" + Number.parseFloat(hashed.eulerchar).toFixed(2).slice(1, -1) + "\nManipulate the " + this.parN + " parameters at right to change the orbifold geometry."

                this.atomList = atomizeOrbifold(rehashed, this.parCounts);

            // we make a check to see if we are going to have enough walls for our fundamental
            // domain and enough reflections for our generators

            //console.log(arrayToString(this.atomList))

            // only use if webgl is being used.
            if (this.renderer && willOrbifoldFitQ(this.atomList, this.renderer.MAX_GEN_COUNT,
                    this.MAX_REF_COUNT, this.MAX_DOMAIN_SIZE)) {
                this.rebuildGui("Reduce the size of the orbifold symbol");
                return false;
            } else {
                this.rebuildGui();
            }
        }

        if (this.curvature >= 0) {
            var output = nonNegHashOrbifold(hashed, this.parCounts, this.curvature);
            this.standardName = output.standardName;
            this.nnn = output.nnn;
            this.rebuildGui();
        }

        var i = 0;

        var me = this;
        this.paramGuiFolderItems = {};
        lengthKeys.forEach(function (key) {
            for (i = 1; i <= me.parCounts[key]; i++) {
                if (typeof me.guiParams[key + "_" + i.toString() + "_l"] == "undefined") {
                    me.guiParams[key + "_" + i.toString() + "_l"] = 2 + (me.randomOffsetRange) * (random() - .5)
                }
                me.paramGuiFolderItems[key + "_" + i.toString() + "_l"] =
                    me.paramGuiFolder.add(me.guiParams, key + "_" + i.toString() + "_l",
                        LENGTHMINVALUE, LENGTHMAXVALUE, me.defaultIncrement).onChange(
                        function () {
                        me.groupParamsChanged();
                    });

            }
        });

        twistKeys.forEach(function (key) {
            for (i = 1; i <= me.parCounts[key]; i++) {
                if (typeof me.guiParams[key + "_" + i.toString() + "_t"] == "undefined") {
                    me.guiParams[key + "_" + i.toString() + "_t"] = 0
                }
                me.paramGuiFolderItems[key + "_" + i.toString() + "_t"] =
                    me.paramGuiFolder.add(me.guiParams, key + "_" + i.toString() + "_t",
                        TWISTMINVALUE, TWISTMAXVALUE, me.defaultIncrement).onChange(
                        function () {
                        me.groupParamsChanged();
                    });
            }
        })

        return true; //all is Ok

    }

    updateTheGroupGeometry() {

        var bounds = [];
        var transforms;
        var interiors = [];

        if (this.curvature < 0) {

            this.assembledFD = assembleFundamentalDomain(this.atomList, this);
            // assembledFD[0]=[vertList,edgeKeyList]
            // assembledFD[1] is a list of internal edges;
            // assembledFD[2] will be a list of cone points TO DO.

            this.generators = produceGenerators(this.assembledFD[0], this)
                var i,
            ss;
            var fdpts = this.assembledFD[0][0];
            for (i = 0; i < fdpts.length; i++) {

                // sPlanes have endpoints included -- thus we can draw our FD as arcs on
                // the javascript side
                // As a legacy kludge, add the info about the type of bound by hand.
                var abound = sPlaneThrough(fdpts[i], fdpts[(i + 1) % (fdpts.length)],
                        [fdpts[i], fdpts[(i + 1) % (fdpts.length)]]);
                abound["label"] = this.assembledFD[0][1][i];
                var bound = [abound];

                // In inversive.frag, a pixel is checked against each FD.bound in turn to see
                // if the corresponding generator should be applied. Nearly always an element of
                // FD.bound should consist of a single sPlane. However, particularly when the
                // "third" vertex of a pillow is a tube, the cutting edge from the "second" to
                // the third vertex should also be supplemented with a "wall".
                // Coming out of assembleFundamentalDomain, this information is stashed as an
                // additional pair of points at the end of the edge key;
                for (var j = 2; j < this.assembledFD[0][1][i].length; j += 2) {
                    bound.push(sPlaneThrough(
                            this.assembledFD[0][1][i][j], this.assembledFD[0][1][i][j + 1]))
                }

                bounds.push(bound)
            }

            transforms = this.generators;

            // the interior edges
            interiors = this.assembledFD[1].map(x => {
                var abound = sPlaneThrough(x[0][0], x[0][1], x[0]);
                abound["label"] = x[1];
                return [abound];
            })
        } //endif curvature<0
        else if (this.curvature >= 0) {
            var igroup = getNonnegativeGroupData(this.standardName, this);
            bounds = (igroup.s).map(x => {
                x.bounds = [NaN, NaN];
                return [x]
            });
            // add the bounding info inside getEuclideanGroupData
            transforms = igroup.t;
            interiors = [];
        }
        this.FD = {
            s: bounds,
            t: transforms,
            i: interiors
        };
    }

    getGroup() {
        return this.FD
    }

    render(context, transform) {
        this.fundamentalDomainPoints = this.symmetryUIController.render(context, transform)

    }

    getUniforms(uniforms) {
        this.symmetryUIController.getUniforms(uniforms)
    }

} // class Group_GeneralHyperbolic

