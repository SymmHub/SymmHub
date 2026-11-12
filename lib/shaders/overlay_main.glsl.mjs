export const OVERLAY_MAIN =
/*glsl*/`
//
//  main() shared by the overlay item programs, see overlay_pre
//
void main () {

    vec2 pnt = vUv;
#ifdef VIEW_OFFSET
    // from the offset from the view's centre: exact however far the view is (vUv is not), and
    // the whole pixel with the view turned (dFdx(vUv.x) is its cosine part)
    float pixelSize = length(dFdx(vViewOffset));
#else
    float pixelSize = abs(dFdx(pnt.x));
#endif
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
