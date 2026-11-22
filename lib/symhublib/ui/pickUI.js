//
//  pickUI.js: the UI builder a page asks for in its address, ?ui=<name>, among those
//  its entry offers (docs/symrenderer_refactor_plan.md D7):
//      SymRenderer({ ..., ui: pickUI({ classic: ClassicUI, simple: SimpleUI }, 'classic') })
//  a name the entry does not offer gives its default
//
export function pickUI(builders, defaultName) {
    let name = null;
    try { name = new URLSearchParams(window.location.search).get('ui'); } catch (e) { /* no page */ }
    return (name && Object.prototype.hasOwnProperty.call(builders, name))
        ? builders[name] : builders[defaultName];
}
