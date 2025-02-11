import {iPlane, iSphere} from '../../library/jslibm/ISplane.js';
import {sin,cos, sqrt, PI} from '../../library/jslibm/Utilities.js';


/* 

Data for the Euclidean and spherical wallpaper groups
Modified to mesh with WallpaperGroups_General.js

*/

export function nonNegHashOrbifold(hashed,parCounts,curvature){
	var name="";
	var nnn=0;
	var handlesN =hashed.handlesN;
	var crosscapsN=hashed.crosscapsN; 
	var conepoints=hashed.conepoints.sort(function(a, b){return b - a}); //in descending order
	var kaleidoscopes=hashed.kaleidoscopes.map(x=>x.sort(function(a, b){return b - a}));
	var kaleidoN = kaleidoscopes.length;
	
	if(handlesN>0){
		parCounts["handle"]=1; 
		name = "O";
	}
	else if(crosscapsN>1){
		parCounts["cap"]=1; //the two caps will have the same length
		name = "XX"
	}
	else if((crosscapsN>0)&&(kaleidoN>0))
		{
		parCounts["cap"]=1; 
		name = "X*"
	}
	else if(crosscapsN>0) 
		{	if(curvature==0)
			{
				parCounts["cap"]=1; 
				name = "22X"
			}
			else //NX 
			{
				name="NX";
				if(conepoints.length==1){
					nnn=conepoints[0];
				}
				else //better not be any conepoints at all!
				{
					name ="X"
				}
			}
	}
	else if(kaleidoN>1)
		{
		parCounts["band"]=1; 
		name = "**"
	}
	else{
		//deal with the cases with an nnn specially, 
		//breaking out of the function
		// 532 etc are handled _after_ this if statement.
		// We are thus concerned with
		// NN,SNN,NS,22N,2SN,S22N 
		// (NX having been handled above)
		// We may assume that the orbifold really is in good shape, 
		// since this is checked in the hashing function.
		if(conepoints.length==2){
			//NN
			name="NN";
			nnn=conepoints[0];
		}
		else if(kaleidoscopes.length>0 && kaleidoscopes[0].length==2)
		{	name="*NN";
			nnn=kaleidoscopes[0][0];
		}
		else if (kaleidoscopes.length>0 && kaleidoscopes[0].length==0)
		{	if(conepoints.length==0){
				name = "*";}
			else{
				name = "N*";
				nnn=conepoints[0]
			}
		}
		else if(conepoints.length==3 && conepoints[1]==2)
		{	name = "22N";
			nnn=conepoints[0]; //recall cones are in descending order
		}
		else if(conepoints.length==1 && conepoints[0]==2)
		// we have to have a single kaleidoscope, with one korner.
		{	name = "2*N";
			nnn = kaleidoscopes[0][0];
		}
		else if(kaleidoscopes.length==1 && kaleidoscopes[0].length==3 && kaleidoscopes[0][1]==2)
		{
			name = "*22N";
			nnn = kaleidoscopes[0][0];
		}
		else{
			conepoints.forEach(function(cone){name+=cone.toString()})
			if(kaleidoN>0){
				name+="*";
				kaleidoscopes[0].
				//	sort(function(a, b){return b - a}).
					forEach(function(corner){name+=corner.toString()})
				}
			switch(name)
			{
				case "2222": parCounts["tube"]=1;break;
				case "22*":
				case "2*22":
				case "*2222": parCounts["slice"]=1;break;
			}
		}
	}
	return {"standardName":name,"nnn":nnn}
}




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
  "X*", //changed from "*x" throughout
  "22X",
  "XX",
  "O",
"N","NN","SN","SNN","X","NX","S","NS","22N",
"2SN","S22N","S532","532","S432","432","S332","332","3S2"
];

/*var WallpaperGroupMap = {
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
 14:"X*",
 15:"22X",
 16:"XX",
 17:"O"
};*/

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
export function iGroup_Trivial(){
	return {s:[], t:[]};
}

//
// group *442
//
export function iGroup_S442(a) {
	
	var d = a*sqrt(2.)/4.;
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
export function iGroup_442(a) {
	
	var d = a*sqrt(2.)/4.;
	
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
export function iGroup_4S2(a) {
	
	var d = a*sqrt(2.)/4.;
	
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
export function iGroup_S632(a) {
	
	var s3 = sqrt(3.);
	
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
export function iGroup_632(a) {
	
	var s3 = sqrt(3.);
	
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
export function iGroup_3S3(a) {
	
	var s3 = sqrt(3.);
	
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
export function iGroup_S333(a){
	
	var s3 = sqrt(3.);
	
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
export function iGroup_333(a) {
	
	var s3 = sqrt(3.);
	
	var d = a*s3/4.;
		
	s0 = iPlane([s3,1,0,d]);
	s1 = iPlane([-s3,1,0,d]);
	s2 = iPlane([s3,-1,0,d]);
	s3 = iPlane([-s3,-1,0,d]);
	
	var sy = iPlane([0,1,0,0]);
	
	return {
			s:[s0,s1,s2,s3],  //fund domain
			t:[[s0,sy],[s1,sy],[s2,sy],[s3,sy]] // transforms 
		};			
		
}

//
// group *2222
//
export function iGroup_S2222(a, b) {
	
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
export function iGroup_2222_(a, b) {
	
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

export function iGroup_2222(a,b,c) {
    
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
export function iGroup_2S22( a, b) {
	
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
export function iGroup_22S(a,b) {
	
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
export function iGroup_SS( a, b) {
	
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
export function iGroup_SX(a, b) {
	
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
export function iGroup_22X(a, b) {
	
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
export function iGroup_XX(a, b) {
	
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
export function iGroup_O(a, b) {
	
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
export function iGroup_SN(n) {
	// presumes n>1
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
export function iGroup_N(n) {
	// presumes n>1
	var angle = PI/n;
	var s0 = iPlane([0,-1,0,0]);
	var s1 = iPlane([-sin(angle), cos(angle),0,0]);
	var s2 = iPlane([-sin(angle), -cos(angle),0,0]);
	return {
			s:[s1,s2],  // domain
			t:[[s1,s0],[s2,s0]] // transforms 
		};						
}

//////////////////
// Spherical Groups
//////////////////

// treated in the plane, scaled with the equator at the unit circle

// same as *n above, for n>1
export function iGroup_SNN(n){
	if(n>1){return iGroup_SN(n)}
	else{
		var s0= iPlane([0,-1,0,0]);
		return {s:[s0],t:[[s0]]}
	}
}

// same as n above; n=1 won't come up
export function iGroup_NN(n){
	return iGroup_N(n)
}

export function iGroup_NX(n){
	//note that n might be 1
	var s0= iPlane([0,-1,0,0]);
	var s1= iPlane([-sin(PI/n/2.),cos(PI/n/2.),0,0]);
	var s2= iPlane([-sin(PI/n/2.),-cos(PI/n/2.),0,0]);
	var ss= iSphere([0,0,0,1]);
	return{
		s:[s1,s2],
		t:[[s1,s0,ss],[s2,s0,ss]]
	}	
}

export function iGroup_NS(n){
	//note that n might be 1
	var ss= iSphere([0,0,0,1]);
	if(n==1){
		return{s:[ss],t:[[ss]]}
	}
	else{
		var s0= iPlane([0,-1,0,0]);
		var s1= iPlane([-sin(PI/n),cos(PI/n),0,0]);
		var s2= iPlane([-sin(PI/n),-cos(PI/n),0,0]);
		return {s:[s1,s2,ss],t:[[s1,s0],[s2,s0],[ss]]}	
	}
}

export function iGroup_S22N(n){
	if(n==1){
		return iGroup_SNN(2)
	}
	else
	{	var ss= iSphere([0,0,0,1]);
		var s0= iPlane([0,-1,0,0]);
		var s1= iPlane([-sin(PI/n),cos(PI/n),0,0]);
		return {s:[s0,s1,ss],t:[[s0],[s1],[ss]]}
	}	
}


export function iGroup_22N(n){
		if(n==1){
			return iGroup_NN(2)
		}
		else
		{	var ss= iSphere([0,0,0,1]);
			var s0= iPlane([0,-1,0,0]);
			var s1= iPlane([-sin(PI/n),cos(PI/n),0,0]);
			var s2= iPlane([-sin(PI/n),-cos(PI/n),0,0]);
			return {s:[s1,s2,ss],t:[[s1,s0],[s2,s0],[ss,s0]]}
		}	
	}
	

export function iGroup_2SN(n){
	if(n==1){
		return iGroup_NS(2)
	}
	else
	{	var ss= iSphere([0,0,0,1]);
		var s0= iPlane([0,-1,0,0]);
		var s1= iPlane([-sin(PI/n),cos(PI/n),0,0]);
		var sh= iPlane([-sin(PI/n/2.),cos(PI/n/2.),0,0]);
		return {s:[s0,s1,ss],t:[[s0],[s1],[ss,sh]]}
	}	
}


export function iGroup_S532(){
	var s0= iPlane([0,-1,0,0]);
	var s1= iPlane([-sin(PI/5),cos(PI/5),0,0]);
	var s5= iSphere([-1.61803398874989, 0,0,1.90211303259031]);
	return {s:[s0,s1,s5], // domain
			t:[[s0],[s1],[s5]] //transforms
		};
}

export function iGroup_532(){
	var s0= iPlane([0,-1,0,0]);
	var s1= iPlane([-sin(PI/5),cos(PI/5),0,0]);
	var s2= iPlane([-sin(PI/5),-cos(PI/5),0,0]);
	var s5= iSphere([-1.61803398874989, 0,0,1.90211303259031]);
	return {s:[s1,s2,s5], // domain
			t:[[s1,s0],[s2,s0],[s5,s0]] //transforms
		};
}

export function iGroup_S432(){
	var s0= iPlane([0,-1,0,0]);
	var s1= iPlane([-sin(PI/4),cos(PI/4),0,0]);
	var s4= iSphere([-1, 0,0,1.41421356237310]);
	return {s:[s0,s1,s4], // domain
			t:[[s0],[s1],[s4]] //transforms
		};
}

export function iGroup_432(){
	var s0= iPlane([0,-1,0,0]);
	var s1= iPlane([-sin(PI/4),cos(PI/4),0,0]);
	var s2= iPlane([-sin(PI/4),-cos(PI/4),0,0]);
	var s4= iSphere([-1, 0,0,1.41421356237310]);
	return {s:[s1,s2,s4], // domain
			t:[[s1,s0],[s2,s0],[s4,s0]] //transforms
		};
}

export function iGroup_S332(){
	var s0= iPlane([0,-1,0,0]);
	var s1= iPlane([-sin(PI/3),cos(PI/3),0,0]);
	var s3= iSphere([-0.707106781186548, 0,0,1.22474487139159]);
	return {s:[s0,s1,s3], // domain
			t:[[s0],[s1],[s3]] //transforms
		};
}

export function iGroup_332(){
	var s0= iPlane([0,-1,0,0]);
	var s1= iPlane([-sin(PI/3),cos(PI/3),0,0]);
	var s2= iPlane([-sin(PI/3),-cos(PI/3),0,0]);
	var s3= iSphere([-0.707106781186548, 0,0,1.22474487139159]);
	return {s:[s1,s2,s3], // domain
			t:[[s1,s0],[s2,s0],[s3,s0]] //transforms
		};
}

export function iGroup_3S2(){
	var s0= iPlane([0,-1,0,0]);
	var s1= iPlane([-sin(PI/3),cos(PI/3),0,0]);
	var s2= iPlane([-sin(PI/3),-cos(PI/3),0,0]);
	var s3= iSphere([-1.41421356237310,0,0, 1.73205080756888]);
	return {s:[s1,s2,s3], // domain
			t:[[s1,s0],[s2,s0],[s3]] //transforms
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
    
    case 'X*':
		case 'x*': return iGroup_SX(a,b);
    
    case '22X':
		case '22x': return iGroup_22X(a,b);
    case 'XX':
		case 'xx': return iGroup_XX(a,b);
    case 'O':
		case 'o': return iGroup_O([a*cos(angle_a),a*sin(angle_a)],[b*cos(angle_b),b*sin(angle_b)]);	
	}
}



export function getNonnegativeGroupData(name, group){
  	var n = group.nnn;
	switch(name){
		default: return iGroup_Trivial();
		case '*442':  return iGroup_S442(1);		
		case '442':  return iGroup_442(1);		
		case '4*2':  return iGroup_4S2(1);
		case '*632':  return iGroup_S632(1);
		case '632':  return iGroup_632(1);
		case '3*3':  return iGroup_3S3(1);
		case '*333':  return iGroup_S333(1);
		case '333':  return iGroup_333(1);
		case '*2222':  return iGroup_S2222(1,getLength(["band",1],group));
		case '2222': return iGroup_2222(1,getLength(["tube",1],group),getTwist(["tube",1],group));
		case '2*22': return iGroup_2S22(1,getLength(["slice",1],group));
		case '22*': return iGroup_22S(1,getLength(["slice",1],group));
		case '**': return iGroup_SS(1,getLength(["slice",1],group));
    
    	case 'X*':
		case '*X':
		case '*x':
		case 'x*': return iGroup_SX(1,getLength(["cap",1],group));
    
    	case '22X':
		case '22x': return iGroup_22X(1,getLength(["cap",1],group));
    	
		case 'XX':
		case 'xx': return iGroup_XX(1,getLength(["cap",1],group));
    	
		case 'O':
		case 'o': return iGroup_O([1,0],[1+getTwist(["handle",1],group),getLength(["handle",1],group)]);	
		
		case 'NN': return iGroup_NN(n);
		
		case '*NN': return iGroup_SNN(n);
		case '*': return iGroup_SNN(1);
		
		case 'NX': return iGroup_NX(n);
		case 'X': return iGroup_NX(1);
		
		case '22N': return iGroup_22N(n);
		case '2*N': return iGroup_2SN(n);
		case 'N*': return iGroup_NS(n);
		case '*22N': return iGroup_S22N(n);
		case '532': return iGroup_532();
		case '*532': return iGroup_S532();
		case '432': return iGroup_432();
		case '*432': return iGroup_S432();
		case '332': return iGroup_332();
		case '*332': return iGroup_S332();
		case '3*2': return iGroup_3S2();
		
	
	
	}
}

//dispatch X, * etc
