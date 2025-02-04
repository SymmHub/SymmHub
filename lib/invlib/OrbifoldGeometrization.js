import {complexN,poincareTurtleMove,poincareMobiusEdgeToEdge,
  poincareMobiusTranslateFromToByD,sPlaneSwapping,poincareMobiusRotationAboutPoint,
  sPlaneReflectAcross,makeMobius,
  poincarePt,poincareMobiusTranslateToO,sPlanesMovingEdge1ToEdge2} 
    from './ComplexArithmetic.js';
import {PI,HPI,TPI,abs,cos,cosh,sin,sinh,coth,asin,sqrt,cot,acosh,asinh,tanh} 
  from './Utilities.js';
//////////////////////////////////////////////////

//////////////////////////////////////////////////

// GEOMETRIZING AN ORBIFOLD

//////////////////////////////////////////////////

/* 
An orbifold is described by its topology: 
each handle is represented by an O (or o), each cross cap by an X (or x), and each boundary by a *
Cone points in the interior of an orbifold are denoted by a counting number >=2; 
and corner points on a boundary are similarly denoted, following *. 
Numbers >=10 are demarcated by parenthesis. 

As loosely described in Thurston's Geometry of Three-Manifolds, and at somewhat greater length in Adam Deaton's 
1994 Princeton University undergraduate thesis, we may geometrize an orbifold by first 
decomposing it into "atoms" hyperbolic triangles, hats and pillows, of the form *pqr, p*r, pqr, where 
the vertices may be cone or corners. Following Thurston, however, the angles may be imaginary, 
giving geodesics that are perpendicular to the sides of the triangle. Atoms are then unfolded into 
polygons, and then reassembled into a fundamental domain. 

In order to ensure the atoms have hyperbolic structure, some features must be combined, such as 
pairs of 2-fold cone points or corners. We will end up with edges of the types listed as "keys"

*/



export var keys = ["handle", "cap", "conePt", "conePair", "tube", "mirror", "mirrorRedundant", 
      "cornerPair", "fold", "band", "slice", "cuttingEdge","edge"];

// these keys will have a length parameter; the length of an edge with any of these keys can be varied
export var lengthKeys = ["handle", "cap","fold", "conePt", "conePair", "tube","band", "slice", "cornerPair"];

// these keys will have an additional twist parameter
export var twistKeys = ["handle", "conePair", "tube"];

/// temp notes on recording cone and corner points:
/// ultimately want to record these in the UI
/// spit out in FD
/// cuttingEdge, mirror can be followed by an integer
/// in unfoldAtom this is recorded
/// at the end of assembleFundamentalDomain these are collected from:
/// cuttingEdge of length 3, conePair, fold, 
/// (Where is the twist component of conePair?)



// Given a string putatively describing a hyperbolic orbifold, return
// [errorMessage, handlesN, crosscapsN, conepoints, kaleidoscopes, eulerchar]
//  errorMessage ="" is the string is ok;  
//  handlesN, crosscapsN are the numbers of handles and crosscaps respectively
// conepoints is an array of conepoint orders
// kaleidoscopes is an array of arrays of cornerpoint orders; 
// eulerchar is the orbifold Euler characteristic.
// For example,  43xo**33x2 => ["",1,2,[4,3,2],[[],[3,3]],-6.5833]

// Positive- and zero-curvature orbifolds will be dispatched differently. 

export function hashOrbifoldString(orbifoldString)
{
    var substring = orbifoldString;
    var handlesN = 0;
    var crosscapsN = 0;
    var conepoints = [];
    var kaleidoscopes = [];
    var noErrorQ = true;
    var notOnKaleidoQ = true;
    var inParensQ = false;
    var currentN = 0;
    var errorMessage = "";
    var tempString = "";
    var digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    var tempCntr = 0;

    while (substring !== "" && noErrorQ)
    {
        let s = substring[0];
        substring = substring.substr(1);
        if (inParensQ)//if we're somewhere after an opening "("
        {
            if (s === ')')// and we're now closing up a ")"
            {
                inParensQ = false;
                if (currentN === 0 || currentN === 1)//do we have a valid number?
                {
                    noErrorQ = false;
                    if (notOnKaleidoQ) {
                        errorMessage = 'Cone point of order ' + currentN
                    }
                    else {
                        errorMessage = 'Kaleidoscopic point of order ' + currentN
                    }
                }
            }
            else //otherwise, still in the parentheses, but check if we have a number
            if (digits.includes(s)) {
                currentN = currentN * 10 + Number(s)
            }
            else {
                errorMessage = 'Poorly formed expression'
            }
        }

        else // so we're not in parentheses:
        if (s === '(') {
            inParensQ = true;
        }
        else if (digits.includes(s)) {
            currentN = Number(s);
            if (currentN == 0 || currentN == 1)
            {
                noErrorQ = false;
                if (notOnKaleidoQ) {
                    errorMessage = 'Cone point of order ' + currentN
                }
                else {
                    errorMessage = 'Kaleidoscopic point of order ' + currentN
                }
            }
        }
        else if (s === 'x' || s === 'X') {
            notOnKaleidoQ = true;
            crosscapsN++;
        }
        else if (s === 'o' || s === 'O') {
            notOnKaleidoQ = true;
            handlesN++;
        }
        else if (s === '*') {
            notOnKaleidoQ = false;
            kaleidoscopes.push([]);
        }
        else {
            noErrorQ = false;
            errorMessage = 'Poorly formed expression';
        }


        if (currentN != 0 && noErrorQ && !inParensQ) {
            if (notOnKaleidoQ) {
                conepoints.push(currentN)
            }
            else {
                var lastScope = kaleidoscopes.pop();
                lastScope.push(currentN);
                kaleidoscopes.push(lastScope);
            }
        }
        if (!inParensQ) {
            currentN = 0
        }
    }


    if (noErrorQ && handlesN == 0 && crosscapsN == 0)
    {
        //still have some checking to do!
        if (conepoints.length == 0)
        {
            //verify that the kaleidos are in good shape
            if (kaleidoscopes.length == 0)
            {
                noErrorQ = false;
                errorMessage = "Empty orbifold!" 
            }
            else if (kaleidoscopes.length == 1)
            {
                var lastScope = kaleidoscopes[kaleidoscopes.length - 1];
                if (lastScope.length == 1)
                {
                    noErrorQ = false;
                    errorMessage =
                    "Single kaleidoscopic point -- not yet implemented" // *n
                }
                else if (lastScope.length == 2)
                {
                    if (!(lastScope[lastScope.length - 1] === lastScope[lastScope.length - 2]))
                    {
                        noErrorQ = false;
                        errorMessage = "Poorly formed orbifold" // a teardrop of the form *pq, p!=q
                    }
                }
            }
        }
        else if (kaleidoscopes.length == 0)
        {
            if (conepoints.length == 1)
            {
                noErrorQ = false;
                errorMessage =
                "Single rotation point -- not yet implemented"  // n
 
            }
            else if (conepoints.length == 2)
            {
                if (!(conepoints[conepoints.length - 1] == conepoints[conepoints.length - 2]))
                {
                    noErrorQ = false;
                    errorMessage = "Poorly formed orbifold" // a teardrop of the form pq, p!=q
                }
            }
        }
    }

    var eulerchar = NaN;
  var curvature = -1;

    if (errorMessage == "") {
        // let's calculate Euler characteristic 
        eulerchar = 2 - 2 * handlesN - crosscapsN - kaleidoscopes.length;
        conepoints.forEach(function(conept) {
            eulerchar = eulerchar - (1 - 1 / conept)
        });
        kaleidoscopes.forEach(function(kscope) {
            kscope.forEach(function(cornerpt) {
                eulerchar = eulerchar - .5 * (1 - 1 / cornerpt)
            })
        })

    
    // the smallest negative orbifold is *237 of char -1/84
    // the smallest positive orbifold is *235 of char 1/60

        if (eulerchar > -0.001) {
      if(eulerchar < .01){  
        curvature = 0;
      //  errorMessage = "euclidean symmetries not yet supported";
            }
      else {
      //  errorMessage = "spherical symmetries not yet supported";
        curvature = 1;
      }
    }

    }

    return {"errorMessage":errorMessage, 
      "handlesN":handlesN, 
      "crosscapsN":crosscapsN, 
      "conepoints":conepoints, 
      "kaleidoscopes":kaleidoscopes, 
      "eulerchar":eulerchar,
      "curvature":curvature}
}



export function countParameters(hashedOrbifold) {
    // We work out the number of parameters; this information is stashed in theGroup.parN 
  // but is not really used, except in messages in the gui. 

    var numParameters = -6 + 6 * hashedOrbifold.handlesN + 3 * hashedOrbifold.crosscapsN + 2 * hashedOrbifold.conepoints.length +
    3 * hashedOrbifold.kaleidoscopes.length;
    hashedOrbifold.kaleidoscopes.forEach(function(kal) {
        numParameters = numParameters + kal.length
    })
    return numParameters

}

export function hashOrbifold(hashedOrbifold,parCounts)
{
    //we assume that the orbifold is in the form outputted by hashOrbifoldString
    if (!(hashedOrbifold.errorMessage === "")) {
        return hashedOrbifold.errorMessage
    }

    //we will not worry about converting mixed handles and crosscaps to all crosscaps.

    /* As per Deaton's thesis, we will
        a) convert pairs of 2-fold cone points to 'rot2 cone points'
            b) if there is a mirror and an extra 2-fold point, convert this to a fold
            c) open up all the handles and crosscaps
            d) create one kaleidoscope by cutting along "bands"
    This ensures that there will be a well-defined procedure for chopping the orbifold up into
    hyperbolic atoms.
    
    */

// We will return [newConePointList, nextnewKaleidoList], each an array of numbers and keys.
// parCounts will store the number of each kind of key, as well as the index of the last of that key added
// Ultimately, parCounts is part of the theGroup structure. 

    var newConePointList = [];
    var newKaleidoList = [];
    var i;

    //handles
    for (i = 1; i <= hashedOrbifold.handlesN; i++)
    {
        newConePointList.push(["handle", i]);
        newConePointList.push(["handle", /*-*/i]); 
    //we would need to know which is which if we are 
    //concerned about removing conjugate generators, and can encode this in the sign of the key
    //If this is used, be sure to take abs when finding matching edges to produce generators.
    //However, in the current version of the code, this is not necessary or helpful.
    }
    parCounts["handle"] = i - 1; // these will actually get two parameters, a twist and a length.

    //crosscaps
    for (i = 1; i <= hashedOrbifold.crosscapsN; i++)
    {
        newConePointList.push(["cap", i]);
    }
    parCounts["cap"] = i - 1; //working??

    // cone points, glomming pairs of 2-fold points together...
    var paired2Q = false;

    var i = 0;
    hashedOrbifold.conepoints.forEach(function(conept) {

        if (conept != 2) {
            newConePointList.push(["conePt", conept])
        }
        else if (paired2Q) {
            i++;
            newConePointList.push(["conePair", i]);
            paired2Q = false
        }
        else {
            paired2Q = true;
        }
    })
    parCounts["conePair"] = i;
    parCounts["fold"] = 0;

    //... but if there's a leftover 2-fold cone point:
    if (paired2Q) {
        // and no mirror, put it on the cone list
        if (hashedOrbifold.kaleidoscopes.length == 0) {
            newConePointList.push(["conePt", 2])
        }
        else // add a fold corner onto the newKaleidolist
        {
            newKaleidoList.push(["fold", 1]);
            parCounts["fold"] = 1;
        }
    }

    // now on to the bands

    // if there ARE any kaleidos to worry about
    if (hashedOrbifold.kaleidoscopes.length > 0)
    {
        if (hashedOrbifold.kaleidoscopes.length == 1 &&
        hashedOrbifold.kaleidoscopes[0].length == 0 &&
        parCounts["fold"] == 0)
      // if there's really just one mirror, 
      // we need something to know it's there;
        {
            newKaleidoList.push("mirror"); 
            parCounts["mirror"] = 1;
        }
        //put the first one on the new list
/// It would be better to figure out how to distribute these across the orbifold ///
/// instead of stacking them all up on one edge.
/// *** There is definitely room for improvement
        {
            hashedOrbifold.kaleidoscopes[0].forEach(function(corner) {
                newKaleidoList.push(["corner", corner])
            })// now add any others, together with bands
            i = 0;
            hashedOrbifold.kaleidoscopes.slice(1).forEach(function(kaleido)
            {
                i++;
                newKaleidoList.push(["band", i])
                kaleido.forEach(function(corner) {
                    newKaleidoList.push(["corner", corner])
                });
            });
            parCounts["band"]=i;
            //now add the remaining bands
            for (i; i > 0; i--)
            {
                newKaleidoList.push(["band", i])
            }
        }
    }

    //now we need to go through and remove consecutive pairs of two fold rotations.
    // since there are bands at the end of this list, don't have to check first vs last.

    var nextnewKaleidoList = [];
    var paired2Q = false;
  parCounts["cornerPair"]=0;
    newKaleidoList.forEach(function(corner) {
        if (corner.length == 2 && corner[0] == "corner" && corner[1] == 2)
        {
            if (paired2Q) {
                 parCounts["cornerPair"]++;
                nextnewKaleidoList.push(["cornerPair", parCounts["cornerPair"]]);
                paired2Q = false;
            }
            else {
                paired2Q = true // and we're waiting for another 
            }
        }
        else {
            //we have anything else
            if (paired2Q) {
                nextnewKaleidoList.push(["corner", 2])
            }
           nextnewKaleidoList.push(corner);
            paired2Q = false;
        }
    });
    if (paired2Q == true) {
        // we have an unmatched pair at the end
        nextnewKaleidoList.push(["corner", 2])
    }
    return {"conepointList":newConePointList, "kaleidoList":nextnewKaleidoList}
}



// now we atomize the orbifold, creating a list of atoms, of twelve flavors. We cut out pairs of cones
// using "tube"s and pairs of corners, or a cone and a piece of mirror using "slice"s; tubes have variable
// length and twist; slices have variable length. 

// There are a few options here that can be played with, if there are both mirrors and cones: 
// 1) can carve off all of the cone points _first_, and then cut to the mirror; this gives
//     a lot of twist parameters
// 2) can cut all the cones out to the mirrors, and then cut the mirrors. This gives very 
//     few twist parameters
// 3) can just do this all randomly.

// It's really not clear a priori what the right approach is, and it might be interesting to 
// experiment. For the time being, we're going with option #2
// Also: the new slices are put on the other end from what's sliced next; i.e. new slices
// are sliced last; this ensures a tree-like structure in the cutting. 


export function atomizeOrbifold(hashedOrbifold,parCounts) {

    var atomList = [];
    var cones = hashedOrbifold.conepointList; // shorthand for the original lists 
    var kaleidos = hashedOrbifold.kaleidoList;
    var noKaleidosQ = (kaleidos.length == 0) // are there any kaleidos
    var sliceN = 0;
    var tubeN = 0;

    while ( (cones.length > 0 || kaleidos.length > 0))
    {  // we have a few elemental cases to take care of:
    if(kaleidos.length==1 && kaleidos[0]=="mirror"){
    // If there is a single, uncornered kaleido, kaleidos == ["mirror"], 
    // since euler char is negative, the only possibility is that either there 
    // are more than two cones, in which case, the algorithm will work correctly, 
    // or exactly two cones, in which case we need to work by hand. There cannot be no 
    // cones or just one cone.
    kaleidos=[];
    if(cones.length==2){
      sliceN++;
      atomList.push([[["slice", sliceN]], [cones[0]]])
      atomList.push([[["slice", sliceN]], [cones[1]]])
      cones=[];  
      }
    }
    else if (kaleidos.length==1 && cones.length==1){
      atomList.push([kaleidos,cones])
      kaleidos =[];
      cones=[];
    }
        else if (!noKaleidosQ && cones.length > 0 
        )// remove a cone and slice to the kaleido
        {
            sliceN++;
            kaleidos.unshift(["slice", sliceN]);
            var cone = cones.pop();
            atomList.push([[["slice", sliceN]], [cone]])
        }
        else if (cones.length > 3)// so no kaleidos but lots of cones
        {
            tubeN++;
            var cone1 = cones.pop();
            var cone2 = cones.pop();
            cones.unshift(["tube", tubeN]);
            // let's put these in order: conePts need to go first.
            if (cone1[0] != "conePt")// then can't go wrong by swapping
            {
                var cc = cone1;
                cone1 = cone2;
                cone2 = cc;
            }
            atomList.push([[], [cone1, cone2, ["tube", tubeN]]])
        }
        else if (cones.length == 3)// remember-- we're in negative Euler char, so can't just have two
        {
            var cone0 = cones.pop();
            var cone1 = cones.pop();
            var cone2 = cones.pop();
            var cc;
            if (cone0[0] != "conePt")
            {
                cc = cone2;
                cone2 = cone0;
                cone0 = cc;
            }
            if (cone0[0] != "conePt")
            {
                cc = cone1;
                cone1 = cone0;
                cone0 = cc;
            }
      else if (cone1[0]!="conePt")
      {
        cc=cone1;
        cone1=cone2;
        cone2=cc;
      }
            // so now any legit conePts are first
            atomList.push([[], [cone0, cone1, cone2]])
        }
        else // no cone points 
        if (kaleidos.length > 3)
        {
            sliceN++;
            var kal0 = kaleidos.pop();
            var kal1 = kaleidos.pop();
            if (kal0[0] != "corner")
            {
                var kk = kal0;
                kal0 = kal1;
                kal1 = kk;
            }
            kaleidos.unshift(["slice", sliceN])
            atomList.push([[kal0, kal1, ["slice", sliceN]], []])
        }
        else if(kaleidos.length==3)// last three kaleidoscopic corners
    // this particularly is assuming negative euler char.
        {
            var kal0 = kaleidos.pop();
            var kal1 = kaleidos.pop();
            var kal2 = kaleidos.pop();
            if (kal0[0] != "corner") {
                var kk = kal2;
                kal2 = kal0;
                kal0 = kk;  
            }
            if (kal0[0] != "corner") {
                var kk = kal1;
                kal1 = kal0;
                kal0 = kk;
            }
      if (kal1[0] != "corner") {
                var kk = kal2;
                kal2 = kal1;
                kal1 = kk;
            }

            atomList.push([[kal0, kal1, kal2], []])
        }
     else {kaleidos = []}// this should never happen
    
    }
    parCounts["tube"] = tubeN;
    parCounts["slice"] = sliceN;
    return atomList
}


// As we prepare to unfold and geometrize the atoms, we define a couple of utilities.
// We will also make heavy use of mobius transformations preserving the unit disk, as described 
// further down in this file. 

// The length of the edge between p and q in a triangle with opposite angle r; 
// Angles may be real [x,0] (an angle) or imaginary [0,x] (a length) this geometry is mostly described in 
// Thurston's Geometry of Three Manifolds, and in Deaton's Thesis. Some details are missing. 

function edgeLength(p, q, r) {
    var cp,sp,cq,sq,cr,ll;
    if (p.re != 0) {
        cp = cos(p.re);
        sp = sin(p.re);
    }
    else {
        cp = cosh(p.im);
        sp = sinh(p.im);
    }
    if (q.re != 0) {
        cq = cos(q.re);
        sq = sin(q.re);
    }
    else {
        cq = cosh(q.im);
        sq = sinh(q.im);
    }
    if (r.re != 0) {
        cr = cos(r.re);
    }
    else {
        cr = cosh(r.im);
    }
    ll = (cp * cq + cr) / (sp * sq);
    if ((p.re == 0 && q.re == 0) || (p.im == 0 && q.im == 0)) {
        return acosh(ll)
    }
    else {
        return asinh(ll)
    }
}


// this is an interface back to the gui, getting hold of the length and twist parameters 

function getLength(key,group) {
    if(
  group.parCounts[key[0]]<
  abs(key[1])){return 1.1}
    else{  
    return group.guiParams[key[0]+"_"+abs(key[1]).toString()+"_l"];}
}

function getTwist(key,group) {
    if(group.parCounts[key[0]]<abs(key[1])){return 0}
//  else if (guiParams = {}){return 0}
    else{  
    return group.guiParams[key[0]+"_"+abs(key[1]).toString()+"_t"];}
}

function useMirrorQ(key) {
  // In an unfolded atom, some mirror lines are redundant and will not be used 
  if (["corner","fold","cornerPair","band"/*,"conjCuttingEdge"*/].indexOf(key[0]) < 0) {return ["mirrorRedundant",0]}
  else {return ["mirror",0]}
}

//
//  The main action: geometrizing our atoms
// 
export function unfoldAtom(atom,group) {
    var unfoldedAtom = [[], []];
   var parCounts = group.parCounts
  
    // we have TWELVE cases to sort out. 
    // we assume we've gotten our features in order of real first, then imaginary 
    
    // the returned structure here is kind of dumb and probably could be improved:
    // [ vertices, edges]
    // cone points are not particularly recorded
   // but each feature is not split up: every feature corresponds to exactly two edges in the final FD.
    // each edge is [type,number] or ["mirror",0]

  // There are many other possibilities for how to cut open a pillow or hat
    var a,b,c,l,m,n,p,q,r,O,P,Q,R,w,y,z;

  O = new complexN(0,0);
  p = new complexN(0,0);
  q = new complexN(0,0);
  r = new complexN(0,0);
  
    // do we have a sheet
    if (atom[1].length == 0)
    {
        /* we have a sheet*/
        a = atom[0][0];
        b = atom[0][1];
        c = atom[0][2];
        if (atom[0][2][0] == "corner")
        {
            /* we have three real corners */
            p.re = PI / a[1];
            q.re = PI / b[1];
            r.re = PI / c[1];
      P = edgeLength(q, r, p);
            R = edgeLength(p, q, r);
            unfoldedAtom[0].push(O);
            y = poincarePt(R);
            unfoldedAtom[0].push(y);
            unfoldedAtom[0].push(poincareTurtleMove(O, y, -q.re, P))
            unfoldedAtom[1] = [["mirror",0], ["mirror",0], ["mirror",0]];

        }
        else if (atom[0][1][0] == "corner")
        {
            /* we have two real corners */
            p.re = PI / a[1];
            q.re = PI / b[1];
            r.im = getLength(c,group);
            P = edgeLength(q, r, p);
            R = edgeLength(p, q, r);

            unfoldedAtom[0].push(O);
            y = poincarePt(R);
            unfoldedAtom[0].push(y);
            z = poincareTurtleMove(O, y, -q.re, P);
            unfoldedAtom[0].push(z);
            z = poincareTurtleMove(y, z, -HPI, r.im);
            unfoldedAtom[0].push(z);
            unfoldedAtom[1] = [["mirror",0], ["mirror",0], c, useMirrorQ(c)]

        }
        else if (atom[0][0][0] == "corner")
        {
            /* we have one real corner */
            p.re = PI / a[1];
            q.im = getLength(b,group);
            r.im = getLength(c,group);
            P = edgeLength(q, r, p);
            R = edgeLength(p, q, r);

            unfoldedAtom[0].push(O);
            y = poincarePt(R);
            unfoldedAtom[0].push(y);
            z = poincareTurtleMove(O, y, -HPI, q.im);
            unfoldedAtom[0].push(z);
            w = poincareTurtleMove(y, z, -HPI, P);
            y = z;
            z = w;
            unfoldedAtom[0].push(z);
            z = poincareTurtleMove(y, z, -HPI, r.im);
            unfoldedAtom[0].push(z);
            unfoldedAtom[1] = [["mirror",0], b, useMirrorQ(b), c, useMirrorQ(c)]
        }
        else
        {
            p.im = getLength(a,group);
            q.im = getLength(b,group);
            r.im = getLength(c,group);
            P = edgeLength(q, r, p);
            Q = edgeLength(r, p, q);
            R = edgeLength(p, q, r);

            unfoldedAtom[0].push(O);
            y = poincarePt(R);
            unfoldedAtom[0].push(y);
            z = poincareTurtleMove(O, y, -HPI, q.im);
            unfoldedAtom[0].push(z);
            
            w = poincareTurtleMove(y, z, -HPI, P);
            unfoldedAtom[0].push(w);
            y = z;
            z = w;
            
            w = poincareTurtleMove(y, z, -HPI, r.im);
             unfoldedAtom[0].push(w);
            y = z;
            z = w;
            
            w = poincareTurtleMove(y, z, -HPI, Q);
            unfoldedAtom[0].push(w);
            
            
            unfoldedAtom[1] = [useMirrorQ(a), b, useMirrorQ(b), c, useMirrorQ(c),a]

        }
    } //done with the sheets

    else if (atom[0].length == 0)
    {  /* we have a pillow*/
    // For the pillows, we will have a pair of colinear edges; 
    // We mark the first of these specially, so that when the 
    // fundamental domain is constructed, the "wall" between them
    // will be recorded; this is so that the correct generator will
    // be chosen in inversive.frag
        a = atom[1][0];
        b = atom[1][1];
        c = atom[1][2];
        
        var A1, A2,a1,a2,M;
        
        if (atom[1][2][0] == "conePt") 
        {  // with three real cone points
             p.re = PI / a[1];
            q.re = PI / b[1];
            r.re = PI / c[1];
            A2 = asin(sqrt(1/(1+Math.pow(cot(p.re)+cos(q.re)/sin(p.re)/cos(r.re),2))))
            A1 = p.re-A2;
            M = acosh(cos(q.re)/sin(A1));
            a1 = acosh(cos(A1)/sin(q.re));
            a2 = acosh(cos(A2)/sin(r.re));
            
            unfoldedAtom[0].push(O);
            y = poincarePt(M);
            unfoldedAtom[0].push(y);
            z = poincareTurtleMove(O,y,-HPI,a1);
            unfoldedAtom[0].push(z);
           
            w=poincareTurtleMove(y,z,-2*q.re,a1);
            unfoldedAtom[0].push(w);
            y=z;z=w;

      w=poincareTurtleMove(y,z,PI,a2)
      unfoldedAtom[0].push(w);
      y=z;z=w;
      
            w=poincareTurtleMove(y,z,-2*r.re,a2);
            unfoldedAtom[0].push(w);
      
      l= parCounts["cuttingEdge"]+1;
      m= parCounts["cuttingEdge"]+2;
      n= parCounts["cuttingEdge"]+3;
      parCounts["cuttingEdge"]+=3;
      // there is no need for a wall!
            unfoldedAtom[1]=[["cuttingEdge",l],["cuttingEdge",m],["cuttingEdge",m/*,
      // this edge will have a "wall", perp to this edge, at the 4th point
      unfoldedAtom[0][3],
      unfoldedAtom[0][2].applyMobius(poincareMobiusRotationAboutPoint(unfoldedAtom[0][3],HPI))
      */],
      ["cuttingEdge",n/*,
      // and this edge will have the same wall, in reverse orientation
      unfoldedAtom[0][2].applyMobius(poincareMobiusRotationAboutPoint(unfoldedAtom[0][3],HPI)),
      unfoldedAtom[0][3]
      */],["cuttingEdge",n],["cuttingEdge",l]];
        }
        else if (atom[1][1][0] == "conePt")
        { // two real cone points, one imaginary
            
            p.re = PI / a[1];
            q.re = PI / b[1];
            r.im = getLength(c,group);
            A2 = asin(sqrt(1/(1+Math.pow(cot(p.re)+cos(q.re)/sin(p.re)/cosh(r.im/2),2))))
            A1 = p.re-A2;
            
            M = acosh(cos(q.re)/sin(A1));
            a1 = acosh(cos(A1)/sin(q.re));
            a2 = asinh(cos(A2)/sinh(r.im/2));
           
      unfoldedAtom[0].push(O);
            y = poincarePt(M);
            unfoldedAtom[0].push(y);
            z = poincareTurtleMove(O,y,-HPI,a1);
            unfoldedAtom[0].push(z);
           
            w=poincareTurtleMove(y,z,-2*q.re,a1);
            unfoldedAtom[0].push(w);
            y=z;z=w;
            w=poincareTurtleMove(y,z,PI,a2); 
            unfoldedAtom[0].push(w);
            
            y=z;z=w;
            w=poincareTurtleMove(y,z,-HPI,r.im);
            unfoldedAtom[0].push(w);
            
            y=z;z=w;
            w=poincareTurtleMove(y,z,-HPI,a2);
            unfoldedAtom[0].push(w);
      l= parCounts["cuttingEdge"]+1;
      m= parCounts["cuttingEdge"]+2;
      n= parCounts["cuttingEdge"]+3;
      parCounts["cuttingEdge"]+=3;
            unfoldedAtom[1]=[["cuttingEdge",l],["cuttingEdge",m]];
      // if C is a tube, then we need walls:
      var middle= (c[0]=="tube")? [["cuttingEdge",m,
          // the Q vertex cannot be a tube, so no need for a wall!
          // this edge will have a "wall", perp to this edge, at the 4th point
          unfoldedAtom[0][3],
          unfoldedAtom[0][2].applyMobius(poincareMobiusRotationAboutPoint(unfoldedAtom[0][3],HPI))
          ],
          ["cuttingEdge",n,
          // and this edge will have the same wall, in reverse orientation
          unfoldedAtom[0][2].applyMobius(poincareMobiusRotationAboutPoint(unfoldedAtom[0][3],HPI)),
          unfoldedAtom[0][3]
          ]]:
          [["cuttingEdge",m],["cuttingEdge",n]];
      unfoldedAtom[1]=unfoldedAtom[1].concat(middle).concat([c,["cuttingEdge",n],["cuttingEdge",l]]);
        }
        else if (atom[1][0][0] == "conePt")
        {  // a pillow with one real corner and two imaginary ones
      p.re = PI / a[1];
            q.im = getLength(b,group);
            r.im = getLength(c,group);
            A2 = asin(sqrt(1/(1+Math.pow(cot(p.re)+cosh(q.im/2)/sin(p.re)/cosh(r.im/2),2))))
            A1 = p.re-A2;
            
            M = acosh(cosh(q.im/2)/sin(A1));
            a1 = asinh(cos(A1)/sinh(q.im/2));
            a2 = asinh(cos(A2)/sinh(r.im/2));
            
            unfoldedAtom[0].push(O);
            y = poincarePt(M);
            unfoldedAtom[0].push(y);
            z = poincareTurtleMove(O,y,-HPI,a1);
            unfoldedAtom[0].push(z);
            
            w=poincareTurtleMove(y,z,-HPI,q.im);
            unfoldedAtom[0].push(w);
            y=z;z=w;
           
            w=poincareTurtleMove(y,z,-HPI,a1);
            unfoldedAtom[0].push(w);
            y=z;z=w;
            
            w=poincareTurtleMove(y,z,PI,a2);
            unfoldedAtom[0].push(w);
            
            y=z;z=w;
            w=poincareTurtleMove(y,z,-HPI,r.im);
            unfoldedAtom[0].push(w);
            
            y=z;z=w;
            w=poincareTurtleMove(y,z,-HPI,a2);
            unfoldedAtom[0].push(w);
            
            l= parCounts["cuttingEdge"]+1;
      m= parCounts["cuttingEdge"]+2;
      n= parCounts["cuttingEdge"]+3;
      parCounts["cuttingEdge"]+=3;
            unfoldedAtom[1]=[["cuttingEdge",l],["cuttingEdge",m], b];
      var middle = (c[0]=="tube"||b[0]=="tube")?
        [["cuttingEdge",m,
        // this edge will have a "wall", perp to this edge, at the 5th point
        unfoldedAtom[0][4],
        unfoldedAtom[0][3].applyMobius(poincareMobiusRotationAboutPoint(unfoldedAtom[0][4],HPI))
        ],
        ["cuttingEdge",n,
        // and this edge will have the same wall, in reverse orientation
        unfoldedAtom[0][3].applyMobius(poincareMobiusRotationAboutPoint(unfoldedAtom[0][4],HPI)),
        unfoldedAtom[0][4]
        ]]:
        [["cuttingEdge",m],["cuttingEdge",n]];
      unfoldedAtom[1]=unfoldedAtom[1].concat(middle).concat([c,["cuttingEdge",n],["cuttingEdge",l]]);
        }
        else
        { // a pillow with three imaginary cones
            p.im = getLength(a,group);
            q.im = getLength(b,group);
            r.im = getLength(c,group);
            A2 = asinh(sqrt(1/(-1+Math.pow(coth(p.im/2)+cosh(q.im/2)/sinh(p.im/2)/cosh(r.im/2),2))))
            A1 = p.im/2-A2;
            
            M = asinh(cosh(r.im/2)/sinh(A2));
            a1 = asinh(cosh(A1)/sinh(q.im/2));
            a2 = asinh(cosh(A2)/sinh(r.im/2));
            
            unfoldedAtom[0].push(O);
            y = poincarePt(M);
            unfoldedAtom[0].push(y);
            z = poincareTurtleMove(O,y,-HPI,a1);
            unfoldedAtom[0].push(z);
            
            w=poincareTurtleMove(y,z,-HPI,q.im);
            unfoldedAtom[0].push(w);
            y=z;z=w;
           
            w=poincareTurtleMove(y,z,-HPI,a1);
            unfoldedAtom[0].push(w);
            y=z;z=w;
            
            w=poincareTurtleMove(y,z,PI,a2);
            unfoldedAtom[0].push(w);
            
            y=z;z=w;
            w=poincareTurtleMove(y,z,-HPI,r.im);
            unfoldedAtom[0].push(w);
            
            y=z;z=w;
            w=poincareTurtleMove(y,z,-HPI,a2);
            unfoldedAtom[0].push(w);
            
            y=z;z=w;
            w=poincareTurtleMove(y,z,-HPI,M);
            unfoldedAtom[0].push(w);
             l= parCounts["cuttingEdge"]+1;
      m= parCounts["cuttingEdge"]+2;
      n= parCounts["cuttingEdge"]+3;
      parCounts["cuttingEdge"]+=3;
      unfoldedAtom[1]=[["cuttingEdge",l],["cuttingEdge",m], b];
      var middle = (c[0]=="tube"||b[0]=="tube")?[["cuttingEdge",m,
      // this edge will have a "wall", perp to this edge, at the 5th point
      unfoldedAtom[0][4],
      unfoldedAtom[0][3].applyMobius(poincareMobiusRotationAboutPoint(unfoldedAtom[0][4],HPI))
      ],
      ["cuttingEdge",n,
      // and this edge will have the same wall, in reverse orientation
      unfoldedAtom[0][3].applyMobius(poincareMobiusRotationAboutPoint(unfoldedAtom[0][4],HPI)),
      unfoldedAtom[0][4]
      ]]:
      [["cuttingEdge",m],["cuttingEdge",n]];
      unfoldedAtom[1]=unfoldedAtom[1].concat(middle).concat([c,["cuttingEdge",n],["cuttingEdge",l],a]);

        }

    } //done with the pillows 

    else /* we have a hat */
    {
        a = atom[0][0];
        b = atom[1][0];
        
        if (atom[0][0][0] == "corner")
        {
            if (atom[1][0][0] == "conePt")
            {  // a real corner and a real cone
                p.re = HPI;
                q.re = PI/ b[1];
                r.re = HPI / a[1];
                 
                
                Q = edgeLength(r, p, q);
                 R = edgeLength(p, q, r);
                
              unfoldedAtom[0].push(O);
        y = poincarePt(Q);
                unfoldedAtom[0].push(y);
                
              z = poincareTurtleMove(O,y,-HPI,R);
              unfoldedAtom[0].push(z);
                                      
              w=poincareTurtleMove(y,z,-TPI/b[1],R);
              unfoldedAtom[0].push(w);
        parCounts["cuttingEdge"]++;
        l= parCounts["cuttingEdge"];
                
        unfoldedAtom[1]=[["mirror",0],["cuttingEdge",l],["cuttingEdge",l],["mirrorRedundant",0]];
            }
            else {
                // a real corner and an imaginary cone
                p.re = HPI;
                q.im = getLength(b,group)/2;
                r.re = HPI/ a[1];
                
                Q = edgeLength(r, p, q);
                 R = edgeLength(p, q, r);
                
                unfoldedAtom[0].push(O);
        y = poincarePt(Q);
                unfoldedAtom[0].push(y);
                
              z = poincareTurtleMove(O,y,-HPI,R);
              unfoldedAtom[0].push(z);
                                      
              w=poincareTurtleMove(y,z,-HPI,q.im*2);
              unfoldedAtom[0].push(w);
                
                
              y=z;z=w;
              w=poincareTurtleMove(y,z,-HPI,R);
              unfoldedAtom[0].push(w);
                
                parCounts["cuttingEdge"]++;
        l= parCounts["cuttingEdge"];
        unfoldedAtom[1]=[["mirror",0],["cuttingEdge",l],b,["cuttingEdge",l],["mirrorRedundant",0]];
                
            }
        }

        else
        {
            if (atom[1][0][0] == "conePt")
            { 
               // an imaginary corner point and a real cone
                p.re = HPI;
                q.re = PI/b[1];
                r.im = getLength(a,group)/2;
                
                Q = edgeLength(r, p, q);
                 R = edgeLength(p, q, r);
                
        y = poincarePt(r.im);
                unfoldedAtom[0].push(y);
                
              z = poincareTurtleMove(O,y,-HPI,Q);
              unfoldedAtom[0].push(z);
                                      
              w=poincareTurtleMove(y,z,-HPI,R);
              unfoldedAtom[0].push(w);
                
                
              y=z;z=w;
              w=poincareTurtleMove(y,z,-TPI/b[1],R);
              unfoldedAtom[0].push(w);
                
                y=z;z=w;
              w=poincareTurtleMove(y,z,-HPI,Q);
              unfoldedAtom[0].push(w);
                
               parCounts["cuttingEdge"]++;
        l= parCounts["cuttingEdge"];
        unfoldedAtom[1]=
          [useMirrorQ(a),["cuttingEdge",l],["cuttingEdge",l],["mirrorRedundant",0],a];
        
            }
            else {
                p.re = HPI;
        q.im = getLength(b,group)/2;
                r.im = getLength(a,group)/2;
                
                Q = edgeLength(r, p, q);
                 R = edgeLength(p, q, r);
                
                y = poincarePt(r.im);
                unfoldedAtom[0].push(y);
                
              z = poincareTurtleMove(O,y,-HPI,Q);
              unfoldedAtom[0].push(z);
                
                w=poincareTurtleMove(y,z,-HPI,R);
              unfoldedAtom[0].push(w); 
                
              y=z;z=w;
              w=poincareTurtleMove(y,z,-HPI,q.im*2);
              unfoldedAtom[0].push(w);
                
              y=z;z=w;
              w=poincareTurtleMove(y,z,-HPI,R);
              unfoldedAtom[0].push(w);
                
                y=z;z=w;
              w=poincareTurtleMove(y,z,-HPI,Q);
              unfoldedAtom[0].push(w);
                
        parCounts["cuttingEdge"]++;
        l= parCounts["cuttingEdge"];
        unfoldedAtom[1]=
          [useMirrorQ(a),["cuttingEdge",l],b,["cuttingEdge",l],["mirrorRedundant",0],a];
      }
        }

    } // done with the hats


//  console.log("Atom "+objectToString(atom)+"\n"+objectToString(unfoldedAtom)+"\n\n")

    return unfoldedAtom
}


// As we reassemble these into a fundamental domain, we continually recenter, to keep 
// the domain from growing off into a numerically less stable regime, closer to the boundary of the 
// Poincare disk. 

// We're keeping this recentering very simplistic: just transform the Euclidean center
// of the vertices to the origin



function recenterDomain(domain){
  
  return moveDomain(domain,poincareMobiusTranslateToO(centerOfDomain(domain)));
  
}

function centerOfDomain(domain){
  var center = new complexN(0,0);
  var n = domain[0].length;

  domain[0].forEach(function(pt){
    center.re+=pt.re; center.im+=pt.im;
  })

  center.re = center.re/n;
  center.im = center.im/n;
  
  return center
    
}

function moveDomain(domain,mob){
    var newDomain = domain.slice();
    var i;
    for(i=0; i<domain[0].length;i++){
        newDomain[0][i]=
      domain[0][i].applyMobius(mob);
    // we may have additional points stashed in the edge labels;
    // this is used for the "wall" info to be passed on to inversive.frag
    if(newDomain[1][i].length>2){
      var j;
      for(j=2; j<newDomain[1][i].length;j++)
      {
        newDomain[1][i][j]=
                domain[1][i][j].applyMobius(mob);
      }
    }
    }
    return newDomain
}


function isSameEdgeTypeQ(edge1,edge2){
    // this is a stupid kludge
    // edge1 will always be a [key,n] 
  // (In fact, key will always be "slice" or "tube")
  // edge2 might be a string or might be [key,n]
    return (Array.isArray(edge2) && edge1[0]==edge2[0] && edge1[1]==edge2[1])
}

export function assembleFundamentalDomain(atomList,group)
{ 
  // starting from a dissected list of atoms,
  // returns a fundamental domain, using the conventions of the individual atoms
  //  [vertList,edgeList]
  //  where vertList =  [ points [[x,y],n] where n>0 iff a cone point of order n]
  // edge list is a list of [key,index] -- index is 0 if no need to match
  // We will also keep track of any of slice and tube edges that are deleted, so that we can
  // add them to the interface

  var parCounts = group.parCounts
  parCounts["cuttingEdge"] = 0; //initialize these
  
    var workingAtomList = [];
    atomList.forEach(function(atom){workingAtomList.push(unfoldAtom(atom,group))
  })


   var nextAtom = workingAtomList.shift();
    
    nextAtom = recenterDomain(nextAtom);
    
//  console.log(objectToString(nextAtom));
  
  
  
    var workingFD = nextAtom.slice(0);
  var internalFDedges=[];
    
    var openAttachments = [];

  // attachments will always be "tube" or "slice", the cuts along which the orbifold
  // was decomposed.
    
    nextAtom[1].forEach(function(edge){
        if(edge[0]=="tube"|| edge[0]=="slice"){
            openAttachments.push(edge)
        } })
    
    while(openAttachments.length>0)
        {
            // as long as there are open attachments... 
            var nextAttachment = openAttachments.pop();
            
            // advance the working fundamental domain so that this is in front;
            while (!isSameEdgeTypeQ(nextAttachment, workingFD[1][0]))
                   {
                       workingFD[0].push(workingFD[0].shift())
                       workingFD[1].push(workingFD[1].shift());
                   }
            
            
            // now find the atom with the right attachment!
            
            var foundAttachmentQ=false;
            
            while(!foundAttachmentQ){
                nextAtom = workingAtomList.shift();
                // is this it?
                var len = nextAtom[1].length;
                while(!foundAttachmentQ && len>0)
                    { len--;
                      if(isSameEdgeTypeQ(nextAttachment, nextAtom[1][0]))
                          {
                              foundAttachmentQ = true;                              
                          }
                     else { 
                         nextAtom[0].push(nextAtom[0].shift());
                     nextAtom[1].push(nextAtom[1].shift());
                       } 
                    }
                if(!foundAttachmentQ){
                  workingAtomList.push(nextAtom); // and move on
                }
            }
            
            // at this point, both the fundamental domain and the next atom should have the 
            // attachment in the front. 
            
            // add any outstanding attachments
            // pop off the first edge from the found atom (since that's the used attachment)
            // and look through the others.
            
            var edge = nextAtom[1].shift();
            nextAtom[1].forEach(function(edge){
            if(edge[0]=="tube"|| edge[0]=="slice"){
                openAttachments.push(edge)}})
            nextAtom[1].unshift(edge);
            
            
            // now shift the atom over to the fundamental domain
            
            var shift =0;
      var a,b,c;
      a = nextAtom[1][0];
      b = Array.isArray(nextAtom[1][0]);
      c = nextAtom[1][0][0];
            if(Array.isArray(nextAtom[1][0])&& nextAtom[1][0][0]=="tube"){
                shift = getTwist(nextAtom[1][0],group)
            }
            var mob = poincareMobiusEdgeToEdge(
                  [nextAtom[0][0],nextAtom[0][1]],[workingFD[0][0],workingFD[0][1]],shift)
                     
            var newAtom = moveDomain(nextAtom,mob)
            
    
      if(nextAttachment[0]=="tube")
      {
      
      
        // We eliminate the tube edge from both the FD and the atom, and 
        // on either end, merge the pair of edges, ensuring that they 
        // have the same label -- we arbitrarily take this from the FD. 
        // However, we have to make sure that any "wall", coming from the 
        // second edge in a merged pair, is preserved. Each wall is encoded as two 
        // more points at the end of the key -- and after merging it is possible that
        // there are two such walls.
        
        var lastFDEdge=workingFD[1][workingFD[1].length-1];
        if(newAtom[1][1].length>2){
          lastFDEdge=lastFDEdge.concat(newAtom[1][1].slice(2))
        }
        var firstFDEdge=workingFD[1][1];
        if(newAtom[1][newAtom[1].length-1].length>2)
        {
          firstFDEdge=firstFDEdge.concat(newAtom[1][newAtom[1].length-1].slice(2))
        }
        
        //for the internal edges, to draw them
        var fis=[workingFD[0][2],workingFD[0][workingFD[0].length-1],newAtom[0][2],newAtom[0][newAtom[0].length-1]]
        var dd = fis[0].poincareDiskDistanceTo(fis[3]); 
        var fism=[
          fis[0].applyMobius(poincareMobiusTranslateFromToByD(fis[0],fis[3],dd/2)),
          fis[1].applyMobius(poincareMobiusTranslateFromToByD(fis[1],fis[2],dd/2))];
          
        internalFDedges.push([fism,nextAttachment]);

        workingFD = [(workingFD[0].slice(2)).concat(newAtom[0].slice(2)),
           ((workingFD[1].slice(2,-1)).concat([lastFDEdge]).concat(newAtom[1].slice(2,-1)).concat([firstFDEdge]))]    
      }
      else{// next attachment is a slice
        //to keep track of the internal edges, to draw them
        internalFDedges.push([[workingFD[0][0],workingFD[0][1]],nextAttachment]);
        
        
        workingFD = [(workingFD[0].slice(2)).concat(newAtom[0].slice(2)),
                           (workingFD[1].slice(2)).concat(newAtom[1].slice(2))]
        
      }
      
      

            // finally, recenter the working FD
      //workingFD = recenterDomain(recenterDomain(recenterDomain(workingFD)))
    
      
      var centerFD,  i, newedges, recenteringN;
      
      recenteringN=2;
      
      for(i=0;i<recenteringN;i++){
         centerFD = centerOfDomain(workingFD);
        move = makeMobius([[-1,0],centerFD.conjugate(),true]);
        workingFD=moveDomain(workingFD,move);
        newedges=[];
        internalFDedges.forEach(function(edge){
        newedges.push([[edge[0][0].applyMobius(move),
          edge[0][1].applyMobius(move)],edge[1]])
        })
        internalFDedges=newedges;
      }
      
  
        }
        // and then another nudge
        var move = poincareMobiusTranslateToO(new complexN(-.001,-.002));
        workingFD = moveDomain(workingFD,move);  

        internalFDedges = internalFDedges.map(edge=>[[edge[0][0].applyMobius(move),
          edge[0][1].applyMobius(move)],edge[1]]);
      

  //console.log("\n\n\n(*fundamental domain:*)\ndomain="+objectToString(workingFD,true)+";\n\n");
        var conepts;
        

      return [workingFD, internalFDedges,conepts]
}

  


export function produceGenerators(fundamentalDomain,group){
  // walk through the generator keys, identifying each edge or pair of edges, 
  // then produce the transforms that accomplish these
  
  // There are many ways to approach this: for example, we might include inverses, or not,
  // or conjugates, or not. Much of this really depends on how the generators are going to be used.
  
  // In the current code, each edge bounding a presumed-convex fundamental domain gets a single list
  // of circles through which to invert, a single generator. 
  
  // Currently, colinear edges are both included, even though Bulatov's algorithm will use only one;
  // This is because we may need all neighboring group elements when constructing Direchlet domains
  // in the non-convex case. 
  
  
  var generators=[];  // as Mobius Transforms
  var sPlanes = []; // as lists of centers of inversion
  
  var points = fundamentalDomain[0];
  var edges = fundamentalDomain[1];
  
  // walk through and find the matching pairs of handles, cutting edges, and conj cutting edges
  // producing generators in order of the edges -- some work will be doubled, but this is a 
  // pretty fast procedure.
  
  var edge;
  var i,j;
  var key;
  var foundQ=false;
  
  for(i=0; i<edges.length; i++){
    edge = edges[i];
    key = edge[0];
    foundQ=false;
    switch(key){
      case "handle":
      case "cuttingEdge":
      /*case "conjCuttingEdge":*/
      case "band":
        j=0;
        while(!foundQ && j<edges.length){
          foundQ = ((i!=j)&&(edges[j][0]==edge[0])&&(edges[j][1]==edge[1]));
          if(!foundQ){j++}}      
        if(j==edges.length){break;}//oops!
        //otherwise, we have a match!
        var p1=points[i],
          p2=points[(i+1)%points.length],
          q1=points[j],
          q2=points[(j+1)%points.length],
          v1,v2;
        var shift = 0;
        if(key=="handle"){shift = getTwist(edge,group)}
        if(shift!=0){
          v1=p1.copy();
          v2=p2.copy();
          p1 =v1.applyMobius(poincareMobiusTranslateFromToByD(v1,v2,shift*getLength(edge,group)));
          p2 =v2.applyMobius(poincareMobiusTranslateFromToByD(v1,v2,shift*getLength(edge,group)));
          }
        var centers = sPlanesMovingEdge1ToEdge2([p1,p2],[q2,q1])
        sPlanes.push(centers);
        break;
      
      case "conePair":
        var d=getTwist(edge,group);
        var e=getLength(edge,group);
        var q=points[i],
          r=points[(i+1)%points.length];
        // the two rotation points are not both needed
        var dd = d<-.25? d+1: d<.25? d+.5: d;
        var point = q.applyMobius(poincareMobiusTranslateFromToByD(q,r,dd*e));
          var centers = sPlanesOfRotation(point,PI)// centers of inversion
          sPlanes.push(centers)
        break;
      
      case "cap":
        var e=getLength(edge,group),
          p=points[i],
          q=points[(i+1)%points.length],
          v=p.applyMobius(poincareMobiusTranslateFromToByD(p,q,e/4)),
          w=p.applyMobius(poincareMobiusTranslateFromToByD(p,q,e/2)),
          centers = [sPlaneSwapping(v,p),sPlaneSwapping(v,w),sPlaneReflectAcross(p,q)];
        sPlanes.push(centers);
      break;
      
      case "cornerPair":
      case "m":
      case "mirror":  
      case "mirrorRedundant":
        var p = points[i],
        q = points[(i+1)%points.length];
        var center = sPlaneReflectAcross(p,q);
        sPlanes.push([center])
      break;
      
      case "fold":
        var p = points[i], q = points[(i+1)%points.length];
        var e=getLength(edge,group), v=p.applyMobius(poincareMobiusTranslateFromToByD(p,q,e/2));
        centers = sPlanesOfRotation(v,PI);
        sPlanes.push(centers);
    }
  }
  
  //console.log("\n\n==Generators==\n")
  //console.log(objectToString(sPlanes,true,3))
  return sPlanes
  
}


////////////
//// For forward mapping:

function generateGroupFromSplanes(sPlanes, depth, t= globalMobTransform,margin=.03,safety=300, shiftByTQ=true){
  // this is a list of lists of sPlanes
  
  var test = poincareMobiusFromSPlanesList(sPlanes[0]);
  var test2 = test.normalize();
  return generateGroup(sPlanes.map(centers=>poincareMobiusFromSPlanesList(centers).normalize()),
    depth,t,margin,safety, shiftByTQ)
}

function generateGroup(normedGens,depth, t= globalMobTransform,margin=.03,safety=300, shiftByTQ=true) 
{  //margin is min distance origin is moved away from boundary for an element to be added
  // safety the maximum number of group elements before bailing
  // shiftByTQ is whether the group is shifted (on the right) by the global transform
  var i = 0;
  var j = 0;
  var isNewQ;

  var group = [];
  
  normedGens.forEach(
    function(gen){
    if(shiftByTQ){group.push(gen.composeWith(t))} else{group.push(gen)}})
  var newelements = group.slice(0);
  var nextelements=[];
  var nextelement;
  
  while(i<depth && group.length<safety){
    i++;
    newelements.forEach(function(newelt){
      if(group.length<safety){
      normedGens.forEach(function(gen){
        if(group.length<safety){
      //  nextelement = newelt.composeWith(gen);
        nextelement = gen.composeWith(newelt);
        if ((1-nextelement.c.abs()/nextelement.a.abs())>margin){
          isNewQ=true;
          j=0;
          while(j<group.length && isNewQ){
            isNewQ = isNewQ && !(nextelement.equal(group[j]))
            j++;
          }
          if(isNewQ){
            nextelements.push(nextelement)
            group.push(nextelement)
          }
        }
      }})
    }})
    newelements = nextelements
    nextelements = []
    }
  
  return group
}


export function willOrbifoldFitQ(atomList,MAX_GEN_COUNT,MAX_REF_COUNT,MAX_DOMAIN_SIZE){
  // how big will the orbifold be?
  return false;
  
}






