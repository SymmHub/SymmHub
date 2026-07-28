import {
    getParam,
    isDefined,
} from './modules.js';

const defaultWorldBox = {
    xmin: -1,
    xmax: 1,
    ymin: -1,
    ymax: 1
};
const defaultScreenBox = {
    xmin: 0,
    xmax: 100,
    ymin: 100,
    ymax: 0
};

export function BoxTransform(param) {
    param = getParam(param, {});
    let wBox = getParam(param.wBox, defaultWorldBox);
    let sBox = getParam(param.sBox, defaultScreenBox);
    let zoom = getParam(param.zoom, 1.0);
    let centerX = getParam(param.centerX, 0);
    let centerY = getParam(param.centerY, 0);

    let sSizeX = (sBox.xmax - sBox.xmin);
    let sSizeY = (sBox.ymax - sBox.ymin);
    let wSizeX = (wBox.xmax - wBox.xmin);
    let wSizeY = (wBox.ymax - wBox.ymin);

    let wCenterX = (wBox.xmin + wBox.xmax) / 2;
    let wCenterY = (wBox.ymin + wBox.ymax) / 2;

    let sCenterX = (sBox.xmin + sBox.xmax) / 2;
    let sCenterY = (sBox.ymin + sBox.ymax) / 2;

    let pixelSizeX = Math.abs(wSizeX / sSizeX) / zoom;
    let pixelSizeY = Math.abs(wSizeY / sSizeY) / zoom;

    let Ax = zoom * (sSizeX / wSizeX);
    let Ay = zoom * (sSizeY / wSizeY);

    let Bx = sCenterX + centerX * sSizeX - Ax * wCenterX;
    let By = sCenterY + centerY * sSizeY - Ay * wCenterY;

    function getPixelSizeX() {
        return pixelSizeX;
    }

    function getPixelSizeY() {
        return pixelSizeY;
    }

    function screen2worldX(sx) {
        return (sx - Bx) / Ax;
    }

    function screen2worldY(sy) {
        return (sy - By) / Ay;
    }

    function world2screenX(wx) {
        return Ax * wx + Bx;
    }

    function world2screenY(wy) {
        return Ay * wy + By;
    }

    function screen2world(s) {
        return [screen2worldX(s[0]), screen2worldY(s[1])];
    }

    function world2screen(w) {
        return [world2screenX(w[0]), world2screenY(w[1])];
    }

    function transform(pin, pout) {
        pout[0] = world2screenX(pin[0]);
        pout[1] = world2screenY(pin[1]);
        return pout;
    }

    function invTransform(pin, pout) {
        pout[0] = screen2worldX(pin[0]);
        pout[1] = screen2worldY(pin[1]);
        return pout;
    }

    function appendZoom(factor, sx, sy) {
        let wx = screen2worldX(sx);
        let wy = screen2worldY(sy);
        let ax = Ax * factor;
        let ay = Ay * factor;

        let dx = ax * wx + Bx - sx;
        let dy = ay * wy + By - sy;
        Bx -= dx;
        By -= dy;
        Ax *= factor;
        Ay *= factor;
        zoom *= factor;
        centerX = (Ax * wCenterX + Bx - sCenterX) / sSizeX;
        centerY = (Ay * wCenterY + By - sCenterY) / sSizeY;

        return {
            zoom: zoom,
            centerX: centerX,
            centerY: centerY,
        };
    }

    function translate(tx, ty) {
        Bx += tx;
        By += ty;
        centerX = (Ax * wCenterX + Bx - sCenterX) / sSizeX;
        centerY = (Ay * wCenterY + By - sCenterY) / sSizeY;

        return {
            zoom: zoom,
            centerX: centerX,
            centerY: centerY,
        };
    }

    return {
        getPixelSizeX: getPixelSizeX,
        getPixelSizeY: getPixelSizeY,
        transform: transform,
        invTransform: invTransform,
        world2screen: world2screen,
        screen2world: screen2world,
        appendZoom: appendZoom,
        translate: translate,
    };
}
