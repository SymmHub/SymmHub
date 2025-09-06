export function drawPoints(gl){
    
    // Array of points (clip space: -1 to 1)
    const points = new Float32Array([
       -0.5, -0.5,
        0.5, -0.5,
       -0.5,  0.5,
        0.5,  0.5,
        0.0,  0.0
    ]);

    // Create buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);

    // Bind attribute
    const posAttrib = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posAttrib);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

    // Clear canvas and draw
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, points.length / 2);

}