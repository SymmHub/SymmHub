import { ParamObj, ParamFunc } from "../../lib/uilib/param.js";

const LABEL_RUN  = 'Run';
const LABEL_STOP = 'Stop';
const IMG_RUN    = 'btn_play.svg';
const IMG_STOP   = 'btn_pause.svg';

export const createSimulationRenderingLayer = simCreator =>
{
  const simulation = simCreator .create();

  let animation = null;

  const init = ( glContext, scheduleRepaint ) =>
  {
    simulation .init( glContext );

    let running = false;

    const isRunning = () => running;
    
    const start = () => {
      running = true;
      // mParams.runSim.setName(LABEL_STOP);
      // if (isDefined(mToolbox.run)){
      //     mToolbox.run.src = IMG_STOP;
      //     mToolbox.run.title = LABEL_STOP;
      // }
      scheduleRepaint();
    }
    const stop = () => {
      running = false;
      // mParams.runSim.setName(LABEL_RUN);
      // if (isDefined(mToolbox.run)){
      //     mToolbox.run.src = IMG_RUN;        
      //     mToolbox.run.title = LABEL_RUN;
      // }
      scheduleRepaint();
    }

    const toggle = () => running? stop() : start();

    animation = ({
      isRunning,
      start,
      stop,
      toggle,
    });
  }
  
  const getToolboxButtons = () =>
  {
    return [
      { title: LABEL_RUN,    src: IMG_RUN,           action: animation.toggle },
      { title: 'initialize', src: 'btn_restart.svg', action: simulation.initSimulation },
    ];
  }

  const recordingToggled = on => on? animation.start() : animation.stop();

  const makeParams = () => ({
    runSim:     ParamFunc( { func: animation.toggle, name: LABEL_RUN } ),
    simulation: ParamObj( { name: 'simulation', obj: simulation } ),
  });

  const getBuffer = () => simulation.getSimBuffer();

  const setGroup = group => simulation.setGroup( group );

  const getName = () => simulation.getName();

  const getClassName = () => simCreator.getClassName();

  const renderFrame = ( options ) =>
  {
    if ( animation.isRunning() ) {
      simulation.doStep();
    }
    simulation.render( options );
    return true;
  }
  
  return {
    init,
    getName,
    getClassName,
    makeParams,
    getToolboxButtons,
    getBuffer,
    renderFrame,
    setGroup,
    recordingToggled,
  };
}