// Ginzburg Landau simulation fragments 
import { GL_reset}    from './gl_reset.glsl.mjs'
import { GL_step }    from './gl_step.glsl.mjs'
import { GL_utils }      from './gl_utils.glsl.mjs'
import { render_inc } from './render_inc.glsl.mjs'
import { render_fp }  from './render_fp.glsl.mjs'
import { hist_vp }    from './hist_vp.glsl.mjs'
import { hist_fp }    from './hist_fp.glsl.mjs'

const GLName = 'GinzburgLandauFragments';

const GinzburgLandauFragments = {

  name: GLName,
  getName: ()=>{return GLName;},

  GL_reset,
  GL_step,
  GL_utils,
  render_inc,
  hist_vp,
  hist_fp,
  render_fp,
};


export {GinzburgLandauFragments};