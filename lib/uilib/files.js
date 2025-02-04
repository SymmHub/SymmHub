// Feature detection. The API needs to be supported
// and the app not run in an iframe.

import {
    getTime
} from './modules.js';

const DEBUG = true;

if(DEBUG)console.log('window.showOpenFilePicker:',window.showOpenFilePicker);


const supportsFileSystemAccess = "showOpenFilePicker" in window &&
    (() => {
        try {
            return window.self === window.top;
        } catch {
            return false;
        }
    })();



export const openFile = async ( types, multiple = false ) => {
  // If the File System Access API is supported…
  if (supportsFileSystemAccess) {
    let file = undefined;
    try {
      // Show the file picker, optionally allowing multiple files.
      const handles = await showOpenFilePicker({ multiple: multiple, types });
      // Only one file is requested.
      // Add the `FileSystemFileHandle` as `.handle`.
      console.log('handles: ', handles);
      if(multiple) {
         let files = [];
         for(let i = 0; i < handles.length; i++){
             let handle = handles[i];
             let file = await handles[i].getFile();
             files.push(file);
         }
         return files;
      } else {
        file = await handles[0].getFile();
        file.handle = handles[0];
      }
    } catch (err) {
      // Fail silently if the user has simply canceled the dialog.
      if (err.name !== 'AbortError') {
        console.error(err.name, err.message);
      }
    }
    return file;
  }
    
  // Fallback if the File System Access API is not supported.
  return new Promise((resolve) => {
    // Append a new `<input type="file" />` and hide it.
    const input = document.createElement('input');
    input.style.display = 'none';
    input.type = 'file';
    document.body.append(input);
    // The `change` event fires when the user interacts with the dialog.
    input.addEventListener('change', () => {
      // Remove the `<input type="file" />` again from the DOM.
      input.remove();
      // If no files were selected, return.
      if (!input.files) {
        return;
      }
      // Return just one file.
      resolve( (multiple)? input.files:input.files[0] );
    });
    // Show the picker.
    if ('showPicker' in HTMLInputElement.prototype) {
      input.showPicker();
    } else {
      input.click();
    }
  });
};


export const saveTextFile = async ( handle, text, type ) =>
{
  const blob = new Blob( [ text ], { type } );
  return saveFile( handle, blob );
};


export const saveFile = async ( handle, blob ) =>
{
  // can't get here unless a handle was returned earlier, so no need for feature detection
  try {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (err) {
    // Fail silently if the user has simply canceled the dialog.
    if (err.name !== 'AbortError') {
      console.error(err.name, err.message);
    }
    return { success: false };
  }
  return { success: true };
}

export const saveTextFileAs = async ( suggestedName, text, type ) =>
{
  const blob = new Blob( [ text ], { type } );
  return saveFileAs( suggestedName, blob );
}

export const saveFileAs = async ( suggestedName, blob ) =>
{
  // If the File System Access API is supported…
  if (supportsFileSystemAccess) {
    try {
      // Show the file save dialog.
      const handle = await showSaveFilePicker( { suggestedName } );
      // Write the blob to the file.
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { handle, success: true };
    } catch (err) {
      // Fail silently if the user has simply canceled the dialog.
      if (err.name !== 'AbortError') {
        console.error(err.name, err.message);
      }
      return { success: false };
    }
  }
  // Fallback if the File System Access API is not supported…
  // Create the blob URL.
  const blobURL = URL.createObjectURL(blob);
  // Create the `<a download>` element and append it invisibly.
  const a = document.createElement('a');
  a.href = blobURL;
  a.download = suggestedName;
  a.style.display = 'none';
  document.body.append(a);
  // Click the element.
  a.click();
  // Revoke the blob URL and remove the element.
  setTimeout(() => {
    URL.revokeObjectURL(blobURL);
    a.remove();
  }, 1000);
  return { success: false }; // we really can't tell, but we know we don't want to set the name in this case
};


export function writeBlobToFile(blob, fileName){
  
  if(DEBUG)console.log('writeBlobToFile() start', fileName);
  const a = document.createElement("a");
  const objURL = URL.createObjectURL(blob);
  a.href = objURL;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(objURL);
  a.remove();        
  if(DEBUG)console.log('writeBlobToFile() done', fileName);
  
}


//
//  danger! it is async
//
export async function writeFileAsync(dirHandle, fname, data) {

    if(DEBUG)console.log(`writing ${fname}`);
    let fhandle = await dirHandle.getFileHandle(fname, {
        create: true
    });
    const writable = await fhandle.createWritable();
    await writable.write(data);
    await writable.close();
    
    if(DEBUG)console.log(`${fname} written`);
}

export function writeFile(dirHandle, fname, data) {

    if(DEBUG)console.log(`writing ${fname} to:`, dirHandle);
    let writer;
    let st0 = getTime();
    return dirHandle.getFileHandle(fname, {create: true}).
                then((h) => h.createWritable()).
                then((w) => {
                        // save writer to be able to call writer.close()
                        writer = w; 
                        return w.write(data)
                    }).
                then(() => {
                    if(DEBUG)console.log(`${fname} written`);                    
                    return writer.close();
                });
                //.then(()=>{
                //   if(DEBUG)console.log(`${fname} closed: `, (getTime() - t0));                                        
                //    return true;
                //});        
}

export function canvasToLocalFile(canvas, dirHandle, fileName, type = 'image/png') {

    if(DEBUG)console.log(`canvasToLocalFile(dirHandle: ${dirHandle}, ${fileName}`);                    
        
    function getCanvasBlob(canvas) {
        return new Promise(
                function(resolve, reject) {
                    canvas.toBlob(blob => resolve(blob), type)
                })
    }
    
    let canvasBlob = getCanvasBlob(canvas);     
    return canvasBlob.then((blob)=>writeFile(dirHandle, fileName, blob));
}

export function _canvasToLocalFile(canvas, dirHandle, fileName, type = 'image/png') {

    canvas.toBlob((blob => writeFile(dirHandle, fileName, blob)), type);
    
}
