/*
  tests of the SVG import (lib/drawlib/SvgImport.js), in a browser: it needs a DOM

    tests/drawlib/svg_import.html     the result in the page and in window.__svgImport

  1. style sheets: the cascade, !important, inheritance, what is not shown
  2. <use> and <symbol>
  3. gradients, patterns, currentColor
  4. what the import leaves out is counted
  5. compound paths
  6. text traced into outlines, each case against what the browser draws, pixel by pixel
  7. all the SVG files of apps/sympix/res, most of them text alone, the same way
*/

import { parseSvg, outlineText, itemsOfSvg } from '../../lib/drawlib/SvgImport.js';
import { nodeRings, traceNodes } from '../../lib/drawlib/Paths.js';

const LETTERS = {
    arrow: ['arrow_2', 'arrow_3'],
    cyrillic: ['cyr_b', 'cyr_eh', 'cyr_el', 'cyr_hard_sign', 'cyr_shcha', 'cyr_u', 'cyr_yo', 'cyr_yot', 'cyr_yu', 'cyr_ze', 'cyr_zhe'],
    latin: ['L', 'S', 'Z', 'fr_F', 'fr_Q', 'fr_R', 'fr_S', 'fr_Z', 'fr_question', 'question', 'r'],
    greek: ['gr_alpha', 'gr_beta', 'gr_chi', 'gr_delta', 'gr_epsilon', 'gr_gamma', 'gr_ksi', 'gr_lambda', 'gr_mu', 'gr_omega', 'gr_phi', 'gr_pi', 'gr_rho', 'gr_tau', 'gr_zeta'],
    misc: ['comma-1', 'comma-2', 'comma-3', 'comma-4', 'comma-5', 'comma', 'gr_epsilon', 'ring-1'],
};

const failures = [];
let checks = 0;
function check(ok, what){
    checks++;
    if (!ok) failures.push(what);
}

const BOX = { cx: 0, cy: 0, half: 1 };
const svg = (body, attrs = 'viewBox="0 0 100 100"') =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${attrs}>${body}</svg>`;
const read = (body, attrs) => itemsOfSvg(parseSvg(svg(body, attrs)), BOX, 0);
const items = (body, attrs) => read(body, attrs).items;
const R = 'width="10" height="10"';

const hex = (item) => {
    const c = item.style.fill && item.style.fill.rgba;
    return c ? c.slice(0, 3).map(v => (v > 0.5 ? 'f' : '0')).join('') : 'none';
};
const fills = (list) => list.map(hex).join(' ');
const alpha = (item) => item.style.fill.rgba[3];
// the box of an item in the drawing's 100 by 100 coordinates
const extent = (item) => {
    const xs = item.points.filter((v, i) => i % 2 === 0).map(v => 50 + 50*v), ys = item.points.filter((v, i) => i % 2).map(v => 50 - 50*v);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(v => Math.round(v*1e6)/1e6).join(' ');
};

function styleSheets(){
    check(fills(items(`<style>rect{fill:#00f} .a{fill:#0f0} #b{fill:#f00}</style>
        <rect ${R}/><rect class="a" ${R}/><rect class="a" id="b" ${R}/><rect class="a" fill="#000" ${R}/><rect class="a" style="fill:#fff" ${R}/>`))
        === '00f 0f0 f00 0f0 fff', 'the cascade: element, class, id; a rule over an attribute, a style attribute over a rule');
    check(fills(items(`<style>.a{fill:#0f0 !important} .b{fill:#0f0}</style>
        <rect class="a" style="fill:#f00" ${R}/><rect class="b" style="fill:#f00 !important" ${R}/><rect class="a" style="fill:#f00 !important" ${R}/>`))
        === '0f0 f00 f00', '!important');
    check(fills(items(`<style>.a{fill:#f00} .a{fill:#0f0} rect.a{fill:#00f} .a{fill:#fff}</style><rect class="a" ${R}/>`)) === '00f', 'the heavier rule, whatever its place');
    check(fills(items(`<style>.a{fill:#f00} .b{fill:#0f0}</style><rect class="b a" ${R}/>`)) === '0f0', 'the later of two equal');
    check(fills(items(`<style>.a, .b { fill: #0f0 } g rect { fill: #00f }</style><rect class="a" ${R}/><rect class="b" ${R}/><g><rect ${R}/></g>`)) === '0f0 0f0 00f', 'commas, descendants');
    const group = items(`<style>.g{fill:#0f0;stroke:#f00;stroke-width:2}</style><g class="g"><rect ${R}/><rect fill="#00f" ${R}/></g>`);
    check(group.length === 1 && group[0].type === 'group' && fills(group[0].children) === '0f0 00f', 'a class on a group is inherited');
    check(group[0].children[0].style.stroke && group[0].children[0].style.strokeWidth > 0, 'and its stroke');
    check(fills(items(`<g fill="#f00"><g fill="#0f0"><rect fill="inherit" ${R}/></g></g>`)) === '0f0', 'inherit');
    check(fills(items(`<style>rect{fill:inherit}</style><g fill="#0f0"><rect ${R}/></g>`)) === '0f0', 'inherit in a rule');
    check(alpha(items(`<style>.h{opacity:0.5}</style><rect class="h" fill-opacity="0.5" ${R}/>`)[0]) === 0.5 || items(`<style>.h{opacity:0.5}</style><rect class="h" ${R}/>`)[0].style.opacity === 0.5, 'opacity from a rule');
    check(fills(items(`<style>@media print { rect { fill: #f00 } } rect { fill: #0f0 }</style><rect ${R}/>`)) === '0f0', '@media is not read');
    check(fills(items(`<style><![CDATA[ .a > .b { fill: #0f0 } ]]></style><g class="a"><rect class="b" ${R}/></g>`)) === '0f0', 'in CDATA');

    check(items(`<style>.n{display:none}</style><rect class="n" ${R}/><g class="n"><rect ${R}/></g>`).length === 0, 'display none by a rule');
    check(items(`<rect display="none" ${R}/><rect style="display:none" ${R}/>`).length === 0, 'by an attribute, by a style attribute');
    check(items(`<g visibility="hidden"><rect ${R}/><rect visibility="visible" ${R}/></g>`).length === 1, 'visibility hides shapes, not what turns it on again');
    check(items(`<g style="visibility:hidden"><rect ${R}/></g>`).length === 0, 'a hidden group has no children');
}

function useAndSymbol(){
    let list = items(`<defs><rect id="r" ${R} fill="#f00"/></defs><use href="#r" x="10" y="20"/>`);
    check(list.length === 1 && extent(list[0]) === '10 20 20 30', 'use: moved by its x and y');
    list = items(`<defs><rect id="r" ${R}/></defs><use xlink:href="#r" transform="translate(40 0)" fill="#0f0"/>`);
    check(list.length === 1 && extent(list[0]) === '40 0 50 10' && hex(list[0]) === '0f0', 'xlink:href, a transform, the use\'s style inherited');
    list = items(`<g id="g" fill="#00f"><rect ${R}/><circle r="3"/></g><use href="#g" y="50"/>`);
    check(list.length === 2 && list[1].type === 'group' && fills(list[1].children) === '00f 00f', 'a group used');
    list = items(`<rect id="r" ${R} fill="#f00"/><use href="#r" x="1"/><use href="#r" x="2"/><use href="#missing"/><use href="other.svg#r"/>`);
    check(list.length === 3, 'two uses, two that lead nowhere');
    check(read(`<use href="#missing"/><use href="other.svg#r"/>`).skipped['broken use'] === 2, 'counted');
    list = items(`<defs><rect id="r" ${R} fill="#f00" opacity="0.5"/></defs><g opacity="0.5"><use href="#r" opacity="0.5"/></g>`);
    check(list.length === 1 && Math.abs(list[0].style.opacity - 0.125) < 1e-9, 'opacity of the group, the use and the shape');

    list = items(`<symbol id="s" viewBox="0 0 10 10"><rect ${R} fill="#f00"/></symbol>`);
    check(list.length === 0, 'a symbol alone shows nothing');
    list = items(`<symbol id="s" viewBox="0 0 10 10"><rect ${R} fill="#f00"/></symbol><use href="#s" x="20" y="20" width="50" height="50"/>`);
    check(list.length === 1 && extent(list[0]) === '20 20 70 70', 'a symbol through its viewBox');
    const placed = (attrs, use) => extent(items(`<symbol id="s" viewBox="0 0 10 10" ${attrs}><rect ${R}/></symbol><use href="#s" ${use}/>`)[0]);
    check(placed('', 'width="40" height="20"') === '10 0 30 20', 'centred, whole');
    check(placed('preserveAspectRatio="xMinYMin meet"', 'width="40" height="20"') === '0 0 20 20', 'at its corner');
    check(placed('preserveAspectRatio="xMaxYMax meet"', 'width="40" height="20"') === '20 0 40 20', 'at the other');
    check(placed('preserveAspectRatio="none"', 'width="40" height="20"') === '0 0 40 20', 'stretched');
    check(placed('preserveAspectRatio="xMidYMid slice"', 'width="40" height="20"') === '0 -10 40 30', 'covering');
    check(placed('width="30" height="30"', '') === '0 0 30 30', 'its own size');
    check(placed('', 'width="50%" height="50%"') === '0 0 50 50', 'percentages of the document');
    list = items(`<symbol id="s"><rect ${R} fill="#f00"/></symbol><use href="#s" x="5" y="5"/>`);
    check(list.length === 1 && extent(list[0]) === '5 5 15 15', 'a symbol without a viewBox');
    list = items(`<svg x="10" y="10" width="20" height="20" viewBox="0 0 10 10"><rect ${R}/></svg>`);
    check(list.length === 1 && extent(list[0]) === '10 10 30 30', 'a nested svg');

    const started = performance.now();
    const held = read(`<g id="a"><rect ${R}/><use href="#a"/></g>`);
    check(held.items.length === 1 && held.skipped['use within itself'] === 1, 'a group using itself ends');
    const twice = read(`<g id="a"><rect ${R}/><use href="#a"/><use href="#a"/></g><g id="b"><use href="#c"/></g><g id="c"><use href="#b"/></g>`);
    check(twice.skipped['use within itself'] >= 3, 'twice, and through another');
    let deep = `<rect id="u0" ${R}/>`;
    for (let i = 1; i < 25; i++) deep += `<g id="u${i}"><use href="#u${i - 1}"/><use href="#u${i - 1}" x="1"/></g>`;
    const wide = read(`<defs>${deep}</defs><use href="#u24"/>`);
    check(wide.skipped['use within itself'] > 0, 'uses that double at every level stop');
    check(performance.now() - started < 8000, 'in time');
}

function paints(){
    const stops = `<linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient>`;
    let r = read(`<defs>${stops}</defs><rect fill="url(#g)" ${R}/>`);
    check(fills(r.items) === 'f00' && r.skipped['gradient fill as one colour'] === 1, 'a gradient: its first colour, counted');
    check(fills(items(`<defs>${stops}<radialGradient id="h" href="#g"/></defs><rect fill="url(#h)" ${R}/>`)) === 'f00', 'stops through href');
    check(fills(items(`<defs>${stops}<linearGradient id="h" xlink:href="#g"/><linearGradient id="i" href="#h"/></defs><rect fill="url(#i)" ${R}/>`)) === 'f00', 'a chain, xlink too');
    check(items(`<defs><linearGradient id="a" href="#b"/><linearGradient id="b" href="#a"/></defs><rect fill="url(#a)" ${R}/>`).length === 0, 'a cycle: no stops, no fill');
    check(items(`<defs><linearGradient id="a"/></defs><rect fill="url(#a)" ${R}/>`).length === 0, 'no stops: no fill');
    let list = items(`<defs><linearGradient id="a"><stop style="stop-color:#0f0;stop-opacity:0.5"/></linearGradient></defs><rect fill="url(#a)" fill-opacity="0.5" ${R}/>`);
    check(hex(list[0]) === '0f0' && alpha(list[0]) === 0.25, 'stop opacity times fill opacity');
    list = items(`<style>.s{stop-color:#00f} rect{fill:url("#a")}</style><defs><linearGradient id="a"><stop class="s"/></linearGradient></defs><rect ${R}/>`);
    check(fills(list) === '00f', 'a stop by a rule; url in quotes from a rule');
    check(fills(items(`<defs><linearGradient id="a"><stop/></linearGradient></defs><rect fill="url(#a)" ${R}/>`)) === '000', 'a stop is black by default');
    list = items(`<defs>${stops}</defs><rect fill="none" stroke="url(#g)" stroke-width="2" ${R}/>`);
    check(list.length === 1 && list[0].style.stroke.rgba[0] > 0.9 && !list[0].style.fill, 'a stroke too');
    check(fills(items(`<rect fill="url(#nothing) #0f0" ${R}/>`)) === '0f0', 'a missing reference: the fallback');
    check(items(`<rect fill="url(#nothing)" ${R}/>`).length === 0, 'without one, nothing');
    r = read(`<defs><pattern id="p" width="1" height="1"/></defs><rect fill="url(#p)" ${R}/>`);
    check(r.items.length === 1 && r.skipped['pattern fill as grey'] === 1, 'a pattern: grey, counted');

    check(fills(items(`<g color="#0f0"><rect fill="currentColor" ${R}/></g>`)) === '0f0', 'currentColor');
    check(fills(items(`<rect style="color:#00f;fill:currentcolor" ${R}/>`)) === '00f', 'from its own style');
    check(fills(items(`<rect fill="currentColor" ${R}/>`)) === '000', 'black by default');
    list = items(`<g color="#f00"><rect fill="none" stroke="currentColor" ${R}/></g>`);
    check(list[0].style.stroke.rgba[0] > 0.9, 'a stroke');
    check(fills(items(`<defs><linearGradient id="a"><stop stop-color="currentColor"/></linearGradient></defs><g color="#0f0"><rect fill="url(#a)" ${R}/></g>`)) === '0f0', 'in a stop');
    check(items(`<rect ${R}/>`)[0].style.miterLimit === 4, 'an SVG\'s miter limit by default');
    check(items(`<style>rect{stroke-miterlimit:8}</style><rect ${R}/>`)[0].style.miterLimit === 8, 'its own');
}

function leftOut(){
    let r = read(`<rect clip-path="url(#c)" ${R}/><rect mask="url(#m)" ${R}/><rect filter="url(#f)" ${R}/><rect style="clip-path:none" ${R}/>`);
    check(r.items.length === 4 && r.skipped['clip path'] === 1 && r.skipped.mask === 1 && r.skipped.filter === 1, 'counted, the shapes shown');
    r = read(`<g filter="url(#f)"><rect ${R}/><rect ${R}/></g>`);
    check(r.skipped.filter === 1, 'once for a group');
    r = read(`<text>a</text><image href="a.png"/><foreignObject/><metadata/><title>t</title>`);
    check(r.items.length === 0 && r.skipped.text === 1 && r.skipped.image === 1 && r.skipped.foreignObject === 1 && !r.skipped.metadata && !r.skipped.title, 'what cannot come in');
    check(!read(`<text x="1" y="1"><tspan x="1" y="1"> </tspan></text>`).skipped.text, 'an empty text is no loss');
}

function compound(){
    let list = items(`<path fill="#00f" d="M0 0H90V90H0Z M30 30V60H60V30Z"/>`);
    check(list.length === 1 && list[0].type === 'path' && list[0].closed, 'two closed subpaths: one path');
    check(nodeRings(list[0].nodes).length === 2 && !list[0].shape, 'two rings');
    list = items(`<path fill-rule="evenodd" d="M0 0H90V90H0Z M30 30H60V60H30Z M40 40H50V50H40Z"/>`);
    check(nodeRings(list[0].nodes).length === 3 && list[0].style.fillRule === 'evenodd', 'three, even-odd');
    list = items(`<path d="M0 0H90V90H0Z"/>`);
    check(list.length === 1 && list[0].type === 'polyline', 'one closed subpath as before');
    list = items(`<path d="M0 0C10 0 10 10 0 10Z"/>`);
    check(list.length === 1 && list[0].type === 'path' && nodeRings(list[0].nodes).length === 1, 'curved as before');
    list = items(`<path fill="#00f" stroke="#f00" d="M0 0H90V90H0Z M30 30V60H60V30Z M0 95H90"/>`);
    check(list.length === 2 && nodeRings(list[0].nodes).length === 2 && !list[1].closed && !list[1].style.fill && list[1].style.stroke, 'an open subpath stays apart, unfilled');
    list = items(`<path fill="#00f" d="M0 0H90 M0 10H90"/>`);
    check(list.length === 0, 'only open and no stroke: nothing');
    list = items(`<g transform="scale(0.5)"><path d="M0 0H100V100H0Z M20 20H80V80H20Z"/></g>`);
    check(extent(list[0]) === '0 0 50 50', 'through a transform');
}

// 6, 7 ────────────────────────────────────────────────────────────────────────

// A browser places and hints small text by the pixel, which outlines traced large do
// not have: 5% of the pixels of a word differ at 100 pixels to the em, under 0.5% at 400.
// So a case is compared with its em above 256 pixels, where it is drawn unhinted. A
// real letter fills the square: at 400 its edges show no more than the tolerance.
const SIDE_CASE = 1600, SIDE_FILE = 400;

/** the text as the browser draws it, on a white square */
async function drawnOriginal(text, side){
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    URL.revokeObjectURL(url);
    const canvas = Object.assign(document.createElement('canvas'), { width: side, height: side });
    const x = canvas.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff';
    x.fillRect(0, 0, side, side);
    return { canvas, x, img };
}

const css = (c) => `rgba(${c[0]*255}, ${c[1]*255}, ${c[2]*255}, ${c[3]})`;

function paintItem(x, item, opacity = 1){
    const own = opacity*(item.style.opacity ?? 1);
    if (item.children) item.children.forEach(c => paintItem(x, c, own));
    if (item.type === 'group') return;
    const path = new Path2D();
    if (item.nodes) traceNodes(item.nodes, item.closed, path);
    else {
        for (let i = 0; i + 1 < item.points.length; i += 2) path.lineTo(item.points[i], item.points[i + 1]);
        if (item.closed) path.closePath();
    }
    x.globalAlpha = own;
    if (item.style.fill) { x.fillStyle = css(item.style.fill.rgba); x.fill(path, item.style.fillRule || 'nonzero'); }
    if (item.style.stroke && item.style.strokeWidth > 0) {
        x.strokeStyle = css(item.style.stroke.rgba);
        x.lineWidth = item.style.strokeWidth;
        x.lineJoin = item.style.lineJoin || 'miter';
        x.lineCap = item.style.lineCap || 'butt';
        x.miterLimit = item.style.miterLimit ?? 10;
        x.stroke(path);
    }
    x.globalAlpha = 1;
}

/** the items beside what the browser draws of the text: how many pixels are drawn, and differ */
async function compared(text, parsed, side){
    const { rx, ry } = parsed.viewport;
    const a = await drawnOriginal(text, side);
    // the document's box on the canvas, as an <img> draws it, and the world on the same place
    const wide = rx >= ry;
    const w = side*(wide ? 1 : rx/ry), h = side*(wide ? ry/rx : 1);
    a.x.drawImage(a.img, (side - w)/2, (side - h)/2, w, h);
    const b = Object.assign(document.createElement('canvas'), { width: side, height: side }), y = b.getContext('2d', { willReadFrequently: true });
    y.fillStyle = '#fff';
    y.fillRect(0, 0, side, side);
    const k = side/(2*Math.max(rx, ry));
    y.setTransform(k, 0, 0, -k, side/2, side/2);
    y.beginPath();
    y.rect(-rx, -ry, 2*rx, 2*ry);
    y.clip();
    parsed.items.forEach(item => paintItem(y, item));
    const pa = a.x.getImageData(0, 0, side, side).data, pb = y.getImageData(0, 0, side, side).data;
    let differ = 0, inked = 0;
    for (let i = 0; i < pa.length; i += 4) {
        if (Math.min(pa[i], pa[i + 1], pa[i + 2]) < 200 || Math.min(pb[i], pb[i + 1], pb[i + 2]) < 200) inked++;
        if (Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2])) > 64) differ++;
    }
    document.body.append(a.canvas, b);
    a.canvas.style.width = b.style.width = '100px';
    return { differ, inked };
}

async function traced(text){
    const source = parseSvg(text);
    await outlineText(source);
    return { ...itemsOfSvg(source, BOX, 0), source };
}

const countNodes = (list) => list.reduce((sum, it) => sum + (it.nodes ? it.nodes.length : 0) + (it.children ? countNodes(it.children) : 0), 0);

async function texts(results){
    const WIDE = 'viewBox="0 0 200 100"', F = 'font-family="Times New Roman" font-size="50"';
    const cases = {
        plain: [`<text x="10" y="60" ${F} fill="#00f">Agw8</text>`, WIDE],
        'by a rule': [`<style>.t{font-family:Arial;font-size:40px;font-weight:bold;fill:#0a0}</style><text class="t" x="10" y="60">Bold</text>`, WIDE],
        'by a group': [`<g font-family="Arial" font-size="40" font-style="italic" fill="#a00"><text x="10" y="60">Slant</text></g>`, WIDE],
        'text-anchor, percent': [`<text x="50%" y="50%" text-anchor="middle" ${F}>Mid</text>`, WIDE],
        turned: [`<text x="60" y="50" ${F} transform="rotate(25 60 50)">Turn</text>`, WIDE],
        'in a transformed group': [`<g transform="translate(20 10) scale(1.5 0.8) skewX(10)"><text x="10" y="60" ${F}>Sk</text></g>`, WIDE],
        'two paints': [`<text x="10" y="60" ${F} fill="#00f">Ab<tspan fill="#f00">Cd</tspan>Ef</text>`, WIDE],
        'a hidden part keeps its place': [`<text x="10" y="60" ${F}>Ab<tspan visibility="hidden">Cd</tspan>Ef</text>`, WIDE],
        'a part not displayed': [`<text x="10" y="60" ${F}>Ab<tspan display="none">Cd</tspan>Ef</text>`, WIDE],
        'lines of tspans': [`<text ${F}><tspan x="10" y="45">One</tspan><tspan x="10" y="90" font-size="36">Two</tspan></text>`, WIDE],
        'per letter': [`<text x="10 40 80" y="60 50 70" dy="0 5" rotate="0 20 -20" ${F}>Abc</text>`, WIDE],
        spacing: [`<text x="5" y="60" letter-spacing="8" word-spacing="20" font-family="Arial" font-size="36">a b c</text>`, WIDE],
        stroked: [`<text x="10" y="70" ${F} fill="none" stroke="#000" stroke-width="1.5">Line</text>`, WIDE],
        'fill and stroke': [`<text x="10" y="70" ${F} fill="#fc0" stroke="#000" stroke-width="1">Both</text>`, WIDE],
        'with shapes': [`<rect width="200" height="100" fill="#def"/><text x="10" y="60" ${F}>Over</text><rect x="60" y="30" width="30" height="40" fill="#f80"/>`, WIDE],
        opacity: [`<text x="10" y="60" ${F} opacity="0.5" fill="#00f">Half</text>`, WIDE],
        'a use of it': [`<defs><text id="t" font-family="Arial" font-size="36" y="36">Used</text></defs><use href="#t" x="10" fill="#00f"/><use href="#t" x="10" y="50" fill="#f00"/>`, WIDE],
        'a text path': [`<defs><path id="p" d="M10 80 Q100 -20 190 80"/></defs><text font-family="Arial" font-size="34"><textPath href="#p">a curve</textPath></text>`, WIDE],
        swash: [`<text x="50" y="65" font-family="French Script MT" font-size="60">Qy</text>`, WIDE],
        'very small units': [`<text x="0.1" y="0.6" font-family="Arial" font-size="0.4">Tiny</text>`, 'viewBox="0 0 2 1"'],
        'units smaller still': [`<text x="0.001" y="0.006" font-family="Arial" font-size="0.004">Tiny</text>`, 'viewBox="0 0 0.02 0.01"'],
        'very large units': [`<text x="1000" y="6000" font-family="Arial" font-size="4000">Big</text>`, 'viewBox="0 0 20000 10000"'],
    };
    for (const [name, [body, attrs]] of Object.entries(cases)) {
        const text = svg(body, attrs), parsed = await traced(text), { differ, inked } = await compared(text, parsed, SIDE_CASE);
        results.push({ set: 'case', name, items: parsed.items.length, nodes: countNodes(parsed.items), inked, differ, skipped: JSON.stringify(parsed.skipped) });
        check(inked > 100, `${name}: something is drawn`);
        check(differ <= 0.02*inked, `${name}: ${differ} of ${inked} pixels differ`);
        check(!parsed.skipped.text, `${name}: not left out`);
    }

    // ink beyond the box measured, as of a font the drawing has and the measuring has not
    const measured = SVGGraphicsElement.prototype.getBBox;
    SVGGraphicsElement.prototype.getBBox = function(){
        const { x, y, width, height } = measured.call(this);
        return { x: x + width/4, y, width: width/2, height };
    };
    try {
        const text = svg(`<text x="10" y="60" ${F}>Agw8</text>`, WIDE), { differ, inked } = await compared(text, await traced(text), SIDE_CASE);
        check(differ <= 0.02*inked, `beyond the box: ${differ} of ${inked} pixels differ`);
    } finally {
        SVGGraphicsElement.prototype.getBBox = measured;
    }

    let r = await traced(svg(`<text x="10" y="60" ${F}>O</text>`, WIDE));
    check(r.items.length === 1 && r.items[0].type === 'path' && r.items[0].closed && nodeRings(r.items[0].nodes).length === 2, 'the letter O is one path of two rings');
    check(r.items[0].style.fillRule === 'evenodd', 'by the even-odd rule');
    r = await traced(svg(`<text x="10" y="60" ${F} fill="#00f">Ab<tspan fill="#f00">Cd</tspan>Ef</text>`, WIDE));
    check(fills(r.items) === '00f f00', 'a path per paint, in order');
    r = await traced(svg(`<text x="10" y="60" ${F} fill="#000"><tspan fill="#0f0">A</tspan><tspan fill="#0f0">B</tspan></text>`, WIDE));
    check(fills(r.items) === '0f0', 'parts of one paint are one path');
    r = await traced(svg(`<text x="10" y="60"> \n </text><text x="10" y="60"><tspan/></text>`, WIDE));
    check(r.items.length === 0 && !r.skipped.text, 'an empty text: nothing, and no loss');
    r = await traced(svg(`<text x="10" y="60" ${F} display="none">Gone</text><text x="10" y="60" ${F} visibility="hidden">Gone</text><defs><text id="n" ${F}>Gone</text></defs>`, WIDE));
    check(r.items.length === 0 && !r.skipped.text, 'what does not show is not traced');
    check(r.source.outlines.get(r.source.doc.querySelector('defs text')) === undefined, 'nor is a text in defs');
    r = await traced(svg(`<text x="10" y="60" ${F} clip-path="url(#c)">Cut</text>`, WIDE));
    check(r.items.length === 1 && r.skipped['clip path'] === 1, 'what a text asks for is left out as for a shape');
    r = await traced(svg(`<text x="10" y="60" ${F} fill="url(#missing) #0f0">Fall</text>`, WIDE));
    check(fills(r.items) === '0f0', 'paints as for a shape');
    const again = parseSvg(svg(`<text x="10" y="60" ${F}>A</text>`, WIDE));
    await outlineText(again);
    const near = itemsOfSvg(again, BOX, 0).items[0], far = itemsOfSvg(again, { cx: 5, cy: 0, half: 2 }, 0).items[0];
    check(Math.abs(far.points[0] - (5 + 2*near.points[0])) < 1e-9, 'traced once, placed anywhere');
    let many = '';
    for (let i = 0; i < 203; i++) many += `<text x="0" y="50" font-family="Arial" font-size="4">.</text>`;
    r = await traced(svg(many, WIDE));
    check(r.items.length === 200 && r.skipped.text === 3, `too many texts stay left out: ${r.items.length}, ${r.skipped.text}`);
}

async function letters(results){
    for (const [set, names] of Object.entries(LETTERS)) {
        for (const name of names) {
            const started = performance.now();
            const text = await (await fetch(`../../apps/sympix/res/${set}/${name}.svg`)).text();
            const parsed = await traced(text);
            const ms = Math.round(performance.now() - started);
            const { differ, inked } = await compared(text, parsed, SIDE_FILE);
            const rings = parsed.items.filter(it => it.nodes).map(it => nodeRings(it.nodes).length);
            results.push({ set, name, items: parsed.items.length, nodes: countNodes(parsed.items), rings: rings.join('+') || '-', inked, differ, ms, skipped: JSON.stringify(parsed.skipped) });
            check(parsed.items.length > 0, `${set}/${name}: it has shapes`);
            check(inked > 100, `${set}/${name}: something is drawn`);
            // a filter is left out, and its effect is not there to compare
            check(parsed.skipped.filter || differ <= 0.025*inked, `${set}/${name}: ${differ} of ${inked} pixels differ`);
        }
    }
}

(async () => {
    const out = document.getElementById('out');
    const result = { done: false };
    window.__svgImport = result;
    try {
        styleSheets();
        useAndSymbol();
        paints();
        leftOut();
        compound();
        result.letters = [];
        result.cases = [];
        await texts(result.cases);
        await letters(result.letters);
    } catch (e) {
        failures.push(`threw: ${e.stack}`);
    }
    Object.assign(result, { checks, failures, done: true });
    out.innerHTML = `<p class="${failures.length ? 'failed' : 'passed'}">${checks} checks, ${failures.length} failed</p>`
                  + failures.map(f => `<div class="failed">${f}</div>`).join('');
})();
