import {
    Group_KLM
} from '../../../lib/grouplib/modules.js';
import {
    CrownCalculator
} from '../../../lib/symhublib/modules.js';

const MYNAME = 'testCrownCalculator';

function generateSpiralPoints(radius) {
    const points = [];
    points.push([0, 0]);
    for (let r = 1; r <= radius; r++) {
        // Left side: x = -r, y from -r to r
        for (let y = -r; y <= r; y++) {
            points.push([-r, y]);
        }
        // Top side: y = r, x from -r + 1 to r
        for (let x = -r + 1; x <= r; x++) {
            points.push([x, r]);
        }
        // Right side: x = r, y from r - 1 down to -r
        for (let y = r - 1; y >= -r; y--) {
            points.push([r, y]);
        }
        // Bottom side: y = -r, x from r - 1 down to -r + 1
        for (let x = r - 1; x >= -r + 1; x--) {
            points.push([x, -r]);
        }
    }
    return points;
}


const groupParams = {
    "K": 3,
    "L": 3,
    "M": 4,
};

const patternTransform = {
    centerX: 0.15, 
    centerY: 0.0,
    scale: 0.31,
    angle: 30, // degrees
};

const GRID_RADIUS = 20;

function drawTestResults(canvas, group, patternTransform, uniqueTransforms) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Center at (600, 600)
    // Scale: 1 unit = 400 pixels
    const zoom = 700;
    const cx = width / 2;
    const cy = height / 2;
    
    function toScreenX(x) {
        return cx + x * zoom;
    }
    
    function toScreenY(y) {
        return cy - y * zoom;
    }
    
    // 1. Draw coordinate grid & axes
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1.5;
    for (let g = -1.5; g <= 1.5; g += 0.05) {
        // Horizontal grid lines
        ctx.beginPath();
        ctx.moveTo(0, toScreenY(g));
        ctx.lineTo(width, toScreenY(g));
        ctx.stroke();
        
        // Vertical grid lines
        ctx.beginPath();
        ctx.moveTo(toScreenX(g), 0);
        ctx.lineTo(toScreenX(g), height);
        ctx.stroke();
    }
    
    // Draw major axes
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();
    
    // 2. Draw fundamental domain boundary (Green)
    const fd = group.getFundDomain();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)'; // Emerald Green
    ctx.lineWidth = 4.0;
    
    fd.forEach(side => {
        if (side.type === 1) { // SPLANE_SPHERE
            const sx = side.v[0];
            const sy = side.v[1];
            const r = Math.abs(side.v[3]);
            
            ctx.beginPath();
            ctx.arc(toScreenX(sx), toScreenY(sy), r * zoom, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (side.type === 2) { // SPLANE_PLANE
            const nx = side.v[0];
            const ny = side.v[1];
            const d = side.v[3];
            
            const px = nx * d;
            const py = ny * d;
            
            const x1 = px - 10 * ny;
            const y1 = py + 10 * nx;
            const x2 = px + 10 * ny;
            const y2 = py - 10 * nx;
            
            ctx.beginPath();
            ctx.moveTo(toScreenX(x1), toScreenY(y1));
            ctx.lineTo(toScreenX(x2), toScreenY(y2));
            ctx.stroke();
        }
    });
    
    // 3. Draw pattern boundary (Dashed slate blue)
    const angleRad = (patternTransform.angle || 0) * (Math.PI / 180);
    const sa = Math.sin(angleRad);
    const ca = Math.cos(angleRad);
    const pcx = patternTransform.centerX || 0;
    const pcy = patternTransform.centerY || 0;
    const pscale = patternTransform.scale !== undefined ? patternTransform.scale : 1;
    
    const corners = [
        [-1, 1], [1, 1], [1, -1], [-1, -1]
    ];
    const wCorners = corners.map(([px, py]) => {
        const wx = pscale * (ca * px - sa * py) + pcx;
        const wy = pscale * (sa * px + ca * py) + pcy;
        return [wx, wy];
    });
    
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)'; // Slate
    ctx.lineWidth = 2.0;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(toScreenX(wCorners[0][0]), toScreenY(wCorners[0][1]));
    for (let i = 1; i < wCorners.length; i++) {
        ctx.lineTo(toScreenX(wCorners[i][0]), toScreenY(wCorners[i][1]));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]); // Reset
    
    // 3.5. Draw all original spiral points in magenta (using the spiral order generator)
    const gridRadius = GRID_RADIUS;
    const spiralPoints = generateSpiralPoints(gridRadius);
    ctx.fillStyle = 'rgba(217, 70, 239, 0.6)'; // Magenta
    spiralPoints.forEach(([gx, gy]) => {
        const px = gx / gridRadius;
        const py = gy / gridRadius;
        const wx = pscale * (ca * px - sa * py) + pcx;
        const wy = pscale * (sa * px + ca * py) + pcy;
        
        ctx.beginPath();
        ctx.arc(toScreenX(wx), toScreenY(wy), 3.5, 0, 2 * Math.PI);
        ctx.fill();
    });

    
    // 4. Draw points and connections
    uniqueTransforms.forEach((t, index) => {
        if (!t.worldPoint || !t.fundDomainPoint) return;
        
        const [wx, wy] = t.worldPoint;
        const [fx, fy] = t.fundDomainPoint;
        
        const swx = toScreenX(wx);
        const swy = toScreenY(wy);
        const sfx = toScreenX(fx);
        const sfy = toScreenY(fy);
        
        // Draw mapping connection line
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(swx, swy);
        ctx.lineTo(sfx, sfy);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw World Point (Blue circle)
        ctx.fillStyle = 'rgba(37, 99, 235, 0.75)'; // Royal Blue
        ctx.beginPath();
        ctx.arc(swx, swy, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        
        // Draw FD Point (Red circle)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)'; // Red
        ctx.beginPath();
        ctx.arc(sfx, sfy, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#b91c1c';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        
        // Add text labels for index
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`#${index}`, swx + 10, swy + 4);
        ctx.fillText(`#${index}`, sfx + 10, sfy + 4);
    });
}

function runTest() {
    console.log(`${MYNAME}.runTest()`);
    
    // Create the symmetry group and configure K:6, L:2, M:3 using setParamsMap
    let groupMaker = new Group_KLM();
    groupMaker.setParamsMap(groupParams);
    let group = groupMaker.getGroup();
    
    console.log('Group fundamental domain length:', group.getFundDomain().length);
    
    // Execute CrownCalculator
    console.time('Crown Calculation');
    const uniqueTransforms = CrownCalculator.calculate(group, patternTransform, { gridRadius: GRID_RADIUS });
    console.timeEnd('Crown Calculation');
    
    console.log(`Found ${uniqueTransforms.length} unique transforms:`);


    
    // Render on canvas
    const canvas = document.getElementById('canvas');
    if (canvas) {
        drawTestResults(canvas, group, patternTransform, uniqueTransforms);
    }
    
    // Update results container
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        let html = `<h2>Test Results</h2>`;
        html += `<p><strong>Group:</strong> KLM (K: ${groupParams.K}, L: ${groupParams.L}, M: ${groupParams.M})</p>`;
        html += `<p><strong>Group FD length:</strong> ${group.getFundDomain().length}</p>`;
        
        html += `<h3>Fundamental Domain Splanes:</h3>`;
        group.getFundDomain().forEach((side, index) => {
            const sideStr = side.toStr(3);
            console.log(`FD Splane #${index}: ${sideStr}`);
            html += `<div class="result-item" style="color: #059669; font-weight: bold;">Splane #${index}: ${sideStr}</div>`;
        });
        
        html += `<p><strong>Unique transforms count:</strong> ${uniqueTransforms.length}</p>`;
        html += `<h3>Transforms Detail:</h3>`;

        
        uniqueTransforms.forEach((t, i) => {
            const pStr = t.patternPoint ? `[${t.patternPoint[0].toFixed(3)}, ${t.patternPoint[1].toFixed(3)}]` : 'N/A';
            const wStr = t.worldPoint ? `[${t.worldPoint[0].toFixed(3)}, ${t.worldPoint[1].toFixed(3)}]` : 'N/A';
            const fStr = t.fundDomainPoint ? `[${t.fundDomainPoint[0].toFixed(3)}, ${t.fundDomainPoint[1].toFixed(3)}]` : 'N/A';
            
            const desc = `Transform #${i}: word='${t.getWord() || "identity"}' (${t.getLength()} refs)<br/>` + 
                         `• Pattern: ${pStr}<br/>` + 
                         `• World:   ${wStr}<br/>` + 
                         `• FD:      ${fStr}`;
            
            console.log(`Transform #${i}: word='${t.getWord() || "identity"}' (${t.getLength()} refs) | pattern: ${pStr} | world: ${wStr} | fundDomain: ${fStr}`);
            html += `<div class="result-item">${desc}</div>`;
        });
        
        resultsDiv.innerHTML = html;
    }
}

runTest();
