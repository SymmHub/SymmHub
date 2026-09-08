export const OVERLAY_SUBGROUP =
/*glsl*/`
//
//  overlay items: a subgroup H of the renderer's group G as the symmetry of an item
//
//  H is given by the transversal cells of its fundamental domain, the union
//
//      D = T_0(F) u T_1(F) u ... u T_{n-1}(F)
//
//  of images of the domain F of G (uGroupData), packed by SubgroupDomain.js
//  packSubgroupDomain() into uSubData: the sides of F, the cell transforms T_j
//  and a table with, per cell j and side s of F, the CLASS of the cell across
//  the wall and whether the wall lies between two H-tiles.  Every cell of the
//  tiling of G is h T_j (F) for one h in H and one j, its class, and the
//  classes of the neighbours of a cell depend on its class alone.
//
//  subFold() folds a point into F by the pairing transforms of G, as
//  iToFundamentalDomainSampler() does, following the class of the cell of the
//  point: 0 for F itself, next[class][s] whenever the fold crosses side s.
//  T_class then maps the folded point into the cell of D the point belongs
//  to: the fold into the domain of H, which need not be convex.  The sides of
//  F at the folded point are the walls of the point's cell; the ones between
//  two H-tiles (subIsBoundary) are the edges of the tiling of H.
//
//  subDomainDistances() works in world space instead: it maps the point into
//  F by every T_j^-1 and measures the sides of F there, which gives D as the
//  union of its cells, its outline as the walls between H-tiles, drawn as
//  segments, and the interior walls of the union.
//
//  uSubEnabled and uSubData are declared in overlay_pre.
//

#define SUB_MAX_SIDES 16

// header texel: x = domain offset (group layout), y = count of cells, z = count of sides of F, w = table offset
int subCellCount(){
    return int(texelFetch(uSubData, ivec2(0, 0), 0).y);
}

// table entry of (class, side): x = class of the cell across the wall, y = 1 for a wall between two H-tiles
vec4 subTableEntry(int cls, int side){
    vec4 h = texelFetch(uSubData, ivec2(0, 0), 0);
    return texelFetch(uSubData, ivec2(int(h.w) + cls*int(h.z) + side, 0), 0);
}

int subNextClass(int cls, int side){
    return int(subTableEntry(cls, side).x);
}

bool subIsBoundary(int cls, int side){
    return subTableEntry(cls, side).y > 0.5;
}

// apply the cell transform T_cell (F -> cell) to the point, or its inverse (the reflections in reverse order)
void subCellTransform(int cell, bool inverse, inout vec3 pnt, inout float scale){

    int transformsOffset = fetchInt(uSubData, 1);
    int transformOffset  = fetchInt(uSubData, transformsOffset + cell + 1);
    int refCount         = fetchInt(uSubData, transformOffset);
    int refsOffset       = transformOffset + 1;
    for(int k = 0; k < refCount; k++){
        int r = inverse ? (refCount - 1 - k) : k;
        iSPlane sp = fetchSplane(uSubData, refsOffset + 2*r);
        iReflect(sp, pnt, scale);
    }
}

// fold the point into F with the renderer's group, following the class of the cell of the point
void subFold(inout vec3 pnt, inout float scale, inout int cls, inout int inDomain, int iterations){

    float EPS = 1.e-7;
    int domainOffset        = fetchInt(uGroupData, 0);
    int transformsOffset    = fetchInt(uGroupData, 1);
    int domainSize          = fetchInt(uGroupData, domainOffset);
    int domainSplanesOffset = domainOffset + 1;

    cls = 0;
    inDomain = 0;
    for(int count = 0; count < iterations; count++){
        int found = 0;
        for(int g = 0; g < domainSize; g++){
            iSPlane sp = fetchSplane(uGroupData, domainSplanesOffset + g*2);
            if(iDistance(sp, pnt) > EPS){
                // outside across side g: the pairing transform of the side, and the class of the cell across it
                int transformOffset = fetchInt(uGroupData, transformsOffset + g + 1);
                int refCount = fetchInt(uGroupData, transformOffset);
                for(int r = 0; r < refCount; r++){
                    iSPlane rsp = fetchSplane(uGroupData, transformOffset + 1 + r*2);
                    iReflect(rsp, pnt, scale);
                }
                cls = subNextClass(cls, g);
                found = 1;
                break;
            }
        }
        if(found == 0){
            inDomain = 1;
            break;
        }
    }
}

//
//  the domain of H in world space, distances in pixels
//
struct SubDomainDist {
    float unionDist;     // signed distance to the union of the cells: the least of the cell distances
    float boundaryDist;  // inside a cell: distance to its nearest wall between H-tiles (<= 0); -1e6 without one or outside
    float boundaryDens;  // the walls between H-tiles as segments of width boundaryWidth
    float wallsDens;     // the interior walls of the union as segments of width wallsWidth
    float shadowDens;    // shadow band of width shadowWidth inside the cells along the walls between H-tiles
};

SubDomainDist subDomainDistances(vec2 pnt, float pntscale, float pixelSize, float boundaryWidth, float wallsWidth, float shadowWidth){

    SubDomainDist sd;
    sd.unionDist    = 1.e6;
    sd.boundaryDist = -1.e6;
    sd.boundaryDens = 0.;
    sd.wallsDens    = 0.;
    sd.shadowDens   = 0.;

    int n = subCellCount();
    int m = min(getDomainSize(uGroupData, 0), SUB_MAX_SIDES);
    float d[SUB_MAX_SIDES];

    for(int j = 0; j < n; j++){
        // the point in the frame of F: q = T_j^-1 (pnt)
        vec3 q = vec3(pnt, 0.);
        float sc = pntscale;
        subCellTransform(j, true, q, sc);
        float pix = pixelSize*sc;
        float cellDist = -1.e6;
        for(int s = 0; s < m; s++){
            d[s] = iDistance(getSplane(uGroupData, 0, s), q)/pix;
            cellDist = max(cellDist, d[s]);
        }
        sd.unionDist = min(sd.unionDist, cellDist);

        for(int s = 0; s < m; s++){
            // the wall as a segment: the line of the side clipped by the other sides of the cell,
            // extended by half a line width so that the segments of adjacent walls join
            float clip = -1.e6;
            for(int k = 0; k < m; k++){
                if(k != s) clip = max(clip, d[k]);
            }
            bool boundary = subIsBoundary(j, s);
            float width = boundary ? boundaryWidth : wallsWidth;
            float dens = smoothstep(0.5, -0.5, abs(d[s]) - 0.5*width) * smoothstep(0.5, -0.5, clip - 0.5*width);
            if(boundary){
                sd.boundaryDens = max(sd.boundaryDens, dens);
                if(cellDist <= 0.) sd.boundaryDist = max(sd.boundaryDist, d[s]);
                // shadow inside the cell along the wall
                float shadow = linearstep(-max(0., shadowWidth), 0., d[s]) * smoothstep(0., -1., d[s]) * smoothstep(0.5, -0.5, clip);
                sd.shadowDens = max(sd.shadowDens, shadow);
            } else {
                sd.wallsDens = max(sd.wallsDens, dens);
            }
        }
    }
    return sd;
}
/*glsl*/`;
