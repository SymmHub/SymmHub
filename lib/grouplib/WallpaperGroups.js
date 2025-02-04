
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
			t:[[s0],[s1],[s2]] // transforms 
		};						
}

//
// group 442
//
function iGroup_442(a) {
	
	var d = a*SQRT2/4.;
	
	var s0 = iPlane([-1,0,0,0]);
	var s1 = iPlane([1,1,0,d]);
	var s2 = iPlane([1,-1,0,d]);

	var s3 = iPlane([0,1,0,0]);

	return {
			s:[s0,s1,s2],  //fund domain
			t:[[s0,s3],[s1,s3],[s2,s3]] // transforms 
		};			
				
}


//
// group 4*2
//
function iGroup_4S2(a) {
	
	var d = a*SQRT2/4.;
	
	var s0 = iPlane([-1,0,0,0]);
	var s1 = iPlane([1,1,0,d]);
	var s2 = iPlane([1,-1,0,d]);

	var sy = iPlane([0,1,0,0]);
	return {
			s:[s0,s1,s2],  //fund domain
			t:[[s0],[sy, s2],[s2,sy]] // transforms 
		};			

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
			t:[[s0],[s1],[s2]] // transforms 
		};					
	
}

//
// group 632
//
function iGroup_632(a) {
	
	var s3 = SQRT3;
	
	var d = a*s3/4.;
		
	var s0 = iPlane([-1,0,0,0]);
	var s1 = iPlane([s3,1,0,d]);
	var s2 = iPlane([s3,-1,0,d]);
	var sy = iPlane([0,1,0,0]);
	
	return {
			s:[s0,s1,s2],  //fund domain
			t:[[s0,sy],[s1,sy],[s2,sy]] // transforms 
		};					
			
}

//
// group 3*3
//
function iGroup_3S3(a) {
	
	var s3 = SQRT3;
	
	var d = a*s3/4.;
		
	var s0 = iPlane([-1,0,0,0]);
	var s1 = iPlane([s3,1,0,d]);
	var s2 = iPlane([s3,-1,0,d]);
	var sy = iPlane([0,1,0,0]);

	return {
			s:[s0,s1,s2],  //fund domain
			t:[[s0],[s1,sy],[s2,sy]] // transforms 
		};							
	
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
			t:[[p0],[p1],[p2]] // transforms 
		};			
}

//
// group 333
//
function iGroup_333(a) {
	
	const ss3 = SQRT3;
	let d = a*ss3/4.;
		
	let s0 = iPlane([ss3,1,0,d]);
	let s1 = iPlane([-ss3,1,0,d]);
	let s2 = iPlane([ss3,-1,0,d]);
	let s3 = iPlane([-ss3,-1,0,d]);
	
	let sy = iPlane([0,1,0,0]);
	
	return {
			s:[s0,s1,s2,s3],  //fund domain
			t:[[s0,sy],[s1,sy],[s2,sy],[s3,sy]] // transforms 
		};			
		
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
			t:[[s0],[s1],[s2],[s3]] // transforms 
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
			t:[[s0,ss],[s1,ss],[s2,ss],[s3,ss]] // transforms 
		};			
	
}

function iGroup_2222(a,b,c) {
    
    var a = a;
    var b2 = 0.5*b;
        
    var s0 = iPlane([1.,0.,0.,  a]);
    var s1 = iPlane([-1.,0.,0., 0.]);
    var s2 = iPlane([0,1.,0.,  b2]);
    var s3 = iPlane([0,-1.,0., b2]);
    
    var ss = iPlane([0.,1.,0.,0.]);
    var ss0 = iPlane([0.,1.,0.,c]);
    var ss1 = iPlane([0.,1.,0.,-c]);
    return {
            s:[s0,s1,s2,s3],  // domain
            t:[[s0,ss0],[s1,ss1],[s2,ss],[s3,ss]] // transforms 
        };                
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
			t:[[s0],[s1,sy],[s2],[s3]] // transforms 
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
			t:[[s0,sy],[s1,sy],[s2],[s3]] // transforms 
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
			t:[[s0],[s1],[s2,sy],[s3,sy]] // transforms 
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
			t:[[s0,sx,sy],[s1,sx,sy],[s2],[s3]] // transforms 
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
			t:[[s0,sx,sy],[s1,sx,sy],[s2,sy, sx],[s3,sy,sx]] // transforms 
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
			t:[[s0,sx,sy],[s1,sx,sy],[s2,sy],[s3,sy]] // transforms 
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
			t:[[sa1,sa0],[sa_1,sa0],[sb1,sb0],[sb_1,sb0]] // transforms 
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
	var debug = getParam(param.debug, false);
  
	if(debug)console.log("iWallpaperGroup(%d)", index, a, b, c,angle_a, angle_b);
	
	switch(name){
		default: return iGroup_Trivial();
		case '*442':  return iGroup_S442(a);		
		case '442':  return iGroup_442(a);		
		case '4*2':  return iGroup_4S2(a);
		case '*632':  return iGroup_S632(a);
		case '632':  return iGroup_632(a);
		case '3*3':  return iGroup_3S3(a);
		case '*333':  return iGroup_S333(a);
		case '333':  return iGroup_333(a);
		case '*2222':  return iGroup_S2222(a,b);
		case '2222': return iGroup_2222(a,b,c);
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
