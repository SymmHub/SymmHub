
let nextId = 1;

//
// simple funciton which gives each object unique ID 
//
export function ObjectId(obj) {
  
    if (obj==null) return null;
    if (obj.__obj_id === undefined) 
      obj.__obj_id = nextId++;
    
    return obj.__obj_id;
}
