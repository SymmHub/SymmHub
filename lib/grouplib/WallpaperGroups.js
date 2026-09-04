
import {normalize,dot, mul, abs,sin,cos,sqrt,PI,getParam,iPlane} from './modules.js';


export const SQRT3 = Math.sqrt(3.);
export const SQRT2 = Math.sqrt(2.);

export var WallpaperGroups = {};

export var WallpaperGroupNames = [
 "trivial",
  "*442",
  "442",
  "4*2",
  "*632",
  "632",
  "3*3",
  "*333",
  "333",
  "*2222",
  "2222",
  "2*22",
  "22*",
  "**",
  "*X",
  "22X",
  "XX",
  "O"
];

export var WallpaperGroupMap = {
 "trivial":0,
 1:"*442",
 2:"442",
 3:"4*2",
 4:"*632",
 5:"632",
 6:"3*3",
 7:"*333",
 8:"333",
 9:"*2222",
 10:"2222",
 11:"2*22",
 12:"22*",
 13:"**",
 14:"*X",
 15:"22X",
 16:"XX",
 17:"O"
};

export function getWallpaperGroupIndex(name){
	for(var i = 0; i < WallpaperGroupNames.length; i++){
		if(name == WallpaperGroupNames[i])
			return i;
	}
	return 0;
}

//
//  trivial group 
//
function iGroup_Trivial(){
	return {s:[], t:[]};
}

//
// group *442
//
function iGroup_S442(a) {
	
	var d = a*SQRT2/4.;
	var s0 = iPlane([-1,0,0,0]);
	var s1 = iPlane([0,-1,0,0]);
	var s2 = iPlane([1,1,0,d]);
	
	return {
			s:[s0,s1,s2],  //fund domain
			t:[[s0],[s1],[s2]] // reverse transforms 
		};						
}

//
// group 442
//
function iGroup_442(a, domainShape) {

	var d = a*SQRT2/4.;

	var s0 = iPlane([-1,0,0,0]);
	var s1 = iPlane([1,1,0,d]);
	var s2 = iPlane([1,-1,0,d]);

	var s3 = iPlane([0,1,0,0]);

	// cone points: 4a at (a/2,0), 4b at (0,+-a/2), 2 at the origin
	switch(resolveWallpaperDomainShape('442', domainShape)){

		default:
		case '4a-4b-4b triangle':
			// right isosceles triangle 4b (0,a/2), 4a (a/2,0), 4b (0,-a/2);
			// the 2-fold point is the midpoint of the side 4b-4b
			return {
					s:[s0,s1,s2],  //fund domain
					t:[[s0,s3],[s1,s3],[s2,s3]] // reverse transforms
				};
		case '4b-4a-4a triangle': {
			// the same triangle with the classes exchanged: 4a (-a/2,0), 4a (a/2,0), 4b (0,a/2);
			// the 2-fold point is the midpoint of the side 4a-4a
			const p = iPolygonSides([[-a/2, 0], [a/2, 0], [0, a/2]]);
			const sx = iPlane([1,0,0,0]);   // mirror x = 0, through 4b and 2
			return { s: p, t: p.map(side => [side, sx]) };
		}
		case '4a-2-4b-2 square': {
			// square 2 (0,0), 4a (a/2,0), 2 (a/2,a/2), 4b (0,a/2)
			const p = iPolygonSides([[0, 0], [a/2, 0], [a/2, a/2], [0, a/2]]);
			const m = iMirrorThrough([a/2, 0], [0, a/2]);   // through 4a and 4b
			return { s: p, t: p.map(side => [side, m]) };
		}
	}
}


//
// group 4*2
//
function iGroup_4S2(a, domainShape) {

	var d = a*SQRT2/4.;

	var s0 = iPlane([-1,0,0,0]);
	var s1 = iPlane([1,1,0,d]);
	var s2 = iPlane([1,-1,0,d]);

	var sy = iPlane([0,1,0,0]);

	// 4-fold point at (a/2,0), mirrors x = 0 and y = +-a/2, *2 corners at (0,+-a/2)
	switch(resolveWallpaperDomainShape('4*2', domainShape)){

		default:
		case '4-*2-*2 triangle':
			// right isosceles triangle *2 (0,a/2), 4 (a/2,0), *2 (0,-a/2), the hypotenuse on the mirror x = 0
			return {
					s:[s0,s1,s2],  //fund domain
					t:[[s0],[s1,sy],[s2,sy]] // reverse transforms
				};
		case '4-*-*2-* square': {
			// square 4 (a/2,0), * (a/2,a/2), *2 (0,a/2), * (0,0); two sides lie on the mirrors y = a/2 and x = 0
			const [q0, q1, q2, q3] = iPolygonSides([[a/2, 0], [a/2, a/2], [0, a/2], [0, 0]]);
			const m = iMirrorThrough([a/2, 0], [0, a/2]);   // through 4 and *2
			return { s:[q0,q1,q2,q3], t:[[q0,m],[q1],[q2],[q3,m]] };
		}
	}
}


//
//  Fundamental domain shapes
//
//  The same group may be given different fundamental domains: the same set of
//  isometries, with the cone points in the same places, but a different domain
//  and hence different pairing transforms (and a different presentation).
//  WallpaperDomainShapes lists the shapes a group offers.  The first shape is the
//  default; it is the domain the group had before domain shapes were introduced,
//  so documents saved without a domainShape keep their geometry.  Groups not
//  listed here have a single domain, named DEFAULT_DOMAIN_SHAPE.
//
//  Shapes are named by their corners in cyclic order: the order of the cone
//  point at a corner (a, b, c distinguish classes of the same order: 442's 4a
//  is the 4-fold point at the right angle of the default triangle, 333's 3a
//  and 3b are the obtuse corners of the default rhombus), '*n' for a corner
//  where mirrors meet and '*' for a corner on a mirror.  Shapes without
//  special points at their corners get plain names (2222).
//
export const DEFAULT_DOMAIN_SHAPE = 'default';

export const WallpaperDomainShapes = {
	'442':  ['4a-4b-4b triangle', '4b-4a-4a triangle', '4a-2-4b-2 square'],
	'4*2':  ['4-*2-*2 triangle', '4-*-*2-* square'],
	'632':  ['6-3-6 triangle', '6-3-3 triangle', '6-2-3-2 kite'],
	'3*3':  ['3-*3-*3 triangle', '3-*-*3-* kite'],
	'333':  ['3a-3c-3b-3c rhombus', '3a-3b-3c-3b rhombus', '3b-3a-3c-3a rhombus'],
	'2222': ['rectangle', 'parallelogram'],
};

//
//  return the domain shapes offered by the named group
//
export function getWallpaperDomainShapes(name){
	return WallpaperDomainShapes[name] || [DEFAULT_DOMAIN_SHAPE];
}

//
//  return the given shape if the named group offers it, the group's default shape otherwise
//
export function resolveWallpaperDomainShape(name, shape){
	var shapes = getWallpaperDomainShapes(name);
	return (shapes.indexOf(shape) >= 0) ? shape : shapes[0];
}

//
//  helpers for domain shapes given by their corners
//

// line through the points P and Q, its normal pointing away from the point O
function iLineThrough(P, Q, O){
	var nx = Q[1] - P[1], ny = P[0] - Q[0];
	if((P[0] - O[0])*nx + (P[1] - O[1])*ny < 0){ nx = -nx; ny = -ny; }
	var len = Math.sqrt(nx*nx + ny*ny);
	nx /= len; ny /= len;
	return iPlane([nx, ny, 0, nx*P[0] + ny*P[1]]);
}

// mirror line through the points P and Q (a reflection does not care about the orientation)
function iMirrorThrough(P, Q){
	return iLineThrough(P, Q, [P[0] + (Q[1] - P[1]), P[1] - (Q[0] - P[0])]);
}

// perpendicular bisector of the segment PQ: with the line PQ it gives the 2-fold rotation about the midpoint
function iBisectorOf(P, Q){
	var dx = Q[0] - P[0], dy = Q[1] - P[1];
	var len = Math.sqrt(dx*dx + dy*dy);
	dx /= len; dy /= len;
	var mx = 0.5*(P[0] + Q[0]), my = 0.5*(P[1] + Q[1]);
	return iPlane([dx, dy, 0, dx*mx + dy*my]);
}

// sides of the convex polygon with the given corners (in cyclic order), normals pointing outward;
// side i runs from corner i to corner i+1
function iPolygonSides(corners){
	var n = corners.length;
	var O = [0, 0];
	for(var i = 0; i < n; i++){ O[0] += corners[i][0]/n; O[1] += corners[i][1]/n; }
	var sides = [];
	for(var j = 0; j < n; j++)
		sides.push(iLineThrough(corners[j], corners[(j+1)%n], O));
	return sides;
}


//
// group *632
//
function iGroup_S632(a) {
		
  let s3 = SQRT3;
	var d = a*s3/4.;
		
	var s0 = iPlane([-1,0,0,0]);
	var s1 = iPlane([0,-1,0,0]);
	var s2 = iPlane([s3,1,0,d]);
	
	return {
			s:[s0,s1,s2],  //fund domain
			t:[[s0],[s1],[s2]] // reverse transforms 
		};					
	
}

//
// group 632
//
//  cone points (H = a*sqrt(3)/2): 6-fold at (0,H) and (0,-H), 3-fold at (H/sqrt(3),0),
//  2-fold at the origin.  All domain shapes share these cone points and differ in
//  which of them are the corners of the domain.  Each shape is mirror symmetric
//  about the line m used in its pairing transforms, so [side, m] (reflect in the
//  side, then in m) is the rotation which maps the cell across that side into the domain.
//
function iGroup_632(a, domainShape) {
	
	var s3 = SQRT3;
	
	var d = a*s3/4.;  // H/2, offset of the lines through a 6-fold and a 3-fold point
	
	switch(resolveWallpaperDomainShape('632', domainShape)){
		
		default:
		case '6-3-6 triangle': {
			// isosceles triangle 6 (0,H), 3 (H/sqrt(3),0), 6' (0,-H);
			// the 2-fold point is the midpoint of the side 6'-6
			const s0 = iPlane([-1,0,0,0]);    // side 6'-6
			const s1 = iPlane([s3,1,0,d]);    // side 6-3
			const s2 = iPlane([s3,-1,0,d]);   // side 3-6'
			const sy = iPlane([0,1,0,0]);     // mirror y = 0, through 2 and 3
			return {
					s:[s0,s1,s2],  //fund domain
					t:[[s0,sy],[s1,sy],[s2,sy]] // reverse transforms
				};
		}
		case '6-3-3 triangle': {
			// equilateral triangle 6 (0,H), 3 (H/sqrt(3),0), 3' (-H/sqrt(3),0);
			// the 2-fold point is the midpoint of the side 3-3'
			const p0 = iPlane([s3,1,0,d]);    // side 6-3
			const p1 = iPlane([0,-1,0,0]);    // side 3-3'
			const p2 = iPlane([-s3,1,0,d]);   // side 3'-6
			const sx = iPlane([1,0,0,0]);     // mirror x = 0, through 6 and 2
			return {
					s:[p0,p1,p2],  //fund domain
					t:[[p0,sx],[p1,sx],[p2,sx]] // reverse transforms
				};
		}
		case '6-2-3-2 kite': {
			// kite 6 (0,H), 2 (0,0), 3 (H/sqrt(3),0), 2' (sqrt(3)H/2,H/2);
			// the 2-fold points are the corners with the right angles
			const k0 = iPlane([-1,0,0,0]);       // side 6-2
			const k1 = iPlane([0,-1,0,0]);       // side 2-3
			const k2 = iPlane([s3,-1,0,d]);      // side 3-2'
			const k3 = iPlane([1,s3,0,3*a/4.]);  // side 2'-6
			const m  = iPlane([s3,1,0,d]);       // mirror through 6 and 3
			return {
					s:[k0,k1,k2,k3],  //fund domain
					t:[[k0,m],[k1,m],[k2,m],[k3,m]] // reverse transforms
				};
		}
	}
}

//
// group 3*3
//
function iGroup_3S3(a, domainShape) {

	var s3 = SQRT3;

	var d = a*s3/4.;

	var s0 = iPlane([-1,0,0,0]);
	var s1 = iPlane([s3,1,0,d]);
	var s2 = iPlane([s3,-1,0,d]);
	var sy = iPlane([0,1,0,0]);

	// H = a*sqrt(3)/2: 3-fold point at (a/2,0), mirrors x = 0 and the two through (0,+-H) and (sqrt(3)H,0),
	// *3 corners at (0,+-H)
	var H = a*s3/2.;
	switch(resolveWallpaperDomainShape('3*3', domainShape)){

		default:
		case '3-*3-*3 triangle':
			// isosceles triangle *3 (0,H), 3 (a/2,0), *3 (0,-H), the base on the mirror x = 0
			return {
					s:[s0,s1,s2],  //fund domain
					t:[[s0],[s1,sy],[s2,sy]] // reverse transforms
				};
		case '3-*-*3-* kite': {
			// kite 3 (a/2,0), * (0,0), *3 (0,H), * (sqrt(3)H/2,H/2); the sides through *3 lie on mirrors
			const [k0, k1, k2, k3] = iPolygonSides([[a/2, 0], [0, 0], [0, H], [s3*H/2, H/2]]);
			const m = iMirrorThrough([a/2, 0], [0, H]);   // through 3 and *3
			return { s:[k0,k1,k2,k3], t:[[k0,m],[k1],[k2],[k3,m]] };
		}
	}
}

//
//  wallpaper group *333
//
function iGroup_S333(a){
	
	var s3 = SQRT3;
	
	var d = a*s3/4.;
	
	var p0 = iPlane([-s3,1,0,d]);
	var p1 = iPlane([s3,1,0,d]);
	var p2 = iPlane([0,-1,0,0]);
	
	return {
			s:[p0,p1,p2],  //fund domain
			t:[[p0],[p1],[p2]] // reverse transforms 
		};			
}

//
// group 333
//
function iGroup_333(a, domainShape) {

	const ss3 = SQRT3;
	let d = a*ss3/4.;

	let s0 = iPlane([ss3,1,0,d]);
	let s1 = iPlane([-ss3,1,0,d]);
	let s2 = iPlane([ss3,-1,0,d]);
	let s3 = iPlane([-ss3,-1,0,d]);

	let sy = iPlane([0,1,0,0]);

	// H = a*sqrt(3)/2: 3-fold points 3a at (a/2,0), 3b at (-a/2,0), 3c at (0,+-H);
	// the three classes together form a triangular lattice of side a
	const H = a*ss3/2.;
	switch(resolveWallpaperDomainShape('333', domainShape)){

		default:
		case '3a-3c-3b-3c rhombus':
			// rhombus 3a (a/2,0), 3c (0,H), 3b (-a/2,0), 3c (0,-H); the obtuse corners 3a and 3b
			return {
					s:[s0,s1,s2,s3],  //fund domain
					t:[[s0,sy],[s1,sy],[s2,sy],[s3,sy]] // reverse transforms
				};
		case '3a-3b-3c-3b rhombus': {
			// rhombus 3b (-a/2,0), 3a (a/2,0), 3b (a,H), 3c (0,H); the obtuse corners 3a and 3c
			const p = iPolygonSides([[-a/2, 0], [a/2, 0], [a, H], [0, H]]);
			const m = iMirrorThrough([a/2, 0], [0, H]);   // through 3a and 3c
			return { s: p, t: p.map(side => [side, m]) };
		}
		case '3b-3a-3c-3a rhombus': {
			// rhombus 3a (-a,H), 3b (-a/2,0), 3a (a/2,0), 3c (0,H); the obtuse corners 3b and 3c
			const p = iPolygonSides([[-a, H], [-a/2, 0], [a/2, 0], [0, H]]);
			const m = iMirrorThrough([-a/2, 0], [0, H]);   // through 3b and 3c
			return { s: p, t: p.map(side => [side, m]) };
		}
	}
}

//
// group *2222
//
function iGroup_S2222(a, b) {
	
	var a2 = 0.5*a;
	var b2 = 0.5*b;
		
	var s0 = iPlane([1.,0.,0.,a2]);
	var s1 = iPlane([-1.,0.,0., 0.]);
	var s2 = iPlane([0.,1.,0., b2]);
	var s3 = iPlane([0.,-1.,0.,0.]);
	
	return {
			s:[s0,s1,s2,s3],  //fund domain
			t:[[s0],[s1],[s2],[s3]] // reverse transforms 
		};			
	
}

//
//  group 2222 (wrong, missing one parameter) 
//
function iGroup_2222_(a, b) {
	
	var a2 = 0.5*a;
	var b2 = 0.5*b;
		
	var s0 = iPlane([1.,0.,0.,  a2]);
	var s1 = iPlane([-1.,0.,0., 0.]);
	var s2 = iPlane([0.,1.,0.,  b2]);
	var s3 = iPlane([0.,-1.,0., b2]);
	
	var ss = iPlane([0.,1.,0.,0.]);
	return {
			s:[s0,s1,s2,s3],  // domain
			t:[[s0,ss],[s1,ss],[s2,ss],[s3,ss]] // reverse transforms 
		};			
	
}

//
//  group 2222 (corrected)
//
function iGroup_2222(a,b,c, domainShape) {

    var b2 = 0.5*b;

    var s0 = iPlane([1.,0.,0.,  a]);
    var s1 = iPlane([-1.,0.,0., 0.]);
    var s2 = iPlane([0,1.,0.,  b2]);
    var s3 = iPlane([0,-1.,0., b2]);

    var ss = iPlane([0.,1.,0.,0.]);
    var ss0 = iPlane([0.,1.,0.,c]);
    var ss1 = iPlane([0.,1.,0.,-c]);

    // 2-fold points at (0,-c), (a,c), (0,b/2-c), (a,b/2+c), on the sides x = 0 and x = a of the rectangle
    switch(resolveWallpaperDomainShape('2222', domainShape)){

        default:
        case 'rectangle':
            // rectangle [0,a] x [-b/2,b/2]; the top and bottom sides are paired by the translation (0,b)
            return {
                    s:[s0,s1,s2,s3],  // domain
                    t:[[s0,ss0],[s1,ss1],[s2,ss],[s3,ss]] // reverse transforms
                };
        case 'parallelogram': {
            // parallelogram with the 2-fold points at the midpoints of its sides and no special points at its corners
            const M = [[0, -c], [a, c], [a, b2 + c], [0, b2 - c]];   // the side midpoints
            const v = [M[1][0] - M[3][0], M[1][1] - M[3][1]];        // side vectors: V2 - V1 = M2 - M4
            const w = [M[2][0] - M[0][0], M[2][1] - M[0][1]];        //               V4 - V1 = M3 - M1
            const V1 = [M[0][0] - v[0]/2, M[0][1] - v[1]/2];
            const V2 = [M[0][0] + v[0]/2, M[0][1] + v[1]/2];
            const corners = [V1, V2, [V2[0] + w[0], V2[1] + w[1]], [V1[0] + w[0], V1[1] + w[1]]];
            const p = iPolygonSides(corners);
            // every side is paired with itself by the 2-fold rotation about its midpoint:
            // reflect in the side, then in its perpendicular bisector
            return { s: p, t: p.map((side, i) => [side, iBisectorOf(corners[i], corners[(i+1)%4])]) };
        }
    }
}

//
//  group 2*22
//
function iGroup_2S22( a, b) {
	
	var a2 = 0.5*a;
	var b2 = 0.5*b;
		
	var s0 = iPlane([1.,0.,0.,  a2]);
	var s1 = iPlane([-1.,0.,0., 0.]);
	var s2 = iPlane([0.,1.,0.,  b2]);
	var s3 = iPlane([0.,-1.,0., b2]);

	var sy = iPlane([0.,1.,0.,0]);
	
	return {
			s:[s0,s1,s2,s3],  // domain
			t:[[s0],[s1,sy],[s2],[s3]] // reverse transforms 
		};			
	
}

//
//  group 22*
//
function iGroup_22S(a,b) {
	
	var a2 = 0.5*a;
	var b2 = 0.5*b;
	
	var s0 = iPlane([1.,0.,0.,  a2]);
	var s1 = iPlane([-1.,0.,0., 0.]);
	var s2 = iPlane([0.,1.,0.,  b2]);
	var s3 = iPlane([0.,-1.,0., b2]);
	
	var sy = iPlane([0.,1.,0.,0]);

	return {
			s:[s0,s1,s2,s3],  // domain
			t:[[s0,sy],[s1,sy],[s2],[s3]] // reverse transforms 
		};			
	
}

//
//  group **
//
function iGroup_SS( a, b) {
	
	var a2 = 0.5*a;
	var b2 = 0.5*b;
		
	var s0 = iPlane([1.,0.,0.,  a2]);
	var s1 = iPlane([-1.,0.,0., 0.]);
	var s2 = iPlane([0.,1.,0.,  b2]);
	var s3 = iPlane([0.,-1.,0., b2]);

	var sy = iPlane([0.,1.,0.,0]);
	
	return {
			s:[s0,s1,s2,s3],  // domain
			t:[[s0],[s1],[s2,sy],[s3,sy]] // reverse transforms 
		};			
		
}

//
//  group SX 
//
function iGroup_SX(a, b) {
	
	var a2 = 0.5*a;
	var b2 = 0.5*b;
		
	var s0 = iPlane([ 1, 0,0,a2]);
	var s1 = iPlane([-1, 0,0,a2]);
	var s2 = iPlane([ 0, 1,0,b2]);
	var s3 = iPlane([ 0,-1,0,b2]);

	var sx = iPlane([ 1,0,0,0]);
	var sy = iPlane([ 0,1,0,0]);
	
	return {
			s:[s0,s1,s2,s3],  // domain
			t:[[s0,sx,sy],[s1,sx,sy],[s2],[s3]] // reverse transforms 
		};				
}

//
//  group 22X
//
function iGroup_22X(a, b) {
	
	var a2 = 0.5*a;
	var b2 = 0.5*b;
	
	
	var s0 = iPlane([1, 0,0,a2]);
	var s1 = iPlane([-1, 0,0,a2]);
	var s2 = iPlane([ 0, 1,0,b2]);
	var s3 = iPlane([ 0,-1,0,b2]);
	
	var sx = iPlane([1,0,0,0]);
	var sy = iPlane([0,1,0,0]);
	
	return {
			s:[s0,s1,s2,s3],  // domain
			t:[[s0,sx,sy],[s1,sx,sy],[s2,sy, sx],[s3,sy,sx]] // reverse transforms 
		};				
		
}

//
//  group XX
//
function iGroup_XX(a, b) {
	
	var a2 = 0.5*a;
	var b2 = 0.5*b;
		
	var s0 = iPlane([ 1, 0,0,a2]);
	var s1 = iPlane([-1, 0,0,a2]);
	var s2 = iPlane([ 0, 1,0,b2]);
	var s3 = iPlane([ 0,-1,0,b2]);
	
	var sx = iPlane([1,0,0,0]);
	var sy = iPlane([0,1,0,0]);

	return {
			s:[s0,s1,s2,s3],  // domain
			t:[[s0,sx,sy],[s1,sx,sy],[s2,sy],[s3,sy]] // reverse transforms 
		};					
}

//
//  group O
//
function iGroup_O(a, b) {
	
	var a2 = mul(a,0.5);
	var b2 = mul(b,0.5);
	
	var lena = sqrt(dot(a2,a2));
	var lenb = sqrt(dot(b2,b2));
	// dual basis
	var da = normalize([b[1], -b[0]]);
	var db = normalize([-a[1], a[0]]);
	var ada = dot(a2,da);
	var bdb = dot(b2,db);

	
	var s0 = iPlane([da[0],da[1],0,ada]);
	var s1 = iPlane([-da[0],-da[1],0,ada]);
	var s2 = iPlane([db[0],db[1],0,bdb]);
	var s3 = iPlane([-db[0],-db[1],0,bdb]);
	
	var sa1 = iPlane([a2[0],a2[1],0,lena]);
	var sa0 = iPlane([a2[0],a2[1],0,0]);
	var sa_1 = iPlane([-a2[0],-a2[1],0,lena]);
	var sb1 = iPlane([b2[0],b2[1],0,lenb]);
	var sb0 = iPlane([b2[0],b2[1],0,0]);
	var sb_1 = iPlane([-b2[0],-b2[1],0,lenb]);
	
	return {
			s:[s0,s1,s2,s3],  // domain
			t:[[sa1,sa0],[sa_1,sa0],[sb1,sb0],[sb_1,sb0]] // reverse transforms 
		};					
		
}

//
//  group *n
//
function iGroup_SN(n) {
	var angle = PI/n;
	var s0 = iPlane([0,-1,0,0]);
	var s1 = iPlane([-sin(angle), cos(angle),0,0]);
	return {
			s:[s0,s1],  // domain
			t:[[s0],[s1]] // transforms 
		};						
}

//
//  group n
//
function iGroup_N(n) {
	var angle = PI/n;
	var s0 = iPlane([0,-1,0,0]);
	var s1 = iPlane([-sin(angle), cos(angle),0,0]);
	var s2 = iPlane([-sin(angle), -cos(angle),0,0]);
	return {
			s:[s1,s2],  // domain
			t:[[s1,s0],[s2,s0]] // transforms 
		};						
}


export function iWallpaperGroup(param){
  
	var name = getParam(param.name,"*442");
	var a = getParam(param.a, 1.);
	var b = getParam(param.b, a);
	var c = getParam(param.c, 0.);

	var angle_a = getParam(param.angle_a, 0.);
	var angle_b = getParam(param.angle_b, PI/2);	
	var domainShape = getParam(param.domainShape, DEFAULT_DOMAIN_SHAPE);
	var debug = getParam(param.debug, false);
  
	if(debug)console.log("iWallpaperGroup(%d)", index, a, b, c,angle_a, angle_b);
	
	switch(name){
		default: return iGroup_Trivial();
		case '*442':  return iGroup_S442(a);		
		case '442':  return iGroup_442(a, domainShape);		
		case '4*2':  return iGroup_4S2(a, domainShape);
		case '*632':  return iGroup_S632(a);
		case '632':  return iGroup_632(a, domainShape);
		case '3*3':  return iGroup_3S3(a, domainShape);
		case '*333':  return iGroup_S333(a);
		case '333':  return iGroup_333(a, domainShape);
		case '*2222':  return iGroup_S2222(a,b);
		case '2222': return iGroup_2222(a,b,c, domainShape);
		case '2*22': return iGroup_2S22(a,b);
		case '22*': return iGroup_22S(a,b);
		case '**': return iGroup_SS(a,b);
    
    case '*X':
		case '*x': return iGroup_SX(a,b);
    
    case '22X':
		case '22x': return iGroup_22X(a,b);
    case 'XX':
		case 'xx': return iGroup_XX(a,b);
    case 'O':
		case 'o': return iGroup_O([a*cos(angle_a),a*sin(angle_a)],[b*cos(angle_b),b*sin(angle_b)]);	
	}
}
