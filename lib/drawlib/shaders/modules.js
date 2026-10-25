import {drawingSplat} from './drawingSplat.glsl.mjs';
import {drawingCrown} from './drawingCrown.glsl.mjs';

const MYNAME = import.meta.url;

export const DrawingShaders = {
    getName:      () => MYNAME,
    drawingSplat: drawingSplat,
    drawingCrown: drawingCrown,
};
