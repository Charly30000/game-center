import { installRemoteNavigation } from '/shared/remote-navigation.js';
import { mountConnection } from './connection.js';

mountConnection();

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
      article.innerHTML = '<span class="game-cover"></span><span class="game-info"><span><strong></strong><small></small></span><span class="play-label" aria-hidden="true">↗</span></span>';
      article.querySelector('strong').textContent = game.title; article.querySelector('small').textContent = game.players;
      const cover = article.querySelector('.game-cover'), image = document.createElement('img');
      image.src = game.cover; image.alt = '';
      cover.replaceChildren(image);
      article.dataset.gameNumber = game.number;
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
