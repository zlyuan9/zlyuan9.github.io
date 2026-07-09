/* ============================================================
   Desktop chrome: top-bar workspace tags (nav), live clock +
   status, theme toggle, and draggable windows.
   ============================================================ */
(function () {
  // --- Workspaces shown as tags in the bar ---
  const PAGES = {
    about:    { tag: '1', label: 'about',    href: '/index.html'    },
    projects: { tag: '2', label: 'projects', href: '/projects.html' }
  };

  const currentPage = (document.body.dataset.page) || 'about';

  /* ---- Top bar: tags (nav) ---- */
  function renderBar() {
    const tags = document.getElementById('tags');
    if (!tags) return;
    tags.innerHTML = '';
    Object.keys(PAGES).forEach(id => {
      const p = PAGES[id];
      const a = document.createElement('a');
      a.href = p.href;
      a.className = 'tag' + (id === currentPage ? ' active' : '');
      a.innerHTML = '<span class="num">' + p.tag + '</span><span class="label">' + p.label + '</span>';
      tags.appendChild(a);
    });
  }

  /* ---- Theme toggle (invert light <-> dark), persisted ---- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀ light' : '☾ dark';
      btn.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    }
  }
  function initTheme() {
    let theme = 'light';
    try { theme = localStorage.getItem('theme') || 'light'; } catch (e) {}
    applyTheme(theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', function () {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      const commit = function () {
        applyTheme(next);
        try { localStorage.setItem('theme', next); } catch (e) {}
      };

      // Circular reveal from the top-right corner sweeping to the bottom-left.
      // The reveal itself is a pure-CSS clip-path keyframe on the new snapshot
      // (see style.css) — driving it in CSS avoids the one-frame flash that a
      // JS-attached animation causes. Falls back to an instant swap where the
      // View Transitions API is missing or the user prefers reduced motion.
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!document.startViewTransition || reduce) { commit(); return; }
      document.startViewTransition(commit);
    });
  }

  /* ---- Live status readout (clock + date) ---- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function tickStatus() {
    const now = new Date();
    const time = document.getElementById('statusTime');
    const date = document.getElementById('statusDate');
    if (time) time.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    if (date) date.textContent = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  }

  /* ---- Analog clock ---- */
  function buildClockFace() {
    const face = document.getElementById('clockTicks');
    if (!face) return;
    let ticks = '';
    for (let i = 0; i < 60; i++) {
      const ang = (i / 60) * 2 * Math.PI;
      const long = i % 5 === 0;
      const r1 = long ? 40 : 44, r2 = 48;
      const x1 = 50 + r1 * Math.sin(ang), y1 = 50 - r1 * Math.cos(ang);
      const x2 = 50 + r2 * Math.sin(ang), y2 = 50 - r2 * Math.cos(ang);
      ticks += '<line class="clock-face-line" x1="' + x1.toFixed(2) + '" y1="' + y1.toFixed(2) +
               '" x2="' + x2.toFixed(2) + '" y2="' + y2.toFixed(2) +
               '" stroke-width="' + (long ? 1.6 : 0.9) + '"/>';
    }
    face.innerHTML = ticks;
  }
  function tickClock() {
    const now = new Date();
    const s = now.getSeconds();
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    setHand('handHour', h / 12, 26, 3.2);
    setHand('handMin', m / 60, 38, 2.4);
    setHand('handSec', s / 60, 42, 1.6);
  }
  // Each hand is a tapered triangle: wide near the base, narrowing to a point
  // at the tip, with the rear vertex anchored at the clock's center.
  function setHand(id, frac, len, width) {
    const el = document.getElementById(id);
    if (!el) return;
    const ang = frac * 2 * Math.PI;
    const dx = Math.sin(ang), dy = -Math.cos(ang);   // forward (toward tip)
    const px = Math.cos(ang), py = Math.sin(ang);     // perpendicular
    const base = len * 0.16;   // how far up the widest point sits
    const pt = (r, w) =>
      (50 + dx * r + px * w).toFixed(2) + ',' + (50 + dy * r + py * w).toFixed(2);
    el.setAttribute('points', [
      pt(len, 0),        // tip
      pt(base, -width),  // left shoulder
      pt(0, 0),          // center
      pt(base, width)    // right shoulder
    ].join(' '));
  }

  /* ---- Draggable elements (windows via title bar, clock via whole box) ---- */
  let zTop = 20;
  function makeDraggable(el, handle) {
    handle.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();

      // On first drag, lift the element out of flow into free-floating mode,
      // pinned at its current on-screen spot so it doesn't jump. Leave a
      // same-size placeholder behind so siblings don't reflow up.
      if (!el.classList.contains('floating')) {
        const r = el.getBoundingClientRect();
        const ph = document.createElement('div');
        ph.className = 'win-placeholder';
        ph.style.width = r.width + 'px';
        ph.style.height = r.height + 'px';
        el.parentNode.insertBefore(ph, el);
        el._placeholder = ph;
        el.style.width = r.width + 'px';
        el.style.position = 'fixed';
        el.style.left = r.left + 'px';
        el.style.top = r.top + 'px';
        el.style.margin = '0';
        el.classList.add('floating');
      }
      el.style.zIndex = ++zTop;

      const startX = e.clientX, startY = e.clientY;
      const originLeft = parseFloat(el.style.left);
      const originTop = parseFloat(el.style.top);
      handle.setPointerCapture(e.pointerId);

      function move(ev) {
        let nx = originLeft + (ev.clientX - startX);
        let ny = originTop + (ev.clientY - startY);
        const maxX = window.innerWidth - el.offsetWidth;
        const maxY = window.innerHeight - handle.offsetHeight;
        nx = Math.max(0, Math.min(nx, Math.max(0, maxX)));
        ny = Math.max(0, Math.min(ny, Math.max(0, maxY)));
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
      }
      function up(ev) {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        try { handle.releasePointerCapture(ev.pointerId); } catch (e) {}
      }
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  function initDrag() {
    // Disable dragging on touch / coarse-pointer devices — grabbing the title
    // bar there hijacks scrolling and causes janky behavior.
    const canDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!canDrag) return;

    // Windows drag by their title bar.
    document.querySelectorAll('.win').forEach(function (win) {
      const handle = win.querySelector('.win-title');
      if (handle) makeDraggable(win, handle);
    });
    // The loose clock drags by the whole box.
    document.querySelectorAll('.clock-box[data-drag]').forEach(function (box) {
      makeDraggable(box, box);
    });
  }

  /* ---- Visitor counter (hidden; toggle with Cmd/Ctrl+Shift+V) ---- */
  function initCounter() {
    const el = document.getElementById('visitorCount');
    if (!el) return;
    let visible = false;
    fetch('https://api.counterapi.dev/v1/colinzhao-portfolio/visits/up')
      .then(r => r.json())
      .then(d => { el.textContent = 'visits: ' + d.count; })
      .catch(() => { el.textContent = 'visits: --'; });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault();
        visible = !visible;
        el.style.display = visible ? 'inline' : 'none';
      }
    });
  }

  /* ---- Keyboard: press a tag number to jump to that workspace ---- */
  function initHotkeys() {
    const map = {};
    Object.keys(PAGES).forEach(id => { map[PAGES[id].tag] = PAGES[id]; });
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const dest = map[e.key];
      if (dest) window.location.href = dest.href;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderBar();
    initTheme();
    buildClockFace();
    tickStatus();
    tickClock();
    setInterval(function () { tickStatus(); tickClock(); }, 1000);
    initDrag();
    initCounter();
    initHotkeys();
  });
})();
