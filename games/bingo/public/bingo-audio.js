import { bingoNumberText, createVisemes, sampleViseme } from './bingo-speech.js';
import { createBingoMusic } from './bingo-music.js';

// Exclusivo de Bingo. Una sola fuente de efectos y una sola locución por pantalla.
const sounds = {
  drum: ['dice-shake-1', .23], pickup: ['chip-lay-1', .38],
  drop: ['maximize_001', .22],
  victory: ['victory-fanfare', .45], select: ['card-slide-1', .22],
  defeat: ['jingles_PIZZI03', .3],
  mark: ['chip-lay-1', .3], ready: ['confirmation_001', .25],
  continue: ['card-place-1', .22], error: ['error_001', .18],
};
export const BINGO_SOUNDS = Object.freeze(sounds);

export function createBingoAudio({host = globalThis, onChange = () => {},createMusic=createBingoMusic} = {}) {
  let context, source, gain, state, active = false, online = true, animated = false;
  let unlocked = false, muted = false, disposed = false, epoch = 0, effectSerial = 0, key;
  let speech = null, speechDone = true;
  let numberKey, instructionRound, animationName, animationCues = new Set();
  const playedResults = new Set();
  const buffers = new Map();
  const allowed = () => !disposed && unlocked && !muted && active && online && !host.document.hidden;
  const tv = () => allowed() && state?.role === 'tv';
  const music=createMusic({host,getContext:()=>context});
  function syncMusic(){music.sync({active:tv()&&state.phase!=='results',ducked:Boolean(speech?.file.startsWith('number-'))});}
  function stopEffect() {
    if (source) { source.onended = null; try { source.stop(); } catch { /* Ya terminó. */ } source.disconnect(); source = null; }
    gain?.disconnect(); gain = null;
    syncMusic();
  }
  function stopSpeech() {
    const owned = speech; speech = null; speechDone = true;
    if (owned) { owned.node.onended = null; try { owned.node.stop(); } catch { /* Ya terminó. */ } owned.node.disconnect(); owned.volume.disconnect(); }
    syncMusic();
  }
  function stop() {
    epoch++;
    stopEffect(); stopSpeech(); animationName = null; animationCues.clear();
  }
  async function load(name) {
    if (!context) return null;
    if (name.startsWith('voice/') && !buffers.has(name)) {
      const voices = [...buffers.keys()].filter(key => key.startsWith('voice/'));
      while (voices.length >= 2) buffers.delete(voices.shift());
    }
    if (!buffers.has(name)) buffers.set(name, (async () => {
      const response = await host.fetch(new URL(`./assets/audio/${name}.wav`, import.meta.url));
      if (!response.ok) throw new Error('Audio no disponible');
      return context.decodeAudioData(await response.arrayBuffer());
    })().catch(() => { buffers.delete(name); return null; }));
    return buffers.get(name);
  }
  async function effect(kind, {loop = false, duration, offset = 0} = {}) {
    const serial = ++effectSerial;
    if (!allowed() || !speechDone) return;
    const token = epoch, spec = sounds[kind];
    if (!spec) return;
    const buffer = await load(spec[0]);
    if (token !== epoch || serial !== effectSerial || !allowed() || !speechDone) return;
    if (!buffer) return;
    stopEffect();
    const node = context.createBufferSource(), volume = context.createGain();
    node.buffer = buffer; node.loop = loop;
    volume.gain.setValueAtTime(0, context.currentTime);
    volume.gain.linearRampToValueAtTime(spec[1], context.currentTime + .015);
    node.connect(volume); volume.connect(context.destination); source = node; gain = volume;
    const length = duration ?? buffer.duration;
    if (Number.isFinite(length)) {
      volume.gain.setValueAtTime(spec[1], context.currentTime + Math.max(.015, length - .08));
      volume.gain.linearRampToValueAtTime(0, context.currentTime + Math.max(.03, length));
    }
    node.onended = () => {
      node.disconnect(); volume.disconnect();
      if (source === node) { source = null; gain = null; }
      syncMusic();
    };
    node.start(0, Math.max(0, offset) % buffer.duration);
    syncMusic();
    if (loop && Number.isFinite(duration)) node.stop(context.currentTime + Math.max(.03, duration));
  }
  async function speak(file, text, {after} = {}) {
    if (!tv()) return;
    effectSerial++;
    stopEffect(); stopSpeech();
    const token = epoch; speechDone = false;
    syncMusic();
    const buffer = await load(`voice/${file}`);
    if (token !== epoch || !tv()) return;
    if (!buffer) { speechDone = true; syncMusic(); after?.(); return; }
    const node = context.createBufferSource(), volume = context.createGain();
    node.buffer = buffer; volume.gain.value = .85; node.connect(volume); volume.connect(context.destination);
    const current = {file, node, volume, buffer, started:context.currentTime, frames:createVisemes(text)};
    speech = current;
    node.onended = () => {
      node.disconnect(); volume.disconnect();
      if (speech === current) { speech = null; speechDone = true; syncMusic(); if (token === epoch && tv()) after?.(); }
    };
    node.start();
    syncMusic();
  }
  function mouth() {
    if (!speech || !tv()) return {width:1, open:.13, speaking:false, pending:!speechDone};
    const elapsed = Math.max(0, context.currentTime - speech.started), buffer = speech.buffer;
    const pcm = buffer.getChannelData(0), start = Math.floor(elapsed * buffer.sampleRate);
    const end = Math.min(pcm.length, start + Math.ceil(buffer.sampleRate * .025));
    let energy = 0; for (let i=start;i<end;i++) energy += pcm[i] ** 2;
    const rms = Math.sqrt(energy / Math.max(1,end-start));
    const shape = sampleViseme(speech.frames, Math.min(1, elapsed / buffer.duration));
    return {width:shape.width, open:rms < .008 ? .13 : Math.max(.18,shape.open) * Math.min(1,rms * 14), speaking:rms >= .008, pending:true};
  }
  function announce() {
    if (!tv() || state.phase !== 'marking' || numberKey === key) return;
    numberKey = key; speak(`number-${String(state.current).padStart(2,'0')}`,`El número ${bingoNumberText(state.current)}`);
  }
  function startPhase() {
    syncMusic();
    if (allowed() && state.phase === 'results') {
      const resultKey = `${state.role}:${state.me?.id || ''}`;
      if (playedResults.has(resultKey)) return;
      if (state.role === 'tv') {
        playedResults.add(resultKey);
        if (state.winners.length) speak('bingo','¡Bingo! ¡Enhorabuena!',{after:() => effect('victory')});
        else effect('defeat');
      } else if (state.role === 'player' && state.me?.playing) {
        playedResults.add(resultKey);
        effect(state.winners.includes(state.me.id) ? 'victory' : 'defeat');
      }
      return;
    }
    if (!tv()) return;
    if (state.phase === 'drawing') {
      const remaining = state.drawEndsAt ? (state.drawEndsAt - Date.now()) / 1000 : (state.drawDurationMs || 5000) / 1000;
      if (remaining > 0) effect('drum', {loop: true, duration: remaining, offset: Math.max(0, (state.drawDurationMs || 5000) / 1000 - remaining)});
    } else if (state.phase === 'marking' && !animated) announce();
  }
  function sync(next, options = {}) {
    const nextActive = Boolean(options.active), nextOnline = options.online !== false;
    const nextAnimated = Boolean(options.animated);
    const nextKey = `${next.role}:${next.me?.id || ''}:${next.roundId}:${next.turn}:${next.phase}`;
    const changed = key !== nextKey || active !== nextActive || online !== nextOnline || animated !== nextAnimated;
    if (state?.roundId !== next.roundId) playedResults.clear();
    state = next; active = nextActive; online = nextOnline; animated = nextAnimated;
    if (changed) {
      stop(); key = nextKey;
      if (allowed()) for (const kind of state.role === 'tv' ? ['drum','pickup','drop','victory'] : ['select','mark','ready','continue','error']) load(sounds[kind][0]);
      startPhase();
    }
    onChange();
  }
  function animation(name, time = 0) {
    if (!tv() || !animated) return;
    if (animationName !== name) { animationName = name; animationCues.clear(); }
    const cue = (id, at, fn) => { if (time >= at && !animationCues.has(id)) { animationCues.add(id); fn(); } };
    if (name === 'PickBall') cue('pickup', 1.3, () => effect('pickup'));
    if (name === 'ShowBall') cue('number', .25, announce);
    if (name === 'DropBall') cue('stars', .9, () => effect('drop'));
    if (name === 'Talk') cue('instruction', .3, () => {
      if (instructionRound !== state.roundId) { instructionRound = state.roundId; speak('continue','Marca tus números y pulsa continuar.'); }
    });
  }
  async function unlock() {
    if (disposed) return;
    try {
      const AudioContext = host.AudioContext || host.webkitAudioContext;
      if (!AudioContext) return;
      if (!context) {
        context = new AudioContext();
        context.onstatechange = () => { if (context.state !== 'running' && !disposed) { unlocked = false; stop(); onChange(); } };
      }
      await context.resume();
      const first = !unlocked; unlocked = context.state === 'running';
      if (unlocked && first) startPhase();
    } catch { unlocked = false; }
    onChange();
  }
  function feedback(kind) {
    if (!allowed() || state?.role !== 'player' || state.phase === 'results') return;
    if (['mark','select','ready','continue','error'].includes(kind)) effect(kind);
  }
  function toggle() { muted = !muted; stop(); if (!muted) { unlock(); startPhase(); } onChange(); }
  function visibility() { stop(); if (!host.document.hidden) { unlock(); startPhase(); } }
  host.document.addEventListener('visibilitychange', visibility);
  return {sync, animation, mouth, unlock, feedback, toggle,
    toggleMusic(){music.toggle();syncMusic();onChange();},get musicEnabled(){return music.enabled;},
    get muted() { return muted; }, get unlocked() { return unlocked; },
    dispose() { if (disposed) return; disposed = true; music.dispose(); stop(); host.document.removeEventListener('visibilitychange', visibility); context?.close().catch(() => {}); },
  };
}
