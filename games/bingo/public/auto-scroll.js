// Conserva la posición al recibir estado y cede el control al tacto, rueda o mando.
export function createCardScroller() {
  const saved = new Map();
  let animation, previous = 0, items = [];
  function stop() {
    cancelAnimationFrame(animation);
    for (const item of items) saved.set(item.key, { position: item.axis === 'x' ? item.node.scrollLeft : item.node.scrollTop, direction: item.direction, pauseUntil: item.pauseUntil });
    items = [];
  }
  function mount(root) {
    stop();
    for (const node of root.querySelectorAll('[data-auto-scroll]')) {
      const key = node.dataset.autoScroll, axis = node.dataset.axis || 'y', old = saved.get(key);
      const item = { node, key, axis, position: old?.position || 0, direction: old?.direction || 1, pauseUntil: old?.pauseUntil || performance.now() + 2400 };
      if (axis === 'x') node.scrollLeft = old?.position || 0; else node.scrollTop = old?.position || 0;
      for (const name of ['pointerdown','wheel','keydown','focusin']) node.addEventListener(name, () => { item.pauseUntil = performance.now() + 9000; }, { passive: true });
      items.push(item);
    }
    previous = performance.now();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function tick(time) {
      const elapsed = Math.min(100,time - previous); previous = time;
      if (!document.hidden && !reduced) for (const item of items) {
        const limit = item.axis === 'x' ? item.node.scrollWidth - item.node.clientWidth : item.node.scrollHeight - item.node.clientHeight;
        if (limit <= 1 || time < item.pauseUntil) { item.position = item.axis === 'x' ? item.node.scrollLeft : item.node.scrollTop; continue; }
        const next = Math.max(0,Math.min(limit,item.position + item.direction * elapsed * .024));
        item.position = next;
        if (item.axis === 'x') item.node.scrollLeft = next; else item.node.scrollTop = next;
        if (next <= 0 || next >= limit - 1) { item.direction *= -1; item.pauseUntil = time + 2400; }
      }
      animation = requestAnimationFrame(tick);
    }
    if (items.length && !reduced) animation = requestAnimationFrame(tick);
  }
  return { mount, stop };
}
