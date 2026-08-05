const stage = document.querySelector('[data-scene-viewport]');
const track = document.querySelector('[data-scene-track]');
const chapters = [...document.querySelectorAll('[data-chapter]')];
const chapterIds = chapters.map((chapter) => chapter.dataset.chapter);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const initialIndex = Math.max(0, chapterIds.indexOf(location.hash.slice(1)));

history.scrollRestoration = 'manual';

const state = {
  machine:'IDLE',
  active: initialIndex,
  target: initialIndex,
  programmaticUntil: 0,
  suppressClickUntil: 0,
  pointerStart: null,
  introTimer: null,
  scrollTimer: null,
  scrollFrame: null,
  wheelLockedUntil: 0,
  transitionPromise: null,
  pendingChapter: null,
  stateTransitionPromise: null,
  viewTransitionSupported: typeof document.startViewTransition === 'function',
};
const chapterDiagnostics = window.__N2J_CHAPTER_DIAGNOSTICS__ = { state:'IDLE', activeIndex:initialIndex, targetIndex:initialIndex, navigationCount:0, transitionCount:0, queuedTarget:null, duplicateRequestCount:0, droppedRequestCount:0, lastSource:null, lastDuration:0, lastError:null };

const ui = {
  status: document.querySelector('.chapter-status'),
  currentLabel: document.querySelector('[data-current-label]'),
  currentNumber: document.querySelector('[data-current-number]'),
  mobileNumber: document.querySelector('[data-mobile-number]'),
  progress: document.querySelector('[data-progress-bar]'),
  indexPanel: document.querySelector('.index-panel'),
  indexToggles: [...document.querySelectorAll('[data-index-toggle]')],
  mobileMenu: document.querySelector('.mobile-utility [data-index-toggle]'),
  toast: document.querySelector('[data-preview-toast]'),
};
const siteShell = document.querySelector('[data-site-shell]');
const syncAuthState = (loggedIn = false) => { document.documentElement.dataset.authenticated = String(Boolean(loggedIn)); };
window.__N2J_SET_AUTH_STATE__ = syncAuthState;
addEventListener('n2j:authchange', (event) => syncAuthState(event.detail?.loggedIn));
syncAuthState(window.N2J_IMWEB_AUTH?.loggedIn);
const transitionDiagnostics = window.__N2J_VIEW_TRANSITION_DIAGNOSTICS__ = { supported:typeof document.startViewTransition==='function', disabled:Boolean(window.__N2J_DISABLE_VIEW_TRANSITIONS__), reducedMotion:reducedMotion.matches, startedCount:0, readyCount:0, finishedCount:0, skippedCount:0, rejectedCount:0, curtainStarted:0, curtainFinished:0, sharedMorphStarted:0, sharedMorphFinished:0, typographySplitStarted:0, typographySplitFinished:0, activeType:null, activeDirection:null, duplicateNames:[], lastDuration:0, lastError:null };
const designToolDiagnostics = window.__N2J_DESIGN_TOOL_DIAGNOSTICS__ = {
  name:'Motion',
  version:'13.0.0',
  repository:'https://github.com/motiondivision/motion',
  api:'animateMini',
  loaded:typeof window.Motion?.animateMini === 'function',
  scope:'menu-content-settle',
  menuRuns:0,
  menuCompleted:0,
  menuSkipped:0,
  targetCount:0,
  ambientScope:'shop-background',
  ambientRuns:0,
  ambientStops:0,
  ambientActive:false,
  ambientTargetCount:0,
  ambientLastError:null,
  lastError:null,
};
let menuMotionRun = 0;
let menuMotionControls = [];

const clampIndex = (index) => Math.min(chapters.length - 1, Math.max(0, index));
const chapterLeft = (index) => clampIndex(index) * stage.clientWidth;
const exactSceneIndex = () => clampIndex(Math.round(stage.scrollLeft / Math.max(1, stage.clientWidth)));
const isPreviewHost = () => ['localhost', '127.0.0.1', ''].includes(location.hostname);
const interactiveSelector = 'a,button,input,textarea,select,label,summary,[role="button"],[contenteditable],[data-interactive],[data-no-chapter-nav],.cta,.menu-drawer,.state-rail,.works-viewer,.person-selector,.process-stage,.index-panel';
const introVideo = document.querySelector('[data-intro-hero-video]');
const mediaConfig = { introHeroVideo:{ src:'https://cdn.midjourney.com/video/d643c5f0-226f-4101-ac72-18f86498de10/0.mp4', type:'video/mp4', objectFit:'cover', objectPosition:'50% 50%', autoplay:true, muted:true, loop:true, playsInline:true } };
if (introVideo) { introVideo.src = mediaConfig.introHeroVideo.src; Object.assign(introVideo.style, { objectFit:mediaConfig.introHeroVideo.objectFit, objectPosition:mediaConfig.introHeroVideo.objectPosition }); }

function syncIntroVideo() {
  if (!introVideo) return;
  introVideo.muted = true;
  introVideo.defaultMuted = true;
  introVideo.playsInline = true;
  const active = chapterIds[state.active] === 'intro' && !reducedMotion.matches && !document.hidden;
  if (active) {
    introVideo.play().then(() => introVideo.classList.add('is-ready')).catch(() => introVideo.classList.remove('is-ready'));
  } else {
    introVideo.pause();
  }
}

introVideo?.addEventListener('loadedmetadata', () => introVideo.classList.add('is-ready'), { once:true });
introVideo?.addEventListener('error', () => introVideo.classList.remove('is-ready'), { once:true });
document.addEventListener('visibilitychange', syncIntroVideo);
reducedMotion.addEventListener?.('change', syncIntroVideo);

function closeIndex() {
  clearMenuMotion();
  ui.indexPanel.classList.remove('is-open');
  ui.indexPanel.setAttribute('aria-hidden', 'true');
  ui.indexToggles.forEach((button) => button.setAttribute('aria-expanded', 'false'));
  if (ui.mobileMenu) ui.mobileMenu.textContent = 'MENU';
}

function openIndex() {
  ui.indexPanel.classList.add('is-open');
  ui.indexPanel.setAttribute('aria-hidden', 'false');
  ui.indexToggles.forEach((button) => button.setAttribute('aria-expanded', 'true'));
  if (ui.mobileMenu) ui.mobileMenu.textContent = '닫기';
  requestAnimationFrame(() => {
    ui.indexPanel.querySelector('[data-index-close]')?.focus();
    animateMenuContent();
  });
}

function clearMenuMotion() {
  menuMotionRun += 1;
  menuMotionControls.forEach((control) => control?.cancel?.());
  menuMotionControls = [];
}

function animateMenuContent() {
  clearMenuMotion();
  const run = menuMotionRun;
  const targets = [...ui.indexPanel.querySelectorAll('.index-list li, .index-utility a')];
  designToolDiagnostics.loaded = typeof window.Motion?.animateMini === 'function';
  designToolDiagnostics.targetCount = targets.length;
  if (reducedMotion.matches || !designToolDiagnostics.loaded || !targets.length) {
    designToolDiagnostics.menuSkipped += 1;
    return;
  }

  try {
    designToolDiagnostics.menuRuns += 1;
    menuMotionControls = targets.map((target, index) => window.Motion.animateMini(
      target,
      { opacity:[0, 1], transform:['translateY(8px)', 'translateY(0px)'] },
      { duration:0.24, delay:0.08 + index * 0.018, ease:'cubic-bezier(0.22, 0.75, 0.2, 1)' },
    ));
    Promise.allSettled(menuMotionControls.map((control) => control.finished)).then(() => {
      if (run === menuMotionRun) designToolDiagnostics.menuCompleted += 1;
    });
  } catch (error) {
    designToolDiagnostics.lastError = String(error);
    designToolDiagnostics.menuSkipped += 1;
    clearMenuMotion();
  }
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.toast.classList.remove('is-visible'), 2400);
}

function restartAnimation(element, className) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function runViewTransition(mutator, options = {}) {
  const canTransition = state.viewTransitionSupported && !reducedMotion.matches && !options.disabled;
  if (!canTransition) {
    mutator();
    return Promise.resolve({ supported:false });
  }
  try {
    const startedAt = performance.now();
    transitionDiagnostics.startedCount += 1;
    transitionDiagnostics.activeTransitionType = options.type || 'chapter-curtain';
    transitionDiagnostics.activeType = transitionDiagnostics.activeTransitionType;
    transitionDiagnostics.activeDirection = options.direction || 'forward';
    const transition = document.startViewTransition(() => { transitionDiagnostics.readyCount += 1; mutator(); });
    transition.ready?.catch((error) => {
      if (error?.name === 'AbortError') transitionDiagnostics.skippedCount += 1;
      else { transitionDiagnostics.rejectedCount += 1; transitionDiagnostics.lastError = String(error); }
    });
    transition.updateCallbackDone?.catch((error) => {
      if (error?.name === 'AbortError') transitionDiagnostics.skippedCount += 1;
      else { transitionDiagnostics.rejectedCount += 1; transitionDiagnostics.lastError = String(error); }
    });
    const timeout = new Promise((resolve) => setTimeout(resolve, 540));
    return Promise.race([transition.finished.catch((error) => { transitionDiagnostics.rejectedCount += 1; transitionDiagnostics.lastError=String(error); }), timeout])
      .then(() => { transitionDiagnostics.finishedCount += 1; transitionDiagnostics.lastDuration=performance.now()-startedAt; transitionDiagnostics.curtainFinished += 1; transitionDiagnostics.sharedMorphFinished += 1; transitionDiagnostics.typographySplitFinished += 1; return { supported:true }; });
  } catch {
    mutator();
    return Promise.resolve({ supported:false, fallback:true });
  }
}

function transitionChapter(index, options = {}) {
  const next = clampIndex(index);
  if (state.transitionPromise) {
    state.pendingChapter = { index:next, options };
    return state.transitionPromise;
  }
  const direction = next >= state.active ? 'forward' : 'backward';
  if (siteShell && !reducedMotion.matches) {
    siteShell.dataset.transitionLayer = direction;
    siteShell.classList.add('is-transitioning');
    transitionDiagnostics.curtainStarted += 1;
    transitionDiagnostics.sharedMorphStarted += 1;
    transitionDiagnostics.typographySplitStarted += 1;
  }
  state.transitionPromise = runViewTransition(() => {
    applyActive(next, options);
  }, { type:'chapter-curtain', direction });
  return state.transitionPromise.finally(() => {
    if (siteShell) { siteShell.dataset.transitionLayer = 'idle'; siteShell.classList.remove('is-transitioning'); }
    state.transitionPromise = null;
    const pending = state.pendingChapter;
    state.pendingChapter = null;
    if (pending && pending.index !== state.active) {
      transitionChapter(pending.index, pending.options).then(() => {
        if (state.active === pending.index) settleAt(pending.index, 'auto');
      });
    }
  });
}

function transitionState(mutator, instant = false) {
  if (instant) {
    mutator();
    return Promise.resolve();
  }
  if (state.stateTransitionPromise) return state.stateTransitionPromise;
  state.stateTransitionPromise = runViewTransition(mutator).finally(() => {
    state.stateTransitionPromise = null;
  });
  return state.stateTransitionPromise;
}

function syncHistory(index, mode = 'push') {
  const chapter = chapters[index];
  const hash = `#${chapter.dataset.chapter}`;
  if (location.hash === hash && mode !== 'replace') return;
  history[mode === 'replace' ? 'replaceState' : 'pushState'](
    { chapter: chapter.dataset.chapter },
    '',
    hash,
  );
}

function applyActive(index, options = {}) {
  const next = clampIndex(index);
  const chapter = chapters[next];
  const changed = state.active !== next;
  state.active = next;
  state.target = next;

  chapters.forEach((item, itemIndex) => {
    item.classList.toggle('is-active', itemIndex === next);
    item.classList.toggle('is-before', itemIndex < next);
    item.setAttribute('aria-hidden', String(itemIndex !== next));
  });

  document.querySelectorAll('[data-chapter-link]').forEach((link) => {
    const current = link.dataset.chapterLink === chapter.dataset.chapter;
    link.classList.toggle('is-current', current);
    current ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current');
  });

  if (changed) {
    restartAnimation(ui.status, 'is-changing');
    restartAnimation(ui.currentNumber, 'is-rolling');
  }
  ui.currentLabel.textContent = chapter.dataset.label;
  ui.currentNumber.textContent = chapter.dataset.number;
  ui.mobileNumber.textContent = chapter.dataset.number;
  ui.progress.style.transform = `scaleX(${(next + 1) / chapters.length})`;
  document.title = `${chapter.dataset.label} — N2J TRINI`;
  if (options.history) syncHistory(next, options.history);
  closeIndex();
  syncIntroVideo();
  window.__N2J_SYNC_WHY_VIDEO__?.();
  window.__N2J_SYNC_SHOP_VIDEO__?.();
  window.__N2J_SYNC_SHOP_AMBIENT__?.();
}

function settleAt(index, behavior = 'auto') {
  const next = clampIndex(index);
  stage.scrollTo({ left: chapterLeft(next), top: 0, behavior });
}

function goToChapter(index, options = {}) {
  const next = clampIndex(index);
  chapterDiagnostics.navigationCount += 1;
  chapterDiagnostics.lastSource = options.source || 'unknown';
  if (next === state.target && Math.abs(stage.scrollLeft - chapterLeft(next)) <= 1) { chapterDiagnostics.duplicateRequestCount += 1; }
  if (state.transitionPromise) {
    const authoritative = ['menu','hash','popstate','history'].includes(options.source);
    if (!authoritative) { chapterDiagnostics.droppedRequestCount += 1; return false; }
    chapterDiagnostics.queuedTarget = next;
  }
  chapterDiagnostics.targetIndex = next;
  state.machine = 'INTENT'; chapterDiagnostics.state = 'INTENT';
  if (next === state.target && Math.abs(stage.scrollLeft - chapterLeft(next)) <= 1) {
    if (options.history) syncHistory(next, options.history);
    return;
  }
  state.target = next;
  state.programmaticUntil = performance.now() + (reducedMotion.matches ? 60 : 780);
  const historyMode = options.fromHistory ? null : (options.replace ? 'replace' : 'push');
  chapterDiagnostics.transitionCount += 1; state.machine = 'TRANSITIONING'; chapterDiagnostics.state = 'TRANSITIONING';
  const started = performance.now();
  transitionChapter(next, { history:historyMode, source:options.source }).then(() => {
    // View Transition owns the visual timing; the native snap is positioned after it.
    // No smooth scroll runs inside the View Transition callback.
    if (state.active === next) settleAt(next, 'auto');
    state.machine = 'SETTLED'; chapterDiagnostics.state = 'SETTLED'; chapterDiagnostics.activeIndex = state.active; chapterDiagnostics.queuedTarget = null; chapterDiagnostics.lastDuration = performance.now() - started;
  }).catch((error) => { state.machine='IDLE'; chapterDiagnostics.state='IDLE'; chapterDiagnostics.lastError=String(error); });
  setTimeout(() => { if (!state.transitionPromise) { state.machine='IDLE'; chapterDiagnostics.state='IDLE'; } }, 600);
}

function navigateToChapter(targetIndex, options = {}) { return goToChapter(targetIndex, options); }

const moveChapter = (delta, source = 'input') => goToChapter(state.active + delta, { source });

function settleScrolledScene() {
  if (state.transitionPromise) return;
  const next = exactSceneIndex();
  const difference = Math.abs(stage.scrollLeft - chapterLeft(next));
  if (difference > 1) settleAt(next, reducedMotion.matches ? 'auto' : 'smooth');
  if (next !== state.active) transitionChapter(next, { history:'push' });
}

function onStageScroll() {
  if (state.scrollFrame) return;
  state.scrollFrame = requestAnimationFrame(() => {
    state.scrollFrame = null;
    if (state.transitionPromise) return;
    if (performance.now() >= state.programmaticUntil) {
      const next = exactSceneIndex();
      if (next !== state.active) transitionChapter(next);
    }
    clearTimeout(state.scrollTimer);
    state.scrollTimer = setTimeout(settleScrolledScene, 150);
  });
}

function subscrollFor(target) {
  return target.closest?.('[data-horizontal-subscroll]') || null;
}

function subscrollCanMove(scroller, direction) {
  if (!scroller || scroller.scrollWidth <= scroller.clientWidth + 1) return false;
  if (direction > 0) return scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth - 1;
  return scroller.scrollLeft > 1;
}

function verticalScrollFor(target) {
  return target.closest?.('[data-inner-scroll],.plans-layout,.about-shell') || null;
}

function verticalScrollCanMove(scroller, direction) {
  if (!scroller || scroller.scrollHeight <= scroller.clientHeight + 1) return false;
  if (direction > 0) return scroller.scrollTop < scroller.scrollHeight - scroller.clientHeight - 1;
  return scroller.scrollTop > 1;
}

function isInteractive(target) {
  return Boolean(target.closest?.(interactiveSelector));
}

function setupChapterNavigation() {
  stage.addEventListener('scroll', onStageScroll, { passive: true });
  stage.addEventListener('scrollend', settleScrolledScene);

  document.addEventListener('click', (event) => {
    if (performance.now() < state.suppressClickUntil || event.target.closest('[data-intro-gate]:not(.is-hidden)')) return;

    const chapterLink = event.target.closest('[data-chapter-link]');
    if (chapterLink) {
      event.preventDefault();
      const index = chapterIds.indexOf(chapterLink.dataset.chapterLink);
      if (index >= 0) goToChapter(index, { source:ui.indexPanel.contains(chapterLink) ? 'menu' : 'cta' });
      return;
    }

    const imwebAction = event.target.closest('[data-imweb-action]');
    if (imwebAction && false) {
      event.preventDefault();
      showToast(`${imwebAction.textContent.trim()}은 Imweb Adapter 연결 시 사이트 기능으로 이동합니다.`);
      return;
    }

    const inquiry = event.target.closest('[data-inquiry-channel]');
    if (inquiry) {
      showToast(`${inquiry.textContent.trim()} 링크는 config에서 연결 예정입니다. 실제 링크를 만들지 않았습니다.`);
      return;
    }

    if (event.target.closest('[data-index-toggle]')) {
      ui.indexPanel.classList.contains('is-open') ? closeIndex() : openIndex();
      return;
    }
    if (event.target.closest('[data-index-close]')) {
      closeIndex();
      return;
    }

    const edge = event.target.closest('[data-chapter-edge]');
    if (edge && !ui.indexPanel.classList.contains('is-open')) {
      moveChapter(edge.dataset.chapterEdge === 'prev' ? -1 : 1, 'edge');
    }
  });

  document.addEventListener('wheel', (event) => {
    if (ui.indexPanel.classList.contains('is-open')) return;
    const magnitude = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(magnitude) < 12) return;
    const direction = magnitude > 0 ? 1 : -1;
    const scroller = subscrollFor(event.target);
    const verticalScroller = verticalScrollFor(event.target);

    if (scroller && subscrollCanMove(scroller, direction)) {
      if (Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
        event.preventDefault();
        scroller.scrollLeft += event.deltaY;
      }
      return;
    }
    if (verticalScrollCanMove(verticalScroller, direction) || isInteractive(event.target)) return;
    if (performance.now() < state.wheelLockedUntil) return;
    event.preventDefault();
    state.wheelLockedUntil = performance.now() + (reducedMotion.matches ? 180 : 620);
    moveChapter(direction, 'wheel');
  }, { passive: false });

  document.addEventListener('pointerdown', (event) => {
    const subscroll = subscrollFor(event.target);
    state.pointerStart = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      stageLeft: stage.scrollLeft,
      target: event.target,
      pointerType: event.pointerType,
      interactive: isInteractive(event.target),
      subscroll,
      subscrollLeft: subscroll?.scrollLeft || 0,
      subscrollMax: subscroll ? subscroll.scrollWidth - subscroll.clientWidth : 0,
    };
  });

  document.addEventListener('pointerup', (event) => {
    const start = state.pointerStart;
    state.pointerStart = null;
    if (!start || ui.indexPanel.classList.contains('is-open')) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = performance.now() - start.time;
    const horizontalSwipe = elapsed < 800 && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2;
    if (!horizontalSwipe) return;
    const direction = dx < 0 ? 1 : -1;
    if (start.subscroll) {
      const consumed = Math.abs(start.subscroll.scrollLeft - start.subscrollLeft) > 4;
      const wasAtBoundary = direction > 0
        ? start.subscrollLeft >= start.subscrollMax - 1
        : start.subscrollLeft <= 1;
      if (consumed || !wasAtBoundary || Math.abs(dx) < 72) return;
    }
    if (start.interactive && !start.subscroll) return;

    const nativeStageMoved = Math.abs(stage.scrollLeft - start.stageLeft) > 5;
    state.suppressClickUntil = performance.now() + 360;
    if (nativeStageMoved) {
      // A native drag is not a chapter command. Return the viewport to the
      // authoritative scene so the synthetic click/scrollend cannot advance.
      clearTimeout(state.scrollTimer);
      state.suppressClickUntil = performance.now() + 520;
      settleAt(state.active, 'auto');
    } else {
      moveChapter(direction, 'swipe');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeIndex();
      return;
    }
    if (isInteractive(event.target) || subscrollFor(event.target)) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(event.key)) {
      event.preventDefault();
      moveChapter(1, 'keyboard');
    }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      moveChapter(-1, 'keyboard');
    }
    if (event.key === 'Home') {
      event.preventDefault();
      goToChapter(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      goToChapter(chapters.length - 1);
    }
  });

  addEventListener('popstate', () => {
    const index = chapterIds.indexOf(location.hash.slice(1));
    goToChapter(index >= 0 ? index : 0, { fromHistory: true });
  });

  addEventListener('hashchange', () => {
    const index = chapterIds.indexOf(location.hash.slice(1));
    if (index >= 0 && index !== state.active) goToChapter(index, { fromHistory: true });
  });

  const reposition = () => settleAt(state.active, 'auto');
  addEventListener('resize', reposition);
  new ResizeObserver(reposition).observe(stage);
}

const whyStates = [
  { number:'01', label:'SCOPE / COST', title:'포함 범위를 먼저 정의합니다.', copy:'필요 기능, 제외 범위, 선택 항목을 같은 문서에서 확인해 예측 가능한 제작 범위를 만듭니다.' },
  { number:'02', label:'FUNCTION / PROOF', title:'실제로 되는 기능을 확인합니다.', copy:'말이 아니라 화면과 동작을 기준으로 구현 가능 범위와 사이트 기능의 경계를 확인합니다.' },
  { number:'03', label:'CARE / RESPONSE', title:'오픈 후 대응 기준을 함께 봅니다.', copy:'수정과 운영의 책임 범위, 요청 기록, 다음 대응 일정을 제작 전에 함께 정리합니다.' },
];

function setupWhyViewer() {
  const viewer = document.querySelector('[data-state-viewer="why"]');
  if (!viewer) return;
  const options = [...viewer.querySelectorAll('[data-state-option]')];
  const panel = viewer.querySelector('.evidence-panel');
  const video = viewer.querySelector('[data-why-video]');
  const media = viewer.querySelector('[data-why-media]');
  const placeholder = viewer.querySelector('[data-why-placeholder]');
  const caption = viewer.querySelector('[data-why-caption]');
  const syncVideo = (active) => {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    if (!active || reducedMotion.matches || document.hidden) {
      video.pause();
      return;
    }
    const attempt = video.play();
    if (attempt?.catch) attempt.catch(() => { media?.classList.add('is-fallback'); });
  };
  window.__N2J_SYNC_WHY_VIDEO__ = () => syncVideo(viewer.closest('.chapter')?.classList.contains('is-active') && Boolean(legacyContent.whyEvidence.find((item) => item.id === viewer.dataset.activeState)?.media));
  video?.addEventListener('loadeddata', () => media?.classList.add('is-ready'), { once:false });
  video?.addEventListener('error', () => media?.classList.add('is-fallback'));
  document.addEventListener('visibilitychange', () => syncVideo(viewer.closest('.chapter')?.classList.contains('is-active') && viewer.dataset.activeState === 'function'));
  const render = (index, instant = false) => {
    const item = legacyContent.whyEvidence[index] || whyStates[index];
    transitionState(() => {
      options.forEach((button, i) => button.classList.toggle('is-current', i === index));
      panel.querySelector('[data-state-number]')?.replaceChildren(item.number);
      panel.querySelector('[data-state-label]').textContent = item.label;
      panel.querySelector('[data-state-title]').textContent = item.title;
      panel.querySelector('[data-state-copy]').textContent = item.copy;
      panel.querySelector('.evidence-panel__line i').style.transform = `scaleX(${.32 + index * .28})`;
      const hasVideo = Boolean(item.media);
      viewer.dataset.activeState = item.id || '';
      if (video) {
        if (hasVideo && video.src !== new URL(item.media, document.baseURI).href) video.src = item.media;
        video.toggleAttribute('aria-hidden', !hasVideo);
        media?.classList.toggle('is-visible', hasVideo);
        placeholder?.toggleAttribute('hidden', hasVideo);
        if (caption) caption.textContent = item.id === 'cost' ? 'COST CLARITY / SCOPE QA' : item.id === 'after' ? 'AFTER OPEN / HANDOVER QA' : 'FUNCTION FIT / MOBILE QA';
        syncVideo(hasVideo && viewer.closest('.chapter')?.classList.contains('is-active'));
      }
      restartAnimation(panel, 'is-changing');
    }, instant);
  };
  options.forEach((button, index) => button.addEventListener('click', () => render(index)));
  render(0, true);
}

function setupShopViewer() {
  const options = [...document.querySelectorAll('[data-shop-option]')];
  const visual = document.querySelector('[data-state-viewer="shop"]');
  if (!visual) return;
  const layout = visual.closest('.shop-layout');
  const media = layout?.querySelector('.shop-gap-media');
  const video = media?.querySelector('[data-shop-video]');
  const mediaSources = {
    prompt:'./assets/videos/shop/shop-mobile.mp4',
    coding:'./assets/videos/shop/shop-coding.mp4',
    landing:'./assets/videos/shop/shop-landing.mp4',
  };
  let activeId = 'prompt';
  const syncVideo = () => {
    if (!video) return;
    const source = mediaSources[activeId];
    if (source && video.getAttribute('src') !== source) {
      video.pause();
      video.setAttribute('src', source);
      video.load();
    }
    if (!visual.closest('.chapter')?.classList.contains('is-active') || reducedMotion.matches || document.hidden) {
      video.pause();
      return;
    }
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.play().catch(() => {});
  };
  window.__N2J_SYNC_SHOP_VIDEO__ = syncVideo;
  document.addEventListener('visibilitychange', syncVideo);
  video?.addEventListener('canplay', syncVideo);
  const render = (id, instant = false) => {
    const index = Math.max(0, legacyContent.shopProducts.findIndex((item) => item.id === id));
    const item = legacyContent.shopProducts[index];
    transitionState(() => {
      options.forEach((button) => {
        const current = button.dataset.shopOption === item.id;
        button.classList.toggle('is-current', current);
        button.setAttribute('aria-selected', String(current));
      });
      activeId = item.id;
      media.dataset.mode = item.id;
      syncVideo();
      visual.dataset.mode = item.id;
      visual.querySelector('[data-shop-kicker]').textContent = item.title;
      visual.querySelector('[data-shop-number]').textContent = `${String(index + 1).padStart(2,'0')} / ${String(legacyContent.shopProducts.length).padStart(2,'0')}`;
      visual.querySelector('[data-shop-description]').textContent = item.description;
      visual.querySelector('[data-shop-input]').textContent = item.input;
      visual.querySelector('[data-shop-result]').textContent = item.result;
      visual.querySelector('[data-shop-scope]').textContent = item.scope;
      document.querySelector('[data-shop-cta]').firstChild.textContent = `${item.cta} `;
      restartAnimation(visual, 'is-changing');
    }, instant);
  };
  options.forEach((button) => button.addEventListener('click', () => render(button.dataset.shopOption)));
  render('prompt', true);
}

function setupShopAmbientMotion() {
  const chapter = document.querySelector('[data-chapter="shop-custom"]');
  const sweep = chapter?.querySelector('[data-shop-ambient-sweep]');
  const traces = [...(chapter?.querySelectorAll('[data-shop-ambient-trace]') || [])];
  if (!chapter || !sweep || traces.length !== 2) return;
  let controls = [];
  designToolDiagnostics.ambientTargetCount = 1 + traces.length;

  const stop = () => {
    if (controls.length) {
      controls.forEach((control) => control?.cancel?.());
      controls = [];
      designToolDiagnostics.ambientStops += 1;
    }
    designToolDiagnostics.ambientActive = false;
  };

  const sync = () => {
    const shouldPlay = chapter.classList.contains('is-active')
      && !document.hidden
      && !reducedMotion.matches
      && typeof window.Motion?.animateMini === 'function';
    if (!shouldPlay) {
      stop();
      return;
    }
    if (controls.length) return;
    try {
      controls = [
        window.Motion.animateMini(
          sweep,
          { transform:['translateX(-120%)', 'translateX(520%)'] },
          { duration:6.8, ease:'linear', repeat:Infinity },
        ),
        window.Motion.animateMini(
          traces[0],
          { transform:['translateX(-130%)', 'translateX(720%)'] },
          { duration:5.6, ease:'linear', repeat:Infinity },
        ),
        window.Motion.animateMini(
          traces[1],
          { transform:['translateX(720%)', 'translateX(-130%)'] },
          { duration:7.4, ease:'linear', repeat:Infinity },
        ),
      ];
      designToolDiagnostics.ambientRuns += 1;
      designToolDiagnostics.ambientActive = true;
    } catch (error) {
      designToolDiagnostics.ambientLastError = String(error);
      stop();
    }
  };

  window.__N2J_SYNC_SHOP_AMBIENT__ = sync;
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener?.('change', sync);
  addEventListener('pagehide', stop, { once:true });
  sync();
}

const processStates = [
  ['01 / CONSULT','상담','목표와 현재 상황을 함께 듣고 프로젝트의 출발점을 정합니다.'],
  ['02 / MATERIAL','자료','필요한 자료와 운영 정보를 순서대로 모아 확인합니다.'],
  ['03 / PLAN','기획','정보와 구매 흐름을 WEB과 MOBILE의 경로로 설계합니다.'],
  ['04 / DESIGN','디자인','브랜드의 언어와 콘텐츠 위계를 화면 경험으로 구체화합니다.'],
  ['05 / BUILD','제작','안정적인 사이트 기능 위에 승인된 디자인을 구현합니다.'],
  ['06 / VERIFY','검수','기기와 흐름, 기록을 기준으로 오류와 교차를 확인합니다.'],
  ['07 / COMPLETE','완료','승인 기록과 운영 기준을 함께 정리해 전달합니다.'],
];

const processPoints = [
  [70,150],[245,80],[420,175],[600,95],[780,185],[955,105],[1130,155],
];

function setupProcessViewer() {
  const rail = document.querySelector('.process-rail');
  const steps = [...document.querySelectorAll('[data-process-index]')];
  const detail = document.querySelector('[data-process-detail]');
  const progress = document.querySelector('[data-process-progress]');
  if (!rail || !steps.length || !detail || !progress) return;
  let active = 0;

  const render = (index, shouldScroll = true, instant = false) => {
    active = Math.min(6, Math.max(0, index));
    transitionState(() => {
      steps.forEach((item, i) => {
        const current = i === active;
        item.classList.toggle('is-current', current);
        current ? item.setAttribute('aria-current', 'step') : item.removeAttribute('aria-current');
      });
      const [label, title, copy] = processStates[active];
      const canonicalStep = legacyContent.processSteps[active];
      const canonicalTitle = canonicalStep?.[0] || title;
      const canonicalCopy = canonicalStep?.[1] || copy;
      detail.querySelector('span').textContent = label;
      detail.querySelector('strong').textContent = canonicalTitle;
      detail.querySelector('p').textContent = canonicalCopy;
      // The canonical curve remains one path. Active state belongs to one node.
      progress.style.strokeDashoffset = '0';
      restartAnimation(detail, 'is-changing');
    }, instant);

    if (shouldScroll && rail.scrollWidth > rail.clientWidth + 1) {
      const desired = (processPoints[active][0] / 1200) * rail.scrollWidth - rail.clientWidth / 2;
      rail.scrollTo({ left: desired, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
  };

  steps.forEach((button, index) => button.addEventListener('click', () => render(index)));
  rail.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    render(active + (event.key === 'ArrowRight' ? 1 : -1));
    steps[active].focus({ preventScroll: true });
  });
  render(0, false, true);
}

const planStates = [
  { label:'ESSENTIAL / RANGE', title:'브랜드의 첫 쇼핑 흐름', status:'실제 작업 이미지와 URL은 준비되면 이 영역에서 함께 확인합니다.', list:['기본 쇼핑 구조','핵심 페이지 디자인','모바일 최적화'] },
  { label:'SIGNATURE / RANGE', title:'기억되는 브랜드 경험', status:'적용 범위와 인터랙션은 합의 후 실제 산출물로 연결합니다.', list:['맞춤 인터랙션','콘텐츠 구조 설계','교차 QA'] },
  { label:'WORKS / PLACEHOLDER', title:'실제 운영 사례 자산 대기', status:'검증 가능한 실제 URL과 이미지가 없어 placeholder로 명확히 표시합니다.', list:['허위 URL 없음','허위 성과 없음','실제 자산 추가 예정'] },
];

function setupPlansViewer() {
  const rail = document.querySelector('.plans-rail');
  const root = document.querySelector('.plans-layout');
  if (rail && legacyContent.worksProjects.length) {
    rail.replaceChildren(...legacyContent.worksProjects.map((project, index) => {
      const button = document.createElement('button'); button.type='button'; button.className=`plan-option${index === 0 ? ' is-current' : ''}`; button.dataset.railItem=''; button.dataset.planIndex=String(index); button.dataset.interactive=''; button.innerHTML=`<span>${String(index + 1).padStart(2,'0')}</span><strong>${project.title}</strong><small>${project.category}</small>`; return button;
    }));
  }
  const buttons = [...document.querySelectorAll('[data-plan-index]')];
  const viewer = root?.querySelector('[data-plan-viewer]');
  if (!viewer) return;
  const planScope = root || viewer;
  const scrollViewport = viewer.querySelector('[data-inner-scroll]');
  const scrollProgress = viewer.querySelector('[data-works-scroll-progress]');
  const syncScrollProgress = () => {
    if (!scrollViewport || !scrollProgress) return;
    const max = Math.max(0, scrollViewport.scrollHeight - scrollViewport.clientHeight);
    scrollProgress.style.transform = `scaleX(${max ? scrollViewport.scrollTop / max : 0})`;
  };
  scrollViewport?.addEventListener('scroll', syncScrollProgress, { passive:true });
  const render = (index, instant = false) => {
    const project = legacyContent.worksProjects[index];
    const item = project ? { label:`${project.category} / SELECTED WORK`, title:project.title, status:'확인 가능한 실제 프로젝트 URL입니다.' } : planStates[index];
    transitionState(() => {
      buttons.forEach((button, i) => button.classList.toggle('is-current', i === index));
      planScope.querySelector('[data-plan-label]').textContent = item.label;
      planScope.querySelector('[data-plan-number]').textContent = `${String(index + 1).padStart(2,'0')} / ${String(legacyContent.worksProjects.length).padStart(2,'0')}`;
      planScope.querySelector('[data-plan-title]').textContent = item.title;
      planScope.querySelector('[data-plan-status]').textContent = item.status;
      planScope.querySelector('[data-plan-category]').textContent = project.category;
      planScope.querySelector('[data-plan-meta]').textContent = `${project.category} · ${project.verificationStatus}`;
      planScope.querySelector('[data-plan-link]').href = project.url;
      const image = viewer.querySelector('[data-plan-image]');
      const mobileSource = viewer.querySelector('[data-plan-mobile-source]');
      image.classList.remove('is-loaded');
      if (scrollViewport) scrollViewport.scrollTop = 0;
      syncScrollProgress();
      image.alt = `${project.title} 웹사이트 화면`;
      mobileSource.srcset = project.mobileImage;
      image.src = project.desktopImage;
      image.dataset.fallback = project.fallbackImage;
      image.onload = () => {
        image.decode().catch(() => {}).finally(() => image.classList.add('is-loaded'));
      };
      image.onerror = () => {
        if (image.src.endsWith(project.fallbackImage.replace('./',''))) return;
        image.src = project.fallbackImage;
      };
      restartAnimation(viewer, 'is-changing');
    }, instant);
  };
  buttons.forEach((button, index) => button.addEventListener('click', () => render(index)));
  render(0, true);
}

const aboutStates = {
  people:'브랜드와 고객을 이해하는 제작',
  responsibility:'진행 상태와 승인을 연결하는 기록',
  continuity:'변경 가능한 운영 체계',
};

function setupAboutViewer() {
  const buttons = [...document.querySelectorAll('[data-about-option]')];
  const copy = document.querySelector('[data-about-state-copy]');
  if (!buttons.length || !copy) return;
  const render = (index) => {
    const next = Math.min(buttons.length - 1, Math.max(0, index));
    buttons.forEach((button, buttonIndex) => {
      const current = buttonIndex === next;
      button.classList.toggle('is-current', current);
      button.setAttribute('aria-selected', String(current));
    });
    copy.textContent = aboutStates[buttons[next].dataset.aboutOption];
    restartAnimation(copy, 'is-changing');
  };
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => render(index));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      render(next);
      buttons[next].focus();
    });
  });
}

function setupAboutPeople() {
  const image = document.querySelector('[data-about-person-image]');
  const caption = document.querySelector('[data-about-person-caption]');
  const focus = document.querySelector('[data-about-focus]');
  const number = document.querySelector('[data-about-number]');
  const captionRail = document.querySelector('[data-about-caption]');
  const buttons = [...document.querySelectorAll('[data-about-person]')];
  if (!image || !buttons.length) return;
  let requestToken = 0;
  let activeId = 'representative';
  const diagnostics = window.__N2J_ABOUT_DIAGNOSTICS__ = { activeId,requestToken:0,commits:0,ignoredCallbacks:0,staleCommits:0,pending:false,lastDecodeError:null };
  const applyPosition = (person) => {
    image.style.objectPosition = matchMedia('(max-width:900px)').matches ? person.objectPosition.mobile : person.objectPosition.desktop;
  };
  const commit = (person, personIndex, token, instant = false) => {
    if (token !== requestToken) {
      diagnostics.ignoredCallbacks += 1;
      return;
    }
    image.alt = `${person.role} ${person.name}`;
    image.src = person.image;
    image.dataset.desktopPosition = person.objectPosition.desktop;
    image.dataset.mobilePosition = person.objectPosition.mobile;
    applyPosition(person);
    if (caption) caption.textContent = `${person.role} · ${person.name}`;
    if (focus) focus.textContent = person.focus;
    if (number) {
      number.textContent = String(personIndex + 1).padStart(2,'0');
      restartAnimation(number, 'is-rolling');
    }
    activeId = person.id;
    diagnostics.activeId = person.id;
    diagnostics.commits += 1;
    diagnostics.pending = false;
    if (instant || reducedMotion.matches) {
      image.classList.add('is-loaded');
      image.classList.remove('is-switching');
      captionRail?.classList.remove('is-switching');
      return;
    }
    requestAnimationFrame(() => {
      if (token !== requestToken) return;
      image.classList.add('is-loaded');
      image.classList.remove('is-switching');
      captionRail?.classList.remove('is-switching');
    });
  };
  const render = async (id, instant = false) => {
    const person = legacyContent.aboutPeople.find((item) => item.id === id) || legacyContent.aboutPeople[0];
    const personIndex = legacyContent.aboutPeople.indexOf(person);
    const token = ++requestToken;
    diagnostics.requestToken = token;
    diagnostics.pending = true;
    buttons.forEach((button) => {
      const current = button.dataset.aboutPerson === person.id;
      button.classList.toggle('is-current', current);
      button.setAttribute('aria-selected', String(current));
    });
    if (!instant && id === activeId) {
      diagnostics.pending = false;
      return;
    }
    image.classList.add('is-switching');
    captionRail?.classList.add('is-switching');
    const preload = new Image();
    preload.src = person.image;
    try {
      await preload.decode();
      commit(person, personIndex, token, instant);
    } catch (error) {
      if (token !== requestToken) {
        diagnostics.ignoredCallbacks += 1;
        return;
      }
      diagnostics.pending = false;
      diagnostics.lastDecodeError = String(error);
      image.classList.remove('is-loaded','is-switching');
      captionRail?.classList.remove('is-switching');
    }
  };
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => render(button.dataset.aboutPerson));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      render(buttons[next].dataset.aboutPerson);
      buttons[next].focus();
    });
  });
  const representative = legacyContent.aboutPeople[0];
  const initial = new Image();
  initial.src = representative.image;
  initial.decode().then(() => commit(representative, 0, ++requestToken, true)).catch((error) => { diagnostics.lastDecodeError=String(error); });
  const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 200));
  idle(() => {
    const preload = new Image();
    preload.src = legacyContent.aboutPeople[1].image;
    preload.decode().catch(() => {});
  });
  addEventListener('resize', () => {
    const person = legacyContent.aboutPeople.find((item) => item.id === activeId);
    if (person) applyPosition(person);
  });
}

function setupAboutPointerMotion() {
  if (!matchMedia('(pointer:fine)').matches || reducedMotion.matches) return;
  const viewer = document.querySelector('.about-portrait');
  const image = document.querySelector('[data-about-person-image]');
  if (!viewer || !image) return;
  viewer.addEventListener('pointermove', (event) => {
    const box = viewer.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width - .5) * 4;
    const y = ((event.clientY - box.top) / box.height - .5) * 4;
    image.style.setProperty('--portrait-x', `${x}px`);
    image.style.setProperty('--portrait-y', `${y}px`);
  });
  viewer.addEventListener('pointerleave', () => {
    image.style.removeProperty('--portrait-x');
    image.style.removeProperty('--portrait-y');
  });
}

function setupRailIndexes() {
  document.querySelectorAll('[data-horizontal-rail]').forEach((rail) => {
    const items = [...rail.querySelectorAll('[data-rail-item]')];
    const scope = rail.closest('.process-stage,.plans-layout,.works-viewer') || rail.parentElement;
    const index = scope?.querySelector('[data-rail-index]');
    if (!index || !items.length) return;
    index.replaceChildren();
    items.forEach((item, itemIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = itemIndex === 0 ? 'is-current' : '';
      button.setAttribute('aria-label', `${itemIndex + 1}번째 항목 보기`);
      button.addEventListener('click', () => item.click());
      index.append(button);
    });
    items.forEach((item, itemIndex) => item.addEventListener('click', () => {
      index.querySelectorAll('button').forEach((button, indexValue) => {
        button.classList.toggle('is-current', indexValue === itemIndex);
      });
    }));
  });
}

function setupIntro() {
  const gate = document.querySelector('[data-intro-gate]');
  const text = document.querySelector('[data-intro-text]');
  const logo = document.querySelector('[data-intro-logo]');
  const headerLogo = document.querySelector('.brand-mark');
  const skip = document.querySelector('[data-intro-skip]');
  const key = 'n2j-trini-intro-seen';
  if (new URLSearchParams(location.search).get('intro') === 'replay') {
    try { sessionStorage.removeItem(key); } catch {}
  }

  const hide = (converge = true) => {
    clearTimeout(state.introTimer);
    if (converge && logo && headerLogo && !reducedMotion.matches) {
      const from = logo.getBoundingClientRect();
      const to = headerLogo.getBoundingClientRect();
      const x = (to.left + to.width / 2) - (from.left + from.width / 2);
      const y = (to.top + to.height / 2) - (from.top + from.height / 2);
      const scale = Math.min(1, to.width / Math.max(1, from.width));
      gate.style.setProperty('--intro-target-x', `${x}px`);
      gate.style.setProperty('--intro-target-y', `${y}px`);
      gate.style.setProperty('--intro-target-scale', String(scale));
      gate.classList.add('is-converging');
      state.introTimer = setTimeout(() => gate.classList.add('is-hidden'), 900);
    } else gate.classList.add('is-hidden');
    try { sessionStorage.setItem(key, '1'); } catch {}
  };

  skip.addEventListener('click', () => hide(false));
  let seen = false;
  try { seen = sessionStorage.getItem(key) === '1'; } catch {}
  if (seen) {
    hide(false);
    return;
  }
  const word = 'N2J TRINI';
  // Keep the visible wordmark empty until the typewriter owns it. This avoids
  // a static full logo flash before the first character is committed.
  text.textContent = '';
  if (reducedMotion.matches) {
    text.textContent = word;
    state.introTimer = setTimeout(() => hide(false), 900);
    return;
  }
  let cursor = 0;
  const typeNext = () => {
    text.textContent = word.slice(0, cursor += 1);
    if (cursor < word.length) state.introTimer = setTimeout(typeNext, 120);
    else state.introTimer = setTimeout(hide, 3000);
  };
  state.introTimer = setTimeout(typeNext, 280);
  addEventListener('error', hide, { once:true });
}

function setupIntroParallax() {
  if (!matchMedia('(pointer:fine)').matches) return;
  const mark = document.querySelector('.intro-media-mark');
  const intro = document.querySelector('#intro');
  if (!mark || !intro) return;
  intro.addEventListener('pointermove', (event) => {
    const box = intro.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width - .5) * 6;
    const y = ((event.clientY - box.top) / box.height - .5) * 6;
    mark.style.transform = `translate3d(${x}px,${y}px,0)`;
  });
  intro.addEventListener('pointerleave', () => { mark.style.transform = ''; });
}

function audit() {
  const active = chapters[state.active];
  const activeBox = active.getBoundingClientRect();
  const stageBox = stage.getBoundingClientRect();
  const visible = (element) => element.offsetParent !== null && !element.closest('[aria-hidden="true"]');
  const textElements = [...active.querySelectorAll('h1,h2,h3,p,a,button,strong')].filter(visible);
  const clippedText = textElements.filter((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const clipsX = ['hidden','clip'].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
    const clipsY = ['hidden','clip'].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    const insideManagedScroller = element.closest('[data-horizontal-subscroll],[data-inner-scroll],.plans-layout,.about-shell');
    const outside = !insideManagedScroller && (
      box.left < -1 || box.right > innerWidth + 1 || box.top < stageBox.top - 1 || box.bottom > innerHeight + 1
    );
    return clipsX || clipsY || outside;
  }).map((element) => element.textContent.trim().slice(0,80));

  const ctas = [...active.querySelectorAll('a,button')].filter(visible);
  const roleElements = {
    title:[...active.querySelectorAll('h1,h2')],
    description:[...active.querySelectorAll('.chapter__description')],
    media:[...active.querySelectorAll('.hero-composition,.value-rail,.shop-visual,.process-stage,.works-viewer,.about-visual')],
    cta:ctas,
  };
  const boxOf = (element) => {
    const box = element.getBoundingClientRect();
    return { text:element.textContent.trim().slice(0,80), x:box.x, y:box.y, width:box.width, height:box.height, right:box.right, bottom:box.bottom };
  };
  const intersectsViewport = (element) => {
    const box = element.getBoundingClientRect();
    return box.right > 0 && box.left < innerWidth && box.bottom > stageBox.top && box.top < innerHeight;
  };
  const boundingBoxes = Object.fromEntries(Object.entries(roleElements).map(([role,elements]) => [role,elements.filter(intersectsViewport).map(boxOf)]));
  const overlaps = (a,b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const ctaIntersections = [];
  for (let a=0;a<ctas.length;a+=1) for (let b=a+1;b<ctas.length;b+=1) {
    if (overlaps(ctas[a].getBoundingClientRect(),ctas[b].getBoundingClientRect())) ctaIntersections.push([ctas[a].textContent.trim(),ctas[b].textContent.trim()]);
  }
  const contentIntersections = [];
  for (const [firstRole,secondRole] of [['title','description'],['title','media'],['description','media']]) {
    for (const first of roleElements[firstRole]) for (const second of roleElements[secondRole]) {
      if (!first.contains(second) && !second.contains(first) && overlaps(first.getBoundingClientRect(),second.getBoundingClientRect())) contentIntersections.push({firstRole,secondRole});
    }
  }

  return {
    chapter:active.dataset.chapter,
    buildId:document.documentElement.dataset.buildId,
    viewport:{width:innerWidth,height:innerHeight},
    viewportOverflow:Math.max(0,document.documentElement.scrollWidth - innerWidth),
    sceneSnapError:{left:activeBox.left,right:activeBox.right-innerWidth},
    stage:{scrollLeft:stage.scrollLeft,scrollWidth:stage.scrollWidth,clientWidth:stage.clientWidth},
    bodyVerticalOverflow:Math.max(0,document.body.scrollHeight - innerHeight),
    clippedText,ctaIntersections,contentIntersections,boundingBoxes,
    viewTransitions:{
      supported:state.viewTransitionSupported,
      reducedMotion:reducedMotion.matches,
      activeNames:[...active.querySelectorAll('.chapter__copy,.media-stage')].map((element)=>({className:element.className,name:getComputedStyle(element).viewTransitionName})).filter((item)=>item.name&&item.name!=='none'),
      pending:Boolean(state.transitionPromise),
    },
    computed:{
      bodyOverflow:getComputedStyle(document.body).overflow,
      chapterPosition:getComputedStyle(active).position,
      chapterHeight:activeBox.height,
      titleFontSize:getComputedStyle(active.querySelector('h1,h2')).fontSize,
      descriptionFontSize:getComputedStyle(active.querySelector('.chapter__description')).fontSize,
      mainColor:getComputedStyle(document.documentElement).getPropertyValue('--main').trim(),
      subColor:getComputedStyle(document.documentElement).getPropertyValue('--sub').trim(),
      pointColor:getComputedStyle(document.documentElement).getPropertyValue('--point').trim(),
      stageScrollSnapType:getComputedStyle(stage).scrollSnapType,
      scenePosition:getComputedStyle(active).position,
      sceneTransform:getComputedStyle(active).transform,
      trackTransform:getComputedStyle(track).transform,
      trackDisplay:getComputedStyle(track).display,
      sceneFlexBasis:getComputedStyle(active).flexBasis,
    },
  };
}

setupChapterNavigation();
setupWhyViewer();
setupShopViewer();
setupShopAmbientMotion();
setupProcessViewer();
setupPlansViewer();
setupAboutViewer();
setupAboutPeople();
setupAboutPointerMotion();
setupRailIndexes();
setupIntroParallax();
applyActive(initialIndex, { history:'replace' });
requestAnimationFrame(() => settleAt(initialIndex, 'auto'));
setupIntro();

window.__N2J_PREVIEW__ = {
  chapterIds,
  get activeChapter() { return chapterIds[state.active]; },
  goTo:(id) => goToChapter(chapterIds.indexOf(id), { instant:reducedMotion.matches }),
  audit,
  get engine() {
    return {
      type:'native-horizontal-scroll-snap',
      scrollLeft:stage.scrollLeft,
      sceneWidth:stage.clientWidth,
      trackScrollWidth:track.scrollWidth,
    };
  },
};
import { legacyContent } from '../content/legacy-content.js';
