import {
  isDefined, 
  isFunction
} from './Utilities.js';

import {
  ObjectId 
} from './ObjectId.js';


const DEBUG = false;

/**
  universal event processor 
  
*/
export class EventProcessor {
  
  constructor(){
    
    if(DEBUG)console.log(this.constructor.name, '(', ObjectId(this), ')');
    this.listeners = {};
    
  }

  
  //
  // register listener for given eventType 
  // listener may be an object which has method listener.handleEvent(evt)
  // or listener may be a function which is called directly listener(event) 
  //
  addEventListener(eventType, listener){
    
    if(DEBUG)console.log(this.constructor.name, '(', ObjectId(this), ').addEventListener(',eventType, ',', listener.name, ')');
    
    let list = this.listeners[eventType];
    if(!isDefined(list)){
      list = [];
      this.listeners[eventType] = list;
    }
    for(let i = 0; i < list.length; i++){
      if(list[i] == listener) {
        // already have that listener
        return;
      }
    }
    list.push(listener);
  }

  removeEventListener(eventType, listener){
    
    let list = this.listeners[eventType];
    if(!isDefined(list)){
      return;
    }
    
    let newlist = [];
    for(let i = 0; i < list.length; i++){
      
      if(list[i] != listener) {
        newlist.push(list[i]);
      }
    }
    this.listeners[eventType] = newlist;
  }
  
  //
  // dispatch the event to all registered listeners 
  //
  handleEvent(evt){
    
    let list = this.listeners[evt.type];
    if(DEBUG)console.log(this.getName()+'.handleEvent(', evt.type, ')');
    if(!isDefined(list)){
      return;
    }
    for(let i = 0; i < list.length; i++){
      
      let item = list[i];
      if(!isDefined(item))
        continue;
      if(isFunction(item.handleEvent)){
        if(DEBUG)console.log('  calling: ', item.constructor.name,'.handleEvent()');
        item.handleEvent(evt);
        
      } else if(isFunction(item)){
        if(DEBUG)console.log('  calling: ', item.name);        
        item(evt);
        
      }          
    }    
  }
  getName(){
    return this.constructor.name + '(' + ObjectId(this)+')';
  }
}
