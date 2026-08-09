/* SHOP sub-page runtime — N2J TRINI
 * Reveal on scroll and nothing else. Everything visual lives in shop-motion.css.
 */
(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // The `.js` guard: if this script never runs, every element stays visible rather
  // than being hidden by a stylesheet waiting for a class that will not arrive.
  root.classList.add('js');

  // `.commerce` is deliberately NOT revealed. It wraps the Imweb widget, and an
  // element under `transform` becomes a containing block — which would break any
  // `position: fixed` option sheet or cart drawer the widget opens. Revealing the
  // order block is also the least justifiable animation on a page that sells.
  const targets = [
    ...document.querySelectorAll('.banner__plate, .spec, .close'),
  ];
  targets.forEach((el) => el.classList.add('reveal'));

  const settle = (el) => el.classList.add('is-visible');

  if (reduced.matches || !('IntersectionObserver' in window)) {
    targets.forEach(settle);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      settle(entry.target);
      observer.unobserve(entry.target);
    }),
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );

  targets.forEach((el) => {
    // Anything already on screen at load settles immediately — a first paint should
    // never wait on a scroll the visitor has no reason to make.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) settle(el);
    else observer.observe(el);
  });

  reduced.addEventListener('change', () => {
    if (reduced.matches) targets.forEach(settle);
  });
})();
