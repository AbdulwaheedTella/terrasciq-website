/* ==========================================================================
   TerraSciQ Analytics — generated geospatial visuals
   A small procedural terrain engine. Everything drawn here is synthetic:
   a demonstration surface, not a real place.

   Exposes window.TSQ with:
     hero(canvas, opts)        animated hero surface with switchable layers
     contours(canvas)          static contour-line backdrop
     landcover(canvas, epoch)  classified land-cover raster (epoch 0 or 1)
     air(canvas)               predicted surface with monitoring stations
   ========================================================================== */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- noise ------------------------------------------------------------ */
  function rng(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(seed) {
    var r = rng(seed), P = new Uint8Array(512), G = new Float32Array(256), i, j, t;
    for (i = 0; i < 256; i++) { P[i] = i; G[i] = r(); }
    for (i = 255; i > 0; i--) { j = (r() * (i + 1)) | 0; t = P[i]; P[i] = P[j]; P[j] = t; }
    for (i = 0; i < 256; i++) P[i + 256] = P[i];
    function n(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      xi &= 255; yi &= 255;
      var a = G[P[P[xi] + yi]], b = G[P[P[xi + 1] + yi]], c = G[P[P[xi] + yi + 1]], d = G[P[P[xi + 1] + yi + 1]];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    return function (x, y, oct) {
      var amp = 0.5, f = 1, s = 0, norm = 0;
      for (var o = 0; o < oct; o++) { s += amp * n(x * f, y * f); norm += amp; amp *= 0.5; f *= 2.03; }
      return s / norm;
    };
  }

  var nH = makeNoise(20260), nV = makeNoise(77), nU = makeNoise(412), nA = makeNoise(9031);

  function normalise(a) {
    var lo = Infinity, hi = -Infinity, i;
    for (i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; }
    var k = 1 / (hi - lo || 1);
    for (i = 0; i < a.length; i++) a[i] = (a[i] - lo) * k;
    return a;
  }

  /* Builds elevation (h), drainage proximity (v), urban score (u), air (a). */
  function buildField(cols, rows, zoom) {
    var n = cols * rows, h = new Float32Array(n), v = new Float32Array(n), u = new Float32Array(n), a = new Float32Array(n);
    var s = zoom / rows, cx = cols * 0.56, cy = rows * 0.52, R = Math.max(cols, rows) * 0.6;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = y * cols + x, px = x * s, py = y * s;
        var valley = Math.abs(nV(px * 0.9 + 3.1, py * 0.9 + 7.7, 3) - 0.5) * 2;
        var e = nH(px + 11.3, py + 4.2, 5);
        h[i] = e * 0.74 + Math.min(valley * 2.2, 1) * 0.26;
        v[i] = valley;
        var d = Math.hypot(x - cx, y - cy) / R;
        u[i] = nU(px * 2.2 + 1.7, py * 2.2 + 9.4, 4) * 0.6 + (1 - Math.min(d, 1)) * 0.62;
        a[i] = nA(px * 0.55 + 5.5, py * 0.55 + 2.2, 3);
      }
    }
    return { cols: cols, rows: rows, h: normalise(h), v: v, u: u, a: normalise(a) };
  }

  /* ---- colour ----------------------------------------------------------- */
  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function ramp(stops) {
    var s = stops.map(function (p) { return [p[0]].concat(hex(p[1])); });
    return function (t) {
      if (t <= s[0][0]) return s[0].slice(1);
      for (var i = 1; i < s.length; i++) {
        if (t <= s[i][0]) {
          var a = s[i - 1], b = s[i], k = (t - a[0]) / (b[0] - a[0]);
          return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
        }
      }
      return s[s.length - 1].slice(1);
    };
  }

  var RAMPS = {
    elevation: ramp([[0, '#06100e'], [0.28, '#0d2a26'], [0.5, '#1b4d42'], [0.68, '#4f7648'], [0.84, '#a7925e'], [1, '#e9dfc6']]),
    flood: ramp([[0, '#080f0e'], [0.42, '#0d2530'], [0.6, '#145a7c'], [0.74, '#2aa3cf'], [0.87, '#e6c84a'], [1, '#ee6a2e']]),
    air: ramp([[0, '#0a1413'], [0.36, '#12322e'], [0.58, '#4b773c'], [0.76, '#8db548'], [0.9, '#e6a23a'], [1, '#ee6a2e']])
  };
  var LC = { water: hex('#2f7fb8'), built: hex('#d9623a'), veg: hex('#4f8a4c'), crop: hex('#b9ad62') };

  var LAYERS = {
    elevation: { css: 'linear-gradient(90deg,#0d2a26,#1b4d42,#4f7648,#a7925e,#e9dfc6)', lo: '0 m', hi: '320 m' },
    flood: { css: 'linear-gradient(90deg,#0d2530,#145a7c,#2aa3cf,#e6c84a,#ee6a2e)', lo: 'Very low', hi: 'Very high' },
    landcover: { css: 'linear-gradient(90deg,#2f7fb8 0 25%,#4f8a4c 25% 50%,#b9ad62 50% 75%,#d9623a 75%)', lo: 'Water · veg', hi: 'Crop · built' },
    air: { css: 'linear-gradient(90deg,#12322e,#4b773c,#8db548,#e6a23a,#ee6a2e)', lo: '20 µg/m³', hi: '100 µg/m³' }
  };

  function floodScore(F, i) { return Math.max(0, Math.min(1, (1 - F.h[i]) * 0.62 + (1 - Math.min(F.v[i] * 2.4, 1)) * 0.5)); }
  function lcClass(F, i, epoch) {
    if (F.v[i] < 0.045 && F.h[i] < 0.62) return 'water';
    if (F.h[i] < 0.14) return 'water';
    if (F.u[i] > (epoch ? 0.7 : 0.86)) return 'built';
    if (F.h[i] > 0.6) return 'veg';
    return F.u[i] + F.a[i] * 0.3 > 0.62 ? 'crop' : 'veg';
  }

  /* Paints a field into an offscreen canvas at grid resolution. */
  function raster(F, layer, opt) {
    opt = opt || {};
    var c = document.createElement('canvas'); c.width = F.cols; c.height = F.rows;
    var g = c.getContext('2d'), img = g.createImageData(F.cols, F.rows), d = img.data;
    var dim = opt.dim == null ? 1 : opt.dim, shadeK = opt.shade == null ? 5 : opt.shade;
    for (var y = 0; y < F.rows; y++) {
      for (var x = 0; x < F.cols; x++) {
        var i = y * F.cols + x, col;
        if (layer === 'elevation') col = RAMPS.elevation(F.h[i]);
        else if (layer === 'flood') col = RAMPS.flood(floodScore(F, i));
        else if (layer === 'air') col = RAMPS.air(F.a[i]);
        else col = LC[lcClass(F, i, opt.epoch)];
        var xl = x > 0 ? F.h[i - 1] : F.h[i], yu = y > 0 ? F.h[i - F.cols] : F.h[i];
        var sh = 1 + ((F.h[i] - xl) + (F.h[i] - yu)) * shadeK;
        sh = Math.max(0.55, Math.min(1.45, sh)) * dim;
        var o = i * 4;
        d[o] = col[0] * sh; d[o + 1] = col[1] * sh; d[o + 2] = col[2] * sh; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /* Marching squares: strokes iso-lines of `data` onto ctx, scaled to w × h. */
  function strokeContours(ctx, data, cols, rows, w, h, levels, style) {
    var sx = w / (cols - 1), sy = h / (rows - 1);
    levels.forEach(function (lv, li) {
      ctx.beginPath();
      for (var y = 0; y < rows - 1; y++) {
        for (var x = 0; x < cols - 1; x++) {
          var i = y * cols + x, a = data[i], b = data[i + 1], c = data[i + cols + 1], d = data[i + cols];
          var k = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
          if (k === 0 || k === 15) continue;
          var tx = x + (lv - a) / (b - a), ty = y, rx = x + 1, ry = y + (lv - b) / (c - b);
          var bx = x + (lv - d) / (c - d), by = y + 1, lx = x, ly = y + (lv - a) / (d - a);
          var seg = function (x1, y1, x2, y2) { ctx.moveTo(x1 * sx, y1 * sy); ctx.lineTo(x2 * sx, y2 * sy); };
          switch (k) {
            case 1: case 14: seg(lx, ly, bx, by); break;
            case 2: case 13: seg(bx, by, rx, ry); break;
            case 3: case 12: seg(lx, ly, rx, ry); break;
            case 4: case 11: seg(tx, ty, rx, ry); break;
            case 6: case 9: seg(tx, ty, bx, by); break;
            case 7: case 8: seg(lx, ly, tx, ty); break;
            case 5: seg(lx, ly, tx, ty); seg(bx, by, rx, ry); break;
            case 10: seg(lx, ly, bx, by); seg(tx, ty, rx, ry); break;
          }
        }
      }
      var major = li % 5 === 0;
      ctx.strokeStyle = major ? style.major : style.minor;
      ctx.lineWidth = major ? style.wMajor : style.wMinor;
      ctx.stroke();
    });
  }

  function levelSet(step) { var l = []; for (var v = step; v < 1; v += step) l.push(+v.toFixed(3)); return l; }

  function fit(canvas, maxDpr) {
    var dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    return { w: w, h: h, dpr: dpr };
  }

  function onResize(fn, target) {
    var t, run = function () { clearTimeout(t); t = setTimeout(fn, 180); };
    if (target && 'ResizeObserver' in window) {
      var box = target.clientWidth + 'x' + target.clientHeight;
      new ResizeObserver(function () {
        var b = target.clientWidth + 'x' + target.clientHeight;
        if (b !== box) { box = b; run(); }
      }).observe(target);
    } else window.addEventListener('resize', run);
  }

  /* ---- hero ------------------------------------------------------------- */
  function hero(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), S, F, base = {}, layer = 'elevation', prev = null, fadeT = 0;
    var pts = [], links = [], mouse = null, running = false, visible = true, last = 0, t0 = performance.now();
    var EXT = { lon0: 3.1, lon1: 3.75, lat0: 6.7, lat1: 6.35 };

    function build() {
      S = fit(canvas, 1.5); if (!S) return;
      var rows = S.w < 700 ? 120 : 170, cols = Math.max(90, Math.min(440, Math.round(rows * S.w / S.h)));
      F = buildField(cols, rows, S.w < 700 ? 3.4 : 4.2);
      base = {};
      var r = rng(31); pts = [];
      var x0 = S.w < 900 ? 0.08 : 0.36;
      for (var i = 0; i < (S.w < 700 ? 9 : 16); i++) pts.push({ u: x0 + r() * (0.96 - x0), v: 0.14 + r() * 0.7, ph: r() * TAU, id: i + 1 });
      links = [];
      pts.forEach(function (p, i) {
        pts.map(function (q, j) { return { j: j, d: Math.hypot((p.u - q.u) * S.w, (p.v - q.v) * S.h) }; })
          .filter(function (o) { return o.j !== i; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 2)
          .forEach(function (o) { if (o.j > i || !links.some(function (l) { return l[0] === o.j && l[1] === i; })) links.push([i, o.j, r()]); });
      });
      frame(performance.now(), true);
    }

    function staticLayer(name) {
      if (base[name]) return base[name];
      var c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(raster(F, name, { dim: name === 'landcover' ? 0.62 : 0.86, epoch: 1 }), 0, 0, c.width, c.height);
      strokeContours(g, F.h, F.cols, F.rows, c.width, c.height, levelSet(0.04), {
        major: 'rgba(233,237,233,.26)', minor: 'rgba(233,237,233,.1)', wMajor: 1 * S.dpr, wMinor: 0.7 * S.dpr
      });
      // graticule
      g.strokeStyle = 'rgba(233,237,233,.07)'; g.lineWidth = 1; g.beginPath();
      var step = 120 * S.dpr;
      for (var x = step; x < c.width; x += step) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, c.height); }
      for (var y = step; y < c.height; y += step) { g.moveTo(0, y + 0.5); g.lineTo(c.width, y + 0.5); }
      g.stroke();
      base[name] = c; return c;
    }

    function valueAt(u, v) {
      var x = Math.max(0, Math.min(F.cols - 1, Math.round(u * (F.cols - 1)))), y = Math.max(0, Math.min(F.rows - 1, Math.round(v * (F.rows - 1)))), i = y * F.cols + x;
      if (layer === 'elevation') return 'Elev. ' + String(Math.round(F.h[i] * 320)).padStart(3, '0') + ' m';
      if (layer === 'flood') { var s = floodScore(F, i); return 'Susceptibility ' + (s > 0.86 ? 'very high' : s > 0.74 ? 'high' : s > 0.6 ? 'moderate' : s > 0.42 ? 'low' : 'very low'); }
      if (layer === 'air') return 'PM10 ' + Math.round(20 + F.a[i] * 80) + ' µg/m³';
      return { water: 'Water', built: 'Built-up', veg: 'Vegetation', crop: 'Cropland' }[lcClass(F, i, 1)];
    }

    function readout(u, v) {
      if (!opts.coord || !F) return;
      var lon = EXT.lon0 + (EXT.lon1 - EXT.lon0) * u, lat = EXT.lat0 + (EXT.lat1 - EXT.lat0) * v;
      opts.coord.textContent = '0' + lat.toFixed(4) + '° N, 00' + lon.toFixed(4) + '° E';
      opts.val.textContent = valueAt(u, v);
    }

    function frame(now, force) {
      if (!S || !F) return;
      if (!force && now - last < 33) return;
      last = now;
      var t = (now - t0) / 1000, W = canvas.width, H = canvas.height, d = S.dpr;
      ctx.globalAlpha = 1;
      ctx.drawImage(staticLayer(layer), 0, 0);
      if (prev && fadeT > 0) {
        var k = Math.max(0, 1 - (now - fadeT) / 700);
        if (k > 0) { ctx.globalAlpha = k; ctx.drawImage(staticLayer(prev), 0, 0); ctx.globalAlpha = 1; } else prev = null;
      }

      // scan line
      var sp = reduced ? 0.62 : (t / 11) % 1.15, sx = sp * W, band = 190 * d;
      var gr = ctx.createLinearGradient(sx - band, 0, sx, 0);
      gr.addColorStop(0, 'rgba(141,181,72,0)'); gr.addColorStop(1, 'rgba(141,181,72,.13)');
      ctx.fillStyle = gr; ctx.fillRect(sx - band, 0, band, H);
      ctx.fillStyle = 'rgba(190,225,130,.55)'; ctx.fillRect(sx, 0, 1 * d, H);

      // area of interest
      if (S.w >= 900) {
        var ax = W * 0.56, ay = H * 0.5, aw = W * 0.2, ah = H * 0.27, cl = 14 * d;
        ctx.strokeStyle = 'rgba(233,237,233,.2)'; ctx.lineWidth = 1; ctx.setLineDash([4 * d, 5 * d]);
        ctx.strokeRect(ax + 0.5, ay + 0.5, aw, ah); ctx.setLineDash([]);
        ctx.strokeStyle = '#ee6a2e'; ctx.lineWidth = 1.5 * d; ctx.beginPath();
        [[ax, ay, 1, 1], [ax + aw, ay, -1, 1], [ax, ay + ah, 1, -1], [ax + aw, ay + ah, -1, -1]].forEach(function (c) {
          ctx.moveTo(c[0] + c[2] * cl, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + c[3] * cl);
        });
        ctx.stroke();
        ctx.font = '500 ' + 10 * d + 'px "IBM Plex Mono", monospace'; ctx.fillStyle = '#ee6a2e';
        ctx.fillText('AOI 01  ·  ANALYSIS EXTENT', ax, ay - 8 * d);
      }

      // network links with travelling pulses
      ctx.lineWidth = 1;
      links.forEach(function (l) {
        var a = pts[l[0]], b = pts[l[1]], x1 = a.u * W, y1 = a.v * H, x2 = b.u * W, y2 = b.v * H;
        ctx.strokeStyle = 'rgba(79,203,238,.2)'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (!reduced) {
          var p = (t * 0.22 + l[2]) % 1;
          ctx.fillStyle = 'rgba(79,203,238,.9)'; ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p, 1.6 * d, 0, TAU); ctx.fill();
        }
      });

      // monitoring points
      ctx.font = 9.5 * d + 'px "IBM Plex Mono", monospace';
      pts.forEach(function (p, i) {
        var x = p.u * W, y = p.v * H, hit = Math.abs(x - sx) < 26 * d, pulse = reduced ? 0.5 : (Math.sin(t * 1.6 + p.ph) + 1) / 2;
        ctx.strokeStyle = 'rgba(233,237,233,' + (0.16 + pulse * 0.2) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, (7 + pulse * 6) * d, 0, TAU); ctx.stroke();
        ctx.fillStyle = hit ? '#bfe182' : '#e9ede9';
        ctx.beginPath(); ctx.arc(x, y, (hit ? 3.4 : 2.4) * d, 0, TAU); ctx.fill();
        if (i % 4 === 0 && S.w >= 700) { ctx.fillStyle = 'rgba(233,237,233,.6)'; ctx.fillText('STN-' + String(p.id).padStart(2, '0'), x + 12 * d, y + 3 * d); }
      });

      // cursor crosshair
      if (mouse) {
        var mx = mouse.u * W, my = mouse.v * H;
        ctx.strokeStyle = 'rgba(233,237,233,.3)'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(mx + 0.5, 0); ctx.lineTo(mx + 0.5, H); ctx.moveTo(0, my + 0.5); ctx.lineTo(W, my + 0.5); ctx.stroke();
        ctx.strokeStyle = '#e9ede9'; ctx.strokeRect(mx - 5 * d, my - 5 * d, 10 * d, 10 * d);
      }
    }

    function loop(now) { if (!running) return; frame(now); requestAnimationFrame(loop); }
    function start() { if (running || reduced || !visible || document.hidden) return; running = true; requestAnimationFrame(loop); }
    function stop() { running = false; }

    var host = canvas.parentElement;
    host.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = canvas.getBoundingClientRect();
      mouse = { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height };
      readout(mouse.u, mouse.v);
      if (reduced) frame(performance.now(), true);
    });
    host.addEventListener('pointerleave', function () { mouse = null; if (reduced) frame(performance.now(), true); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; visible ? start() : stop(); }).observe(canvas);
    }
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    // rebuild whenever the canvas box changes (also covers a pane that was hidden at load)
    var lastBox = '';
    function rebuild() {
      var box = canvas.clientWidth + 'x' + canvas.clientHeight;
      if (box === lastBox || !canvas.clientWidth) return;
      lastBox = box; build(); readout(mouse ? mouse.u : 0.72, mouse ? mouse.v : 0.5);
    }
    if ('ResizeObserver' in window) {
      var rt; new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(rebuild, lastBox ? 180 : 0); }).observe(canvas);
    } else onResize(rebuild);
    rebuild(); start();

    return {
      setLayer: function (name) {
        if (!LAYERS[name] || name === layer) return LAYERS[name];
        prev = layer; layer = name; fadeT = performance.now();
        readout(mouse ? mouse.u : 0.72, mouse ? mouse.v : 0.5);
        if (reduced) { prev = null; frame(performance.now(), true); }
        return LAYERS[name];
      },
      layers: LAYERS
    };
  }

  /* ---- static visuals --------------------------------------------------- */
  function contours(canvas) {
    function draw() {
      var S = fit(canvas, 1.5); if (!S) return;
      var rows = 110, cols = Math.max(80, Math.min(320, Math.round(rows * S.w / S.h)));
      var F = buildField(cols, rows, 3), g = canvas.getContext('2d');
      g.clearRect(0, 0, canvas.width, canvas.height);
      strokeContours(g, F.h, cols, rows, canvas.width, canvas.height, levelSet(0.04), {
        major: 'rgba(233,237,233,.2)', minor: 'rgba(233,237,233,.09)', wMajor: S.dpr, wMinor: 0.7 * S.dpr
      });
    }
    draw(); onResize(draw, canvas);
  }

  function landcover(canvas, epoch) {
    function draw() {
      var S = fit(canvas, 2); if (!S) return;
      var rows = 150, cols = Math.round(rows * S.w / S.h), F = buildField(cols, rows, 3.6), g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(raster(F, 'landcover', { epoch: epoch, dim: 0.96, shade: 3 }), 0, 0, canvas.width, canvas.height);
    }
    draw(); onResize(draw, canvas);
  }

  function air(canvas) {
    function draw() {
      var S = fit(canvas, 2); if (!S) return;
      var rows = 130, cols = Math.round(rows * S.w / S.h), F = buildField(cols, rows, 3.2), g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, d = S.dpr;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(raster(F, 'air', { dim: 0.95, shade: 1.5 }), 0, 0, W, H);
      strokeContours(g, F.a, cols, rows, W, H, levelSet(0.1), { major: 'rgba(8,12,11,.4)', minor: 'rgba(8,12,11,.4)', wMajor: d, wMinor: d });
      g.strokeStyle = 'rgba(233,237,233,.08)'; g.lineWidth = 1; g.beginPath();
      for (var x = 80 * d; x < W; x += 80 * d) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
      for (var y = 80 * d; y < H; y += 80 * d) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
      g.stroke();
      var r = rng(5); g.font = 9.5 * d + 'px "IBM Plex Mono", monospace';
      for (var i = 0; i < 17; i++) {
        var u = 0.06 + r() * 0.88, v = 0.1 + r() * 0.8, px = u * W, py = v * H;
        var val = Math.round(20 + F.a[Math.round(v * (rows - 1)) * cols + Math.round(u * (cols - 1))] * 80);
        g.fillStyle = 'rgba(8,12,11,.55)'; g.beginPath(); g.arc(px, py, 6 * d, 0, TAU); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1.2 * d; g.beginPath(); g.arc(px, py, 4 * d, 0, TAU); g.stroke();
        if (i % 3 === 0) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(val + ' µg/m³', px + 10 * d, py + 3 * d); }
      }
    }
    draw(); onResize(draw, canvas);
  }

  window.TSQ = { hero: hero, contours: contours, landcover: landcover, air: air, rng: rng, noise: makeNoise };
})();
