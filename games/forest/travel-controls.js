// Keep the same controls and keyboard focus when the toolbar changes layout.
export function setupTravelControls(toolbar) {
  const actions = toolbar.querySelector('.toolbar-items');
  const toggle = toolbar.querySelector('[aria-controls]');
  const buttons = [...actions.querySelectorAll('button, a')];

  function expand(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toolbar.classList.toggle('expanded', open);
    actions.inert = toolbar.classList.contains('compact') && !open;
  }

  function fit() {
    const visible = buttons.filter((button) => button.getBoundingClientRect().width > 0);
    const gap = parseFloat(getComputedStyle(actions).columnGap) || 0;
    const needed =
      visible.reduce((width, button) => width + button.getBoundingClientRect().width, 0) +
      gap * Math.max(0, visible.length - 1);
    const compact = needed > toolbar.clientWidth;
    if (toolbar.classList.contains('compact') === compact) return;
    const focused = document.activeElement;
    toolbar.classList.toggle('compact', compact);
    toggle.hidden = !compact;
    expand(false);
    if (compact && actions.contains(focused)) toggle.focus();
    if (!compact && focused === toggle) visible[0]?.focus();
  }

  toggle.onclick = () => expand(toggle.getAttribute('aria-expanded') !== 'true');
  actions.addEventListener('click', (event) => {
    if (!toolbar.classList.contains('expanded')) return;
    if (!event.composedPath().some((element) => buttons.includes(element))) return;
    expand(false);
    if (!document.querySelector('dialog[open]')) toggle.focus();
  });
  toolbar.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !toolbar.classList.contains('expanded')) return;
    expand(false);
    toggle.focus();
    event.preventDefault();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!toolbar.contains(event.target)) expand(false);
  });
  toolbar.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !toolbar.contains(event.relatedTarget)) expand(false);
  });
  const observer = new ResizeObserver(fit);
  for (const element of [toolbar, ...buttons]) observer.observe(element);
  fit();
  return fit;
}
