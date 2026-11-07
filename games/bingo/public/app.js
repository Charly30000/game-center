import { createConnection } from '/shared/connection.js';
import { installRemoteNavigation, captureFocus, restoreFocus } from '/shared/remote-navigation.js';
import { installViewportLayout } from './viewport.js';
import { createCardScroller } from './auto-scroll.js';
import { requestPlayerPortrait, requestPlayerOrientation, releasePlayerOrientation, restorePlayerFullscreen } from './orientation.js';
import * as views from './views.js';

const app = document.querySelector('#app');
const dialogs = document.querySelector('#dialogs');
const notice = document.querySelector('#notice');
const connectionLabel = document.querySelector('#connection');
const fullscreenButton = document.querySelector('#restore-fullscreen');
const local = { view: 'choose', selectedCard: 0, name: '', avatar: 0, playerId: null, editing: false };
const scroller = createCardScroller();
let state, status = 'connecting', revoked = false, modal, modalFocus, toastTimer;
let renderer, rendererModule, sceneGeneration = 0, noNumberNotice, celebratedRound;
let rendererLoad, loadingSlot;
let pointerActive = false, pendingRender = false;
let appliedOrientation = null, profilePlayerId = null;
const fitViewport = installViewportLayout(app);

// Una entrada de historial por pantalla real; nunca se reintroduce el estado
// durante popstate ni se impide la navegación normal del navegador.
history.replaceState({ bingoView: 'choose' }, '', location.href);
installRemoteNavigation({ preferred: () => app.querySelector('[data-role="tv"],#new-player,#continue:not(:disabled),button:not(:disabled)'), onBack: handleBack });

function toast(error) {
  notice.className = 'toast'; notice.textContent = error?.message || String(error);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { notice.className = ''; notice.textContent = ''; }, 6000);
}
const net = createConnection({
  onState(next) {
    const previous = state;
    if (!previous && next.role === 'player' && next.me) {
      local.view = 'session';
      history.pushState({bingoView:'session'},'',location.href);
    }
    if (next.me && next.me.id !== local.playerId) {
      local.playerId = next.me.id; local.name = next.me.name; local.avatar = next.me.avatar;
    }
    if (next.roundId !== previous?.roundId) local.selectedCard = 0;
    if (next.phase !== previous?.phase && modal?.kind !== 'takeover') closeModal();
    if (next.role === 'guest' && previous?.role !== 'guest' && previous && local.view === 'session') {
      local.view = 'choose'; local.editing = false;
      history.replaceState({ bingoView: 'choose' }, '', location.href);
    }
    if (previous && next.phase === 'lobby' && next.roundId !== previous.roundId && local.view === 'players') {
      local.view = 'choose'; history.replaceState({bingoView:'choose'},'',location.href);
    }
    if (previous?.role === 'player' && next.role !== 'player') { releasePlayerOrientation(); appliedOrientation = null; }
    state = next; syncPlayerOrientation(); render(); showNoNumberNotice();
    if (next.phase === 'results' && next.role === 'tv' && next.settings.effects && celebratedRound !== next.roundId && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      celebratedRound = next.roundId;
      const splash = document.createElement('div'); splash.className = 'bingo-splash'; splash.setAttribute('aria-hidden','true'); splash.innerHTML = '<span>✦ ✳ ✦</span><strong>¡Bingo!</strong><span>✳ ✦ ✳</span>';
      document.body.append(splash); setTimeout(() => splash.remove(),1600);
    }
  },
  onStatus(next) { status = next; renderConnection(); },
  onError: toast,
  onRevoked() { revoked = true; renderer?.dispose(); renderer = null; render(); },
});

function renderConnection() {
  connectionLabel.classList.toggle('offline',status !== 'online');
  connectionLabel.querySelector('span:last-child').textContent = status === 'online' ? 'En directo' : status === 'offline' ? 'Reconectando…' : 'Conectando…';
  document.querySelector('.net-block')?.remove();
  if (status !== 'online' && state && !revoked) {
    const block = document.createElement('div'); block.className = 'net-block'; block.innerHTML = '<p>Reconectando… Espera un momento.</p>'; document.body.append(block);
  }
  updateFullscreenButton();
}
function preferredPlayerOrientation() { return state?.me?.playing && state.phase !== 'lobby' ? 'landscape' : 'portrait'; }
function syncPlayerOrientation() {
  if (state?.role !== 'player' || local.view !== 'session') return;
  const mode = preferredPlayerOrientation();
  if (mode !== appliedOrientation) { appliedOrientation = mode; requestPlayerOrientation(mode); }
}
function updateFullscreenButton() {
  const visible = state?.role === 'player' && local.view === 'session' && !revoked && status === 'online' && !document.fullscreenElement;
  fullscreenButton.hidden = !visible;
  document.body.classList.toggle('fullscreen-return-active',visible);
}
fullscreenButton.addEventListener('click',async () => {
  if (!await restorePlayerFullscreen(preferredPlayerOrientation())) toast('El navegador no permite activar la pantalla completa. Puedes seguir jugando.');
  updateFullscreenButton(); fitViewport();
});
document.addEventListener('fullscreenchange',() => { updateFullscreenButton(); fitViewport(); });
function goTo(view, replace = false) {
  local.view = view;
  if (history.state?.bingoView !== view) history[replace ? 'replaceState' : 'pushState']({ bingoView: view },'',location.href);
  syncPlayerOrientation(); render(); showNoNumberNotice();
}
async function action(type,payload = {}) {
  try { await net.request(type,{...payload,roundId:state?.roundId,turn:state?.turn}); return true; }
  catch (error) { toast(error); return false; }
}
async function enterSession(payload) {
  if (payload.role === 'tv') { releasePlayerOrientation(); appliedOrientation = null; }
  try { await net.identify(payload); local.editing = false; goTo('session'); return true; }
  catch (error) {
    if (error.code === 'CONFIRM_TAKEOVER') {
      const player = state.players.find(player => player.id === payload.claimPlayerId);
      if (!player) return false;
      openModal({kind:'takeover',title:'¿Eres tú?',body:`${views.avatar(player.avatar)}<p><strong>${views.escape(player.name)}</strong> está conectado. Recuperarás sus cartones y se cerrará su pantalla anterior.</p>`,confirm:'Recuperar jugador',run:() => enterSession({...payload,force:true})});
    } else toast(error);
    return false;
  }
}
async function choosePlayer() {
  appliedOrientation = 'portrait';
  requestPlayerPortrait();
  if (state.phase !== 'lobby') { goTo('players'); return; }
  const token = net.playerToken();
  if (token) {
    try { await net.identify({role:'player',token}); local.editing = false; goTo('session'); return; }
    catch (error) { if (error.code !== 'SESSION_EXPIRED') { toast(error); return; } net.clearPlayerToken(token); }
  }
  enterSession({role:'player'});
}
async function previousView() {
  if (history.state?.bingoView && local.view !== 'choose') history.back();
  else {
    local.view = 'choose'; await net.identify({role:'guest'}).catch(toast); goTo('choose',true);
  }
}
function handleBack() {
  if (modal) { closeModal(); return true; }
  if (revoked) { location.reload(); return true; }
  if (!state) return false;
  if (local.view === 'choose') { location.href = '/'; return true; }
  if (local.view === 'session' && state.role === 'tv' && state.phase === 'results') { action('reset'); return true; }
  if (local.view === 'session' && ['drawing','marking'].includes(state.phase)) {
    openModal({kind:'back',title:'¿Cambiar de pantalla?',body:'<p>La partida seguirá con los demás. Podrás elegir tu jugador para recuperar tus cartones.</p>',confirm:'Volver a selección',run:previousView});
  } else previousView();
  return true;
}
window.addEventListener('popstate', async event => {
  if (local.view === 'session' && state?.role === 'tv' && state.phase === 'results') { await action('reset'); return; }
  const target = event.state?.bingoView;
  local.view = target === 'players' && state?.phase !== 'lobby' ? 'players' : 'choose';
  local.editing = false; closeModal();
  if (state?.role !== 'guest') await net.identify({role:'guest'}).catch(toast);
  render();
});

function currentScreen() {
  if (local.view === 'choose') return ['choose',views.chooseScreen()];
  if (local.view === 'players') return ['players',views.playerSelection(state)];
  if (state.role === 'guest') return ['choose',views.chooseScreen()];
  if (state.phase === 'results') return ['results',views.resultsScreen(state)];
  if (state.phase !== 'lobby') return [state.role === 'tv' ? 'tv-game' : 'player-game',state.role === 'tv' ? views.tvGame(state) : views.playerGame(state,local.selectedCard)];
  if (state.role === 'tv') return ['lobby',views.tvLobby(state)];
  return !state.me.ready || local.editing ? ['profile',views.profileScreen(local)] : ['ready',views.readyScreen(state)];
}
function render() {
  if (!state) return;
  if (pointerActive) { pendingRender = true; return; }
  pendingRender = false;
  if (!revoked && local.view === 'choose' && app.dataset.screen === 'choose') { fitViewport(); renderConnection(); return; }
  // Un cambio de viewport o de lista de jugadores no vuelve a enfocar el nombre.
  // Mantener el nodo evita reabrir el teclado que el usuario acaba de cerrar.
  if (!revoked && app.dataset.screen === 'profile' && local.view === 'session' && state.role === 'player' && state.phase === 'lobby' && (!state.me.ready || local.editing) && profilePlayerId === state.me.id) {
    updateProfileSelection(); fitViewport(); renderConnection(); return;
  }
  scroller.stop();
  if (revoked) {
    app.dataset.screen = 'revoked'; app.innerHTML = '<section class="revoked-screen"><h1>Tu jugador está en otro dispositivo</h1><p>Sus cartones están a salvo. Esta pantalla se ha desconectado.</p><button class="btn" id="return-selection">Volver a selección</button></section>';
    document.querySelector('#return-selection').onclick = () => location.reload(); renderConnection(); return;
  }
  const focus = captureFocus(app);
  const oldStage = document.querySelector('#presenter-stage');
  const [screen,html] = currentScreen();
  app.dataset.screen = screen; app.dataset.turn = String(state.turn);
  app.innerHTML = html;
  profilePlayerId = screen === 'profile' ? state.me.id : null;
  if (oldStage && document.querySelector('#presenter-stage')) document.querySelector('#presenter-stage').replaceWith(oldStage);
  bind(); if (screen !== 'profile') restoreFocus(app,focus);
  fitViewport(); scroller.mount(app); updateScene(); renderConnection();
  if (modal?.kind === 'start') drawModal(false);
}
function updateProfileSelection() {
  for (const button of app.querySelectorAll('[data-avatar]')) {
    const selected = Number(button.dataset.avatar) === local.avatar;
    button.classList.toggle('selected',selected); button.setAttribute('aria-pressed',String(selected));
  }
}
document.addEventListener('pointerdown', event => { if (app.contains(event.target) || dialogs.contains(event.target)) pointerActive = true; }, true);
const finishPointer = () => { pointerActive = false; setTimeout(() => { if (pendingRender) render(); },0); };
document.addEventListener('pointerup',finishPointer,true);
document.addEventListener('pointercancel',finishPointer,true);
function bind() {
  app.querySelectorAll('[data-back]').forEach(button => button.onclick = handleBack);
  app.querySelector('[data-role="tv"]')?.addEventListener('click',() => enterSession({role:'tv'}));
  app.querySelector('[data-role="player"]')?.addEventListener('click',choosePlayer);
  app.querySelectorAll('[data-claim]').forEach(button => button.onclick = () => enterSession({role:'player',claimPlayerId:button.dataset.claim}));
  app.querySelectorAll('[data-step]').forEach(button => button.onclick = () => action('settings',{cardsPerPlayer:state.settings.cardsPerPlayer + Number(button.dataset.step)}));
  app.querySelector('#effects')?.addEventListener('change',event => action('settings',{effects:event.target.checked}));
  app.querySelector('#start')?.addEventListener('click',() => openModal({kind:'start',title:'¿Empezamos?',confirm:'Empezar partida',run:() => action('start')}));
  app.querySelector('#cancel')?.addEventListener('click',() => openModal({kind:'cancel',title:'¿Cancelar la partida?',body:'<p>Se borrarán los jugadores, los cartones y las victorias de esta sesión.</p>',confirm:'Cancelar partida',run:() => action('cancel')}));
  app.querySelector('#restart')?.addEventListener('click',() => action('restart'));
  app.querySelector('#reset')?.addEventListener('click',() => action('reset'));
  app.querySelector('#edit-profile')?.addEventListener('click',() => { local.editing = true; render(); });
  app.querySelector('#player-name')?.addEventListener('input',event => { local.name = event.target.value; });
  app.querySelectorAll('[data-avatar]').forEach(button => button.onclick = () => { document.querySelector('#player-name')?.blur(); local.avatar = Number(button.dataset.avatar); updateProfileSelection(); });
  app.querySelector('#profile')?.addEventListener('submit',async event => { event.preventDefault(); if (await action('profile',{name:local.name,avatar:local.avatar})) { local.editing = false; render(); } });
  app.querySelectorAll('[data-card]').forEach(button => button.onclick = () => { local.selectedCard = Number(button.dataset.card); render(); });
  app.querySelectorAll('[data-number]').forEach(button => button.onclick = () => action('mark',{card:local.selectedCard,number:Number(button.dataset.number)}));
  app.querySelector('#continue')?.addEventListener('click',() => action('continue'));
}
function showNoNumberNotice() {
  if (local.view !== 'session' || state.role !== 'player' || !state.me?.playing || state.phase !== 'marking' || state.me.continued || modal) return;
  const key = `${state.roundId}:${state.turn}:${state.me.id}`;
  if (key === noNumberNotice || state.me.cards.some(card => card.includes(state.current)) || state.me.cards.some((_,i) => views.pendingOnCard(state,i).length)) return;
  noNumberNotice = key;
  openModal({kind:'no-number',title:'No ha salido tu número',body:`<p>El <strong>${state.current}</strong> no está en tus cartones. Pulsa Continuar para esperar la próxima bola.</p>`,confirm:'Continuar →',run:() => action('continue')});
}
function openModal(data) { modalFocus = document.activeElement; modal = data; drawModal(true); }
function closeModal() {
  modal = null; dialogs.replaceChildren();
  if (modalFocus?.isConnected) modalFocus.focus({preventScroll:true}); modalFocus = null;
}
function drawModal(focus) {
  if (!modal) return;
  const ready = state.players.filter(player => player.ready && player.online).length;
  const body = modal.kind === 'start' ? `<p>Hay <strong>${ready} jugador${ready === 1 ? '' : 'es'}</strong> y ${state.settings.cardsPerPlayer} cartones por persona. ¿Estamos todos?</p>` : modal.body;
  dialogs.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">${modal.title}</h2>${body}<div class="modal-actions">${modal.kind === 'no-number' ? '' : '<button class="btn secondary" id="modal-cancel">Volver</button>'}<button class="btn green" id="modal-confirm" ${modal.kind === 'start' && !ready ? 'disabled' : ''}>${modal.confirm}</button></div></section></div>`;
  dialogs.querySelector('#modal-cancel')?.addEventListener('click',closeModal);
  dialogs.querySelector('#modal-confirm').onclick = async () => { const run = modal.run; closeModal(); await run(); };
  if (focus) (dialogs.querySelector('#modal-cancel') || dialogs.querySelector('#modal-confirm')).focus({preventScroll:true});
}
document.addEventListener('keydown',event => {
  if (!modal || event.key !== 'Tab') return;
  const buttons = [...dialogs.querySelectorAll('button:not(:disabled)')];
  if (event.shiftKey && document.activeElement === buttons[0]) { buttons.at(-1).focus(); event.preventDefault(); }
  else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { buttons[0].focus(); event.preventDefault(); }
});
async function updateScene() {
  const slot = document.querySelector('#presenter-stage');
  const enabled = slot && state.settings.effects && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!enabled) { sceneGeneration++; renderer?.dispose(); renderer = null; rendererLoad = null; loadingSlot = null; return; }
  if (renderer) { renderer.update(state); return; }
  if (rendererLoad && loadingSlot === slot) return;
  const generation = ++sceneGeneration;
  loadingSlot = slot;
  const pending = (async () => {
    try {
      rendererModule ||= import('./presenter.js'); const module = await rendererModule;
      if (generation !== sceneGeneration || !slot.isConnected) return;
      const mounted = await module.mountPresenter(slot);
      if (generation !== sceneGeneration || !slot.isConnected) { mounted.dispose(); return; }
      renderer = mounted; renderer.update(state);
    } catch { /* Si la carga o WebGL falla, permanece la ilustración estática. */ }
    finally { if (rendererLoad === pending) { rendererLoad = null; loadingSlot = null; } }
  })();
  rendererLoad = pending;
}
window.addEventListener('pagehide',() => { sceneGeneration++; scroller.stop(); renderer?.dispose(); net.stop(); });
window.addEventListener('pageshow',event => { if (event.persisted) location.reload(); });
