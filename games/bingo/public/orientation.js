// La orientación cambia con la fase. Las peticiones anteriores se invalidan
// para que un reintento vertical no pueda sobrescribir el modo de partida.
let preferred = null, requestVersion = 0;

export function releasePlayerOrientation() {
  requestVersion++;
  preferred = null;
  try { screen.orientation?.unlock?.(); } catch { /* API no disponible. */ }
}

export async function requestPlayerOrientation(mode,{forceFullscreen = false} = {}) {
  if (!['portrait','landscape'].includes(mode)) throw new Error('Orientación no válida.');
  const mobile = matchMedia('(pointer: coarse)').matches;
  if (!mobile && !forceFullscreen) return false;
  if (preferred && preferred !== mode) {
    try { screen.orientation?.unlock?.(); } catch { /* Se intentará el nuevo modo. */ }
  }
  preferred = mode;
  const version = ++requestVersion;
  const current = () => version === requestVersion;
  const lock = screen.orientation?.lock;
  async function fullscreen() {
    if (!document.fullscreenElement) {
      if (!document.documentElement.requestFullscreen) return false;
      await document.documentElement.requestFullscreen();
    }
    return current();
  }
  try {
    // El botón debe invocar requestFullscreen directamente dentro del gesto.
    if (forceFullscreen && !await fullscreen()) return false;
    if (!current()) return false;
    if (!mobile || !lock) return Boolean(document.fullscreenElement);
    await lock.call(screen.orientation,mode);
    return current();
  } catch {
    if (!current() || forceFullscreen || !lock) return false;
    try {
      if (!await fullscreen() || !current()) return false;
      await lock.call(screen.orientation,mode);
      return current();
    } catch { return false; }
  }
}

export const requestPlayerPortrait = () => requestPlayerOrientation('portrait');

export async function restorePlayerFullscreen(mode) {
  await requestPlayerOrientation(mode,{forceFullscreen:true});
  return Boolean(document.fullscreenElement);
}
