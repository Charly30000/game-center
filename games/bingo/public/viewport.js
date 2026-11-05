export function installViewportLayout(app) {
  let frame;
  function fit() {
    document.documentElement.style.setProperty('--visible-height', `${Math.floor(window.visualViewport?.height || innerHeight)}px`);
    const board = app.querySelector('.number-board');
    const space = app.querySelector('.board-space');
    if (board && space) {
      const width = Math.floor(Math.min(space.clientWidth, space.clientHeight * 10 / 9));
      board.style.width = `${width}px`; board.style.height = `${Math.floor(width * .9)}px`;
    }
    const ticket = app.querySelector('.traditional-ticket');
    const playfield = app.querySelector('.player-playfield');
    if (ticket && playfield) {
      const portrait = matchMedia('(max-width: 650px) and (orientation: portrait)').matches;
      const count = app.querySelectorAll('[data-card]').length;
      const compact = !portrait && playfield.clientHeight < count * 64 + (count - 1) * 10 + 6;
      app.dataset.ticketLayout = portrait ? 'strip' : compact ? 'grid' : 'list';
      if (compact) {
        // Repartir los botones antes de reducirlos: todos deben poder pulsarse.
        const availableRows = Math.max(1,Math.floor((playfield.clientHeight - 2) / 48));
        const columns = Math.min(count,Math.max(2,Math.ceil(count / availableRows))), rows = Math.ceil(count / columns);
        app.style.setProperty('--ticket-tab-columns',String(columns));
        app.style.setProperty('--ticket-tab-height',`${Math.max(44,Math.min(64,Math.floor((playfield.clientHeight - 6 - (rows - 1) * 4) / rows)))}px`);
        app.style.setProperty('--ticket-selector-width',`${columns * 48 + (columns - 1) * 4 + 6}px`);
      }
      const style = getComputedStyle(ticket);
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const heading = ticket.querySelector('.ticket-print-heading').offsetHeight;
      const footer = ticket.querySelector('.ticket-print-footer').offsetHeight;
      const gap = parseFloat(style.rowGap) || 0;
      const width = ticket.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const available = playfield.clientHeight - (portrait ? app.querySelector('.ticket-tabs').offsetHeight + (parseFloat(getComputedStyle(playfield).rowGap) || 0) : 0);
      const desired = Math.max(78,width / 9 * .74 * 3) + padding + borders + heading + footer + gap * 2;
      ticket.style.height = `${Math.floor(Math.min(available,desired))}px`;
    }
    const grid = app.querySelector('.ticket-grid');
    if (grid) {
      const size = Math.floor(Math.min((grid.clientWidth / 9 - 2) * .72, (grid.clientHeight / 3 - 2) * .78, 52));
      grid.style.setProperty('--number-size', `${Math.max(14,size)}px`);
    }
    const avatars = app.querySelector('.avatars');
    if (avatars) {
      const style = getComputedStyle(avatars);
      const columnGap = parseFloat(style.columnGap) || 0, rowGap = parseFloat(style.rowGap) || 0;
      const size = Math.floor(Math.min(88,(avatars.clientWidth - columnGap * 4) / 5,(avatars.clientHeight - rowGap * 3) / 4));
      avatars.style.setProperty('--avatar-size',`${Math.max(1,size)}px`);
    }
    const logo = app.querySelector('.mini-ticket');
    if (logo) {
      const picture = logo.parentElement, angle = Math.PI / 15;
      const width = logo.offsetWidth * Math.cos(angle) + logo.offsetHeight * Math.sin(angle);
      const height = logo.offsetHeight * Math.cos(angle) + logo.offsetWidth * Math.sin(angle);
      logo.style.setProperty('--ticket-logo-scale',String(Math.min(1,picture.clientWidth / width * .9,picture.clientHeight / height * .9)));
    }
  }
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
  const observer = new ResizeObserver(schedule); observer.observe(app);
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  return schedule;
}
