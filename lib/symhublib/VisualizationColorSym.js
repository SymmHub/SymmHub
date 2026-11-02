import {    
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamChoice,
    ParamString,
    ParamObj,
    setViewport,
    enableBlending,
    VisualizationOptions,
    ColorSymPrograms,

    InterpolationNames,
    getInterpolationId,
    Subgroups,
    CrownCalculator,
    DataPacking,
    wordToPerm,
    invertPerm,
    packPerm,
    MAX_COLORS_COUNT,
    transToPackedPerms,
    strToPermutations,
    ColorTiles,
} from './modules.js';




const DEBUG = false;
const MYNAME = 'VisualizationColorSym';
const DataSourceNames = VisualizationOptions.dataSourceNames;
const MAX_CROWN_COUNT = 20;
// the sprite path (a pattern with getSprites): the bounds of the shader
// colorImageSprites, and the tiles looked at per sprite
const MAX_SPRITES = 32;
const MAX_TILES = 64;
const MAX_SPRITE_TILES = 64*4;
const SPRITE_TILES = 16;
const SPRITE_GRID_RADIUS = 7;

const COLORING_TYPE_NAMES = ['none', 'mult', 'invMut', 'hueShift'];
const COLORING_TYPE = { 'none': 0, 'mult': 1, 'invMut': 2, 'hueShift': 3 };
const TORADIANS = Math.PI / 180;


//
//  Color Symmetry visualization layer.
//  Renders a PatternImageArray as a composited multi-image using sampler2DArray.
//
//  par.config - optional initial values 
//
function VisualizationColorSym(par={}){
    
    let mConfig = {
        enabled: true,
        opacity: 1,
        interpolation: InterpolationNames[0], 
        dataSource: DataSourceNames[0],
        useMipmap: false,
        imageId: '',
        permutations: '',
        permIndex: 0,
        useCrown: false,
        useOrbit: false,
        mask: '',
        coloringType: 'none',
        patternTiltDirection: 0,
        useTilt: false,
    };

    if(par.config){
        Object.assign(mConfig, par.config);
    }

    // ── id / name management (required by ParamObjArray) ─────────────────────
    const mIdRef = { id: par.id ?? '' };
    let mOnIdChange = null;

    let mParams = null;
    let mGLCtx = null;
    let mOnChange = null;
    let mPrograms = null;
    // Cache for the TEXTURE_2D_ARRAY used in multi-image compositing.
    let mArrayTexCache = { tex: null, count: 0, size: 0 };
    let mCrownGroupData = null;
    // the crown tiles of the last group and box: {group, key, revTrans}
    let mCrownCache = null;
    // sprites: the tiles' maps packed for the shader, and per sprite id the
    // tiles its box meets, {key, group, tiles}, kept while the box stays
    let mSpriteTileData = null;
    const mSpriteCrowns = new Map();
    // did the last render show sprites (then the main buffer is not sampled)
    let mLastSprites = false;

    // Cell color palette (cosine palette → uCellColors uniform) used when multiplyColors is on.
    const mColorTiles = ColorTiles({
        getAlpha:     () => 1.0,
        getColorMask: () => '',
        getPermIndex: () => mConfig.permIndex,
    });

    let mGeneratorPerms = strToPermutations(mConfig.permutations);
    let mInvGeneratorPerms = mGeneratorPerms.map(p => invertPerm(p));

    // Parsed permutation data ready to upload as uPermData / uPermSize.
    // mPermData: flat Uint32Array(MAX_GEN_COUNT * 4) with packed uvec4 values.
    const MAX_GEN_COUNT = 6;
    let mPermData = new Uint32Array(MAX_GEN_COUNT * 4); // zeroed = all identity-like
    let mPermSize = 0;

    // Per-texture-layer alpha mask (0.0 = hidden, 1.0 = visible), padded with 1s.
    const MAX_TEX_COUNT = MAX_COLORS_COUNT;
    let mTexAlpha = new Float32Array(MAX_TEX_COUNT).fill(1.0);

    // presentation of the renderer's group (its generators are the sides of the
    // fundamental domain), handed over by the renderer at init
    let mGetGroupPresentation = null;

    const mSubgroups = Subgroups({
        getParentPermutations: () => mConfig.permutations,
        getPresentation: () => (mGetGroupPresentation ? mGetGroupPresentation() : null),
        onSubgroupSelected: (subgroup) => {
            if (subgroup) {
                const params = getParams();
                if (params && params.permutations) {
                    params.permutations.setValue(subgroup.invcos);
                } else {
                    mConfig.permutations = subgroup.invcos;
                    onPermChanged();
                }
                mColorTiles.getParams().count.setValue(subgroup.index);
                if (params && params.permIndex) {
                    params.permIndex.setMax(subgroup.index - 1);
                }
            }
        },
        onChange: () => onChange(null)
    });


    function onChange(param){
        
      if(DEBUG)console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
        
    }



    //
    //  Parse mConfig.permutations into packed GPU data.
    //
    //  Format: space-separated words, each word encodes one permutation.
    //  Each character maps its position: 'a'->0, 'b'->1, ..., 'z'->25.
    //  Identity of size n is "abcde..." (first n letters in order).
    //
    function onPermChanged() {
        const str = mConfig.permutations;
        mGeneratorPerms = strToPermutations(str);
        mInvGeneratorPerms = mGeneratorPerms.map(p => invertPerm(p));

        mPermData = new Uint32Array(MAX_GEN_COUNT * 4);
        mPermSize = 0;

        if (mGeneratorPerms.length === 0) {
            if (DEBUG) console.log(`${MYNAME}.onPermChanged(): empty — using identity`);
            onChange(null);
            return;
        }

        mPermSize = mGeneratorPerms[0].length;

        // Keep ColorTiles count in sync with the permutation size.
        mColorTiles.getParams().count.setValue(mPermSize);
        const params = getParams();
        if (params && params.permIndex) {
            params.permIndex.setMax(mPermSize - 1);
        }

        for (let k = 0; k < Math.min(mGeneratorPerms.length, MAX_GEN_COUNT); k++) {
            const perm = mGeneratorPerms[k];
            const packed = packPerm(perm);
            // Write the 4 uint32s into the flat buffer at slot k.
            mPermData.set(packed, k * 4);
        }

        if (DEBUG) console.log(`${MYNAME}.onPermChanged(): ${mGeneratorPerms.length} perms, size=${mPermSize}`, mPermData);
        onChange(null);
    }

    //
    //  Parse mConfig.mask into mTexAlpha.
    //  Each character: '0' → 0.0, anything else → 1.0.
    //  Positions beyond the string length are filled with 1.0.
    //
    function onMaskChanged() {
        const str = mConfig.mask || '';
        for (let i = 0; i < MAX_TEX_COUNT; i++) {
            mTexAlpha[i] = (i < str.length && str[i] === '0') ? 0.0 : 1.0;
        }
        if(DEBUG) console.log(`${MYNAME}.onMaskChanged(): "${str}"`, mTexAlpha.slice(0, 8));
        onChange(null);
    }

    function makeParams(cf) {

        let oc = onChange;

        return {
            id: ParamString({ obj: mIdRef, key: 'id', name: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); } }),
            enabled:       ParamBool({obj: cf, key:'enabled', onChange: oc}),
            opacity:       ParamFloat({obj: cf, key: 'opacity', min: 0, max: 1, step: 0.001, onChange: oc}),
            imageId:       ParamString({obj: cf, key: 'imageId', name: 'images', onChange: oc}),
            permutations:  ParamString({obj: cf, key: 'permutations', onChange: onPermChanged}),
            permIndex:     ParamInt({obj: cf, key: 'permIndex', name:'offset', min: 0, max: 23, step: 1, onChange: oc}),
            useOrbit:     ParamBool({obj: cf, key: 'useOrbit', onChange: oc}),
            mask:          ParamString({obj: cf, key: 'mask', onChange: onMaskChanged}),
            subgroups:     ParamObj({name: 'subgroups', obj: mSubgroups}),
            coloringType:  ParamChoice({obj: cf, key: 'coloringType', name: 'coloring', choice: COLORING_TYPE_NAMES, onChange: oc}),
            colorTiles:    ParamObj({name: 'colors', obj: mColorTiles}),
            useCrown:      ParamBool({obj: cf, key: 'useCrown', name: 'crown', onChange: oc}),
            useTilt:       ParamBool({obj: cf, key: 'useTilt', name: 'depth sort', onChange: oc}),
            patternTiltDirection: ParamFloat({obj: cf, key: 'patternTiltDirection', name: 'tilt angle°', min: -180, max: 180, step: 1, onChange: oc}),
            useMipmap:     ParamBool({obj: cf, key: 'useMipmap', name: 'mipmap', onChange: oc}),
            interpolation: ParamChoice({obj: cf, key: 'interpolation', name: 'interp', choice: InterpolationNames, onChange: oc}),
        }

    } // function makeParams()

    
    // Build (or reuse) a TEXTURE_2D_ARRAY containing one layer per DoubleFBO.
    // doubleFBOs: array of DoubleFBO objects (from patternData.getComponentBuffer()).
    // Each frame the current read framebuffer of every FBO is blitted into its layer.
    function updateImageArrayTex(gl, doubleFBOs) {
        const count = doubleFBOs.length;
        const size  = doubleFBOs[0].width;  // PatternImage buffers are always square

        // Recreate only when count or size changes.
        if (!mArrayTexCache.tex || mArrayTexCache.count !== count || mArrayTexCache.size !== size) {
            if (mArrayTexCache.tex) gl.deleteTexture(mArrayTexCache.tex);
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
            gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA32F, size, size, count, 0, gl.RGBA, gl.FLOAT, null);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            mArrayTexCache = { tex, count, size };
        }

        // Copy each image's current render result into the corresponding array layer.
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, mArrayTexCache.tex);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, mConfig.useMipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        for (let i = 0; i < count; i++) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, doubleFBOs[i].read.fbo);
            gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, 0, 0, size, size);
        }
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);

        if (mConfig.useMipmap) {
            gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
        }
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

        return mArrayTexCache.tex;
    }

    /**
     * Calculates the crown transforms, packs them into a GL sampler,
     * and computes the packed permutation data for shader usage.
     * Reverses the transforms list to render inner tiles on top of outer ones.
     * 
     * @param {Group} group - The symmetry group.
     * @param {Object} patternTransform - The current pattern transform.
     * @returns {Object} An object containing { crownData, crownPerms }.
     */
    function prepareCrownData(group, patternTransform) {
        // the nearest MAX_CROWN_COUNT tiles of the box (nearest first), kept
        // while the group and the box stay
        const key = [patternTransform.centerX, patternTransform.centerY, patternTransform.scale, patternTransform.angle].join(' ');
        if (!mCrownCache || mCrownCache.group !== group || mCrownCache.key !== key) {
            mCrownCache = { group, key, revTrans: CrownCalculator.calculate(group, patternTransform, { gridRadius: 15, maxCount: MAX_CROWN_COUNT }) };
        }
        const revTrans = mCrownCache.revTrans;
        const loopCount = Math.min(revTrans.length, MAX_CROWN_COUNT);
        // dirTrans[g] = revTrans[g]^-1: maps FD → adjacent tile g in world space.
        // Used for both geometry and permutations:
        //   Geometry:     the shader applies dirTrans[g] to a FD point to locate the
        //                 adjacent tile's image in world coords (correct even when
        //                 the pattern center is offset from the FD center).
        //   Permutations: wordToPerm(dirTrans[g].word, ...) produces the correct
        //                 crown color permutation consistent with the FD tiling shader.
        // Reversed so that transforms closer to the center are rendered last (on top).
        let dirTrans = revTrans.slice(0, loopCount).reverse().map(t => t.getInverse());

        const crownGroup = {
            s: group.getFundDomain(),
            t: dirTrans
        };
        const gl = mGLCtx.gl;
        DataPacking.packGroupToSampler(gl, mCrownGroupData, crownGroup);
        const crownData = mCrownGroupData;

        const crownPerms = transToPackedPerms(dirTrans, mGeneratorPerms, mInvGeneratorPerms, mConfig.useOrbit);

        if (DEBUG) {
            const crownPermsInfo = dirTrans.map(t => {
                const perm = wordToPerm(t.getWord(), mGeneratorPerms, mInvGeneratorPerms, mConfig.useOrbit);
                return `${t.getWord() || "identity"}: [${perm.join(",")}]`;
            }).join(", ");
            console.log(`Crown Permutations: ${crownPermsInfo}`);
        }

        return { crownData, crownPerms };
    }

    //
    //  the sprite path: every sprite (an item of the drawing in its own buffer)
    //  is seen through the tiles meeting its box, nearest first; the union of
    //  those tiles goes to the shader with their permutations, each sprite
    //  with its box, opacity, slot and the indices of its tiles
    //
    function renderSprites(par, spriteData, ids){
        const gl = mGLCtx.gl;
        const cmCfg = mConfig;
        const group = par.group;
        const all = ids.length ? spriteData.sprites.filter(s => ids.includes(s.layerId)) : spriteData.sprites;
        const sprites = all.slice(0, MAX_SPRITES);

        const tiles = [];
        const tileIndex = new Int32Array(MAX_SPRITE_TILES);
        const boxes = new Float32Array(MAX_SPRITES*4);
        const infos = new Int32Array(MAX_SPRITES*4);
        // a sprite's colour permutation after the tile's: the identity unless set
        const identity = packPerm([]);
        const spritePerms = new Uint32Array(MAX_SPRITES*4);
        let used = 0;
        sprites.forEach((s, i) => {
            const key = [s.box.cx, s.box.cy, s.box.half].join(' ');
            let c = mSpriteCrowns.get(s.id);
            if (!c || c.key !== key || c.group !== group) {
                const rev = CrownCalculator.calculate(group, { centerX: s.box.cx, centerY: s.box.cy, scale: s.box.half, angle: 0 },
                                                      { gridRadius: SPRITE_GRID_RADIUS, maxCount: SPRITE_TILES });
                c = { key, group, tiles: rev.slice(0, SPRITE_TILES).map(t => ({ fromFD: t.getInverse(), key: CrownCalculator.elementKey(t), word: t.getWord() })) };
                mSpriteCrowns.set(s.id, c);
            }
            // without the crown a sprite is seen through the domain alone
            const list = cmCfg.useCrown ? c.tiles : c.tiles.filter(t => t.word === '');
            infos[4*i] = used;
            let count = 0;
            for (const t of list) {
                if (used >= MAX_SPRITE_TILES) break;
                let j = tiles.findIndex(x => x.key === t.key);
                if (j < 0) {
                    if (tiles.length >= MAX_TILES) continue;
                    j = tiles.length;
                    tiles.push(t);
                }
                tileIndex[used++] = j;
                count++;
            }
            infos[4*i + 1] = count;
            // the slot (the layer's offset, moved by the sprite's own) in the low
            // byte, the colour class whose tiles alone show the sprite + 1 above;
            // a sprite carried by a symmetry (s.word: a group made of copies)
            // takes the slot that symmetry's permutation gives, so its copies
            // keep the colours they had
            // (coloured by cosets: the slot moved by the word's permutation; by
            // orbits: the colour index permuted after the tile's)
            let slot = mPermSize > 0 ? (cmCfg.permIndex + (s.slot || 0)) % mPermSize : 0;
            spritePerms.set(identity, 4*i);
            if (s.word && mPermSize > 0) {
                const perm = wordToPerm(s.word, mGeneratorPerms, mInvGeneratorPerms, cmCfg.useOrbit);
                if (cmCfg.useOrbit) spritePerms.set(packPerm(perm), 4*i);
                else if (perm[slot] !== undefined) slot = perm[slot];
            }
            infos[4*i + 2] = slot + (((s.cls ?? -1) + 1) << 8);
            // the sprite's layer of the texture array
            infos[4*i + 3] = s.index;
            boxes[4*i] = s.box.cx; boxes[4*i + 1] = s.box.cy; boxes[4*i + 2] = s.box.half; boxes[4*i + 3] = s.opacity;
        });
        for (const [id] of mSpriteCrowns) if (!spriteData.sprites.some(s => s.id === id)) mSpriteCrowns.delete(id);

        const dirTrans = tiles.map(t => t.fromFD);
        DataPacking.packGroupToSampler(gl, mSpriteTileData, { s: group.getFundDomain(), t: dirTrans });
        const tilePerms = new Uint32Array(MAX_TILES*4);
        tilePerms.set(transToPackedPerms(dirTrans, mGeneratorPerms, mInvGeneratorPerms, cmCfg.useOrbit));

        if (cmCfg.useMipmap) spriteData.ensureMipmaps();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, spriteData.texture);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, cmCfg.useMipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

        const spriteUni = {
            uSpriteArray:   spriteData.texture,
            uSpriteTexSize: spriteData.size,
            uSpriteCount:   sprites.length,
            uSpriteBox:     boxes,
            uSpriteInfo:    infos,
            uSpritePermData: spritePerms,
            uTileIndex:     tileIndex,
            uTileData:      mSpriteTileData,
            uTileCount:     tiles.length,
            uTilePermData:  tilePerms,
            uTransparency:  (1. - cmCfg.opacity),
            uPermData:      mPermData,
            uPermSize:      mPermSize,
            uUseOrbit:      cmCfg.useOrbit,
            uTexAlpha:      mTexAlpha,
            uUseMipmap:     cmCfg.useMipmap,
            uFillCells:          false,
            uCellColors:         mColorTiles.getPremultColors(),
            uCellColorPermIndex: mColorTiles.getPermIndex(),
            uColoringType:       COLORING_TYPE[cmCfg.coloringType] ?? 0,
            uUseTilt:    cmCfg.useTilt,
            uTiltVector: (() => {
                const angle = cmCfg.patternTiltDirection * TORADIANS;
                return new Float32Array([Math.cos(angle), Math.sin(angle)]);
            })(),
        };

        enableBlending(gl);
        const progName = 'colorImageSprites';
        let renderProg = mPrograms.getProgram(gl, progName);
        if(!renderProg) throw new Error(MYNAME + '.renderSprites(): failed to get program ' + progName);
        renderProg.bind();
        renderProg.setUniforms(par.navigatorUni);
        renderProg.setUniforms(par.renderUni);
        renderProg.setUniforms(spriteUni);
        renderProg.setUniforms({uOpacity: cmCfg.opacity});
        setViewport(gl, par.canvas);
        renderProg.blit(null);
    }

    function render(par){
        
       //if(DEBUG) console.log(`${MYNAME}.render()`, par);
        let gl = mGLCtx.gl;
        let cmCfg = mConfig;
        
        let dataBuffer   = par.dataBuffer; 
        let renderUni    = par.renderUni;
        let navigatorUni = par.navigatorUni;
        let canvas       = par.canvas;
        let renderTarget = null;
        //
        //  image uniforms
        //
        // Parse imageId as a space-separated list of component ids.
        const ids = cmCfg.imageId ? cmCfg.imageId.trim().split(/\s+/).filter(Boolean) : [];

        // a drawing's items as sprites: shown by the sprite program
        const spriteData = (par.patternData && par.patternData.getSprites) ? par.patternData.getSprites() : null;
        mLastSprites = !!(spriteData && spriteData.texture);
        if (mLastSprites) {
            renderSprites(par, spriteData, ids);
            return;
        }

        // collect DoubleFBOs for each id.
        // Use optional chaining on getComponentBuffer — simple PatternData
        // objects (from PatternImage) don't implement it.
        const doubleFBOs = ids
            .map(id => par.patternData?.getComponentBuffer?.(id))
            .filter(Boolean);

        // Fall back to the default buffer when no ids are resolved.
        const buffers = doubleFBOs.length > 0 ? doubleFBOs : [par.dataBuffer];

        const arrayTex = updateImageArrayTex(gl, buffers);

        let crownData = renderUni.uGroupData;
        let crownPerms = null;

        if (cmCfg.useCrown && par.group && par.patternTransform) {
            const res = prepareCrownData(par.group, par.patternTransform);
            crownData = res.crownData;
            crownPerms = res.crownPerms;
        } else {
            crownPerms = new Uint32Array(MAX_CROWN_COUNT * 4);
        }

        const imageUni = {
            uImageArray:    arrayTex,
            uNumImages:     buffers.length,
            uTransparency:  (1. - cmCfg.opacity),
            uInterpolation: getInterpolationId(cmCfg.interpolation),
            uPermData:      mPermData,
            uPermSize:      mPermSize,
            uTexPermIndex:  cmCfg.permIndex,
            uUseCrown:      cmCfg.useCrown,
            uUseOrbit:     cmCfg.useOrbit,
            uTexAlpha:      mTexAlpha,
            uCrownData:     crownData,
            uCrownPermData: crownPerms,
            uUseMipmap:     cmCfg.useMipmap,

            // cell color tiles
            uFillCells:          false,
            uCellColors:         mColorTiles.getPremultColors(),
            uCellColorPermIndex: mColorTiles.getPermIndex(),
            uColoringType:       COLORING_TYPE[cmCfg.coloringType] ?? 0,

            // tilt depth-sort
            uUseTilt:    cmCfg.useTilt,
            uTiltVector: (() => {
                const angle = cmCfg.patternTiltDirection * TORADIANS;
                return new Float32Array([Math.cos(angle), Math.sin(angle)]);
            })(),
        };


        //
        // render the complete image 
        // 
        enableBlending(gl); 
        const progName = 'colorImageArray';
        let renderProg = mPrograms.getProgram(gl, progName);                     
        if(!renderProg) throw new Error(`${MYNAME}.render(): failed to get program ${progName}`);
        renderProg.bind();
        
        // uniforms for complete canvas transform 
        renderProg.setUniforms(navigatorUni);
        renderProg.setUniforms(renderUni);
        renderProg.setUniforms(imageUni);
        renderProg.setUniforms({uOpacity: cmCfg.opacity}); 
        setViewport(gl, canvas);
        renderProg.blit(renderTarget);                     
       
    }
    
    function init(par){
        
       if(DEBUG) console.log(`${MYNAME}.init()`, par);
        mGLCtx = par.glCtx;        
        mOnChange = par.onChange;
        mGetGroupPresentation = par.getGroupPresentation || null;        
        mPrograms = ColorSymPrograms;

        mCrownGroupData = DataPacking.createGroupDataSampler(mGLCtx.gl);
        mSpriteTileData = DataPacking.createGroupDataSampler(mGLCtx.gl);

        mColorTiles.setOnChange(() => onChange(null));
    }
    
    //
    //  what the layer shows of a pattern's copies, for an editor that picks
    //  what is seen (drawlib's DrawingEditor.hitTest), as render() and the
    //  shaders draw them:
    //    sprites     the sprite path ran last: every sprite (getSprites, the
    //                ones named by ids, the first maxSprites) through the
    //                spriteTiles tiles nearest its box (grid spriteGridRadius),
    //                the domain alone without the crown; in sprite order, a
    //                sprite's tiles nearest first, each over the ones before
    //    else        the buffers of the components named by ids (none: the
    //                main buffer) through the domain, or with the crown its
    //                crownCount tiles nearest the pattern box, the farthest
    //                first, each over the ones before
    //    tilt        the depth sort's direction or null: the contributions
    //                sorted by tilt . p, the largest in front (p: the world
    //                point of a sprite's copy, the pattern box point of a
    //                buffer's, the same order as the buffer's texture point)
    //  sides are the sides of the domain a fold of the pointer crossed, in
    //  order (its tile's colour permutation, as the fold accumulates it),
    //  tileWord the word of a tile's map from the domain
    //
    function describeCopies(){
        const ids = mConfig.imageId ? mConfig.imageId.trim().split(/\s+/).filter(Boolean) : [];
        const angle = mConfig.patternTiltDirection*TORADIANS;
        const size = mPermSize;
        // permutations as the shaders hold them: size values, 0 beyond
        const at = (p, i) => (i < size && i < p.length) ? p[i] : 0;
        const compose = (outer, inner) => { const r = []; for (let i = 0; i < size; i++) r.push(at(outer, at(inner, i))); return r; };
        const generator = g => g < MAX_GEN_COUNT ? (mGeneratorPerms[g] || []) : [];
        const wordPerm = word => wordToPerm(word, mGeneratorPerms, mInvGeneratorPerms, mConfig.useOrbit);
        // the colour permutation of a tile seen from the pointer's tile
        function tilePerm(sides, tileWord){
            let p = [];
            for (let i = 0; i < size; i++) p.push(i);
            for (const g of sides) p = mConfig.useOrbit ? compose(generator(g), p) : compose(p, generator(g));
            const t = wordPerm(tileWord);
            return mConfig.useOrbit ? compose(t, p) : compose(p, t);
        }
        const shown = ci => mTexAlpha[ci] > 0;
        return {
            sprites:          mLastSprites,
            ids,
            opacity:          mConfig.opacity,
            useCrown:         mConfig.useCrown,
            crownCount:       MAX_CROWN_COUNT,
            spriteTiles:      SPRITE_TILES,
            spriteGridRadius: SPRITE_GRID_RADIUS,
            maxSprites:       MAX_SPRITES,
            tilt:             mConfig.useTilt ? [Math.cos(angle), Math.sin(angle)] : null,
            // the colour index of a sprite's copy, -1 when it is not seen (its
            // colour masked, another class's tile, no opacity); sprite: as
            // getSprites lists it
            spriteCopyColor(sides, tileWord, sprite){
                if (!(sprite.opacity > 0)) return -1;
                let slot = size > 0 ? (mConfig.permIndex + (sprite.slot || 0)) % size : 0;
                let spritePerm = null;
                if (sprite.word && size > 0) {
                    const perm = wordPerm(sprite.word);
                    if (mConfig.useOrbit) spritePerm = perm;
                    else if (perm[slot] !== undefined) slot = perm[slot];
                }
                let ci = at(tilePerm(sides, tileWord), slot);
                if (spritePerm && ci < spritePerm.length) ci = spritePerm[ci];
                const cls = sprite.cls ?? -1;
                if (cls >= 0 && ci !== cls) return -1;
                return shown(ci) ? ci : -1;
            },
            // the image of the array a buffer's copy samples, -1 when its colour is masked
            bufferCopyImage(sides, tileWord){
                const ci = at(tilePerm(sides, tileWord), mConfig.permIndex);
                return shown(ci) ? ci : -1;
            },
        };
    }

    //
    //
    //
    function getParams(){
        if(!mParams)
            mParams = makeParams(mConfig);
        return mParams;

    }

    return {
        getParams:    getParams,
        // the pattern renders its main buffer only for layers that sample it
        usesPatternBuffer: () => !mLastSprites,
        describeCopies,
        getClassName: (() => MYNAME),
        getId:        () => mIdRef.id,
        setId:        (id) => { mIdRef.id = id; },
        setOnIdChange:(fn) => { mOnIdChange = fn; },
        init:         init,
        render:       render,
        // another group (or another domain shape of the same group) has other
        // generators: let the subgroup tables follow
        onGroupChanged: () => mSubgroups.onGroupChanged(),
        get enabled(){ return mConfig.enabled; },
    }

} // function VisualizationColorSym




export {
   VisualizationColorSym
}
