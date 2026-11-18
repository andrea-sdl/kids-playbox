// Keep the same controls and keyboard focus when the toolbar changes layout.
export function setupTravelControls(header) {
  const actions = header.querySelector('#trail-actions');
  const toggle = header.querySelector('#actions-toggle');
  const buttons = [...actions.querySelectorAll('button, a')];

  function expand(open) {
    toggle.setAttribute('aria-expanded', String(open));
    header.classList.toggle('expanded', open);
    actions.inert = header.classList.contains('compact') && !open;
  }

  function fit() {
    const visible = buttons.filter((button) => button.getBoundingClientRect().width > 0);
    const gap = parseFloat(getComputedStyle(actions).columnGap) || 0;
    const needed =
      visible.reduce((width, button) => width + button.getBoundingClientRect().width, 0) +
      gap * Math.max(0, visible.length - 1);
    const compact = needed > header.clientWidth;
    if (header.classList.contains('compact') === compact) return;
    const focused = document.activeElement;
    header.classList.toggle('compact', compact);
    toggle.hidden = !compact;
    expand(false);
    if (compact && actions.contains(focused)) toggle.focus();
    if (!compact && focused === toggle) visible[0]?.focus();
  }

  toggle.onclick = () => expand(toggle.getAttribute('aria-expanded') !== 'true');
  actions.addEventListener('click', (event) => {
    if (!header.classList.contains('expanded')) return;
    if (!event.composedPath().some((element) => buttons.includes(element))) return;
    expand(false);
    if (!document.querySelector('dialog[open]')) toggle.focus();
  });
  header.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !header.classList.contains('expanded')) return;
    expand(false);
    toggle.focus();
    event.preventDefault();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!header.contains(event.target)) expand(false);
  });
  header.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) expand(false);
  });
  const observer = new ResizeObserver(fit);
  for (const element of [header, ...buttons]) observer.observe(element);
  fit();
  return fit;
}
