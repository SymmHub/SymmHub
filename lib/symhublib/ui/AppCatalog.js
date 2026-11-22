/*
 * AppCatalog.js — Pure data manifest of SymmHub applications and their symmetry-family pages.
 * All paths are relative to the repository root (no leading slash) so pages work at any mount path.
 *
 * Kept strictly data-only (no functions, classes, or imports) so lightweight gallery pages
 * (appendThumbnails.js) can read it without loading WebGL or symhublib core modules.
 */

export const APP_CATALOG = {
    home: 'index.html',
    docs: [
        { id: 'outline',  title: 'Architecture & Outline', path: 'outline.html' },
        { id: 'notation', title: 'Two Dollars of Symmetry', path: 'tutorials/orbifold-notation.html' },
        { id: 'showcase', title: 'Orbifold Showcase',       path: 'tutorials/orbifold-showcase.html' },
    ],
    apps: [
        {
            id: 'sympix',
            title: 'SymPix',
            subtitle: 'Symmetry from pictures',
            badge: 'Interactive',
            index: 'apps/sympix/index.html',
            thumb: 'apps/sympix/img/tmb_klm.png',
            variants: [
                { label: 'Frieze',      page: 'apps/sympix/sympix_frieze.html',     thumbPage: 'apps/sympix/sympix_thumb_frieze.html' },
                { label: 'Spherical',   page: 'apps/sympix/sympix_spherical.html',  thumbPage: 'apps/sympix/sympix_thumb_spherical.html' },
                { label: 'Wallpaper',   page: 'apps/sympix/sympix_wp.html',         thumbPage: 'apps/sympix/sympix_thumb_wp.html' },
                { label: 'KLM',         page: 'apps/sympix/sympix_klm.html',        thumbPage: 'apps/sympix/sympix_thumb_klm.html' },
                { label: 'KLMN',        page: 'apps/sympix/sympix_klmn.html',       thumbPage: 'apps/sympix/sympix_thumb_klmn.html' },
                { label: '5 Splanes',   page: 'apps/sympix/sympix_5splanes.html',   thumbPage: 'apps/sympix/sympix_thumb_5splanes.html' },
                { label: 'KLx',         page: 'apps/sympix/sympix_klx.html',        thumbPage: 'apps/sympix/sympix_thumb_klx.html' },
                { label: 'Image Array', page: 'apps/sympix/sympix_imageArray.html', thumbPage: 'apps/sympix/sympix_thumb_imageArray.html' },
                { label: 'Color',       page: 'apps/sympix/sympix_color.html',      thumbPage: 'apps/sympix/sympix_thumb_color.html' },
                { label: 'Orbifold',    page: 'apps/sympix/sympix_orbifold.html',   thumbPage: 'apps/sympix/sympix_thumb_orbifold.html' },
                { label: 'Scripted',    page: 'apps/sympix/sympix_scripted.html',   thumbPage: 'apps/sympix/sympix_thumb_scripted.html' },
            ],
            devVariants: [
                { label: 'Cyclic',   page: 'apps/sympix/sympix_cyclic.html',   thumbPage: 'apps/sympix/sympix_thumb_cyclic.html' },
                { label: 'oN',       page: 'apps/sympix/sympix_on.html',       thumbPage: 'apps/sympix/sympix_thumb_on.html' },
                { label: '*22222',   page: 'apps/sympix/sympix_s22222.html',   thumbPage: 'apps/sympix/sympix_thumb_s22222.html' },
                { label: '22222',    page: 'apps/sympix/sympix_22222.html',    thumbPage: 'apps/sympix/sympix_thumb_22222.html' },
                { label: '*222222',  page: 'apps/sympix/sympix_s222222.html',  thumbPage: 'apps/sympix/sympix_thumb_s222222.html' },
                { label: 'Grandma',  page: 'apps/sympix/sympix_grandma.html',  thumbPage: 'apps/sympix/sympix_thumb_grandma.html' },
                { label: 'Maskit 2', page: 'apps/sympix/sympix_maskit2.html',  thumbPage: 'apps/sympix/sympix_thumb_maskit2.html' },
            ],
        },
        {
            id: 'symdraw',
            title: 'SymDraw',
            subtitle: 'Vector drawing with symmetry',
            badge: 'Vector',
            index: 'apps/symdraw/index.html',
            thumb: 'apps/symdraw/img/tmb_wp.png',
            variants: [
                { label: 'Frieze',    page: 'apps/symdraw/symdraw_frieze.html',    thumbPage: 'apps/symdraw/symdraw_thumb_frieze.html' },
                { label: 'Spherical', page: 'apps/symdraw/symdraw_spherical.html', thumbPage: 'apps/symdraw/symdraw_thumb_spherical.html' },
                { label: 'Wallpaper', page: 'apps/symdraw/symdraw_wp.html',        thumbPage: 'apps/symdraw/symdraw_thumb_wp.html' },
                { label: 'KLM',       page: 'apps/symdraw/symdraw_klm.html',       thumbPage: 'apps/symdraw/symdraw_thumb_klm.html' },
                { label: 'Color',     page: 'apps/symdraw/symdraw_color.html',     thumbPage: 'apps/symdraw/symdraw_thumb_color.html' },
                { label: 'Bending',   page: 'apps/symdraw/symdraw_bending.html',   thumbPage: 'apps/symdraw/symdraw_thumb_bending.html' },
            ],
        },
        {
            id: 'gray_scott',
            title: 'SymSim — Gray-Scott',
            subtitle: 'Reaction-diffusion PDE with symmetry',
            badge: 'PDE',
            index: 'apps/symsim/gray_scott/index.html',
            parentIndex: 'apps/symsim/index.html',
            parentTitle: 'SymSim',
            thumb: 'apps/symsim/gray_scott/img/tmb_wp.png',
            variants: [
                { label: 'Wallpaper',          page: 'apps/symsim/gray_scott/symsim_gray_scott_wp.html',     thumbPage: 'apps/symsim/gray_scott/symsim_gray_scott_thumb_wp.html' },
                { label: 'Wallpaper + Conformal', page: 'apps/symsim/gray_scott/symsim_gray_scott_wp_inv.html', thumbPage: 'apps/symsim/gray_scott/symsim_gray_scott_thumb_wp_inv.html' },
                { label: 'KLM',                page: 'apps/symsim/gray_scott/symsim_gray_scott_klm.html',    thumbPage: 'apps/symsim/gray_scott/symsim_gray_scott_thumb_klm.html' },
                { label: 'KLMN',               page: 'apps/symsim/gray_scott/symsim_gray_scott_klmn.html',   thumbPage: 'apps/symsim/gray_scott/symsim_gray_scott_thumb_klmn.html' },
                { label: 'Simple Viewer',      page: 'apps/symsim/gray_scott/symsim_gray_scott_simple.html', thumbPage: null },
            ],
        },
        {
            id: 'ginzburg_landau',
            title: 'SymSim — Ginzburg-Landau',
            subtitle: 'Complex Ginzburg-Landau PDE with symmetry',
            badge: 'PDE',
            index: 'apps/symsim/ginzburg_landau/index.html',
            parentIndex: 'apps/symsim/index.html',
            parentTitle: 'SymSim',
            thumb: 'apps/symsim/ginzburg_landau/img/tmb_wp.png',
            variants: [
                { label: 'Wallpaper', page: 'apps/symsim/ginzburg_landau/symsim_ginzburg_landau_wp.html',       thumbPage: 'apps/symsim/ginzburg_landau/symsim_ginzburg_landau_thumb_wp.html' },
                { label: 'KLM',       page: 'apps/symsim/ginzburg_landau/symsim_ginzburg_landau_klm.html',      thumbPage: 'apps/symsim/ginzburg_landau/symsim_ginzburg_landau_thumb_klm.html' },
                { label: 'KLMN',      page: 'apps/symsim/ginzburg_landau/symsim_ginzburg_landau_klmn.html',     thumbPage: 'apps/symsim/ginzburg_landau/symsim_ginzburg_landau_thumb_klmn.html' },
                { label: '5 Splanes', page: 'apps/symsim/ginzburg_landau/symsim_ginzburg_landau_5splanes.html', thumbPage: 'apps/symsim/ginzburg_landau/symsim_ginzburg_landau_thumb_5splanes.html' },
            ],
        },
        {
            id: 'attractors',
            title: 'SymChaos',
            subtitle: 'Chaotic iterated attractors with symmetry',
            badge: 'Chaos',
            index: 'apps/attractors/index.html',
            thumb: 'apps/attractors/img/tmb_wp.png',
            variants: [
                { label: 'No Symmetry', page: 'apps/attractors/att_nosym.html',     thumbPage: 'apps/attractors/att_thumb_nosym.html' },
                { label: 'Wallpaper',   page: 'apps/attractors/att_wp.html',        thumbPage: 'apps/attractors/att_thumb_wp.html' },
                { label: 'Frieze',      page: 'apps/attractors/att_frieze.html',    thumbPage: 'apps/attractors/att_thumb_frieze.html' },
                { label: 'Spherical',   page: 'apps/attractors/att_spherical.html', thumbPage: 'apps/attractors/att_thumb_spherical.html' },
                { label: 'KLM',         page: 'apps/attractors/att_klm.html',       thumbPage: 'apps/attractors/att_thumb_klm.html' },
            ],
        },
        {
            id: 'sample',
            title: 'Minimal Sample',
            subtitle: 'Reference template for new SymmHub apps',
            badge: 'Template',
            index: 'apps/sample/index.html',
            thumb: 'apps/sample/img/tmb_sample.png',
            variants: [
                { label: 'Sample', page: 'apps/sample/sample.html', thumbPage: 'apps/sample/index.html' },
            ],
        },
        {
            id: 'orbifold',
            title: 'Orbifold',
            subtitle: 'Direct-manipulation general hyperbolic orbifolds',
            badge: 'Lab',
            index: 'apps/orbifold/Symmetry.html',
            variants: [
                { label: 'Orbifold', page: 'apps/orbifold/Symmetry.html', thumbPage: null },
            ],
        },
        {
            id: 'groups',
            title: 'Groups',
            subtitle: 'Subgroup enumeration & coset permutation playground',
            badge: 'Tool',
            index: 'apps/groups/index.html',
            variants: [
                { label: 'Groups', page: 'apps/groups/index.html', thumbPage: null },
            ],
        },
    ],
};
