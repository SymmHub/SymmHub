/**
 * ParamUiFolder.js
 *
 * A folder in a panel for rows whose values stay entries of the params they are
 * in: the folder is only the place where their UI goes. A ParamGroup would nest
 * the values of its rows under its own key, and change what a document saves.
 *
 * Usage (the folder comes before the rows that go into it):
 *
 *   const folder = ParamUiFolder({ name: 'palette parameters' });
 *   const params = {
 *       palette: ...,
 *       folder,                                        // makes the folder, saves nothing
 *       a: folder.contain(ParamFloatVector({...})),    // the UI of a is in the folder,
 *       b: folder.contain(ParamFloatVector({...})),    // its value is params.a, as ever
 *       adjust: ...,
 *   };
 */

export function ParamUiFolder(arg) {

    let mFolder = null;

    function createUI(gui) {
        mFolder = gui.addFolder(arg?.name ?? 'folder');
    }

    // a param like the given one, only its UI is made in the folder
    function contain(param) {
        return { ...param, createUI: (gui) => param.createUI(mFolder ?? gui) };
    }

    return {
        createUI,
        contain,
        serializable: false,
    };

} // ParamUiFolder
