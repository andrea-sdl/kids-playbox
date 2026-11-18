// One set of buttons keeps its state and handlers as the phone rotates.
export function setupTravelControls(bar, header) {
  const center = bar.querySelector('.center-controls');
  const actions = bar.querySelector('#trail-actions');
  const toggle = bar.querySelector('#actions-toggle');
  const headerHome = header.parentNode;
  const headerNext = header.nextSibling;
  const mobile = matchMedia('(max-width: 650px), (pointer: coarse)');
  const buttons = [...actions.querySelectorAll('button'), ...header.querySelectorAll('button, a')];

  function expand(open) {
    toggle.setAttribute('aria-expanded', String(open));
    center.classList.toggle('expanded', open);
    actions.inert = center.classList.contains('compact') && !open;
  }

  function fit() {
    const split = mobile.matches && bar.clientWidth > 0;
    if (split && header.parentNode !== actions) actions.append(header);
    if (!split && header.parentNode === actions) headerHome.insertBefore(header, headerNext);
    const visible = buttons.filter((button) => button.getBoundingClientRect().width > 0);
    const gap = parseFloat(getComputedStyle(actions).columnGap) || 0;
    const needed =
      visible.reduce((width, button) => width + button.getBoundingClientRect().width, 0) +
      gap * Math.max(0, visible.length - 1);
    const compact = split && needed > center.clientWidth;
    if (center.classList.contains('compact') === compact) return;
    const focused = document.activeElement;
    center.classList.toggle('compact', compact);
    toggle.hidden = !compact;
    expand(false);
    if (compact && actions.contains(focused)) toggle.focus();
    if (!compact && focused === toggle) actions.querySelector('button:not([hidden])').focus();
  }

  toggle.onclick = () => expand(toggle.getAttribute('aria-expanded') !== 'true');
  center.addEventListener('click', (event) => {
    if (event.target === center) expand(false);
  });
  actions.addEventListener('click', (event) => {
    if (!center.classList.contains('expanded') || !event.target.closest('button, a')) return;
    expand(false);
    if (!document.querySelector('dialog[open]')) toggle.focus();
  });
  bar.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !center.classList.contains('expanded')) return;
    expand(false);
    toggle.focus();
    event.preventDefault();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!center.contains(event.target)) expand(false);
  });
  center.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !center.contains(event.relatedTarget)) expand(false);
  });
  const observer = new ResizeObserver(fit);
  for (const element of [bar, center, ...buttons]) observer.observe(element);
  mobile.addEventListener('change', fit);
  return fit;
}
