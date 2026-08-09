/* Development layer — N2J TRINI architect preview
 * Additive only, loaded after app.js. Delete this file and develop.css, and revert
 * the two changed lines in app.js, to return to the baseline exactly.
 *
 * One job: bring the selected WHY tab into view.
 *
 * Below 901px main.css turns `.evidence-tabs` into a horizontal scroller whose
 * buttons are 40% of the rail, and develop.css fades its right edge. Selecting a tab
 * never scrolled it, so at 390 the third tab's label measured 45.8px hard-clipped
 * past the rail edge with its surviving 40.4px sitting entirely inside the fade —
 * reaching alpha 0 at its visible end. 99.5% destroyed. The user could not read which
 * criterion they had selected.
 *
 * The fade is right for a trailing tab and wrong for the active one. Scrolling the
 * selection into view resolves both without touching either rule.
 */
/* ---------------------------------------------------------- Transition smoothing
 * Measured, not guessed. Per chapter hop: 7-13 dropped frames and a worst frame of
 * 67-117ms at 1440x900, against 33-50ms at 390x844 with the CPU throttled 4x. Mobile
 * being smoother than desktop while running slower rules out JS — and PerformanceObserver
 * recorded zero long tasks. The cost scales with rendered area, which points at the
 * View Transition snapshot: 1440x900 is 8x the pixels of 390x844.
 *
 * Four elements carry `view-transition-name` during a hop; `.media-stage` is the
 * largest and holds a playing <video>. A live video forces the compositor to
 * re-rasterise its texture every frame while it is being snapshotted, and the
 * cross-fade shows the outgoing frame over the incoming one — which is the ghosting.
 *
 * Pausing playback for the length of the transition removes both. Nothing visual
 * changes: the frame on screen is the frame that was already there.
 */
(() => {
  const shell = document.querySelector('[data-site-shell]');
  if (!shell) return;

  let paused = [];

  const freeze = () => {
    paused = [...document.querySelectorAll('video')].filter((v) => !v.paused);
    paused.forEach((v) => v.pause());
  };

  const thaw = () => {
    // Resume ONLY what is in the chapter now on screen. Resuming everything that was
    // paused left all three videos decoding at once — app.js deliberately pauses the
    // ones off-screen, and undoing that traded a transition stall for a permanent one.
    paused.forEach((v) => {
      if (!v.closest('.chapter.is-active')) return;
      const play = v.play();
      if (play && typeof play.catch === 'function') play.catch(() => {});
    });
    paused = [];
  };

  // app.js marks the window with `is-transitioning`; observe it rather than racing it.
  new MutationObserver(() => {
    if (shell.classList.contains('is-transitioning')) freeze();
    else if (paused.length) thaw();
  }).observe(shell, { attributes: true, attributeFilter: ['class'] });
})();

/* ------------------------------------------------------------- SHOP CTA routing
 * The SHOP chapter's 쇼핑하기 button pointed at the Kakao channel regardless of which
 * product was selected. Each product now has its own page, so the CTA follows the
 * selection: PROMPT / CODING / LANDING.
 *
 * The inquiry channels stay where they are — they are a different action and both are
 * still reachable from the product pages.
 */
(() => {
  const cta = document.querySelector('[data-shop-cta]');
  if (!cta) return;

  const PAGES = { prompt: './shop/prompt.html', coding: './shop/coding.html', landing: './shop/landing.html' };

  // Reading `.is-current` on click was a frame behind — app.js moves the class after
  // the handler, so the CTA pointed at the previously selected product. The clicked
  // button is passed in directly; `.is-current` is only the fallback for first paint.
  const sync = (chosen) => {
    const current = chosen || document.querySelector('[data-shop-option].is-current');
    const id = current && current.dataset.shopOption;
    const href = PAGES[id];
    if (!href) return;
    cta.setAttribute('href', href);
    // It is an internal page now, so drop the new-tab treatment the channel link had.
    cta.removeAttribute('target');
    cta.removeAttribute('rel');
    // data-imweb-action would make develop's preview guard intercept a real page link.
    cta.removeAttribute('data-imweb-action');
  };

  sync();
  document.querySelectorAll('[data-shop-option]').forEach((button) => {
    button.addEventListener('click', () => sync(button));
  });
  window.addEventListener('hashchange', () => sync());
})();

/* --------------------------------------------------------- Video first-paint pop-in
 * Reported: after a CTA the typography appears and the video only arrives later.
 *
 * Only the INTRO hero had a `poster`. Every other video is `preload="metadata"`, so the
 * element has its box and no decoded frame — the chapter's text paints immediately and
 * the media plate stays empty until the first frame lands. The gap is the pop-in.
 *
 * A poster paints on the same frame as the text and the video takes over from it
 * invisibly. Sources are set by app.js at runtime, so the poster is attached whenever a
 * src appears rather than in the markup.
 */
(() => {
  const posterFor = (src) => {
    if (!src) return null;
    const clean = src.split('?')[0];
    return /\.mp4$/i.test(clean) ? clean.replace(/\.mp4$/i, '-poster.jpg') : null;
  };

  const attach = (video) => {
    if (!video || video.getAttribute('poster')) return;
    const poster = posterFor(video.currentSrc || video.getAttribute('src'));
    if (poster) video.setAttribute('poster', poster);
  };

  const sync = () => document.querySelectorAll('video').forEach(attach);

  sync();
  // app.js swaps `src` when a chapter or an option changes.
  new MutationObserver((records) => {
    records.forEach((r) => r.target instanceof HTMLVideoElement && attach(r.target));
  }).observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ['src'],
  });
  window.addEventListener('hashchange', sync);
})();

/* ------------------------------------------------- Index panel: entrance animation
 * Reproduced: open the menu, pick a chapter from it, reopen — the six chapter entries
 * are gone. Measured 6/6 visible on the first open, 0/6 on the second.
 *
 * app.js animates `.index-list li` from opacity 0 with Motion.animateMini. Choosing a
 * chapter closes the panel mid-flight, the animation is cancelled, and the inline
 * `opacity: 0` it wrote stays on the element. The next open starts from a list that is
 * already invisible, and an inline style beats any stylesheet rule.
 *
 * Two guards: wipe the stale inline state as the panel opens so the animation starts
 * clean, and re-check after the animation window in case it is cancelled again. If the
 * animation never runs at all, the items are simply visible — which is the correct
 * failure direction for a decorative entrance.
 */
(() => {
  const panel = document.querySelector('.index-panel');
  if (!panel) return;

  const items = () => panel.querySelectorAll('.index-list li, .index-utility a');

  const clearInline = () => items().forEach((el) => {
    el.style.removeProperty('opacity');
    el.style.removeProperty('transform');
  });

  const rescue = () => items().forEach((el) => {
    if (parseFloat(getComputedStyle(el).opacity) < 0.99) {
      el.style.setProperty('opacity', '1');
      el.style.removeProperty('transform');
    }
  });

  new MutationObserver(() => {
    if (!panel.classList.contains('is-open')) return;
    clearInline();
    // 0.24s duration + ~0.1s of stagger, plus a margin.
    setTimeout(rescue, 520);
  }).observe(panel, { attributes: true, attributeFilter: ['class'] });
})();

/* ------------------------------------------------------- Reachability when clipped
 * Mark a chapter's `.scene-inner` as an inner scroller only while its content is
 * genuinely taller than the box. `[data-inner-scroll]` is app.js's own hook
 * (`verticalScrollFor`), so the wheel scrolls the chapter first and hands back to
 * chapter navigation at the end of travel — no new interaction model.
 */
(() => {
  const sync = () => {
    document.querySelectorAll('.scene-inner').forEach((inner) => {
      // Measure without the flag, so the previous state cannot mask the answer.
      inner.removeAttribute('data-inner-scroll');
      if (inner.scrollHeight > inner.clientHeight + 1) {
        inner.setAttribute('data-inner-scroll', '');
      }
    });
  };

  const schedule = () => requestAnimationFrame(sync);

  schedule();
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  // Chapter changes swap which content is laid out.
  document.addEventListener('click', schedule, true);
  window.addEventListener('hashchange', schedule);
  // Fonts and video metadata land after first paint and change heights.
  window.addEventListener('load', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
})();

(() => {
  const rail = document.querySelector('.evidence-tabs');
  if (!rail) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const reveal = (button) => {
    if (!button || rail.scrollWidth <= rail.clientWidth) return;
    // NOT scrollIntoView. That walks the entire ancestor scrollport chain, and
    // `.chapter--why` is `overflow-x: hidden` — which still scrolls programmatically.
    // Selecting a tab dragged the whole chapter 47-92px left, cutting the left edge
    // off the eyebrow, the headline and the body, with no scrollbar and no gesture to
    // bring it back. Scroll the rail and nothing else.
    const target = button.offsetLeft - (rail.clientWidth - button.offsetWidth) / 2;
    rail.scrollTo({
      left: Math.max(0, Math.min(target, rail.scrollWidth - rail.clientWidth)),
      behavior: reduced.matches ? 'auto' : 'smooth',
    });

    // Focusing a partially-visible control makes the browser scroll its nearest
    // scrollable ancestor to reveal it. `.chapter--why` is `overflow-x: hidden`, which
    // still scrolls programmatically and has no scrollbar — so the chapter drifted
    // left and the headline lost its first characters, unrecoverably. The rail is the
    // only thing allowed to move; clipped ancestors are pinned back.
    let el = rail.parentElement;
    while (el && el !== document.body) {
      if (el.scrollLeft !== 0 && !el.hasAttribute('data-scene-viewport')) el.scrollLeft = 0;
      el = el.parentElement;
    }
  };

  // app.js owns selection; observe the class it sets rather than racing its handler.
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target;
      if (target instanceof HTMLElement && target.classList.contains('is-current')) {
        reveal(target);
        return;
      }
    }
  });

  rail.querySelectorAll('button').forEach((button) => {
    observer.observe(button, { attributes: true, attributeFilter: ['class'] });
  });
})();
