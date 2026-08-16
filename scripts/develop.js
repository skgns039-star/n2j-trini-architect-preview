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
    // Left-align, don't centre: centring leaves the PREVIOUS tab half-sliced
    // against the rail's left edge with no fade or affordance on that side
    // (owner's 2026-08-16 recording — "…한 비용"). Flush-left puts earlier tabs
    // fully off-screen and the next tab peeking into the right-edge fade.
    const target = button.offsetLeft - 2;
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

/* ---------------------------------------------------- Flick past a rail chapter
 *
 * Reported from a real phone: "swiping sideways won't move from one screen to the next
 * — I can't tell if it's lag or a bug." Reproduced on an emulated Pixel 7 with real
 * touch injection, and it is neither:
 *
 *   swipe 1   PROCESS rail   0 -> 304 px     chapter stays
 *   swipe 2   PROCESS rail 304 -> 392 (end)  chapter stays
 *   swipe 3   rail already at its end        chapter finally advances
 *
 * PROCESS and PLANS/WORKS each hold a horizontal rail with ~392px of scroll, and a
 * thumb-swipe travels about 300px, so those chapters charge a two-swipe toll before
 * they will release. app.js is doing exactly what it says — scroll the inner rail
 * first, hand off to the chapter only once it is exhausted — which is right on a mouse
 * and wrong on a phone, where that rail covers most of the screen and nothing marks it
 * as a separate scroll surface. Swiping above the rail advances on the first try, so
 * the navigation was never broken; the dead zone was just invisible.
 *
 * The rule added here is the one carousels have taught people for years: a slow drag
 * scrolls the rail, a fast flick pages the container. Velocity, not position, is what
 * separates them, so the rail keeps working for browsing and the chapter always
 * releases when the visitor clearly means to leave.
 *
 * Navigation goes through `location.hash`, the site's own authoritative route — app.js
 * treats `hash` as a source that may interrupt an in-flight transition, so this cannot
 * strand the machine mid-move.
 */
(() => {
  const root = document.documentElement;
  const stage = document.querySelector('[data-scene-track]')?.parentElement
    || document.querySelector('.scene-viewport');
  if (!stage) return;

  const chapters = [...document.querySelectorAll('.chapter')].map((c) => c.dataset.chapter);
  if (chapters.length < 2) return;

  // Only where a coarse pointer is the primary input. A mouse has a scrollbar and a
  // wheel; it does not need this and should not get a surprise page turn.
  const coarse = window.matchMedia('(pointer: coarse)');

  // Two ways to qualify, because either one alone gets it wrong. Speed alone misses the
  // slow, deliberate drag all the way across the screen — which is unmistakably "take me
  // to the next screen" — and it cannot be calibrated honestly against injected input,
  // where transport latency stretched a 310px gesture to 705ms and 0.44px/ms. Distance
  // alone would hijack a long, careful browse of the rail. A gesture is a page turn if it
  // is quick, OR if it crosses nearly half the screen; browsing a rail is neither.
  const FLICK_SPEED = 0.5;        // px/ms
  const FLICK_SCREEN_SHARE = 0.45; // of viewport width
  const FLICK_DISTANCE = 90;      // px — floor, so a tap-slip can never qualify

  let start = null;
  let last = null;

  // Touch events, not pointer events, and the difference is the entire defect.
  //
  // Instrumented on an emulated Pixel 7, one 310px flick across the PROCESS rail:
  //
  //   pointerdown@350 -> pointermove@328 -> pointercancel -> (nothing more)
  //   touchstart@350  -> touchmove x9 ... @40 -> touchend@40
  //
  // The browser cancels the pointer stream 22px in, the instant it decides the gesture
  // belongs to a scroller. Everything after that arrives only as touch events. app.js's
  // swipe handler is bound to `pointerup`, which on a touch device never fires for any
  // gesture that scrolls anything — so it never ran on the first two swipes, and the
  // chapter released on the third only because by then the rail was at its end, nothing
  // scrolled, no cancel was issued, and `pointerup` finally arrived. Reading the gesture
  // from `pointercancel` does not rescue it either: at 22px of travel there is no flick
  // to detect yet. The full gesture exists only in the touch stream.
  const at = (event) => {
    const t = event.changedTouches && event.changedTouches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  };

  document.addEventListener('touchstart', (event) => {
    start = null;
    last = null;
    if (event.touches.length !== 1) return;             // a pinch is not a page turn
    // Armed on every touch, not only over a horizontal rail. PLANS/WORKS covers its
    // screen with a VERTICAL scroller (`data-inner-scroll`), so a rail-only guard left
    // that chapter with nothing at all: no horizontal rail to match, and app.js's
    // `pointerup` path already dead. Buttons and links are excluded so a tap on a
    // control cannot be read as a page turn.
    if (event.target.closest?.('a, button, input, select, textarea, [data-interactive]')) return;
    const point = at(event);
    if (!point) return;
    start = {
      x: point.x, y: point.y, time: performance.now(),
      chapter: document.querySelector('.chapter.is-active')?.dataset.chapter,
    };
    last = { x: point.x, y: point.y, time: start.time };
  }, { capture: true, passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!start) return;
    const point = at(event);
    if (point) last = { x: point.x, y: point.y, time: performance.now() };
  }, { capture: true, passive: true });

  const finish = () => {
    const from = start;
    const end = last;
    start = null;
    last = null;
    if (!from || !end) return;
    if (document.querySelector('.index-panel.is-open')) return;

    const dx = end.x - from.x;
    const dy = end.y - from.y;
    const elapsed = Math.max(end.time - from.time, 1);
    const speed = Math.abs(dx) / elapsed;

    if (Math.abs(dx) < FLICK_DISTANCE) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.3) return;   // a diagonal is not a page turn
    const decisive = speed >= FLICK_SPEED
      || Math.abs(dx) >= window.innerWidth * FLICK_SCREEN_SHARE;
    if (!decisive) return;                           // a browsing drag stays in the rail

    const current = document.querySelector('.chapter.is-active')?.dataset.chapter;
    // Native scroll-snap and app.js both still work wherever the gesture is not eaten by
    // a scroller. If either already moved the chapter during this gesture, the journey is
    // done — navigating again here would skip a screen.
    if (current !== from.chapter) return;
    const index = chapters.indexOf(current);
    if (index < 0) return;
    const next = index + (dx < 0 ? 1 : -1);
    if (next < 0 || next >= chapters.length) return;

    location.hash = `#${chapters[next]}`;
  };

  document.addEventListener('touchend', finish, { capture: true, passive: true });
  document.addEventListener('touchcancel', () => { start = null; last = null; },
    { capture: true, passive: true });

  // Marks the chapters that own a scrollable rail, so the stylesheet can show where the
  // separate scroll surface is instead of leaving the visitor to discover it by failing.
  const markRails = () => {
    document.querySelectorAll('[data-horizontal-subscroll]').forEach((rail) => {
      rail.classList.toggle('has-more', rail.scrollWidth > rail.clientWidth + 4);
    });
  };
  markRails();
  addEventListener('resize', markRails, { passive: true });
  document.querySelectorAll('[data-horizontal-subscroll]').forEach((rail) => {
    rail.addEventListener('scroll', () => {
      rail.classList.toggle(
        'at-end',
        rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 4,
      );
    }, { passive: true });
  });

  root.classList.add('n2j-flick-ready');
})();

/* ---------------------------------------------- PROCESS mobile: scroll-linked 3D curve
 * Owner 2026-08-16: on a phone the process had been flattened to a plain list, losing the
 * curve's identity. develop.css now lays the seven steps as a vertical serpentine whose
 * nodes stand up from a back-tilt as they enter; this controller drives the two things CSS
 * cannot: it reveals each node once as it scrolls in (the 3D action), and it makes the node
 * nearest the viewport centre the active step whose description shows — so one vertical
 * scroll walks 상담 → 완료. Portrait phones only; desktop/landscape keep the horizontal rail.
 */
(() => {
  const chapter = document.querySelector('.chapter--process');
  if (!chapter) return;
  const steps = [...chapter.querySelectorAll('.process-step')];
  if (!steps.length) return;
  const mq = window.matchMedia('(max-width: 900px) and (orientation: portrait)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let revealObserver = null;
  let scroller = null;
  let onScroll = null;
  let activeIndex = -1;

  const teardown = () => {
    if (revealObserver) { revealObserver.disconnect(); revealObserver = null; }
    if (scroller && onScroll) scroller.removeEventListener('scroll', onScroll);
    scroller = null; onScroll = null;
  };

  const syncActive = () => {
    // Map scroll progress across the whole scroller onto the seven steps, so scrolling to
    // the bottom always lands on 완료 even when the serpentine only just overflows. Reveal
    // every step up to the active one too, so the walk cannot leave a node still tilted
    // back below an IntersectionObserver margin.
    if (!scroller) return;
    const max = scroller.scrollHeight - scroller.clientHeight;
    const prog = max > 4 ? scroller.scrollTop / max : 0;
    const best = Math.min(steps.length - 1, Math.max(0, Math.round(prog * (steps.length - 1))));
    // Reveal is left to the per-node IntersectionObserver so each back-tilt actually plays
    // as its own node enters (Hallmark m2: revealing all-up-to-active flipped them flat
    // before they were on screen). Here we only track the active step for the description.
    if (best !== activeIndex) { activeIndex = best; steps[best].click(); }
  };

  const setup = () => {
    teardown();
    if (!mq.matches) { steps.forEach((s) => s.classList.remove('is-inview')); activeIndex = -1; return; }

    if (reduce.matches) {
      steps.forEach((s) => s.classList.add('is-inview'));
    } else {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('is-inview'); revealObserver.unobserve(e.target); }
        });
      }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.2 });
      steps.forEach((s) => revealObserver.observe(s));
    }

    scroller = chapter.querySelector('.scene-inner');
    onScroll = () => requestAnimationFrame(syncActive);
    if (scroller) scroller.addEventListener('scroll', onScroll, { passive: true });
    activeIndex = -1;
    syncActive();
  };

  setup();
  mq.addEventListener?.('change', setup);
  reduce.addEventListener?.('change', setup);
  window.addEventListener('orientationchange', () => setTimeout(setup, 150));
  // The reachability pass marks .scene-inner scrollable after measuring; re-bind then.
  window.addEventListener('hashchange', () => { if (mq.matches) setTimeout(setup, 180); });
})();
