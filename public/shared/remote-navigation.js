const selector = 'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]';
const codes = { 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 13: 'Enter', 10009: 'Back', 461: 'Back', 27: 'Back' };
const names = { Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown', BrowserBack: 'Back', GoBack: 'Back', Escape: 'Back', Select: 'Enter' };
export function remoteKey(event) { return names[event.key] || codes[event.keyCode] || event.key; }

// Favorece controles alineados con la dirección; no depende del orden del DOM.
export function directionalTarget(origin, candidates, direction) {
  const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight';
  const sign = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1;
  const center = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  const start = center(origin);
  let best = null, score = Infinity;
  for (const candidate of candidates) {
    const rect = candidate.rect, point = center(rect);
    const along = (horizontal ? point.x - start.x : point.y - start.y) * sign;
    if (along <= 1) continue;
    const across = Math.abs(horizontal ? point.y - start.y : point.x - start.x);
    const aligned = horizontal ? rect.top < origin.top + origin.height && rect.top + rect.height > origin.top : rect.left < origin.left + origin.width && rect.left + rect.width > origin.left;
    const rank = along + across * 3 + (aligned ? 0 : 10000);
    if (rank < score) { best = candidate.element; score = rank; }
  }
  return best;
}
function controls(root) {
    return [...root.querySelectorAll(selector)].filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert]'));
}
export function captureFocus(root) {
  const active = document.activeElement;
  if (!root.contains(active)) return null;
  return { id: active.id, attributes: [...active.attributes].filter(attribute => attribute.name.startsWith('data-')).map(attribute => [attribute.name, attribute.value]), index: controls(root).indexOf(active) };
}
export function restoreFocus(root, snapshot) {
  if (!snapshot) return;
  const items = controls(root);
  const target = snapshot.id ? items.find(item => item.id === snapshot.id) : snapshot.attributes.length ? items.find(item => snapshot.attributes.every(([name, value]) => item.getAttribute(name) === value)) : items[snapshot.index];
  (target || items[Math.min(snapshot.index, items.length - 1)])?.focus({ preventScroll: true });
}
export function installRemoteNavigation({ preferred = () => null, onBack = () => false } = {}) {
  const keydown = event => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = remoteKey(event);
    const editable = event.target instanceof HTMLElement && (event.target.isContentEditable || ['TEXTAREA', 'SELECT'].includes(event.target.tagName) || (event.target.tagName === 'INPUT' && event.target.type !== 'checkbox'));
    if (editable && key !== 'Back') return;
    if (key === 'Back') { if (onBack()) { event.preventDefault(); event.stopPropagation(); } return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(key)) return;
    const scope = document.querySelector('[aria-modal="true"]') || document;
    const items = controls(scope);
    if (!items.length || document.querySelector('.net-block')) return;
    document.body.classList.add('remote-navigation'); event.preventDefault();
    const active = document.activeElement;
    if (!items.includes(active)) { (items.includes(preferred()) ? preferred() : items[0]).focus({ preventScroll: true }); return; }
    if (key === 'Enter') { if (!event.repeat) active.click(); return; }
    const target = directionalTarget(active.getBoundingClientRect(), items.filter(item => item !== active).map(element => ({ element, rect: element.getBoundingClientRect() })), key);
    if (target) {
      target.focus({ preventScroll: true });
      const region = target.closest('.scroll-region');
      if (region) {
        const bounds = region.getBoundingClientRect(), rect = target.getBoundingClientRect();
        if (rect.bottom > bounds.bottom) region.scrollTop += rect.bottom - bounds.bottom + 8;
        if (rect.top < bounds.top) region.scrollTop -= bounds.top - rect.top + 8;
      }
    }
  };
  document.addEventListener('keydown', keydown);
  document.addEventListener('pointerdown', () => document.body.classList.remove('remote-navigation'));
}
