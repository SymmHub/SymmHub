export const OVERLAY_MAIN =
/*glsl*/`
//
//  main() shared by the overlay item programs, see overlay_pre
//
void main () {

    vec2 pnt = vUv;
    float pixelSize = abs(dFdx(pnt.x));
    float scale = 1.;
    vec4 color = vec4(0);

#ifdef OVERLAY_ITEM_SCREEN
    // screen space item: no projection, drawn everywhere
    color = getItemColor(pnt, scale, pixelSize);
#else
    float sdist = -1.;
    #ifdef HAS_SPHERICAL_PROJECTION
    if(u_sphericalProjectionEnabled){
        sdist = makeSphericalProjection(pnt, scale);
        scale = 1.;
    }
    #endif  //HAS_SPHERICAL_PROJECTION

    if(sdist < 0.) {
        // inside of unit circle
        color = getItemColor(pnt, scale, pixelSize);
    }
#endif

    outColor = color*(1.-uTransparency);

}
/*glsl*/`;
