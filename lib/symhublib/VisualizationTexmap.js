import {    
    Colormaps,    
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamObj,
    ParamChoice, 
    ParamGroup,
    TextureFile,
    Textures,
    setViewport,
    enableBlending,
    SymRendererPrograms,
    TORADIANS,
} from './modules.js';

const DEBUG = true;
const MYNAME = 'VisualizationTexmap';
const INCREMENT = 1.e-12;

function VisualizationTexmap(par={}){
    
    let mTextureMaker = null;
        
    let mConfig = {
        enabled: true,
        opacity: 1,  
        texture: mTextureMaker,
        minValue: -1,
        maxValue:  1,
        useMipmap: false,
        
        transform: {
            scale: 1,
            angle: 0,
            texCenterX: 0,
            texCenterY: 0,
            uvOriginX: 0,
            uvOriginY: 0,
        }
    };
    if(par.config){
        Object.assign(mConfig, par.config);
    }

    let mParams = null;
    let mGLCtx = null;
    let mOnChange = null;
    let mPrograms = null;
    
    function onChange(param){
        
      console.log(`${MYNAME}.onChange()`, param);
      if(mOnChange) mOnChange(param);
        
    }

    function makeParams(tmc) {

        let oc = onChange;

        return {
            enabled:    ParamBool({obj: tmc, key: 'enabled', onChange: oc}),
            opacity:    ParamFloat({obj: tmc, key: 'opacity',onChange: oc}),
            minValue:   ParamFloat({obj: tmc, key:'minValue', onChange: oc}),
            maxValue:   ParamFloat({obj: tmc, key:'maxValue', onChange: oc}),
            useMipmap:  ParamBool({obj: tmc, key: 'useMipmap',onChange: oc}),
            texture:    ParamObj({name: 'texture', obj: mTextureMaker }),
            transform:  makeTexTransformParams(tmc.transform),
        };

    } // function makeParams()
    
    function makeTexTransformParams(ttcfg){
        let tt = ttcfg;
        let oc = onChange;        
        return ParamGroup({name: 'transform',
                          params: {
                                scale: ParamFloat({obj: tt, key: 'scale', min: -10, max: 10, step: 0.00001, onChange: oc}),
                                angle: ParamFloat({obj: tt, key: 'angle', min: -360,max: 360,step: 0.00001, onChange: oc}),
                                texCenterX: ParamFloat({obj: tt,key: 'texCenterX', min: -1, max: 1,step: 0.00001,onChange: oc}),
                                texCenterY: ParamFloat({obj: tt,key: 'texCenterY', min: -1, max: 1,step: 0.00001,onChange: oc}),
                                uvOriginX: ParamFloat({obj: tt, key: 'uvOriginX', min: -1, max: 1, step: 0.00001,onChange: oc}),
                                uvOriginY: ParamFloat({obj: tt, key: 'uvOriginY', min: -1, max: 1,step: 0.00001, onChange: oc}),
                            }
        });        
    }

    //
    //
    // 
    function render(par){
        
        let cfg = mConfig;
        if(!cfg.enabled)
            return;
        //if(DEBUG) console.log(`${MYNAME}.render()`, par);
        let gl = mGLCtx.gl;
        
        let dataBuffer  = par.dataBuffer; 
        let renderUni   = par.renderUni;
        let navigatorUni = par.navigatorUni;
        let canvas      = par.canvas;
        let renderTarget = null;

        let tvc = cfg.transform;
        let uvAngle = TORADIANS * tvc.angle;
        let uvScale = tvc.scale;
        
        // texmap uniforms 
        let texUni = { 
           
            uMinValue:      cfg.minValue,
            uMaxValue:      cfg.maxValue,
            uColorTexture:  mTextureMaker.getTexture(),
            uUVscale:       [uvScale * Math.cos(uvAngle), -uvScale * Math.sin(uvAngle)],
            uUVorigin:      [tvc.uvOriginX, tvc.uvOriginY],
            uTexCenter:     [tvc.texCenterX, tvc.texCenterY],
            uTransparency:      1.-cfg.opacity,            
        };
        console.log(`${MYNAME}.render() texUni: `,texUni)
        /*
        if(cfg.useMipmap){ // create mipmap 
        
            let progVis = mPrograms.getProgram('bufferVisTextured');
            progVis.bind();

            let cnv = mMipmapBuffer;
            gl.viewport(0, 0, cnv.width, cnv.height);
            // no need to clear because we render the whole viewport and have no blending
            disableBlending();
                    
            // transformation to render data into buffer 
            let transUni = getStandardTexTransUni(cnv);
            
            progVis.setUniforms(transUni);            
            progVis.setUniforms(texVisUni);            
            progVis.blit(mMipmapBuffer);      // render to top mipmap level 
            
            mMipmapBuffer.attach(0);          // set as the current texture. Needed for  generateMipmap()            
            gl.generateMipmap(gl.TEXTURE_2D); 
            
        }
        */
        //
        // render the complete image 
        // 
        enableBlending(gl);
        
        setViewport(gl, canvas);
        let renderProg = mPrograms.getProgram('bufferToScreenTextured');

        renderProg.bind();

        renderProg.setUniforms(navigatorUni);
        renderProg.setUniforms(renderUni);
        renderProg.setUniforms(texUni);
        
        //let mipmapUni = getMipmapUni();        
        //renderProg.setUniforms(mipmapUni);
        
        renderProg.blit(renderTarget);
       
    }
    /*
    {
        let gl = mGLCtx.gl;

        let visConf     = mConfig.visualization;
        let symOptions  = mConfig.symmetry.options;
        let visOpt      = mConfig.visualization.options;       

        let simBuffer   = mSimulation.getSimBuffer();
        let tvc = mConfig.texTransform;
        let uvAngle = TORADIANS * tvc.angle;
        let uvScale = tvc.scale;
        
        // texture visualization  uniforms 
        let texVisUni = { 
           
            uMinValue:      visConf.minValue,
            uMaxValue:      visConf.maxValue,
            uColorTexture:  mTextureMaker.getTexture(),
            uUVscale:       [uvScale * Math.cos(uvAngle), -uvScale * Math.sin(uvAngle)],
            uUVorigin:      [tvc.uvOriginX, tvc.uvOriginY],
            uTexCenter:     [tvc.texCenterX, tvc.texCenterY],

        };

        if(visOpt.useMipmap){ // create mipmap 
        
            let progVis = mPrograms.getProgram('bufferVisTextured');
            progVis.bind();

            let cnv = mMipmapBuffer;
            gl.viewport(0, 0, cnv.width, cnv.height);
            // no need to clear because we render the whole viewport and have no blending
            disableBlending();
                    
            // transformation to render data into buffer 
            let transUni = getStandardTexTransUni(cnv);
            
            progVis.setUniforms(transUni);            
            progVis.setUniforms(texVisUni);            
            progVis.blit(mMipmapBuffer);      // render to top mipmap level 
            
            mMipmapBuffer.attach(0);          // set as the current texture. Needed for  generateMipmap()            
            gl.generateMipmap(gl.TEXTURE_2D); 
            
        }
        
        //
        // render the complete image 
        // 
        enableBlending();
        
        let renderProg = mPrograms.getProgram('bufferToScreenTextured');
        renderProg.bind();


        // uniforms for complete canvas transform 
        let ctUni = mNavigator.getUniforms({}, mTimeStamp);            
        renderProg.setUniforms(ctUni);
        
        let renderUni = getRenderUni();            
        renderProg.setUniforms(renderUni);
        
        // reuse textured visualization uniforms 
        renderProg.setUniforms(texVisUni);
        
        let mipmapUni = getMipmapUni();            
        renderProg.setUniforms(mipmapUni);

        let canvas = mCanvas.glCanvas;
        gl.viewport(0, 0, canvas.width, canvas.height);
        renderProg.blit(null); 
    }
    */
    function init(par){
        
       if(DEBUG) console.log(`${MYNAME}.init()`, par);
        mGLCtx = par.glCtx;        
        mOnChange = par.onChange;        
        mPrograms = SymRendererPrograms();
        mTextureMaker = new TextureFile({
            texInfo: Textures.t1.concat(Textures.t2).concat(Textures.experimental),
            gl: mGLCtx.gl,
            onChanged: onChange
        });
        
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
        getParams:  getParams, 
        init:       init,
        render:     render,
        get enabled(){return mConfig.enabled;},
    }

} // function VisualizationTexmap


export {
   VisualizationTexmap     
}