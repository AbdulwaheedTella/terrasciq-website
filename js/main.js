/* ==========================================================================
   TerraSciQ Analytics — interface behaviour
   Each block is independent and exits quietly if its markup is absent.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var SVG = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var n = document.createElementNS(SVG, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---- navigation ------------------------------------------------------- */
  var nav = $('#nav'), burger = $('#burger'), menu = $('#menu');

  function onScroll() { nav.classList.toggle('is-stuck', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('is-locked', open);
  }
  burger.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1180) setMenu(false); });

  // highlight the section currently in view
  var navLinks = $$('.nav__links a');
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) spy.observe(s); });
  }

  /* ---- reveal on scroll ------------------------------------------------- */
  function countUp(node) {
    var end = parseFloat(node.dataset.count), dec = +node.dataset.dec || 0, suf = node.dataset.suffix || '', sep = node.dataset.sep;
    var fmt = function (v) { var s = v.toFixed(dec); if (sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); return s + suf; };
    if (reduced) { node.textContent = fmt(end); return; }
    var t0 = performance.now(), dur = 1500;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      node.textContent = fmt(end * e);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  var watched = $$('.rv, .rail, .console, [data-count]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        if (e.target.dataset.count) countUp(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    watched.forEach(function (n) { io.observe(n); });
  } else {
    watched.forEach(function (n) { n.classList.add('is-in'); });
  }

  /* ---- hero ------------------------------------------------------------- */
  var heroCanvas = $('#hero-canvas');
  if (heroCanvas && window.TSQ) {
    var hero = TSQ.hero(heroCanvas, { coord: $('#hud-coord'), val: $('#hud-val') });
    var layerBtns = $$('[data-layer]');
    layerBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var name = b.dataset.layer, meta = hero.layers[name];
        hero.setLayer(name);
        layerBtns.forEach(function (o) { o.setAttribute('aria-pressed', String(o.dataset.layer === name)); });
        $('#hud-ramp').style.background = meta.css;
        $('#hud-lo').textContent = meta.lo; $('#hud-hi').textContent = meta.hi;
      });
    });
  }

  /* ---- generated section visuals ---------------------------------------- */
  if (window.TSQ) {
    $$('[data-contours]').forEach(TSQ.contours);
    if ($('#aq-canvas')) TSQ.air($('#aq-canvas'));

    // Data → Intelligence → Decision: the same grid, progressively resolved
    (function () {
      var a = $('#viz-data'), b = $('#viz-intel'), c = $('#viz-decision');
      if (!a) return;
      var r = TSQ.rng(8), n = TSQ.noise(51), cw = 20, cols = 20, rows = 7;
      var box = { x0: 99, y0: 99, x1: 0, y1: 0 };
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        var v = n(x * 0.16, y * 0.22, 3), px = x * cw, py = y * cw - 4;
        a.appendChild(el('rect', { x: px + 3, y: py + 3, width: cw - 6, height: cw - 6, fill: '#e9ede9', opacity: (r() * 0.5 + 0.04).toFixed(2) }));
        if (v > 0.6 && x < 14) { box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y); }
        var col = v > 0.6 ? '#ee6a2e' : v > 0.52 ? '#8db548' : v > 0.44 ? '#2f6f57' : '#16302a';
        b.appendChild(el('rect', { x: px + 1, y: py + 1, width: cw - 2, height: cw - 2, fill: col, opacity: 0.9 }));
        c.appendChild(el('rect', { x: px + 1, y: py + 1, width: cw - 2, height: cw - 2, fill: v > 0.6 ? '#ee6a2e' : '#16302a', opacity: v > 0.6 ? 0.95 : 0.55 }));
      }
      // outline the cluster the model flags, and label it
      var bx = box.x0 * cw - 3, by = Math.max(2, box.y0 * cw - 7), bw = (box.x1 - box.x0 + 1) * cw + 6, bh = Math.min(128 - by, (box.y1 - box.y0 + 1) * cw + 6);
      var g = el('g', { fill: 'none', stroke: '#e9ede9', 'stroke-width': 1 });
      g.appendChild(el('rect', { x: bx, y: by, width: bw, height: bh, 'stroke-dasharray': '4 4' }));
      g.appendChild(el('path', { d: 'M' + (bx + bw) + ' 66h' + Math.max(12, 300 - bx - bw) }));
      c.appendChild(g);
      [['PRIORITY', '#e9ede9', 62], ['ZONE 01', '#ee6a2e', 76]].forEach(function (l) {
        var t = el('text', { x: 308, y: l[2], fill: l[1], 'font-family': 'IBM Plex Mono, monospace', 'font-size': 9, 'letter-spacing': 1 });
        t.textContent = l[0]; c.appendChild(t);
      });
    })();

    // Environmental analytics tile: graduated symbols over a smooth surface
    (function () {
      var s = $('#viz-env'); if (!s) return;
      var n = TSQ.noise(140);
      for (var y = 0; y < 6; y++) for (var x = 0; x < 13; x++) {
        var v = n(x * 0.2 + 2, y * 0.26 + 1, 3), hot = v > 0.6;
        s.appendChild(el('circle', { cx: 28 + x * 22, cy: 30 + y * 22, r: (1.4 + v * 7).toFixed(1), 'class': (hot ? 'fo grow' : 'f') + (v < 0.46 ? ' dim' : ''), opacity: hot ? 0.95 : 0.75 }));
      }
    })();
  }

  /* ---- capabilities: expandable detail ---------------------------------- */
  $$('.cap__toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cap = btn.closest('.cap'), open = !cap.classList.contains('is-open');
      cap.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.firstElementChild.textContent = open ? 'Close' : 'Explore capability';
    });
  });

  /* ---- work: Kuala Lumpur 2000 / 2020 comparison ------------------------ */
  var compare = $('#compare');
  if (compare) {
    var range = $('input', compare), imgA = $('#cmp-a'), imgB = $('#cmp-b'), key = $('#kl-key');
    var setP = function () { compare.style.setProperty('--p', range.value + '%'); };
    range.addEventListener('input', setP); setP();

    var scale = function (css, lo, hi) { return '<div class="bar" style="background:' + css + '"></div><div class="ends"><span>' + lo + '</span><span>' + hi + '</span></div>'; };
    var KL = {
      landcover: { label: 'Land cover', key: '<p>Five classes mapped at 30 m. Colours match the table below. 21% of the city changed class between 2000 and 2020.</p>' },
      ndvi: { label: 'Vegetation index (NDVI)', key: scale('linear-gradient(90deg,#8a5a2b,#d9c27a,#9fbf5a,#3f8a45,#12512f)', 'Sparse 0.05', 'Dense 0.37') + '<p>Greenness measured from the red and near-infrared bands. City-wide mean 0.185 in 2000 and 0.191 in 2020.</p>' },
      ndbi: { label: 'Built-up index (NDBI)', key: scale('linear-gradient(90deg,#0f4c5c,#5fa8a0,#e8e2c8,#e9954a,#b8321f)', 'Low −0.18', 'High 0.07') + '<p>Built surface intensity from the shortwave and near-infrared bands. City-wide mean −0.059 in 2000 and −0.047 in 2020.</p>' },
      elevation: { label: 'Elevation', single: true, key: scale('linear-gradient(90deg,#1b4d42,#4f7648,#a7925e,#d9c9a3,#f3ecd9)', '14 m', '318 m') + '<p>Terrain model with hillshade. It also provides the relief shading under the other layers.</p>' }
    };
    var klBtns = $$('[data-kl]');
    var pick = function (name) {
      var L = KL[name], a = 'assets/img/kl-' + name + (L.single ? '' : '-2000') + '.webp', b = 'assets/img/kl-' + name + (L.single ? '' : '-2020') + '.webp';
      klBtns.forEach(function (o) { o.setAttribute('aria-pressed', String(o.dataset.kl === name)); });
      key.innerHTML = L.key;
      compare.classList.add('is-swapping');
      setTimeout(function () {
        imgA.src = a; imgB.src = b;
        imgA.alt = L.label + ' of Kuala Lumpur' + (L.single ? '.' : ' in 2000.'); imgB.alt = L.label + ' of Kuala Lumpur in 2020.';
        compare.classList.toggle('is-single', !!L.single);
        var done = function () { compare.classList.remove('is-swapping'); };
        if (imgA.decode) imgA.decode().then(done, done); else done();
      }, reduced ? 0 : 200);
    };
    klBtns.forEach(function (b) { b.addEventListener('click', function () { pick(b.dataset.kl); }); });
    key.innerHTML = KL.landcover.key;
  }

  /* ---- work: open figures full size ------------------------------------ */
  var figs = $$('.case .plate img, .case .thumbs img');
  if (figs.length && 'HTMLDialogElement' in window) {
    var box = document.createElement('dialog');
    box.className = 'lightbox'; box.setAttribute('aria-label', 'Figure, full size');
    box.innerHTML = '<div class="lightbox__in"><button class="lightbox__close" type="button">Close</button><div class="lightbox__stage"><img alt=""></div><p class="lightbox__cap"></p></div>';
    document.body.appendChild(box);
    var big = $('img', box), cap = $('.lightbox__cap', box);
    var shut = function () { box.close(); };
    $('.lightbox__close', box).addEventListener('click', shut);
    big.addEventListener('click', shut);
    box.addEventListener('click', function (e) { if (e.target === box || e.target.classList.contains('lightbox__stage')) shut(); });
    figs.forEach(function (img) {
      img.classList.add('zoomable'); img.tabIndex = 0; img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Enlarge figure: ' + img.alt);
      var open = function () { big.src = img.currentSrc || img.src; big.alt = img.alt; cap.textContent = img.alt; box.showModal(); };
      img.addEventListener('click', open);
      img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  /* ---- work: view all --------------------------------------------------- */
  var moreBtn = $('#more-work-btn');
  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      var box = $('#more-work'), open = !box.classList.contains('is-open');
      box.classList.toggle('is-open', open);
      moreBtn.setAttribute('aria-expanded', String(open));
      moreBtn.firstElementChild.textContent = open ? 'Show less' : 'View all work';
    });
  }

  /* ---- area of applicability: step through the map ---------------------- */
  var aoaMap = $('#aoa-map'), steps = $$('#aoa-steps .step');
  if (aoaMap && steps.length) {
    var timer = null, current = 4;
    var show = function (n) {
      current = n; aoaMap.dataset.step = n;
      steps.forEach(function (s) { var on = +s.dataset.step === n; s.classList.toggle('is-on', on); s.setAttribute('aria-pressed', String(on)); });
    };
    var cycle = function () { timer = setInterval(function () { show(current % 4 + 1); }, 2800); };
    var halt = function () { clearInterval(timer); timer = null; };
    steps.forEach(function (s) {
      var pick = function () { halt(); show(+s.dataset.step); };
      s.addEventListener('click', pick); s.addEventListener('focus', pick);
      if (finePointer) s.addEventListener('mouseenter', pick);
    });
    if (!reduced && 'IntersectionObserver' in window) {
      var userTook = false;
      steps.forEach(function (s) { s.addEventListener('click', function () { userTook = true; }); });
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting && !timer && !userTook) { show(1); cycle(); } else if (!e[0].isIntersecting) halt();
      }, { threshold: 0.35 }).observe(aoaMap);
    }
  }

  /* ---- research: topic filter ------------------------------------------- */
  var filters = $$('.filter'), pubs = $$('.pub');
  filters.forEach(function (f) {
    f.addEventListener('click', function () {
      var k = f.dataset.filter;
      filters.forEach(function (o) { o.setAttribute('aria-pressed', String(o === f)); });
      pubs.forEach(function (p) { p.hidden = k !== 'all' && p.dataset.topics.split(' ').indexOf(k) === -1; });
    });
  });

  /* ---- magnetic buttons ------------------------------------------------- */
  if (finePointer && !reduced) {
    $$('[data-magnetic]').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  /* ---- contact form ----------------------------------------------------- */
  var form = $('#project-form');
  if (form) {
    var status = $('#form-status'), file = $('#f-file'), fileName = $('#f-file-name'), MAX = 8 * 1024 * 1024;
    var say = function (kind, html) { status.className = 'form__status is-' + kind; status.innerHTML = html; };
    var fallback = 'Please email <a href="mailto:terrasciq.analytics@gmail.com">terrasciq.analytics@gmail.com</a> or message us on <a href="https://wa.me/60102486014" target="_blank" rel="noopener">WhatsApp</a>.';

    file.addEventListener('change', function () {
      var f = file.files[0];
      if (f && f.size > MAX) { file.value = ''; fileName.textContent = 'Attach a file'; say('err', 'That file is larger than 8 MB. Please attach a smaller one or send it by email.'); return; }
      fileName.textContent = f ? f.name : 'Attach a file';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var btn = $('button[type="submit"]', form);
      btn.disabled = true; say('ok', 'Sending…');
      fetch('/', { method: 'POST', body: new FormData(form) })
        .then(function (res) {
          if (!res.ok) throw new Error(res.status);
          form.reset(); fileName.textContent = 'Attach a file';
          say('ok', 'Thank you. Your message has been received and we will be in touch shortly.');
        })
        .catch(function () { say('err', 'Your message could not be sent from this page. ' + fallback); })
        .then(function () { btn.disabled = false; });
    });
  }
})();
