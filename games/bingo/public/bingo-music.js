// Canal independiente de música; comparte el contexto de audio del Bingo.
export function createBingoMusic({host=globalThis,getContext}) {
  let enabled=true,active=false,ducked=false,disposed=false,pending=false,serial=0;
  let bufferPromise,node,gain,started=0,offset=0,target;
  function stop() {
    serial++;pending=false;
    if(node){offset+=Math.max(0,getContext().currentTime-started);try{node.stop();}catch{/* Ya terminó. */}node.disconnect();node=null;}
    gain?.disconnect();gain=null;target=undefined;
  }
  function volume() {
    if(!gain)return;
    const next=ducked ? .05 : .25;
    if(next===target)return;target=next;
    const context=getContext();gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(next,context.currentTime,ducked ? .045 : .6);
  }
  async function start() {
    const context=getContext();if(!context||pending||node)return;
    const token=serial;pending=true;
    bufferPromise||=(async()=>{
      const response=await host.fetch(new URL('./assets/audio/background-calm.mp3',import.meta.url));
      if(!response.ok)throw new Error('Música no disponible');
      return context.decodeAudioData(await response.arrayBuffer());
    })().catch(()=>{bufferPromise=null;return null;});
    const buffer=await bufferPromise;
    if(token!==serial||disposed||!active||!enabled)return;
    pending=false;if(!buffer)return;
    node=context.createBufferSource();gain=context.createGain();node.buffer=buffer;node.loop=true;
    gain.gain.value=0;node.connect(gain);gain.connect(context.destination);
    offset%=buffer.duration;started=context.currentTime;node.start(0,offset);volume();
  }
  function sync(next) {
    active=Boolean(next.active);ducked=Boolean(next.ducked);
    if(disposed||!active||!enabled){if(node||pending)stop();return;}
    if(node)volume();else start();
  }
  return {sync,get enabled(){return enabled;},toggle(){enabled=!enabled;if(!enabled)stop();},dispose(){disposed=true;stop();bufferPromise=null;}};
}
