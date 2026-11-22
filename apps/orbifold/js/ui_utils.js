//
//  creates full-viewport layered canvas for Orbifold GL rendering and 2D domain overlay
//
export function createLayeredCanvas(options = {}) {
    const stage = document.createElement('div');
    stage.className = 'orbifold-stage';

    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'canvasContainer';

    const glCanvas = document.createElement('canvas');
    glCanvas.className = 'layeredCanvas';
    const overlay = document.createElement('canvas');
    overlay.className = 'layeredCanvas';

    canvasContainer.appendChild(glCanvas);
    canvasContainer.appendChild(overlay);
    stage.appendChild(canvasContainer);
    document.body.appendChild(stage);

    const onResize = typeof options.onresize === 'function' ? options.onresize : (() => {});
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => onResize()).observe(stage);
    }
    window.addEventListener('resize', () => onResize());

    return {
        stage,
        container: canvasContainer,
        glCanvas,
        overlay,
    };
}
