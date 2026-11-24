/* «Космічний клавіатурний тренажер»: інтерфейс, полотно гри, клавіатура з підказками, прогрес.
   Логіка (розкладки, генерація, комбо, помилки) лежить у klaviatura-core.js і спільна з перевіркою tools/check-klaviatura.js.
   Рядки беруться зі словника (t); контент рівнів: content/klaviatura/levels.json. */
(function () {
  "use strict";
  var Core = window.KlaviaturaCore;
  var ROOT = document.documentElement.getAttribute("data-root") || "";
  var LANG = (window.GII18n && GII18n.lang) || "uk";
  var STORE_ID = "klaviatura:v2", SLUG = "klaviatura";
  var NS = "http://www.w3.org/2000/svg";
  var $ = function (id) { return document.getElementById(id); };
  var T = function (k, params) { return t("klaviatura." + k, params); };
  var reduced = function () { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); };
  var now = function () { return window.performance && performance.now ? performance.now() : new Date().getTime(); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var TIER_COLORS = ["#7df9ff", "#4be39a", "#ffc94a", "#ff5ad1"];

  /* ---------- допоміжне: класи без classList (SVG у старих браузерах) ---------- */
  function hasCls(el, c) { return (" " + (el.getAttribute("class") || "") + " ").indexOf(" " + c + " ") >= 0; }
  function addCls(el, c) { if (!hasCls(el, c)) el.setAttribute("class", ((el.getAttribute("class") || "") + " " + c).replace(/^\s+/, "")); }
  function delCls(el, c) { el.setAttribute("class", (" " + (el.getAttribute("class") || "") + " ").replace(" " + c + " ", " ").replace(/^\s+|\s+$/g, "")); }
  function svgEl(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function div(cls, parent, tag) {
    var e = document.createElement(tag || "div");
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------- фонові зірки сторінки ---------- */
  (function () {
    var host = $("stars"), frag = document.createDocumentFragment();
    for (var i = 0; i < 80; i++) {
      var s = document.createElement("span"), sz = rnd(1, 2.6);
      s.className = "st";
      s.style.cssText = "left:" + rnd(0, 100).toFixed(1) + "%;top:" + rnd(0, 100).toFixed(1) + "%;width:" + sz.toFixed(1) + "px;height:" + sz.toFixed(1) + "px;animation-delay:-" + rnd(0, 4).toFixed(1) + "s;animation-duration:" + rnd(2.6, 6).toFixed(1) + "s";
      frag.appendChild(s);
    }
    host.appendChild(frag);
  })();

  /* ---------- збереження: {v:1, uk:{<id рівня>:{stars,...}}, en:{...}} ---------- */
  var saved = { v: 1, uk: {}, en: {} };
  var levels = [], cfg = null;
  function loadSaved() {
    try {
      var s = window.GIStorage ? GIStorage.load(STORE_ID) : null;
      if (s && typeof s === "object") {
        ["uk", "en"].forEach(function (l) {
          if (!s[l] || typeof s[l] !== "object") return;
          for (var id in s[l]) {
            var b = s[l][id];
            if (s[l].hasOwnProperty(id) && b && typeof b.stars === "number" && b.stars >= 1 && b.stars <= 3) saved[l][id] = b;
          }
        });
      }
    } catch (e) { /* пошкоджені дані: починаємо з нуля */ }
  }
  function persist() {
    if (window.GIStorage) { GIStorage.save(STORE_ID, saved); syncSummary(); }
  }
  function doneCount() {
    var n = 0;
    levels.forEach(function (lv) { if (saved[LANG][lv.id]) n++; });
    return n;
  }
  function syncSummary() { if (window.GIStorage && levels.length) GIStorage.setSummary(SLUG, doneCount(), levels.length); }
  function bestOf(lv) { return saved[LANG][lv.id] || null; }
  function unlocked(i) { return i === 0 || !!bestOf(levels[i - 1]); }

  /* ---------- екранна клавіатура ---------- */
  var keyByCode = {}, fingerEls = {};
  
  function buildKeyboard() {
    var kb = $("keyboard"), layout = Core.getLayout(LANG);
    kb.textContent = "";
    function ghost(text, units) {
      var k = div("key ghost", null);
      k.style.flexGrow = String(units);
      k.textContent = text;
      return k;
    }
    function spacer(units) { var s = div("", null); s.style.flexGrow = String(units); s.style.flexBasis = "0"; return s; }
    function letterKey(def, units) {
      var k = div("key f-" + def.finger, null), isLetter = def.shift !== def.base && def.shift === def.base.toUpperCase();
      k.setAttribute("data-code", def.code);
      k.style.flexGrow = String(units || 1);
      if (isLetter) { div("", k, "span").textContent = def.shift; }
      else {
        /* знаки з Shift (! ? : ; ( ) ") з тренажера прибрано: показуємо лише кому на клавіші крапки в українській розкладці */
        if (LANG === "uk" && def.code === "Slash") div("s", k, "span").textContent = def.shift;
        div("", k, "span").textContent = def.base;
      }
      if (def.code === "KeyF" || def.code === "KeyJ") addCls2(k, "bump");
      keyByCode[def.code] = k;
      return k;
    }
    function addCls2(el, c) { el.className += " " + c; }
    function shiftKey(code, finger, units) {
      var k = div("key f-" + finger, null);
      k.setAttribute("data-code", code);
      k.style.flexGrow = String(units);
      k.textContent = "Shift";
      keyByCode[code] = k;
      return k;
    }
    var rows = [
      layout[0].map(function (d) { return letterKey(d, 1); }).concat([ghost("⌫", 2)]),
      [ghost("Tab", 1.5)].concat(layout[1].map(function (d, i) { return letterKey(d, i === 12 ? 1.5 : 1); })),
      [ghost("Caps", 1.75)].concat(layout[2].map(function (d) { return letterKey(d, 1); })).concat([ghost("Enter", 2.25)]),
      [shiftKey("ShiftLeft", "lp", 2.25)].concat(layout[3].map(function (d) { return letterKey(d, 1); })).concat([shiftKey("ShiftRight", "rp", 2.75)])
    ];
    var space = div("key spc", null);
    space.setAttribute("data-code", "Space");
    space.style.flexGrow = "6.25";
    space.textContent = T("keySpace");
    keyByCode.Space = space;
    rows.push([spacer(3.75), space, spacer(5)]);
    rows.forEach(function (r) {
      var row = div("kb-row", kb);
      r.forEach(function (k) { row.appendChild(k); });
    });
  }

  /* Дві руки (SVG, по одній ліворуч і праворуч від клавіатури): пальці підсвічуються, вигляд зверху, пальці вгору.
     Права рука дзеркальна до лівої: великий палець завжди ближче до клавіатури. viewBox обох: 20 24 215 168. */
  var FINGER_SHAPES = [
    { n: 0, x: 36, y: 70, w: 28, h: 64 },
    { n: 1, x: 70, y: 44, w: 30, h: 90 },
    { n: 2, x: 106, y: 32, w: 32, h: 102 },
    { n: 3, x: 144, y: 44, w: 30, h: 90 }
  ];
  var HAND_MIRROR_X = 20 * 2 + 215;
  function buildHands() {
    ["l", "r"].forEach(function (side) {
      var svg = $(side === "l" ? "handL" : "handR");
      svg.textContent = "";
      var g = svgEl("g", side === "r" ? { transform: "translate(" + HAND_MIRROR_X + " 0) scale(-1 1)" } : {}, svg);
      svgEl("rect", { "class": "palm", x: 30, y: 112, width: 176, height: 70, rx: 28 }, g);
      FINGER_SHAPES.forEach(function (f) {
        var code = side + ["p", "r", "m", "i"][f.n];
        var el = svgEl("rect", { "class": "fg f-" + code, x: f.x, y: f.y, width: f.w, height: f.h, rx: f.w / 2 }, g);
        (fingerEls[code] = fingerEls[code] || []).push(el);
      });
      var th = svgEl("rect", { "class": "fg f-th", x: 186, y: 100, width: 28, height: 70, rx: 14, transform: "rotate(-28 200 160)" }, g);
      (fingerEls.th = fingerEls.th || []).push(th);
    });
  }

  var litKeys = [], litFingers = [];
  function clearHints() {
    litKeys.forEach(function (k) { k.className = k.className.replace(/ next\b/g, ""); });
    litFingers.forEach(function (f) { delCls(f, "on"); delCls(f, "sh"); });
    litKeys = []; litFingers = [];
  }
  function keyLabel(ch) { return ch === " " ? T("keySpace") : ch; }
  /* Підсвітити наступну клавішу, палець (і Shift із протилежної руки для великих літер і знаків). */
  function showHint(ch) {
    clearHints();
    var hint = $("fingerHint");
    if (!ch) { hint.textContent = ""; return; }
    var loc = Core.locate(LANG, ch);
    if (!loc) { hint.textContent = ""; return; }
    var k = keyByCode[loc.code];
    if (k) { k.className += " next"; litKeys.push(k); }
    (fingerEls[loc.finger] || []).forEach(function (f) { addCls(f, "on"); litFingers.push(f); });
    var params = { key: keyLabel(ch), finger: T("finger." + loc.finger) };
    if (loc.shift) {
      var sk = keyByCode[loc.shiftCode];
      if (sk) { sk.className += " next"; litKeys.push(sk); }
      (fingerEls[loc.shiftFinger] || []).forEach(function (f) { addCls(f, "sh"); litFingers.push(f); });
      params.shiftFinger = T("finger." + loc.shiftFinger);
    }
    hint.textContent = "";
    hint.appendChild(GII18n.md(T(loc.shift ? "hint.shift" : "hint.key", params)));
  }
  function flashBad(code) {
    var k = keyByCode[code];
    if (!k) return;
    k.className += " bad";
    setTimeout(function () { k.className = k.className.replace(/ bad\b/g, ""); }, 280);
  }

  /* ---------- рядок тексту ---------- */
  var chEls = [], textRow = $("textRow"), track = $("track");
  function renderText(game) {
    track.textContent = "";
    chEls = [];
    for (var i = 0; i < game.length; i++) {
      var ch = game.text.charAt(i), s = document.createElement("span");
      s.className = "ch" + (ch === " " ? " sp" : "");
      if (ch !== " ") s.textContent = ch;
      track.appendChild(s);
      chEls.push(s);
    }
    $("textSr").textContent = game.text;
    paintChars(game, 0, game.length);
    scrollText(game);
  }
  function paintChar(game, i) {
    var el = chEls[i];
    if (!el) return;
    var m = game.marks[i], cls = "ch" + (game.text.charAt(i) === " " ? " sp" : "");
    if (m === "ok" || m === "fixed") cls += " " + m;
    if (i === game.pos && game.status === "playing") cls += " cur" + (m === "err" ? " err" : "");
    el.className = cls;
  }
  function paintChars(game, a, b) { for (var i = a; i < b; i++) paintChar(game, i); }
  function scrollText(game) {
    var el = chEls[Math.min(game.pos, chEls.length - 1)];
    if (!el) return;
    var cw = textRow.clientWidth, target = el.offsetLeft + el.offsetWidth / 2;
    var shift = Math.min(0, Math.round(cw * 0.4 - target));
    track.style.transform = "translateX(" + shift + "px)";
  }

  /* ---------- ігрове полотно ---------- */
  var Stage = (function () {
    var cv = $("stage"), ctx = cv.getContext ? cv.getContext("2d") : null;
    var wrap = $("stageWrap");
    var W = 1500, H = 340, scale = 1;   /* логічні розміри поля; на екрані 1920x1080 воно займає ~1530x350 css-пікселів */
    var game = null, ast = null, parts = [], beams = [], pops = [], starsBg = [];
    var tm = 0, lastTs = 0, raf = 0, active = false;
    var shake = 0, redFlash = 0, kick = 0, comboPulse = 0, shipAlive = true;
    var fin = null, comboText = "";
    var motion = true;

    function geom() {
      var R = Math.round(H * 0.19);
      var S = { x: W * 0.1, y: H * 0.74 };
      /* астероїд на старті (відстань 1) разом зі смужкою міцності лежить повністю в полі: зверху лишається ~36 px, праворуч ~40 px */
      var F = { x: W - R - 44, y: R + 46 };
      var ang = Math.atan2(F.y - S.y, F.x - S.x), ux = Math.cos(ang), uy = Math.sin(ang);
      var L = R * 1.35;
      var C = { x: S.x + ux * (L * 0.6 + R + 4), y: S.y + uy * (L * 0.6 + R + 4) };
      return { R: R, S: S, F: F, C: C, ux: ux, uy: uy, ang: ang, L: L, nose: { x: S.x + ux * L * 0.62, y: S.y + uy * L * 0.62 } };
    }
    function astPos(g, d) { return { x: g.C.x + (g.F.x - g.C.x) * d, y: g.C.y + (g.F.y - g.C.y) * d }; }

    function makeAst(hpMax, hp, entering) {
      var rng = Core.createRng(Math.floor(Math.random() * 4294967295) + 1), verts = [], i, n = 18;
      for (i = 0; i < n; i++) verts.push(0.8 + rng() * 0.26);
      var craters = [], cracks = [];
      for (i = 0; i < 5; i++) craters.push({ a: rng() * 6.28, r: 0.15 + rng() * 0.5, s: 0.1 + rng() * 0.14 });
      for (i = 0; i < 8; i++) {
        var a = rng() * 6.28, pts = [{ x: (rng() - 0.5) * 0.3, y: (rng() - 0.5) * 0.3 }], len = 0.55 + rng() * 0.45, k;
        for (k = 1; k <= 3; k++) {
          var q = pts[k - 1], aa = a + (rng() - 0.5) * 0.9;
          pts.push({ x: q.x + Math.cos(aa) * len / 3, y: q.y + Math.sin(aa) * len / 3 });
        }
        cracks.push(pts);
      }
      return { hp: hp, hpMax: hpMax, d: entering ? 1.55 : 1, rot: rng() * 6.28, spin: (rng() - 0.5) * 0.7, verts: verts, craters: craters, cracks: cracks, flash: 0, jolt: 0 };
    }

    function resize() {
      if (!ctx) return;
      var cssW = wrap.clientWidth;
      if (!cssW) return;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(cssW * dpr);
      cv.height = Math.round(cssW * (H / W) * dpr);
      scale = cv.width / W;
      var rng = Core.createRng(77);
      starsBg = [];
      for (var i = 0; i < 120; i++) starsBg.push({ x: rng() * W, y: rng() * H, z: 0.3 + rng() * 0.9, p: rng() * 6.28 });
      draw();
    }

    function reset(g) {
      game = g; parts = []; beams = []; pops = []; shake = 0; redFlash = 0; kick = 0; comboPulse = 0; shipAlive = true; fin = null;
      motion = !reduced();
      ast = makeAst(g.hpMax, g.hp, motion);
      if (!motion) ast.d = Core.distance(g);
      comboText = "";
      draw();
    }
    function setComboText(s) { comboText = s; }

    function burst(x, y, n, colors, speed, life, size) {
      if (!motion) return;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, v = speed * (0.35 + Math.random() * 0.65);
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.4), max: life, size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, spark: Math.random() < 0.35 });
      }
    }
    function ring(x, y, r, color) { if (motion) pops.push({ ring: true, x: x, y: y, r: r, life: 0.5, max: 0.5, color: color }); }

    function hit(ev) {
      if (!ast || !game) return;
      var g = geom(), tier = ev.mult >= 4 ? 3 : ev.mult >= 3 ? 2 : ev.mult >= 2 ? 1 : 0, n = Math.min(4, ev.mult);
      var p = astPos(g, ast.d), px = -g.uy, py = g.ux, gap = g.R * 0.2;
      var tx = p.x - g.ux * g.R * 0.82, ty = p.y - g.uy * g.R * 0.82;
      for (var k = 0; k < n; k++) {
        var off = (k - (n - 1) / 2) * gap;
        beams.push({ x1: g.nose.x + px * off, y1: g.nose.y + py * off, x2: tx + px * off * 0.5, y2: ty + py * off * 0.5, age: 0, life: 0.18, color: TIER_COLORS[tier], w: 2.2 + tier * 1.3 });
      }
      kick = 1;
      ast.hp = Math.max(0, ast.hp - ev.damage);
      ast.flash = 1;
      burst(tx, ty, 4 + ev.mult * 2, ["#b9a6c9", "#8d7a9e", "#ffb27a", "#e8dccd"], 150 + tier * 30, 0.7, 4);
      if (ev.tierUp) comboPulse = 1;
      if (ev.destroyed) {
        var c = astPos(g, ast.d);
        burst(c.x, c.y, 34, ["#ffe45c", "#ff7a3d", "#ffd9a8", "#b9a6c9", "#ffffff"], 260, 1.1, 5);
        ring(c.x, c.y, g.R * 1.9, "#ffd9a8");
        pops.push({ text: "+100", x: c.x, y: c.y - g.R, life: 1.1, max: 1.1, color: "#ffe45c" });
        ast = makeAst(game.hpMax, game.hpMax, motion);
        if (!motion) ast.d = Core.distance(game);
      }
      if (!motion) draw();
    }
    function miss() {
      redFlash = 1;
      if (motion) shake = 1;
      if (!motion) draw();
    }
    /* Астероїд долітає до корабля, вибух, потім cb. */
    function crash(cb) {
      fin = { kind: "crash", t: 0, phase: 0, cb: cb };
      if (!motion) { shipAlive = false; ast = null; draw(); setTimeout(cb, 50); fin = null; }
    }
    function win(cb) {
      var g = geom();
      if (ast) {
        var c = astPos(g, ast.d);
        burst(c.x, c.y, 40, ["#4be39a", "#3fe0d0", "#ffe45c", "#ffffff"], 280, 1.2, 5);
        ring(c.x, c.y, g.R * 2.2, "#4be39a");
        ast = null;
      }
      if (!motion) { draw(); setTimeout(cb, 50); return; }
      fin = { kind: "win", t: 0, phase: 0, cb: cb };
    }
    function busy() { return !!fin; }

    function step(dt) {
      tm += dt;
      var g = geom(), target = game ? Core.distance(game) : 1;
      if (fin && fin.kind === "crash") {
        fin.t += dt;
        if (fin.phase === 0) {
          if (ast) ast.d = Math.max(0, ast.d - dt * (0.9 + fin.t * 2.2));
          if (ast && ast.d <= 0.001) {
            fin.phase = 1; fin.t = 0;
            burst(g.S.x, g.S.y, 60, ["#ffe45c", "#ff7a3d", "#e5483a", "#ffffff", "#b9a6c9"], 320, 1.3, 6);
            ring(g.S.x, g.S.y, g.R * 2.6, "#ff7a3d");
            shipAlive = false; ast = null; shake = 1.4; redFlash = 1.2;
          }
        } else if (fin.t > 1.0) { var cb = fin.cb; fin = null; cb(); }
      } else if (fin && fin.kind === "win") {
        fin.t += dt;
        if (fin.t > 0.9) { var cb2 = fin.cb; fin = null; cb2(); }
      } else if (ast) {
        ast.d += (target - ast.d) * (1 - Math.exp(-dt * 3.2));
        if (Math.abs(target - ast.d) < 0.002) ast.d = target;
      }
      if (ast) { ast.rot += ast.spin * dt; ast.flash = Math.max(0, ast.flash - dt * 6); }
      shake = Math.max(0, shake - dt * 2.2); redFlash = Math.max(0, redFlash - dt * 2.4); kick = Math.max(0, kick - dt * 7); comboPulse = Math.max(0, comboPulse - dt * 2);
      var i;
      for (i = beams.length - 1; i >= 0; i--) { beams[i].age += dt; if (beams[i].age > beams[i].life) beams.splice(i, 1); }
      for (i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985; p.rot += p.vr * dt;
        if (p.life <= 0) parts.splice(i, 1);
      }
      for (i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (!pops[i].ring) pops[i].y -= 28 * dt; if (pops[i].life <= 0) pops.splice(i, 1); }
    }

    function drawShip(g) {
      var bob = motion ? Math.sin(tm * 2) * 3 : 0, back = kick * 5, L = g.L;
      ctx.save();
      ctx.translate(g.S.x - g.ux * back, g.S.y + bob - g.uy * back);
      if (shake > 0) ctx.translate((Math.random() - 0.5) * 6 * shake, (Math.random() - 0.5) * 6 * shake);
      ctx.rotate(g.ang);
      ctx.lineJoin = "round"; ctx.lineWidth = 2.4; ctx.strokeStyle = "#1b1330";
      /* полум'я двигуна */
      var fl = L * (0.34 + (motion ? 0.12 * Math.sin(tm * 38) : 0.05));
      ctx.fillStyle = "#ff7a3d";
      ctx.beginPath(); ctx.moveTo(-L * 0.5, -L * 0.1); ctx.lineTo(-L * 0.5 - fl, 0); ctx.lineTo(-L * 0.5, L * 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffe45c";
      ctx.beginPath(); ctx.moveTo(-L * 0.5, -L * 0.05); ctx.lineTo(-L * 0.5 - fl * 0.6, 0); ctx.lineTo(-L * 0.5, L * 0.05); ctx.closePath(); ctx.fill();
      /* крила */
      ctx.fillStyle = "#3fe0d0";
      ctx.beginPath(); ctx.moveTo(-L * 0.05, -L * 0.17); ctx.lineTo(-L * 0.55, -L * 0.52); ctx.lineTo(-L * 0.5, -L * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-L * 0.05, L * 0.17); ctx.lineTo(-L * 0.55, L * 0.52); ctx.lineTo(-L * 0.5, L * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* корпус */
      ctx.fillStyle = "#eae3d8";
      ctx.beginPath(); ctx.moveTo(L * 0.62, 0); ctx.lineTo(-L * 0.05, -L * 0.2); ctx.lineTo(-L * 0.5, -L * 0.13); ctx.lineTo(-L * 0.5, L * 0.13); ctx.lineTo(-L * 0.05, L * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* кабіна */
      ctx.fillStyle = "#7df9ff";
      ctx.beginPath(); ctx.ellipse ? ctx.ellipse(L * 0.14, 0, L * 0.17, L * 0.09, 0, 0, 6.283) : ctx.arc(L * 0.14, 0, L * 0.09, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#ff7a3d";
      ctx.fillRect(-L * 0.32, -L * 0.04, L * 0.2, L * 0.08);
      ctx.restore();
    }

    function drawAst(g) {
      var p = astPos(g, ast.d), R = g.R, i;
      var jx = ast.flash > 0 && motion ? (Math.random() - 0.5) * 4 * ast.flash : 0, jy = ast.flash > 0 && motion ? (Math.random() - 0.5) * 4 * ast.flash : 0;
      ctx.save();
      ctx.translate(p.x + jx, p.y + jy);
      ctx.rotate(ast.rot);
      ctx.beginPath();
      for (i = 0; i < ast.verts.length; i++) {
        var a = i / ast.verts.length * 6.283, r = R * ast.verts[i];
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      var gr = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R * 1.1);
      gr.addColorStop(0, "#8f7f9c"); gr.addColorStop(1, "#3b3147");
      ctx.fillStyle = gr; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "#1b1330"; ctx.lineJoin = "round"; ctx.stroke();
      ctx.save(); ctx.clip();
      for (i = 0; i < ast.craters.length; i++) {
        var c = ast.craters[i], cx = Math.cos(c.a) * c.r * R, cy = Math.sin(c.a) * c.r * R;
        ctx.beginPath(); ctx.arc(cx, cy, c.s * R, 0, 6.283); ctx.fillStyle = "rgba(20,12,34,.45)"; ctx.fill();
        ctx.beginPath(); ctx.arc(cx - 1, cy - 1, c.s * R, 3.4, 5.4); ctx.strokeStyle = "rgba(255,230,210,.35)"; ctx.lineWidth = 1.6; ctx.stroke();
      }
      /* тріщини з'являються разом зі шкодою */
      var frac = 1 - ast.hp / ast.hpMax, nCr = ast.hp >= ast.hpMax ? 0 : Math.max(1, Math.ceil(frac * ast.cracks.length));
      for (i = 0; i < nCr; i++) {
        var pts = ast.cracks[i];
        ctx.beginPath(); ctx.moveTo(pts[0].x * R, pts[0].y * R);
        for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x * R, pts[k].y * R);
        ctx.lineWidth = 4.2; ctx.strokeStyle = "rgba(255,122,61,.55)"; ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = "#140a22"; ctx.stroke();
      }
      if (ast.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + (0.5 * ast.flash).toFixed(2) + ")"; ctx.fillRect(-R * 1.3, -R * 1.3, R * 2.6, R * 2.6); }
      ctx.restore();
      ctx.restore();
      /* смужка міцності */
      var bw = R * 1.9, bh = 11, bx = p.x - bw / 2, by = p.y - R * 1.06 - 20, f = Math.max(0, ast.hp / ast.hpMax);
      ctx.fillStyle = "rgba(10,6,22,.85)"; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = f > 0.5 ? "#4be39a" : f > 0.25 ? "#ffc94a" : "#ff7b6b";
      ctx.fillRect(bx, by, bw * f, bh);
      ctx.strokeStyle = "rgba(243,233,225,.7)"; ctx.lineWidth = 1.4; ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
    }

    function draw() {
      if (!ctx || !cv.width) return;
      var g = geom();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      /* фон */
      var bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#0d0a24"); bg.addColorStop(1, "#14102f");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      var neb = ctx.createRadialGradient(W * 0.8, H * 0.15, 10, W * 0.8, H * 0.15, W * 0.5);
      neb.addColorStop(0, "rgba(63,224,208,.13)"); neb.addColorStop(1, "rgba(63,224,208,0)");
      ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
      var i;
      for (i = 0; i < starsBg.length; i++) {
        var s = starsBg[i], sx = motion ? ((s.x - tm * 8 * s.z) % W + W) % W : s.x;
        ctx.fillStyle = "rgba(255,255,255," + (0.25 + 0.5 * s.z * (motion ? 0.6 + 0.4 * Math.sin(tm * 1.5 + s.p) : 1)).toFixed(2) + ")";
        ctx.fillRect(sx, s.y, 1 + s.z * 1.3, 1 + s.z * 1.3);
      }
      /* небезпека: червоне сяйво з боку астероїда */
      var danger = game ? 1 - Core.distance(game) : 0;
      if (danger > 0.02 || redFlash > 0) {
        var rg = ctx.createRadialGradient(W * 0.1, H * 0.85, 20, W * 0.1, H * 0.85, W * 0.7);
        rg.addColorStop(0, "rgba(255,60,60," + (danger * 0.28 + redFlash * 0.3).toFixed(3) + ")"); rg.addColorStop(1, "rgba(255,60,60,0)");
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      }
      if (ast) drawAst(g);
      /* промені */
      for (i = 0; i < beams.length; i++) {
        var b = beams[i], al = 1 - b.age / b.life;
        ctx.lineCap = "round";
        ctx.globalAlpha = al * 0.45; ctx.strokeStyle = b.color; ctx.lineWidth = b.w * 2.2;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.globalAlpha = al; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = b.w * 0.8;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (shipAlive) drawShip(g);
      /* частинки */
      for (i = 0; i < parts.length; i++) {
        var p = parts[i], a2 = Math.max(0, p.life / p.max);
        ctx.globalAlpha = a2; ctx.fillStyle = p.color;
        if (p.spark) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6 * a2 + 0.6, 0, 6.283); ctx.fill(); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7); ctx.restore(); }
      }
      ctx.globalAlpha = 1;
      for (i = 0; i < pops.length; i++) {
        var q = pops[i], qa = Math.max(0, q.life / q.max);
        if (q.ring) {
          ctx.globalAlpha = qa; ctx.strokeStyle = q.color; ctx.lineWidth = 4 * qa + 1;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 - qa) + 8, 0, 6.283); ctx.stroke();
        } else {
          ctx.globalAlpha = Math.min(1, qa * 2); ctx.fillStyle = q.color; ctx.font = "800 30px Unbounded, Nunito, sans-serif"; ctx.textAlign = "center";
          ctx.fillText(q.text, q.x, q.y);
        }
        ctx.globalAlpha = 1;
      }
      /* напис КОМБО */
      if (comboText && game && game.mult > 1) {
        var tier = game.mult >= 4 ? 3 : game.mult >= 3 ? 2 : 1, pulse = 1 + comboPulse * 0.25;
        ctx.save();
        /* посередині екрана, трохи нижче центру: угорі зліва лежать лічильники, а повідомлення внизу праворуч */
        ctx.translate(W * 0.5, H * 0.56);
        ctx.scale(pulse, pulse);
        ctx.font = "800 " + (36 + tier * 6) + "px Unbounded, Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 7; ctx.strokeStyle = "rgba(10,6,22,.9)"; ctx.lineJoin = "round";
        ctx.strokeText(comboText, 0, 0);
        ctx.fillStyle = TIER_COLORS[tier]; ctx.fillText(comboText, 0, 0);
        ctx.restore();
      }
    }

    function tick(ts) {
      raf = 0;
      if (!active) return;
      var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
      lastTs = ts;
      step(dt);
      draw();
      raf = window.requestAnimationFrame(tick);
    }
    function start() {
      if (active || !ctx) return;
      active = true; lastTs = 0; motion = !reduced();
      if (!raf && window.requestAnimationFrame) raf = window.requestAnimationFrame(tick);
    }
    function stop() { active = false; if (raf && window.cancelAnimationFrame) window.cancelAnimationFrame(raf); raf = 0; }

    window.addEventListener("resize", resize);
    return { reset: reset, hit: hit, miss: miss, crash: crash, win: win, busy: busy, resize: resize, start: start, stop: stop, setComboText: setComboText, draw: draw };
  })();

  /* ---------- стан гри ---------- */
  var idx = -1, game = null, view = "levels", modalOpen = false, keyboardSeen = false, errTimer = 0;
  var statusEl = $("status");

  function say(msg, cls) { statusEl.className = "status" + (cls ? " " + cls : ""); statusEl.textContent = msg; }
  function starsNode(n) {
    var box = document.createElement("span");
    box.className = "stars";
    for (var i = 1; i <= 3; i++) {
      var s = document.createElement("span");
      s.className = i <= n ? "on" : "off";
      s.setAttribute("aria-hidden", "true");
      s.textContent = i <= n ? "★" : "☆";
      box.appendChild(s);
    }
    var sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = T("starsAria", { n: n });
    box.appendChild(sr);
    return box;
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    if (!game) return;
    $("hudScore").textContent = T("hud.score", { n: Core.score(game) });
    $("hudAst").textContent = T("hud.ast", { n: game.destroyed });
    $("hudErr").textContent = T("hud.err", { n: game.errors, max: game.budget });
    var danger = game.budget - game.errors <= Math.max(2, Math.ceil(game.budget * 0.25));
    $("hudErr").className = "chip" + (danger && game.errors > 0 ? " danger" : "");
    $("hudCombo").textContent = T("hud.combo", { n: game.combo });
    $("hudCombo").className = "chip" + (game.mult > 1 ? " combo-on" : "");
    Stage.setComboText(game.mult > 1 ? T("comboLabel", { mult: game.mult }) : "");
  }

  /* Нові клавіші рівня для показу: символи newKeys (великі, якщо це літери) і Shift, якщо рівень його вводить. */
  function newKeyLabels(set) {
    var out = [], nk = set.newKeys || "";
    if (set.shift) out.push("Shift");
    for (var i = 0; i < nk.length; i++) out.push(nk.charAt(i).toUpperCase());
    return out;
  }

  /* ---------- рівні: список ---------- */
  function renderLevelList() {
    var box = $("levelList"), ol = null, stage = null, sec = null;
    box.textContent = "";
    levels.forEach(function (lv, i) {
      if (!ol || lv.stage !== stage) {
        /* новий етап: заголовок з метою й окремий список рівнів */
        stage = lv.stage;
        sec = div("lv-stage", box, "section");
        var hid = "stageH" + (stage === undefined ? "0" : stage);
        sec.setAttribute("aria-labelledby", hid);
        if (stage !== undefined) {
          var h = div("lv-stage-h", sec, "h3"); h.id = hid; h.textContent = T("stage." + stage + ".title");
          var goal = div("lv-stage-goal muted", sec, "p"); goal.textContent = T("stage." + stage + ".goal");
        }
        ol = div("levels", sec, "ol");
      }
      var li = document.createElement("li"), b = document.createElement("button"), best = bestOf(lv), open = unlocked(i);
      b.type = "button"; b.className = "lv"; b.setAttribute("data-id", lv.id);
      b.disabled = !open;
      var top = div("lv-top", b);
      var no = div("lv-no", top, "span"); no.textContent = T("levelNo", { n: i + 1 });
      if (open) top.appendChild(starsNode(best ? best.stars : 0));
      else { var lk = div("stars lock", top, "span"); lk.setAttribute("aria-hidden", "true"); lk.textContent = "🔒"; var sr = div("sr-only", top, "span"); sr.textContent = T("locked"); }
      var nm = div("lv-name", b, "span"); nm.textContent = GIData.pick(lv.title);
      var keys = div("lv-keys", b), nk = newKeyLabels(lv.sets[LANG]);
      if (nk.length) {
        var lab = div("sr-only", keys, "span"); lab.textContent = T("newKeys") + " ";
        for (var c = 0; c < nk.length; c++) { var kb = document.createElement("kbd"); kb.textContent = nk[c]; keys.appendChild(kb); }
      } else {
        var rv = div("lv-meta", keys, "span"); rv.textContent = T("review");
      }
      var meta = div("lv-meta", b, "span");
      meta.textContent = best ? T("best", { cpm: best.cpm, acc: Math.round(best.accuracy) }) : "";
      li.appendChild(b); ol.appendChild(li);
    });
    $("levelsProgress").textContent = T("levelsProgress", { done: doneCount(), total: levels.length });
  }

  /* ---------- перемикання екранів ---------- */
  function showLevels(noFocus) {
    view = "levels";
    document.body.classList.remove("in-game");
    Stage.stop();
    $("viewGame").hidden = true; $("viewLevels").hidden = false;
    renderLevelList();
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ок */ }
    if (!noFocus) { var h = $("levelsH"); h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch (e2) { /* ок */ } }
  }
  function startLevel(i) {
    var lv = levels[i], set = lv.sets[LANG];
    idx = i;
    var seed = Math.floor(Math.random() * 4294967294) + 1;
    var text = Core.generate(set, seed);
    game = Core.newGame(text, {
      errorBudgetRatio: lv.errorBudgetRatio || cfg.errorBudgetRatio,
      asteroidHp: lv.asteroidHp || cfg.asteroidHp,
      combo: cfg.combo,
      stars: cfg.stars
    });
    view = "game";
    document.body.classList.add("in-game");
    $("viewLevels").hidden = true; $("viewGame").hidden = false;
    $("lvlNo").textContent = T("levelNo", { n: i + 1 });
    $("lvlName").textContent = GIData.pick(lv.title);
    var tip = $("lvlTip");
    tip.textContent = "";
    tip.appendChild(GII18n.md(GIData.pick(lv.tip)));
    var nk = newKeyLabels(set);
    if (nk.length) {
      tip.appendChild(document.createTextNode(" " + T("newKeys") + " "));
      for (var c = 0; c < nk.length; c++) {
        var kb = document.createElement("kbd"); kb.textContent = nk[c]; tip.appendChild(kb);
        tip.appendChild(document.createTextNode(" "));
      }
    }
    $("layoutWarn").hidden = true;
    renderText(game);
    Stage.resize();
    Stage.reset(game);
    Stage.start();
    updateHud();
    showHint(game.text.charAt(0));
    say(T("status.start"));
    try { history.replaceState(null, "", "#" + lv.id); } catch (e) { /* ок */ }
    textRow.focus({ preventScroll: true });
    fitGameView();
    scrollText(game);
  }
  /* Рядок тексту, екран і клавіатура з руками мають бути видні одночасно. На вікні ~1920x950 вони влазять без прокручування.
     Якщо вікно менше, прокручуємо так, щоб низ клавіатури став унизу вікна, але рядок тексту не зник угорі. */
  function fitGameView() {
    window.scrollTo(0, 0);
    var top = document.querySelector(".type-card").getBoundingClientRect().top - 8;
    var bottom = document.querySelector(".kb-wrap").getBoundingClientRect().bottom + 12;
    var need = bottom - window.innerHeight;
    if (need > 0) window.scrollTo(0, Math.max(0, Math.min(need, top)));
  }

  /* ---------- результат ---------- */
  var modal = $("modal");
  function statItem(label, value) {
    var d = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = label; dd.textContent = value;
    d.appendChild(dt); d.appendChild(dd);
    return d;
  }
  function openModal(won, sum) {
    modalOpen = true;
    var box = modal.firstElementChild || modal.children[0];
    box.className = "modal-box" + (won ? "" : " lost");
    $("mIcon").textContent = won ? "🚀" : "💥";
    $("mtitle").textContent = T(won ? "result.wonTitle" : "result.lostTitle");
    $("mText").textContent = T(won ? "result.wonText" : "result.lostText");
    var ms = $("mStars");
    ms.textContent = "";
    if (won) {
      ms.hidden = false;
      for (var i = 1; i <= 3; i++) { var s = document.createElement("span"); s.className = i <= sum.stars ? "" : "off"; s.setAttribute("aria-hidden", "true"); s.textContent = i <= sum.stars ? "★" : "☆"; ms.appendChild(s); }
      var sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = T("starsAria", { n: sum.stars }); ms.appendChild(sr);
    } else ms.hidden = true;
    var st = $("mStats");
    st.textContent = "";
    st.appendChild(statItem(T("stat.accuracy"), T("pct", { n: Math.round(sum.accuracy) })));
    st.appendChild(statItem(T("stat.cpm"), String(sum.cpm)));
    st.appendChild(statItem(T("stat.combo"), String(sum.maxCombo)));
    st.appendChild(statItem(T("stat.destroyed"), String(sum.destroyed)));
    st.appendChild(statItem(T("stat.score"), String(sum.score)));
    st.appendChild(statItem(T("stat.errors"), String(sum.errors)));
    var hasNext = won && idx < levels.length - 1;
    $("mNext").hidden = !hasNext;
    modal.className = "modal show";
    var first = hasNext ? $("mNext") : $("mRetry");
    first.focus();
  }
  function closeModal() { modal.className = "modal"; modalOpen = false; }

  function finish(won) {
    var sum = Core.summary(game);
    if (won) {
      var lv = levels[idx], prev = saved[LANG][lv.id] || { stars: 0, cpm: 0, accuracy: 0, maxCombo: 0, destroyed: 0, score: 0 };
      saved[LANG][lv.id] = {
        stars: Math.max(prev.stars, sum.stars), cpm: Math.max(prev.cpm, sum.cpm), accuracy: Math.max(prev.accuracy, sum.accuracy),
        maxCombo: Math.max(prev.maxCombo, sum.maxCombo), destroyed: Math.max(prev.destroyed, sum.destroyed), score: Math.max(prev.score, sum.score)
      };
      persist();
      say(T("status.won"), "ok");
      Stage.win(function () { openModal(true, sum); });
    } else {
      say(T("status.lost"), "bad");
      Stage.crash(function () { openModal(false, sum); });
    }
  }

  /* ---------- клавіатурні події ---------- */
  function touchOnly() {
    try {
      var mm = window.matchMedia;
      return !!(mm && mm("(any-pointer: coarse)").matches && !mm("(any-pointer: fine)").matches && !mm("(any-hover: hover)").matches);
    } catch (e) { return false; }
  }
  function onKeyDown(e) {
    if (!keyboardSeen && e.key && !(e.key === "Unidentified")) { keyboardSeen = true; $("touchNotice").hidden = true; }
    if (view === "game" && !modalOpen && game && game.status !== "playing" && e.key && e.key.length === 1) { e.preventDefault(); return; }   /* поки триває анімація кінця, пробіл не гортає сторінку */
    if (view !== "game" || modalOpen || !game || game.status !== "playing" || Stage.busy()) return;
    if (e.ctrlKey && !e.altKey || e.metaKey) return;             /* Ctrl+R, Ctrl+C тощо працюють як завжди; AltGr (Ctrl+Alt) друкує символи */
    var tg = e.target && e.target.tagName;
    if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
    var expected = game.text.charAt(game.pos);
    var cls = Core.classify(LANG, expected, e);
    if (cls === "ignore") return;                                 /* Shift, Tab, Enter, стрілки: нічого не робимо й не блокуємо */
    e.preventDefault();                                           /* пробіл не гортає сторінку, ' і / не відкривають швидкий пошук */
    if (e.repeat) return;
    if (cls === "layout") {
      var w = $("layoutWarn");
      w.textContent = T("layoutHint"); w.hidden = false;
      say(T("layoutHint"), "warn");
      return;
    }
    $("layoutWarn").hidden = true;
    var ev = Core.press(game, cls === "ok", now());
    var pos = game.pos;
    if (ev.type === "hit") {
      paintChar(game, pos - 1); paintChar(game, pos);
      Stage.hit(ev);
      if (ev.won) { clearHints(); $("fingerHint").textContent = ""; }
      else showHint(game.text.charAt(pos));
      if (ev.destroyed) say(T("status.destroyed", { n: game.destroyed }), "ok");
      else if (ev.tierUp) say(T("status.tier", { mult: ev.mult }), "ok");
    } else if (ev.type === "miss") {
      paintChar(game, pos);
      flashBad(e.code);
      Stage.miss(ev);
      say(T(ev.lostCombo >= 5 ? "status.missCombo" : "status.miss", { errors: ev.errors, max: game.budget }), "bad");
    }
    updateHud();
    scrollText(game);
    if (ev.won) finish(true);
    else if (ev.lost) { clearHints(); $("fingerHint").textContent = ""; paintChars(game, 0, game.length); finish(false); }
  }
  /* Пробіл на сфокусованій кнопці не повинен її натискати (клік спрацьовує на keyup). */
  function onKeyUp(e) {
    if (view === "game" && !modalOpen && (e.key === " " || e.key === "Spacebar")) e.preventDefault();
  }

  /* ---------- кнопки ---------- */
  $("levelList").addEventListener("click", function (e) {
    var b = e.target;
    while (b && b !== this && !(b.getAttribute && b.getAttribute("data-id"))) b = b.parentNode;
    if (!b || b === this) return;
    var id = b.getAttribute("data-id");
    for (var i = 0; i < levels.length; i++) if (levels[i].id === id && unlocked(i)) startLevel(i);
  });
  $("backBtn").addEventListener("click", function () { showLevels(); });
  $("restartBtn").addEventListener("click", function () { startLevel(idx); });
  $("mRetry").addEventListener("click", function () { closeModal(); startLevel(idx); });
  $("mNext").addEventListener("click", function () { closeModal(); startLevel(idx + 1); });
  $("mLevels").addEventListener("click", function () { closeModal(); showLevels(); });
  $("resetProgress").addEventListener("click", function () {
    if (!window.confirm(T("resetConfirm"))) return;
    saved = { v: 1, uk: {}, en: {} };
    if (window.GIStorage) GIStorage.remove(STORE_ID);
    syncSummary();
    renderLevelList();
  });
  document.addEventListener("keydown", function (e) {
    if (modalOpen) {
      if (e.key === "Escape") { closeModal(); showLevels(); return; }
      if (e.key === "Tab") {      /* фокус не виходить із вікна: Tab ходить по колу видимих кнопок */
        var bs = [], all = modal.querySelectorAll("button"), i;
        for (i = 0; i < all.length; i++) if (!all[i].hidden) bs.push(all[i]);
        var f = bs[0], l = bs[bs.length - 1];
        if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); }
        else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); }
      }
      return;
    }
    onKeyDown(e);
  });
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", function () { if (view === "game" && game) scrollText(game); });
  document.addEventListener("visibilitychange", function () {
    if (view !== "game") return;
    if (document.hidden) Stage.stop(); else Stage.start();
  });

  /* ---------- маршрутизація: #<id рівня> ---------- */
  function hashLevel() {
    var h = (location.hash || "").replace(/^#/, "");
    for (var i = 0; i < levels.length; i++) if (levels[i].id === h) return i;
    return -1;
  }
  window.addEventListener("hashchange", function () {
    var i = hashLevel();
    if (i >= 0 && !(view === "game" && idx === i)) { closeModal(); startLevel(i); }
    else if (i < 0 && (location.hash && location.hash !== "#")) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ок */ } }
  });

  /* ---------- старт ---------- */
  GIData.loadJSON(ROOT + "content/klaviatura/levels.json").then(function (doc) {
    try {
      cfg = doc; levels = doc.levels;
      buildKeyboard(); buildHands();
      loadSaved();
      syncSummary();
      if (touchOnly()) $("touchNotice").hidden = false;
      var i = hashLevel();
      if (i >= 0) startLevel(i); else showLevels(true);
    } catch (err) {
      /* замість порожнього екрана — повідомлення «онови сторінку» */
      $("viewGame").hidden = true; $("viewLevels").hidden = true;
      $("loadError").hidden = false;
      throw err;
    }
    window.__klaviatura = { Core: Core, get game() { return game; }, get saved() { return saved; } };
  });
})();
