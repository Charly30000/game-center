export const colors = ['#ba5038','#23746c','#b58b29','#7e689b','#5d7f42'];
export const avatarNames = ['Leo','Luna','Abuela','Abuelo','Valentina','Perrito','Gato','Panda','Zorro','Rana','Robot azul','Robot coral','Alien','Astronauta','Dinosaurio','León','Conejo','Pingüino','Mateo','Sofía'];
export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const avatar = id => `<img src="./assets/avatars/${Number.isInteger(id) ? id : 0}.webp" alt="${avatarNames[id] || 'Personaje'}" width="160" height="160">`;

export function playerCard(player, selectable = false) {
  const tag = selectable ? 'button' : 'article';
  return `<${tag} class="player-card ${player.ready ? '' : 'draft'} ${player.online ? '' : 'offline'}" ${selectable ? `data-claim="${player.id}"` : ''}>
    ${player.wins ? `<span class="wins">★ ${player.wins}</span>` : ''}
    ${player.ready ? avatar(player.avatar) : '<span class="avatar-placeholder" aria-hidden="true">☺</span>'}
    <strong class="player-name">${escape(player.name || 'Eligiendo personaje…')}</strong>
    <span class="player-status">${!player.ready ? 'Preparándose' : player.online ? selectable ? 'Conectado · recuperar' : '✓ Conectado' : 'Sin conexión · recuperar'}</span>
  </${tag}>`;
}
function toolbar(title, subtitle = '', extra = '') {
  return `<div class="view-toolbar"><button class="back" data-back aria-label="Volver a la pantalla anterior">← <span>Volver</span></button><div class="view-title"><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${extra}</div>`;
}
function scroller(players, key, { horizontal = false, selectable = false } = {}) {
  return `<div class="scroll-region ${horizontal ? 'card-rail' : 'card-grid'}" ${selectable ? '' : `data-auto-scroll="${key}" data-axis="${horizontal ? 'x' : 'y'}"`} aria-label="${selectable ? 'Elige un jugador' : 'Jugadores'}">${players.map(player => playerCard(player,selectable)).join('')}</div>`;
}
function presenterStage(extra = '') {
  return `<div id="presenter-stage" class="presenter-stage ${extra}"><span class="presenter-sign" aria-hidden="true">BINGO</span><div class="presenter-viewport"><img src="./assets/presenter-static.webp?v=illustration-1" alt="Presentador de chaleco rojo junto al bombo dorado"></div></div>`;
}
export function chooseScreen() {
  return `<div class="view-toolbar"><a class="back" href="/">← Centro de juegos</a></div>
    <div class="role-intro"><span class="eyebrow">Bingo en familia</span><h1>Cada pantalla tiene <span>su papel.</span></h1><p>Una tele para compartirlo todo. Un móvil para guardar tus números.</p></div>
    <div class="role-options screen-body">
      <button class="role-card" data-role="tv"><span class="role-picture"><img src="./assets/presenter-static.webp?v=illustration-1" alt="Presentador de chaleco rojo junto al bombo dorado"></span><span class="role-kicker">La pantalla de todos</span><strong>Televisión</strong><span>Prepara la partida, sigue las bolas y celebra cada bingo.</span></button>
      <button class="role-card" data-role="player"><span class="role-picture player-picture"><span class="mini-ticket" aria-hidden="true">${[7,12,25,40,83,9,18,32,55,90].map(number=>`<span>${number}</span>`).join('')}</span></span><span class="role-kicker">Tus cartones, tu suerte</span><strong>Jugador</strong><span>Dispositivo móvil. Elige tu personaje y prepárate para marcar.</span></button>
    </div><p class="view-footnote">Una misma Wi-Fi. Una buena partida.</p>`;
}
export function playerSelection(state) {
  const players = state.players.filter(player => player.ready);
  return `${toolbar('Elige tu jugador','Toca tu nombre para recuperar tus cartones.')}
    <section class="screen-body player-selection"><div class="scroll-region card-grid selection-grid" aria-label="Jugadores disponibles">
    ${players.map(player => playerCard(player,true)).join('')}</div>
    ${!players.length && state.phase !== 'lobby' ? '<p class="empty">No hay jugadores disponibles para recuperar.</p>' : ''}</section>`;
}
export function profileScreen(local) {
  return `${toolbar('Tu nombre y tu personaje')}
    <form id="profile" class="screen-body profile-form">
      <div class="profile-details"><label for="player-name">Nombre <span>(3–40 caracteres)</span></label><input id="player-name" class="name-input" name="name" minlength="3" maxlength="40" required autocomplete="nickname" value="${escape(local.name)}" placeholder="Tu nombre de la suerte"><p class="profile-note">El nombre es único. El personaje puede repetirse.</p><button class="btn green" type="submit">Confirmar jugador ✓</button></div>
      <div class="avatar-field"><span class="field-label">Elige tu personaje</span><div class="avatars">${avatarNames.map((name,i) => `<button type="button" class="avatar-option ${local.avatar === i ? 'selected' : ''}" data-avatar="${i}" aria-label="${name}" aria-pressed="${local.avatar === i}">${avatar(i)}</button>`).join('')}</div></div>
    </form>`;
}
export function readyScreen(state) {
  const player = state.players.find(player => player.id === state.me.id);
  return `${toolbar('¡Todo listo!', 'La partida empieza desde la televisión.')}
    <section class="screen-body ready-content">${playerCard(player)}<div><h2>Un buen sitio en el sofá…</h2><p>Ya estás en el equipo. La televisión mostrará cuándo empieza la partida.</p><button class="btn secondary" id="edit-profile">Cambiar personaje o nombre</button></div></section>`;
}
export function tvLobby(state) {
  const ready = state.players.filter(player => player.ready && player.online).length;
  return `${toolbar('¿Estamos todos?', 'Confirma tu personaje desde el móvil.')}
    <div class="screen-body lobby-layout"><section class="roster-panel"><div class="panel-heading"><h2>Vuestro equipo <span class="count">${state.players.length}</span></h2><span class="scroll-hint">${state.players.length > 6 ? 'Se desplaza automáticamente' : ''}</span></div>
    ${state.players.length ? scroller(state.players,'lobby') : '<div class="lobby-empty"><span aria-hidden="true">☺ + ☺</span><h3>Falta el equipo</h3><p>Abrid Bingo en cada móvil y elegid Jugador.</p></div>'}
    <p class="join-hint">En cada móvil: <strong>${escape(location.origin)}</strong></p></section>
    <aside class="rules"><div><h2>Las reglas de casa</h2><p>90 bolas. Gana el primer cartón completo.</p></div>
      <div class="card-counter"><div><strong>Cartones por jugador</strong><small>Entre 1 y 5 cartones.</small></div><div class="stepper"><button data-step="1" aria-label="Aumentar cartones" ${state.settings.cardsPerPlayer === 5 ? 'disabled' : ''}><img src="./assets/arrow.svg" alt=""></button><strong>${state.settings.cardsPerPlayer}</strong><button data-step="-1" class="down" aria-label="Reducir cartones" ${state.settings.cardsPerPlayer === 1 ? 'disabled' : ''}><img src="./assets/arrow.svg" alt=""></button></div></div>
      <label class="effects-option"><input id="effects" type="checkbox" ${state.settings.effects ? 'checked' : ''}><span>Modelos 3D y animaciones<small>Desactívalos si la tele va despacio.</small></span></label>
      <button class="btn green" id="start" ${ready ? '' : 'disabled'}>¡Empezar partida! ↗</button></aside></div>`;
}
export function tvGame(state) {
  const players = state.players.filter(player => player.playing && player.online && (state.phase === 'drawing' || !player.continued));
  return `${toolbar(state.phase === 'drawing' ? 'La suerte está girando…' : '¿Lo tienes?', `${state.called.length} de 90 bolas`, '<button class="btn secondary cancel-button" id="cancel">Cancelar partida</button>')}
    <div class="screen-body tv-layout"><div class="board-space"><section class="number-board" aria-label="Tablero de números extraídos">${Array.from({length:90},(_,i) => `<span class="board-ball ${state.called.includes(i+1) ? 'called' : ''} ${state.current === i+1 ? 'current' : ''}" aria-label="${state.called.includes(i+1) ? `Ha salido el ${i+1}` : 'Bola sin salir'}">${state.called.includes(i+1) ? i+1 : ''}</span>`).join('')}</section></div>
      <section class="presenter-section">${presenterStage()}<div class="ball-caption"><span class="current-ball">${state.current ?? '•••'}</span><p>${state.phase === 'drawing' ? 'Sacando la próxima bola' : 'Marca tus números y pulsa Continuar'}</p></div></section></div>
    <section class="waiting-panel"><div class="panel-heading"><h2>${state.phase === 'drawing' ? 'Jugando' : players.length ? 'Esperando a…' : 'Esperando que vuelva un jugador'} <span class="count">${players.length}</span></h2></div>${scroller(players,'waiting',{horizontal:true})}</section>`;
}
export function pendingOnCard(state,index) {
  return state.me.cards[index].filter(number => number && state.called.includes(number) && !state.me.marks[index].includes(number));
}
export function playerGame(state,selectedCard) {
  const me = state.me;
  if (!me.playing) return `${toolbar('Esta vez, de público.')}<div class="screen-body spectator"><p>No estabas conectado al comenzar. Podrás jugar la siguiente.</p></div>`;
  const card = me.cards[selectedCard], marks = me.marks[selectedCard], drawing = state.phase === 'drawing';
  const pending = me.cards.some((_,i) => pendingOnCard(state,i).length);
  const hint = drawing ? 'El bombo está girando.' : me.continued ? '¡Listo! Esperamos al resto.' : pending ? 'Marca los números iluminados de todos tus cartones.' : 'Todo listo. Pulsa Continuar.';
  return `<div class="player-game-header"><button class="back" data-back aria-label="Volver a la selección de jugador">←</button><div class="player-identity">${avatar(me.avatar)}<strong>${escape(me.name)}</strong></div><div class="turn-banner"><span>${drawing ? 'Esperando número' : 'Ha salido el'}</span><span class="mini-ball">${state.current ?? '·'}</span></div></div>
    <div class="screen-body player-playfield"><nav class="ticket-tabs" aria-label="Tus cartones" style="--card-count:${me.cards.length}">${me.cards.map((_,i) => `<button class="ticket-tab ${selectedCard === i ? 'active' : ''} ${!drawing && pendingOnCard(state,i).length ? 'pending' : ''}" data-card="${i}" style="--ticket-color:${colors[i]}" aria-label="Cartón ${i+1}, ${me.marks[i].length} de 15 marcados" aria-pressed="${selectedCard === i}"><strong><span class="ticket-word">Cartón </span>${i+1}</strong><small>${me.marks[i].length}/15</small></button>`).join('')}</nav>
    <section class="traditional-ticket" aria-label="Cartón ${selectedCard+1}" style="--ticket-color:${colors[selectedCard]}"><div class="ticket-print-heading"><strong>BINGO</strong><span>EN FAMILIA · 90 BOLAS</span><span>Nº ${selectedCard+1}</span></div><div class="ticket-grid">${card.map(number => {
      const marked = number && marks.includes(number), canMark = number && !marked && !drawing && state.called.includes(number);
      return `<button class="ticket-cell ${number ? marked ? 'punched' : canMark ? 'pending' : '' : 'blank'}" ${canMark ? `data-number="${number}"` : 'disabled'} aria-label="${number ? `${number}${marked ? ', marcado' : canMark ? ', pulsa para marcar' : ', todavía no ha salido'}` : 'Casilla vacía'}">${number ? `<span class="ticket-number">${number}</span>` : ''}</button>`;
    }).join('')}</div><div class="ticket-print-footer"><span>LA SUERTE SE COMPARTE</span><span>15 NÚMEROS · CARTÓN ${selectedCard+1}</span></div></section>
    ${drawing ? '<div class="draw-overlay"><span class="spinner"></span><strong>Esperando número…</strong></div>' : ''}</div>
    <div class="player-actions"><p>${hint}</p><button class="btn green" id="continue" ${drawing || pending || me.continued ? 'disabled' : ''}>${me.continued ? '✓ Preparado' : 'Continuar →'}</button></div>`;
}
export function resultsScreen(state) {
  const tv = state.role === 'tv', won = state.winners.includes(state.me?.id), winners = state.players.filter(player => state.winners.includes(player.id));
  return `<div class="results-heading ${tv || won ? 'winner' : 'loser'}"><span class="eyebrow">Una buena partida merece otra</span><h1>${tv ? '¡Bingo!' : won ? '¡Ganaste!' : 'Perdiste…'}</h1><p>${winners.length > 1 ? '¡La suerte se comparte! Estos son los ganadores.' : 'El primer cartón completo ya tiene nombre.'}</p></div>
    <div class="screen-body results-cards ${tv && state.settings.effects ? 'has-presenter' : ''}">${scroller(winners,'winners')}${tv && state.settings.effects ? presenterStage('results-presenter') : ''}</div>
    <div class="results-actions">${tv ? '<button class="btn secondary" id="reset">Volver a selección</button><button class="btn green" id="restart">Otra partida ↗</button>' : '<p>La televisión prepara la revancha o vuelve a selección para todos.</p>'}</div>`;
}
