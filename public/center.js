import { installRemoteNavigation } from '/shared/remote-navigation.js';

const catalog = document.querySelector('#catalog');
installRemoteNavigation({ preferred: () => catalog.querySelector('button') });
const notice = document.querySelector('#notice');
let installPrompt;
const toast = message => { notice.className = 'toast'; notice.textContent = message; setTimeout(() => { notice.className = ''; notice.textContent = ''; }, 6500); };
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
document.querySelector('#install').addEventListener('click', async () => {
  if (installPrompt) { await installPrompt.prompt(); installPrompt = null; }
  else toast(location.protocol === 'http:' && location.hostname !== 'localhost' ? 'Para instalar desde otro dispositivo necesitas HTTPS. Puedes seguir jugando desde el navegador.' : 'En el menú de tu navegador elige «Instalar aplicación» o «Añadir a la pantalla de inicio». En iPhone está en Compartir.');
});
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});
async function load() {
  try {
    const response = await fetch('/api/games');
    if (!response.ok) throw new Error();
    const games = await response.json();
    catalog.replaceChildren();
    for (const game of games) {
      const article = document.createElement('button'); article.className = 'game-card';
      article.setAttribute('aria-label', `Jugar a ${game.title}`);
      article.innerHTML = '<span class="game-cover bingo-cover"><svg class="bingo-cover-logo" viewBox="0 0 360 230" aria-hidden="true"><rect width="360" height="230" fill="#f1dbc3"/><image href="/games/bingo/assets/presenter-cover.webp?v=1" x="113" y="42" width="244" height="180"/><rect x="14" y="14" width="147" height="21" rx="5" fill="#fffdf6" opacity=".9"/><text x="22" y="28" font-family="Fredoka,sans-serif" font-size="9" fill="#3c403b">PARA TODA LA FAMILIA</text><g transform="rotate(-9 70 106)" fill="#d95d38" font-family="Fredoka,sans-serif" font-size="56" font-weight="600" stroke="#fff6e4" stroke-width="1"><text x="22" y="91">BIN</text><text x="22" y="141">GO!</text></g><g transform="rotate(-10 68 187)"><circle cx="68" cy="187" r="27" fill="#faf7ef" stroke="#f4c95e" stroke-width="9"/><text x="68" y="196" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="25" fill="#282c35">90</text></g></svg></span><span class="game-info"><span><strong></strong><small></small></span><span class="play-label" aria-hidden="true">↗</span></span>';
      article.querySelector('strong').textContent = game.title; article.querySelector('small').textContent = game.players;
      article.dataset.players = game.players;
      article.addEventListener('click', async event => {
        const button = event.currentTarget; button.disabled = true; button.querySelector('small').textContent = 'Preparando el juego…';
        try { const result = await fetch(`/api/games/${encodeURIComponent(game.id)}/launch`, { method: 'POST' }); const data = await result.json(); if (!result.ok) throw new Error(data.error); location.href = data.url; }
        catch (error) { toast(error.message || 'No se pudo conectar con el servidor.'); button.querySelector('small').textContent = 'Volver a intentar'; button.focus({ preventScroll: true }); }
        finally { button.disabled = false; }
      });
      catalog.append(article);
    }
    catalog.querySelector('button')?.focus({ preventScroll: true });
  } catch { catalog.innerHTML = '<p class="muted">No hay conexión con el centro. Conéctate a la Wi-Fi de casa y recarga la página.</p>'; }
}
load();
window.addEventListener('pageshow', () => {
  for (const button of catalog.querySelectorAll('button')) {
    button.disabled = false;
    button.querySelector('small').textContent = button.dataset.players;
  }
});
