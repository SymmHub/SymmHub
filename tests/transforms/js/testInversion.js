
import {

    iSphere, 
    iReflect,
    sqrt,    
}

from '../../../lib/invlib/modules.js';

function toStr(v,digits){
    let s = '[';
    for(let i = 0; i < v.length; i++){
        s += v[i].toFixed(digits);
        s += ' ';
    }
    s += ']';
    
    return s;
}


function testInversion(){

    console.log('testInversion()');

    let s3 = sqrt(3);
    let s5 = sqrt(5);
    let fi = (s5+1)/2;
    //
    //coord of icosahedral vertex
    //
    let p = [(fi-1)/s3, 0, (fi/s3)];
    let q = [1/sqrt(fi*fi+1), 0, fi/sqrt(fi*fi+1)];
    
    let sphere = iSphere([0,0,-1, sqrt(2)]);    
    let p1 = iReflect(sphere, p);    
    let q1 = iReflect(sphere, q);    
        
    let s = (fi-1)/(fi+s3);     
    let s1 = 4*(s5-1)/(s5+2*s3+1);
    
    let pp = 1/(2 * fi + sqrt(fi*fi+1));
    
    console.log('p: ', toStr(p, 16));
    console.log('p1: ', toStr(p1, 16));
    console.log('q: ', toStr(q, 16));
    console.log('q1: ', toStr(q1, 16));
    console.log('s: ', s.toFixed(16));
    console.log('s1: ', s1.toFixed(16));
    console.log('pp: ', pp.toFixed(16));
    
        
}

function test2(){

    const PHI = "φ"; 
    const U = "u";   // u = sqrt(phi + 2)

    function getSymbolicInvertedIcosahedron() {
        // Definition of symbols for display
        
        console.log(`--- CONSTANT DEFINITIONS ---`);
        console.log(`${PHI} = (1 + √5) / 2  (Golden Ratio)`);
        console.log(`${U} = √(${PHI} + 2)      (Normalization Factor)`);
        console.log(`Inversion Center: (0, 0, -1), Radius: √2`);
        console.log(`Resulting z-coordinate is always 0 (Planar Projection)\n`);

        const vertices = [];

        // --- GROUP 1: The "Equatorial" Vertices (Invariant) ---
        // These original points had z=0. They lie on the intersection 
        // of the sphere and the inversion plane, so they do not move.
        // Algebraic Form: (±1/u, ±φ/u)
        console.log(`--- GROUP 1: Invariant Points (On Unit Circle) ---`);
        const signs = [-1, 1];
        signs.forEach(s1 => {
            signs.forEach(s2 => {
                const sign1 = s1 > 0 ? "" : "-";
                const sign2 = s2 > 0 ? "" : "-";
                
                vertices.push({
                    type: "Unit Circle",
                    coord: `( ${sign1}1/${U}, ${sign2}${PHI}/${U}, 0 )`
                });
            });
        });
        console.log(`  • 4 points generated: (±1/${U}, ±${PHI}/${U}, 0)`);


        // --- GROUP 2: Vertices on the Y-Axis ---
        // Original: (0, ±1/u, ±φ/u)
        // These project onto the Y-axis. They form reciprocal pairs.
        // Inner pair: ±(u - φ)  |  Outer pair: ±(u + φ)
        console.log(`\n--- GROUP 2: Y-Axis Points (Reciprocals) ---`);
        
        // Inner Y (Derived from z > 0)
        signs.forEach(s => {
            const sign = s > 0 ? "" : "-";
            vertices.push({
                type: "Y-Axis Inner",
                coord: `( 0, ${sign}(${U} - ${PHI}), 0 )`
            });
        });
        
        // Outer Y (Derived from z < 0)
        signs.forEach(s => {
            const sign = s > 0 ? "" : "-";
            vertices.push({
                type: "Y-Axis Outer",
                coord: `( 0, ${sign}(${U} + ${PHI}), 0 )`
            });
        });
        console.log(`  • 2 Inner points: (0, ±(${U} - ${PHI}), 0)`);
        console.log(`  • 2 Outer points: (0, ±(${U} + ${PHI}), 0)`);


        // --- GROUP 3: Vertices on the X-Axis ---
        // Original: (±φ/u, 0, ±1/u)
        // These project onto the X-axis. They form reciprocal pairs.
        // Inner pair: ±φ/(u + 1) | Outer pair: ±φ/(u - 1)
        console.log(`\n--- GROUP 3: X-Axis Points (Reciprocals) ---`);

        // Inner X
        signs.forEach(s => {
            const sign = s > 0 ? "" : "-";
            vertices.push({
                type: "X-Axis Inner",
                coord: `( ${sign}${PHI}/(${U} + 1), 0, 0 )`
            });
        });

        // Outer X
        signs.forEach(s => {
            const sign = s > 0 ? "" : "-";
            vertices.push({
                type: "X-Axis Outer",
                coord: `( ${sign}${PHI}/(${U} - 1), 0, 0 )`
            });
        });
        console.log(`  • 2 Inner points: (±${PHI}/(${U} + 1), 0, 0)`);
        console.log(`  • 2 Outer points: (±${PHI}/(${U} - 1), 0, 0)`);

        return vertices;
    }

    // Execute
    const symbolicVertices = getSymbolicInvertedIcosahedron();

    // Optional: Verify numerically that these symbolic forms match the calculated ones
    console.log(`\n--- NUMERICAL VERIFICATION ---`);
    const phi = (1 + Math.sqrt(5)) / 2;
    const u = Math.sqrt(phi + 2);

    // Pick one from Group 3 Outer: phi / (u - 1)
    const symbolicValue = phi / (u - 1);

    // Calculate via raw inversion of original vertex (phi/u, 0, -1/u)
    const origX = phi/u;
    const origZ = -1/u;
    const invertedX = origX / (1 + origZ); // x / (1+z)

    console.log(`Symbolic [φ/(${U}-1)]: ${symbolicValue.toFixed(8)}`);
    console.log(`Calculated [x/(1+z)]:   ${invertedX.toFixed(8)}`);
}



//testInversion();
test2();