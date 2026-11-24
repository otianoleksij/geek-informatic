/* «Перегони слів»: інтерфейс, SVG-траса з мультяшними машинами й камерою, що їде за гравцем, анімації (requestAnimationFrame), прогрес.
   Логіка (слова, ліміти часу, позиції, обгони, кубки) лежить у perehony-core.js, розкладки й оцінка натискань
   (classify, у т. ч. «не та розкладка») у klaviatura-core.js (catalog.json: sharedScripts).
   Рядки беруться зі словника (t); слова й ліміти: content/perehony/words.json. */
(function () {
  "use strict";
  var Core = window.PerehonyCore, Klav = window.KlaviaturaCore;
  var ROOT = document.documentElement.getAttribute("data-root") || "";
  var LANG = (window.GII18n && GII18n.lang) || "uk";
  var STORE_ID = "perehony:v2", SLUG = "perehony";
  var NS = "http://www.w3.org/2000/svg";
  var $ = function (id) { return document.getElementById(id); };
  var T = function (k, params) { return t("perehony." + k, params); };
  var reduced = function () { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); };
  var now = function () { return window.performance && performance.now ? performance.now() : new Date().getTime(); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var easeInOut = function (u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; };
  var easeOut = function (u) { return 1 - Math.pow(1 - u, 3); };

  /* ---------- геометрія траси ----------
     Екран: viewBox 0 0 1200 400. Світ: машини стоять у слотах через SP (x лівий край машини), 1-ше місце найправіше.
     Камера їде за гравцем: гравець завжди на екрані в PLAYER_SX, решту видно з боків (попереду 3-4 машини, позаду 2). */
  var VBW = 1200;
  var LANE_Y = [322, 278], LANE_S = [1.2, 1.13];     /* ближня смуга (звичайна) і дальня (для обгону) */
  var CAR_W = 122 * 1.2;
  var SP = 170;                                      /* відстань між машинами у світі */
  var PLAYER_SX = 400;                               /* екранний x лівого краю машини гравця */
  var START_WX = -60;                                /* лінія старту (світ) */
  var FINISH_GAP = 380;                              /* фініш за лідером (світ) */
  var PASS_MS = 1150;
  var CD_STEP = 800;                                 /* мс на цифру зворотного відліку */
  var ROAD_SPEED = 520;                              /* одиниць за секунду: дорога їде повз, поки машини «їдуть» */
  var LAYERS = { clouds: 0.05, hillsFar: 0.1, hillsNear: 0.18, trees: 0.35, road: 1, front: 1.3 };

  /* 14 розфарбувань суперників: колір + наклейка на дверях (якщо суперників більше, повторюються) */
  var PAL = [
    { base: "#2F80ED", dark: "#1B4FA8", light: true, decal: "circle" },
    { base: "#27AE60", dark: "#177A42", light: true, decal: "triangle" },
    { base: "#F2C94C", dark: "#9A7410", light: false, decal: "diamond" },
    { base: "#9B51E0", dark: "#6A2FB0", light: true, decal: "stripes" },
    { base: "#F2994A", dark: "#A85A0E", light: false, decal: "bolt" },
    { base: "#14B8A6", dark: "#0B7C70", light: false, decal: "heart" },
    { base: "#FF6FB1", dark: "#B83B7A", light: false, decal: "plus" },
    { base: "#8BD21E", dark: "#4F7C0A", light: false, decal: "ring" },
    { base: "#38BDF8", dark: "#0E7FB5", light: false, decal: "dots" },
    { base: "#D946EF", dark: "#8E1FA3", light: false, decal: "wave" },
    { base: "#4F46E5", dark: "#2E27A8", light: true, decal: "arrow" },
    { base: "#D5DAE6", dark: "#7C86A0", light: false, decal: "moon" },
    { base: "#A9693B", dark: "#6B3E1D", light: true, decal: "square" },
    { base: "#3D4A6B", dark: "#232C47", light: true, decal: "drop" }
  ];
  var PLAYER_STYLE = { base: "#EB4D4B", dark: "#A82220", decal: "star", light: true };
  function carStyle(id) {
    if (id === Core.PLAYER) return PLAYER_STYLE;
    var k = parseInt(id.slice(1), 10) - 1;
    return PAL[(k < 0 ? 0 : k) % PAL.length];
  }
  var NC = 15;                                       /* машин у поточних перегонах */
  var camX = 0;                                      /* лівий край камери у світі */
  var OUTLINE = "#1C2540";

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
  function addCls(el, c) { if ((" " + el.className + " ").indexOf(" " + c + " ") < 0) el.className = (el.className ? el.className + " " : "") + c; }
  function delCls(el, c) { el.className = (" " + el.className + " ").replace(" " + c + " ", " ").replace(/^\s+|\s+$/g, ""); }
  function setCls(el, c, on) { if (on) addCls(el, c); else delCls(el, c); }

  /* ---------- збереження: {v:1, uk:{<складність>:{place,cpm,accuracy,inTime,cups}}, en:{...}} ---------- */
  var saved = { v: 1, uk: {}, en: {} };
  var cfg = null, diffs = [];
  function loadSaved() {
    try {
      var s = window.GIStorage ? GIStorage.load(STORE_ID) : null;
      if (s && typeof s === "object") {
        ["uk", "en"].forEach(function (l) {
          if (!s[l] || typeof s[l] !== "object") return;
          for (var id in s[l]) {
            var b = s[l][id];
            if (s[l].hasOwnProperty(id) && b && typeof b.place === "number" && b.place >= 1 && b.place <= (cfg.raceLength + 1) && typeof b.cpm === "number") saved[l][id] = b;
          }
        });
      }
    } catch (e) { /* пошкоджені дані: починаємо з нуля */ }
  }
  function persist() { if (window.GIStorage) { GIStorage.save(STORE_ID, saved); syncSummary(); } }
  function winsCount() {
    var n = 0;
    diffs.forEach(function (d) { var b = saved[LANG][d.id]; if (b && b.place === 1) n++; });
    return n;
  }
  function syncSummary() { if (window.GIStorage && diffs.length) GIStorage.setSummary(SLUG, winsCount(), diffs.length); }
  function bestOf(d) { return saved[LANG][d.id] || null; }

  /* ---------- кубки (SVG-малюнок) ---------- */
  var CUP_PATH = "M8 3h16v9a8 8 0 0 1-16 0V3zM8 6H3v3a5 5 0 0 0 5 5M24 6h5v3a5 5 0 0 1-5 5M16 20v5M10 29h12M12 25h8v4h-8z";
  function cupsSvg(n, host) {
    host.textContent = "";
    for (var i = 0; i < 3; i++) {
      var s = svgEl("svg", { viewBox: "0 0 32 32", "aria-hidden": "true", focusable: "false" }, host);
      svgEl("path", { d: CUP_PATH, "class": i < n ? "got" : "no", "stroke-linejoin": "round", "stroke-linecap": "round" }, s);
    }
  }

  /* ---------- меню ---------- */
  var view = "menu", currentDiff = null;
  function renderMenu() {
    var host = $("diffList"), total = 0, max = diffs.length * 3;
    host.textContent = "";
    diffs.forEach(function (d) {
      var b = div("diff " + d.id, host, "button");
      b.type = "button";
      b.setAttribute("data-id", d.id);
      var top = div("d-top", b);
      div("d-name", top, "span").textContent = T("diff." + d.id + ".name");
      div("d-flag", top, "span");
      var rng = Core.lengthRange(d, cfg.words[LANG]);
      div("d-line", b, "p").textContent = T("diff." + d.id + ".desc");
      div("d-line", b, "p").textContent = T("card.len", { min: rng.min, max: rng.max });
      div("d-line", b, "p").textContent = T("card.time", { s: Math.round(Core.avgLimitSeconds(d, cfg.words[LANG])) });
      var best = bestOf(d), line = div("d-best" + (best ? "" : " none"), b);
      if (best) {
        var tx = div("", line, "span");
        tx.textContent = T("card.best", { place: best.place, cpm: best.cpm });
        var cw = div("cups", line, "span");
        cw.setAttribute("role", "img");
        cw.setAttribute("aria-label", T("cupsAria", { n: best.cups }));
        cupsSvg(best.cups, cw);
        total += best.cups;
      } else line.textContent = T("card.none");
    });
    $("cupsTotal").textContent = T("cupsTotal", { n: total, max: max });
    var ul = $("rules");
    ul.textContent = "";
    div("", ul, "li").textContent = T("rule1", { count: cfg.raceLength });
    div("", ul, "li").textContent = T("rule2");
    div("", ul, "li").textContent = T("rule3");
  }
  function showMenu(initial) {
    stopLoop(); closeModal();
    view = "menu"; race = null; phase = "idle";
    $("viewRace").hidden = true; $("viewMenu").hidden = false;
    renderMenu();
    if (location.hash && location.hash !== "#") { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ок */ } }
    if (!initial) { var h = $("menuH"); if (h) { h.setAttribute("tabindex", "-1"); h.focus(); } }
    try { window.scrollTo(0, 0); } catch (e2) { /* ок */ }
  }

  /* ---------- траса: шари ---------- */
  var scene, layerEls = {}, carsG, fxG, finishG, startG, carObjs = {};
  var scroll = { dist: 0, speed: 0, target: 0 };
  var wheelAngle = 0;

  function tileClouds() {
    var s = "", xs = [150, 520, 880], ys = [58, 98, 48], i;
    for (i = 0; i < xs.length; i++) {
      s += '<g transform="translate(' + xs[i] + " " + ys[i] + ')" fill="#FFFFFF" opacity=".96"><ellipse rx="56" ry="18" cy="6"/><circle cx="-20" cy="-8" r="21"/><circle cx="14" cy="-16" r="26"/><circle cx="38" cy="-2" r="16"/></g>';
    }
    return s;
  }
  function tileHills(fill, y0, amp) {
    var a = amp;
    return '<path fill="' + fill + '" d="M0 ' + y0 + " C120 " + (y0 - a) + " 260 " + (y0 - a) + " 380 " + (y0 - a * 0.2) + " C500 " + (y0 + a * 0.2) + " 560 " + (y0 - a * 1.1) + " 700 " + (y0 - a * 0.9) +
      " C860 " + (y0 - a * 0.7) + " 960 " + (y0 + a * 0.3) + " 1100 " + (y0 - a * 0.4) + " C1150 " + (y0 - a * 0.7) + " 1180 " + (y0 - a * 0.1) + " 1200 " + y0 + ' L1200 260 L0 260 Z"/>';
  }
  function tileTrees() {
    var xs = [90, 300, 520, 760, 990, 1130], sc = [1, 0.8, 1.1, 0.9, 1.05, 0.75], s = "", i;
    for (i = 0; i < xs.length; i++) {
      s += '<g transform="translate(' + xs[i] + " 232) scale(" + sc[i] + ')"><rect x="-6" y="-34" width="12" height="36" rx="3" fill="#8B5E34" stroke="#5A3A1C" stroke-width="2"/>' +
        '<circle cx="0" cy="-60" r="30" fill="#3FA34D" stroke="#276B30" stroke-width="2.5"/><circle cx="-20" cy="-46" r="20" fill="#4CB85A" stroke="#276B30" stroke-width="2.5"/>' +
        '<circle cx="20" cy="-46" r="20" fill="#4CB85A" stroke="#276B30" stroke-width="2.5"/><circle cx="-8" cy="-68" r="8" fill="#6FD27A" opacity=".8"/></g>';
    }
    return s;
  }
  function tileRoad() {
    var s = "", x;
    for (x = 0; x < VBW; x += 60) {
      s += '<rect x="' + x + '" y="226" width="30" height="10" fill="#E5383B"/><rect x="' + (x + 30) + '" y="226" width="30" height="10" fill="#FFFFFF"/>';
      s += '<rect x="' + x + '" y="342" width="30" height="10" fill="#FFFFFF"/><rect x="' + (x + 30) + '" y="342" width="30" height="10" fill="#E5383B"/>';
      s += '<rect x="' + (x + 8) + '" y="287" width="38" height="5" rx="2" fill="#F7F9FD"/>';
    }
    return s;
  }
  function tileFront() {
    var s = "", xs = [60, 190, 340, 470, 610, 760, 880, 1030, 1140], i;
    var cols = ["#FF6FB1", "#FFD43B", "#FFFFFF", "#FF9F43", "#B388FF"];
    for (i = 0; i < xs.length; i++) {
      s += '<g transform="translate(' + xs[i] + " " + (368 + (i % 3) * 8) + ')"><path d="M0 0V-12" stroke="#2E8B3A" stroke-width="3" stroke-linecap="round"/><circle cy="-15" r="6" fill="' + cols[i % cols.length] + '" stroke="#14213A" stroke-width="1.6"/><circle cy="-15" r="2" fill="#FFD43B"/></g>';
      if (i % 2) s += '<path d="M' + (xs[i] + 40) + " 386 q4 -16 8 0 q4 -14 8 0" + '" fill="none" stroke="#3FA34D" stroke-width="3" stroke-linecap="round"/>';
    }
    return s;
  }
  function chequer(x, y, w, h, cols, rows) {
    var s = "", cw = w / cols, ch = h / rows, r, c;
    s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#FFFFFF"/>';
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) if ((r + c) % 2 === 0) s += '<rect x="' + (x + c * cw) + '" y="' + (y + r * ch) + '" width="' + cw + '" height="' + ch + '" fill="#14213A"/>';
    return s + '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="none" stroke="#14213A" stroke-width="2"/>';
  }
  function layer(id, tile) {
    return '<g id="L_' + id + '"><g>' + tile + '</g><g transform="translate(' + VBW + ' 0)">' + tile + "</g></g>";
  }

  /* наклейка на дверях (центр близько 50,-27) */
  function decalMarkup(c, dc, O) {
    var k = c.decal;
    if (k === "circle") return '<circle cx="50" cy="-27" r="6.5" ' + dc + "/>";
    if (k === "triangle") return '<path d="M43 -21 L50 -34 L57 -21 Z" ' + dc + "/>";
    if (k === "diamond") return '<path d="M50 -35 L58 -27 L50 -19 L42 -27 Z" ' + dc + "/>";
    if (k === "stripes") return '<path d="M40 -33 L46 -33 L52 -21 L46 -21 Z M50 -33 L56 -33 L62 -21 L56 -21 Z" ' + dc + "/>";
    if (k === "bolt") return '<path d="M53 -35 L43 -26 L49 -26 L46 -18 L58 -28 L51 -28 Z" ' + dc + "/>";
    if (k === "heart") return '<path d="M50 -19 C40 -26 42 -35 47.5 -35 C49 -35 50 -34 50 -33 C50 -34 51 -35 52.5 -35 C58 -35 60 -26 50 -19 Z" ' + dc + "/>";
    if (k === "plus") return '<path d="M47 -35 H53 V-30 H58 V-24 H53 V-19 H47 V-24 H42 V-30 H47 Z" ' + dc + "/>";
    if (k === "ring") return '<circle cx="50" cy="-27" r="7.5" ' + dc + '/><circle cx="50" cy="-27" r="3" fill="' + c.base + '" stroke="' + c.dark + '" stroke-width="1.4"/>';
    if (k === "dots") return '<circle cx="42" cy="-27" r="3.6" ' + dc + '/><circle cx="50" cy="-27" r="3.6" ' + dc + '/><circle cx="58" cy="-27" r="3.6" ' + dc + "/>";
    if (k === "wave") return '<path d="M41 -27 Q45.5 -35 50 -27 T59 -27" fill="none" stroke="' + c.dark + '" stroke-width="6.5" stroke-linecap="round"/><path d="M41 -27 Q45.5 -35 50 -27 T59 -27" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round"/>';
    if (k === "arrow") return '<path d="M41 -30 H50 V-35 L59 -27 L50 -19 V-24 H41 Z" ' + dc + "/>";
    if (k === "moon") return '<path d="M54 -35 A9 9 0 1 0 54 -19 A7 7 0 1 1 54 -35 Z" ' + dc + "/>";
    if (k === "square") return '<rect x="43" y="-34" width="14" height="14" rx="2.5" ' + dc + "/>";
    if (k === "drop") return '<path d="M50 -36 C56 -28 58 -25 58 -23 A8 8 0 0 1 42 -23 C42 -25 44 -28 50 -36 Z" ' + dc + "/>";
    return '<path d="M50 -37 L53.5 -29.5 L61.5 -28.6 L55.6 -23.2 L57.2 -15.3 L50 -19.2 L42.8 -15.3 L44.4 -23.2 L38.5 -28.6 L46.5 -29.5 Z" fill="#FFD43B" stroke="' + O + '" stroke-width="2" stroke-linejoin="round"/>';
  }

  function carMarkup(id) {
    var c = carStyle(id), d = "", O = OUTLINE;
    var decalFill = "#FFFFFF";
    d += '<ellipse cx="62" cy="1" rx="58" ry="5" fill="rgba(20,33,58,.22)"/>';
    d += '<path d="M22 -36 C26 -54 38 -62 56 -62 L86 -62 C100 -62 108 -50 110 -36 Z" fill="' + c.base + '" stroke="' + O + '" stroke-width="2.5" stroke-linejoin="round"/>';
    d += '<rect x="2" y="-38" width="120" height="28" rx="11" fill="' + c.base + '" stroke="' + O + '" stroke-width="2.5"/>';
    d += '<rect x="7" y="-17" width="110" height="5" rx="2.5" fill="' + c.dark + '"/>';
    d += '<path d="M28 -38 C31 -50 38 -57 46 -58 L46 -38 Z" fill="#D6F0FF" stroke="' + O + '" stroke-width="2" stroke-linejoin="round"/>';
    d += '<path d="M52 -38 L52 -54 Q52 -60 60 -60 L86 -60 Q98 -60 104 -38 Z" fill="#D6F0FF" stroke="' + O + '" stroke-width="2" stroke-linejoin="round"/>';
    /* big eyes in the windshield */
    d += '<circle cx="68" cy="-47" r="8.6" fill="#fff" stroke="' + O + '" stroke-width="1.8"/><circle cx="88" cy="-47" r="8.6" fill="#fff" stroke="' + O + '" stroke-width="1.8"/>';
    d += '<circle cx="71" cy="-46" r="4.3" fill="' + O + '"/><circle cx="91" cy="-46" r="4.3" fill="' + O + '"/>';
    d += '<circle cx="72.3" cy="-47.6" r="1.4" fill="#fff"/><circle cx="92.3" cy="-47.6" r="1.4" fill="#fff"/>';
    /* wheel arches and wheels */
    var wx = [28, 94], i;
    for (i = 0; i < 2; i++) {
      d += '<circle cx="' + wx[i] + '" cy="-13" r="16" fill="' + O + '"/>';
      d += '<g transform="translate(' + wx[i] + ' -13)"><circle r="13" fill="#2A2F45"/><g class="wh"><circle r="7.5" fill="#E8ECF4"/><path d="M0 -6.5V6.5M-6.5 0H6.5" stroke="#8E9AB8" stroke-width="2"/><circle r="2.2" fill="#2A2F45"/></g></g>';
    }
    /* door decal */
    var dc = 'fill="' + decalFill + '" stroke="' + c.dark + '" stroke-width="1.8" stroke-linejoin="round"';
    d += decalMarkup(c, dc, O);
    /* headlight, tail light, smile on the front bumper */
    d += '<circle cx="115" cy="-33" r="4.2" fill="#FFF3A0" stroke="' + O + '" stroke-width="1.6"/>';
    d += '<rect x="1" y="-31" width="5" height="9" rx="2" fill="#FF4D4D" stroke="' + O + '" stroke-width="1.4"/>';
    d += '<path d="M104 -25 Q112 -14 119 -25" fill="none" stroke="' + O + '" stroke-width="2.6" stroke-linecap="round"/>';
    if (id === "p") {
      /* flag on a pole at the back (text from i18n) */
      d += '<path d="M12 -38 V-84" stroke="' + O + '" stroke-width="3" stroke-linecap="round"/>';
      d += '<path d="M13 -84 Q26 -89 38 -84 T62 -84 L62 -64 Q50 -59 38 -64 T13 -64 Z" fill="#FFD43B" stroke="' + O + '" stroke-width="2.2" stroke-linejoin="round"/>';
      d += '<text class="you" x="38" y="-69" text-anchor="middle" font-size="15" font-weight="800" fill="' + O + '" font-family="Nunito, sans-serif"></text>';
    }
    return d;
  }

  function buildScene() {
    var s = '<defs>' +
      '<linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6EC8FF"/><stop offset="1" stop-color="#E3F6FF"/></linearGradient>' +
      '<linearGradient id="gGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FE07F"/><stop offset="1" stop-color="#56BD57"/></linearGradient>' +
      '<linearGradient id="gRoad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6A7390"/><stop offset="1" stop-color="#555D77"/></linearGradient></defs>';
    s += '<rect width="1200" height="400" fill="url(#gSky)"/>';
    s += '<g transform="translate(1050 70)"><circle r="62" fill="#FFE27A" opacity=".5"/><circle r="40" fill="#FFC83D" stroke="#E9A400" stroke-width="3"/></g>';
    s += layer("clouds", tileClouds());
    s += layer("hillsFar", tileHills("#A5E3AA", 190, 46));
    s += layer("hillsNear", tileHills("#86D48D", 214, 30));
    s += '<rect y="214" width="1200" height="186" fill="url(#gGrass)"/>';
    s += layer("trees", tileTrees());
    s += '<rect y="236" width="1200" height="106" fill="url(#gRoad)"/>';
    s += layer("road", tileRoad());
    s += '<g id="startG"><g>' + chequer(-9, 236, 18, 106, 2, 8) + '</g></g>';
    s += '<g id="finishG" visibility="hidden"><g>' + chequer(-9, 236, 18, 106, 2, 8) +
      '<path d="M-3 236 V120" stroke="#14213A" stroke-width="7" stroke-linecap="round"/><path d="M-3 236 V120" stroke="#EDEFF7" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M-160 122 Q-120 108 -80 122 T-3 122 L-3 158 Q-40 172 -80 158 T-160 158 Z" fill="#fff" stroke="#14213A" stroke-width="3" stroke-linejoin="round"/>' +
      '<text class="ftxt" x="-80" y="148" text-anchor="middle" font-size="22" font-weight="800" fill="#14213A" font-family="Nunito, sans-serif"></text></g></g>';
    s += '<g id="cars"></g>';
    s += layer("front", tileFront());
    s += '<g id="fx"></g>';
    scene.innerHTML = s;
    var k;
    for (k in LAYERS) if (LAYERS.hasOwnProperty(k)) layerEls[k] = scene.querySelector("#L_" + k);
    carsG = scene.querySelector("#cars"); fxG = scene.querySelector("#fx");
    finishG = scene.querySelector("#finishG"); startG = scene.querySelector("#startG");
    scene.querySelector(".ftxt").textContent = T("finishLabel");
    /* машини */
    var ids = Core.opponentIds(NC - 1).concat([Core.PLAYER]);
    carObjs = {};
    ids.forEach(function (id) {
      var g = svgEl("g", {}, carsG);
      g.innerHTML = carMarkup(id);
      carObjs[id] = { id: id, g: g, x: 0, lane: 0, tw: null, wheels: g.querySelectorAll(".wh"), phase: Math.random() * 6, badge: null };
    });
    var you = scene.querySelector(".you");
    if (you) you.textContent = T("youFlag");
  }

  /* ---------- машини: місця, анімація обгону ---------- */
  function slotX(idx) { return (NC - 1 - idx) * SP; }
  function finishWX() { return slotX(0) + CAR_W + FINISH_GAP; }
  function laneY(l) { return lerp(LANE_Y[0], LANE_Y[1], l); }
  function laneS(l) { return lerp(LANE_S[0], LANE_S[1], l); }

  function placeCars(instant) {
    race.order.forEach(function (id, idx) {
      var c = carObjs[id], tx = slotX(idx);
      if (instant || reduced()) { c.x = tx; c.lane = 0; c.tw = null; }
      else if (!c.tw && Math.abs(c.x - tx) < 0.5) { c.x = tx; }
      else if (!c.tw) c.tw = { t: 0, dur: PASS_MS, fromX: c.x, toX: tx, fromLane: c.lane, role: "back" };
      c.targetX = tx;
    });
  }
  /* passer обганяє passed: passer піднімається на дальню смугу, їде вперед і повертається; passed плавно відступає назад */
  function startSwap(passerId, passedId) {
    race.order.forEach(function (id, idx) { carObjs[id].targetX = slotX(idx); });
    var a = carObjs[passerId], b = carObjs[passedId];
    if (reduced()) { a.x = a.targetX; b.x = b.targetX; a.lane = b.lane = 0; a.tw = b.tw = null; return; }
    a.tw = { t: 0, dur: PASS_MS, fromX: a.x, toX: a.targetX, fromLane: a.lane, role: "pass" };
    b.tw = { t: 0, dur: PASS_MS, fromX: b.x, toX: b.targetX, fromLane: b.lane, role: "back" };
    puff(a, 5);
  }
  function laneFor(tw, u) {
    if (tw.role !== "pass") return lerp(tw.fromLane, 0, easeInOut(u));
    if (u < 0.24) return lerp(tw.fromLane, 1, easeInOut(u / 0.24));
    if (u > 0.76) return lerp(1, 0, easeInOut((u - 0.76) / 0.24));
    return 1;
  }
  var drawKey = "";
  function updateCars(dt, tms) {
    var animate = !reduced(), ids = Core.opponentIds(NC - 1).concat([Core.PLAYER]), order = [];
    if (!animate) dt = 0;
    wheelAngle += dt * (phase === "countdown" || phase === "idle" ? 0.2 : (phase === "finishing" ? 1.1 : 0.7));
    ids.forEach(function (id) {
      var c = carObjs[id];
      if (c.finishing) {
        c.x += c.vx * dt / 1000;
      } else if (c.tw) {
        c.tw.t += dt;
        var u = clamp(c.tw.t / c.tw.dur, 0, 1);
        c.x = lerp(c.tw.fromX, c.tw.toX, easeInOut(u));
        c.lane = laneFor(c.tw, u);
        if (u >= 1) { c.x = c.tw.toX; c.lane = 0; c.tw = null; }
      }
    });
    /* камера їде за гравцем (плавно, бо x гравця сам анімується) */
    camX = carObjs[Core.PLAYER].x - PLAYER_SX;
    ids.forEach(function (id) {
      var c = carObjs[id];
      var bob = animate && phase !== "idle" ? Math.sin(tms * 0.011 + c.phase) * 1.3 : 0;
      var y = laneY(c.lane) + bob, sc = laneS(c.lane), sx = c.x - camX;
      var vis = sx > -CAR_W - 30 && sx < VBW + 30;
      if (vis !== c.vis) { c.vis = vis; c.g.setAttribute("visibility", vis ? "visible" : "hidden"); }
      if (vis) {
        c.g.setAttribute("transform", "translate(" + sx.toFixed(1) + " " + y.toFixed(1) + ") scale(" + sc.toFixed(3) + ")");
        var w;
        for (w = 0; w < c.wheels.length; w++) c.wheels[w].setAttribute("transform", "rotate(" + (wheelAngle % 360).toFixed(1) + ")");
      }
      c.y = y;
      order.push(c);
    });
    /* ближчі до глядача машини малюємо поверх */
    order.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var key = order.map(function (c) { return c.id; }).join("");
    if (key !== drawKey) { drawKey = key; order.forEach(function (c) { carsG.appendChild(c.g); }); }
  }

  /* ---------- шари сцени: паралакс від камери й від ходу дороги ---------- */
  function updateScenery(dt) {
    scroll.speed += (scroll.target - scroll.speed) * Math.min(1, dt / 350);
    if (reduced()) scroll.speed = 0;
    scroll.dist += scroll.speed * dt / 1000;
    var k;
    for (k in LAYERS) if (LAYERS.hasOwnProperty(k) && layerEls[k]) {
      var off = (((scroll.dist + camX) * LAYERS[k]) % VBW + VBW) % VBW;
      layerEls[k].setAttribute("transform", "translate(" + (-off).toFixed(1) + " 0)");
    }
    /* лінія старту їде разом із дорогою, фініш стоїть у світі машин */
    var sx = START_WX - camX - scroll.dist;
    if (startG) { startG.setAttribute("transform", "translate(" + sx.toFixed(1) + " 0)"); startG.setAttribute("visibility", sx < -40 || sx > VBW + 40 ? "hidden" : "visible"); }
    var fx = finishWX() - camX;
    if (finishG) { finishG.setAttribute("transform", "translate(" + fx.toFixed(1) + " 0)"); finishG.setAttribute("visibility", fx < -40 || fx - 200 > VBW ? "hidden" : "visible"); }
  }

  /* ---------- ефекти: пил і конфеті ---------- */
  var parts = [];
  function puff(car, n) {
    if (reduced()) return;
    var i;
    for (i = 0; i < n; i++) {
      var el = svgEl("circle", { r: 4, fill: "#EFE3C2", opacity: 0.85, stroke: "#C9B98F", "stroke-width": 1 }, fxG);
      parts.push({ el: el, kind: "dust", x: car.x - camX + 10 + Math.random() * 14, y: laneY(car.lane) - 6 - Math.random() * 6, vx: -60 - Math.random() * 70, vy: -10 - Math.random() * 30, age: 0, life: 650 + Math.random() * 250 });
    }
  }
  function confetti() {
    if (reduced()) return;
    var cols = ["#FF5A5F", "#FFC83D", "#2D55E0", "#27AE60", "#9B51E0", "#FF8FC7"], i;
    for (i = 0; i < 90; i++) {
      var el = svgEl("rect", { width: 9 + Math.random() * 6, height: 5 + Math.random() * 5, fill: cols[i % cols.length] }, fxG);
      parts.push({ el: el, kind: "conf", x: 300 + Math.random() * 700, y: -20 - Math.random() * 120, vx: -90 + Math.random() * 180, vy: 80 + Math.random() * 160, rot: Math.random() * 360, vr: -300 + Math.random() * 600, age: 0, life: 3400 });
    }
  }
  function updateParts(dt) {
    var i, p, s = dt / 1000;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i]; p.age += dt;
      if (p.age >= p.life) { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); parts.splice(i, 1); continue; }
      p.x += p.vx * s; p.y += p.vy * s;
      if (p.kind === "dust") {
        var u = p.age / p.life;
        p.el.setAttribute("cx", p.x.toFixed(1)); p.el.setAttribute("cy", p.y.toFixed(1));
        p.el.setAttribute("r", (4 + u * 14).toFixed(1)); p.el.setAttribute("opacity", (0.85 * (1 - u)).toFixed(2));
      } else {
        p.rot += p.vr * s; p.vy += 90 * s; p.vx *= 0.995;
        p.el.setAttribute("transform", "translate(" + p.x.toFixed(1) + " " + p.y.toFixed(1) + ") rotate(" + p.rot.toFixed(0) + ")");
        if (p.age > p.life - 600) p.el.setAttribute("opacity", ((p.life - p.age) / 600).toFixed(2));
      }
    }
  }
  function clearFx() {
    while (parts.length) { var p = parts.pop(); if (p.el.parentNode) p.el.parentNode.removeChild(p.el); }
  }

  /* ---------- спливаючі написи ---------- */
  function pop(text, cls, xUnits, delay, topPct) {
    var host = $("pops");
    var make = function () {
      var el = div("pop " + (cls || ""), host);
      el.textContent = text;
      el.style.left = (clamp(xUnits, 140, VBW - 140) / VBW * 100).toFixed(1) + "%";
      el.style.top = (topPct || 14) + "%";
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1600);
    };
    if (delay) setTimeout(make, delay); else make();
  }

  /* ---------- слово, шкала часу, мініатюра порядку ---------- */
  var live = null, liveTimer = 0;
  function say(msg) {
    if (!live) live = $("live");
    live.textContent = "";
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { live.textContent = msg; }, 40);
  }
  var letterEls = [];
  function showWord(word) {
    var box = $("word"), i;
    box.className = "word";
    box.textContent = "";
    letterEls = [];
    for (i = 0; i < word.length; i++) {
      var ch = word.charAt(i), s = div("ch" + (ch === "'" ? " apos" : ""), box, "span");
      s.textContent = ch;
      letterEls.push(s);
    }
    paintWord();
  }
  function paintWord() {
    var i, pos = race ? race.wordPos : 0, active = race && race.status === "word";
    var last = race && race.status === "between" && race.results.length ? race.results[race.results.length - 1] : null;
    for (i = 0; i < letterEls.length; i++) {
      var el = letterEls[i];
      setCls(el, "done", i < pos || !!(last && last.ok));
      setCls(el, "miss", !!(last && !last.ok && i >= pos));
      setCls(el, "cur", active && i === pos);
    }
  }
  function flashBad() {
    var el = letterEls[race.wordPos];
    if (!el) return;
    delCls(el, "bad"); void el.offsetWidth; addCls(el, "bad");
  }
  function idleWord(text) {
    var box = $("word");
    box.className = "word idle";
    box.textContent = text;
    letterEls = [];
  }
  var lastTimeTxt = "";
  function updateTime() {
    var fill = $("timeFill"), ratio = 1, txt = "";
    if (race && race.status === "word") {
      var lim = Core.currentLimit(race), rem = Core.remainingMs(race);
      ratio = lim ? rem / lim : 0;
      txt = T("timeLeft", { s: (Math.ceil(rem / 100) / 10).toFixed(1) });
    } else if (race && race.status === "between") { ratio = fill._last || 0; txt = ""; }
    fill._last = ratio;
    fill.style.transform = "scaleX(" + clamp(ratio, 0, 1).toFixed(4) + ")";
    var cls = ratio < 0.25 ? "timefill low" : ratio < 0.5 ? "timefill warn" : "timefill";
    if (fill.className !== cls) fill.className = cls;
    if (txt !== lastTimeTxt) { $("timeLeft").textContent = txt; lastTimeTxt = txt; }
  }
  function resetTimeBar() {
    var f = $("timeFill"); f._last = 1; f.style.transform = "scaleX(1)"; f.className = "timefill";
    $("timeLeft").textContent = ""; lastTimeTxt = "";
  }

  function buildPips() {
    var ol = $("pips"), i;
    ol.textContent = "";
    for (i = 0; i < race.total; i++) div("", ol, "li");
  }
  function updatePips() {
    var lis = $("pips").children, i;
    for (i = 0; i < lis.length; i++) {
      var r = race.results[i], cls = r ? (r.ok ? "ok" : "miss") : (i === race.index && race.status === "word" ? "now" : "");
      if (lis[i].className !== cls) lis[i].className = cls;
    }
  }
  var chipEls = {};
  function buildStrip() {
    var strip = $("strip");
    strip.textContent = "";
    chipEls = {};
    Core.opponentIds(NC - 1).concat([Core.PLAYER]).forEach(function (id) {
      var st = carStyle(id), c = div("chip" + (id === Core.PLAYER ? " me" : "") + (st.light ? "" : " y"), strip);
      c.style.background = st.base;
      chipEls[id] = c;
    });
    updateStrip();
  }
  function updateStrip() {
    var strip = $("strip"), w = strip.clientWidth || 600, pad = 26;
    race.order.forEach(function (id, idx) {
      var c = chipEls[id], x = pad + (NC - 1 - idx) / (NC - 1) * (w - 2 * pad - 14);
      c.style.left = x.toFixed(1) + "px";
      c.textContent = String(idx + 1);
    });
  }
  function updateBadge(dir) {
    var p = Core.place(race), b = $("placeBadge");
    $("placeNum").textContent = p + " / " + NC;
    b.setAttribute("aria-label", T("placeAria", { place: p, total: NC }));
    delCls(b, "up"); delCls(b, "down");
    if (dir && !reduced()) { void b.offsetWidth; addCls(b, dir); }
  }
  function updateCount() {
    $("wordCount").textContent = race.status === "finished" || race.index < 0 ? "" : T("wordCount", { n: Math.min(race.index + 1, race.total), total: race.total });
  }

  /* ---------- перегони ---------- */
  var race = null, phase = "idle";          /* idle | countdown | word | between | finishing | done */
  var cdT = 0, cdStage = -1, betweenT = 0, fin = null, rafId = 0, lastTs = 0, modalOpen = false, keyboardSeen = false;
  var started = 0;

  function startRace(d) {
    closeModal();
    currentDiff = d; view = "race";
    $("viewMenu").hidden = true; $("viewRace").hidden = false;
    $("diffName").textContent = T("diff." + d.id + ".name");
    var seed = (Math.floor(Math.random() * 4294967295) ^ new Date().getTime()) >>> 0;
    var words = Core.pickWords(cfg.words[LANG], d, cfg.raceLength, Klav.createRng(seed));
    race = Core.newRace(words, d);
    NC = race.cars;
    try { if (("#" + d.id) !== location.hash) history.replaceState(null, "", location.pathname + location.search + "#" + d.id); } catch (e) { /* ок */ }
    buildScene();
    clearFx(); parts = []; drawKey = "";
    placeCars(true);
    scroll.dist = 0; scroll.speed = 0; scroll.target = 0;
    fin = null;
    updateCars(0, 0); updateScenery(0);
    buildPips(); buildStrip(); updatePips(); updateBadge(); updateCount(); resetTimeBar();
    $("layoutWarn").hidden = true;
    $("pops").textContent = "";
    phase = "countdown"; cdT = 0; cdStage = -1; betweenT = 0;
    idleWord(T("getReady"));
    say(T("status.ready"));
    try { $("wordRow").focus(); } catch (e2) { /* ок */ }
    startLoop();
  }

  function nextWord() {
    var w = Core.startWord(race);
    if (w === null) { startFinish(); return; }
    phase = "word";
    showWord(w); resetTimeBar(); updatePips(); updateCount(); updateTime();
    $("layoutWarn").hidden = true;
    say(T("status.word", { n: race.index + 1, total: race.total, word: w }));
  }

  function handleEvent(ev) {
    var px = PLAYER_SX + 60;
    paintWord();
    updatePips(); updateTime();
    if (ev.type === "overtake") {
      if (ev.moved) {
        startSwap(Core.PLAYER, ev.passed);
        pop(T("pop.up"), "", px);
        if (ev.fast) pop(T("pop.fast"), "fast", px, 180, 34);   /* під «+1 позиція», щоб не накладалися */
        updateBadge("up");
        say(T(ev.fast ? "status.upFast" : "status.up", { place: ev.place, total: NC }));
      } else {
        pop(T("pop.lead"), ev.fast ? "fast" : "", px);
        say(T("status.lead"));
      }
    } else {
      /* час вийшов: слово пропущено, місце те саме, машини стоять на місцях */
      pop(T("pop.miss"), "bad", px);
      say(T("status.miss", { place: ev.place, total: NC }));
      $("timeFill")._last = 0; updateTime();
    }
    updateStrip();
    phase = "between"; betweenT = 0;
  }

  /* ---------- фініш ---------- */
  function startFinish() {
    phase = "finishing";
    fin = { t: 0, playerAt: null, ranked: {} };
    idleWord(T("finishLabel"));
    $("wordCount").textContent = "";
    $("timeLeft").textContent = ""; lastTimeTxt = "";
    updatePips();
    var f = finishG.querySelector(".ftxt"); if (f) f.textContent = T("finishLabel");
    /* машини стоять у фінальному порядку; камера лишається на гравцеві */
    race.order.forEach(function (id, idx) { var c = carObjs[id]; c.x = slotX(idx); c.lane = 0; c.tw = null; c.finishing = false; c.vx = 0; });
    scroll.target = 0; scroll.speed = 0;
    if (reduced()) {
      fin.reduced = true; fin.playerAt = 0;
      onPlayerFinished();
      return;
    }
    var gap = finishWX() - (carObjs[Core.PLAYER].x + CAR_W);
    fin.vmax = clamp(gap / 1.9, 800, 1700);
    race.order.forEach(function (id) { carObjs[id].finishing = true; });
  }
  function updateFinish(dt) {
    if (fin.reduced) { if (now() - fin.t0 > 700) { phase = "done"; openResult(); } return; }
    fin.t += dt;
    var lineX = finishWX();
    var ramp = clamp(fin.t / 500, 0, 1);
    race.order.forEach(function (id, idx) {
      var c = carObjs[id];
      c.vx = 120 + (fin.vmax - 120) * easeOut(ramp);
      if (!fin.ranked[id] && c.x + CAR_W >= lineX + 6) {
        fin.ranked[id] = idx + 1;
        c.badge = svgEl("g", { transform: "translate(60 -92)" }, c.g);
        svgEl("circle", { r: 17, fill: idx === 0 ? "#FFC83D" : "#FFFFFF", stroke: OUTLINE, "stroke-width": 3 }, c.badge);
        var tx = svgEl("text", { y: 6, "text-anchor": "middle", "font-size": 19, "font-weight": 800, fill: OUTLINE, "font-family": "Nunito, sans-serif" }, c.badge);
        tx.textContent = String(idx + 1);
        if (id === Core.PLAYER) { fin.playerAt = fin.t; onPlayerFinished(); }
      }
    });
    if (fin.playerAt !== null && fin.t - fin.playerAt > 1300 && phase === "finishing") { phase = "done"; openResult(); }
  }
  function onPlayerFinished() {
    var p = Core.place(race);
    say(T("status.finish", { place: p, total: NC }));
    pop(T("pop.finish", { place: p }), p === 1 ? "fast final" : "final", 600);
    if (p === 1) confetti();
    if (fin.reduced) fin.t0 = now();
  }

  /* ---------- підсумок ---------- */
  var modal = null;
  function statItem(label, value) {
    var wrap = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = label; dd.textContent = value;
    wrap.appendChild(dt); wrap.appendChild(dd);
    return wrap;
  }
  function openResult() {
    var sum = Core.summary(race), d = currentDiff, prev = bestOf(d), record = Core.isBetter(sum, prev);
    if (record || !prev) {
      saved[LANG][d.id] = { place: sum.place, cpm: sum.cpm, accuracy: sum.accuracy, inTime: sum.inTime, cups: sum.cups };
    } else if (prev && prev.cups < sum.cups) prev.cups = sum.cups;
    persist();
    $("mtitle").textContent = sum.win ? T("res.winTitle") : T("res.placeTitle", { place: sum.place });
    $("mText").textContent = T({ win: "res.t1", podium: "res.tPodium", good: "res.tGood", keep: "res.tLow" }[sum.kind]);
    var cw = $("mCups");
    cw.setAttribute("aria-label", T("cupsAria", { n: sum.cups }));
    cupsSvg(sum.cups, cw);
    $("mRecord").hidden = !(record && prev);
    var st = $("mStats"); st.textContent = "";
    st.appendChild(statItem(T("stat.place"), T("placeOf", { place: sum.place, total: sum.cars })));
    st.appendChild(statItem(T("stat.words"), T("wordsOf", { n: sum.inTime, total: sum.total })));
    st.appendChild(statItem(T("stat.cpm"), String(sum.cpm)));
    st.appendChild(statItem(T("stat.acc"), T("pct", { n: Math.round(sum.accuracy) })));
    modal.className = "modal show"; modalOpen = true;
    $("mRetry").focus();
  }
  function closeModal() { if (modal) modal.className = "modal"; modalOpen = false; }

  /* ---------- головний цикл ---------- */
  function frame(ts) {
    rafId = 0;
    if (view !== "race" || !race) return;
    if (document.hidden) { lastTs = 0; return; }
    var dt = lastTs ? Math.min(ts - lastTs, 100) : 16;
    lastTs = ts;
    if (phase === "countdown") {
      cdT += dt;
      var st = Math.floor(cdT / CD_STEP);
      if (st !== cdStage) { cdStage = st; showCountdown(st); }
      if (st >= 3) scroll.target = ROAD_SPEED;
      if (cdT >= CD_STEP * 3 + 650) { $("countdown").textContent = ""; nextWord(); }
    } else if (phase === "word") {
      var ev = Core.tick(race, dt);
      if (ev) handleEvent(ev); else updateTime();
    } else if (phase === "between") {
      betweenT += dt;
      var wait = race.index + 1 >= race.total ? Core.BETWEEN_MS + 700 : Core.BETWEEN_MS;
      if (betweenT >= wait) {
        nextWord();
      }
    } else if (phase === "finishing" && fin) {
      updateFinish(dt);
    }
    updateCars(dt, ts); updateScenery(dt); updateParts(dt);
    if (view === "race" && race) rafId = requestAnimationFrame(frame);
  }
  function showCountdown(stage) {
    var box = $("countdown");
    box.textContent = "";
    box.className = "countdown" + (stage >= 3 ? " go" : "");
    var s = div("", box, "span");
    s.textContent = stage >= 3 ? T("cd.go") : String(3 - stage);
    if (stage < 3) say(String(3 - stage));
    else { say(T("cd.go")); idleWord(""); }
  }
  function startLoop() { if (!rafId) { lastTs = 0; rafId = requestAnimationFrame(frame); } }
  function stopLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  /* ---------- клавіатурні події ---------- */
  function touchOnly() {
    try {
      var mm = window.matchMedia;
      return !!(mm && mm("(any-pointer: coarse)").matches && !mm("(any-pointer: fine)").matches && !mm("(any-hover: hover)").matches);
    } catch (e) { return false; }
  }
  function onKeyDown(e) {
    if (!keyboardSeen && e.key && e.key !== "Unidentified") { keyboardSeen = true; $("touchNotice").hidden = true; }
    if (view !== "race" || !race || modalOpen) return;
    if (e.ctrlKey && !e.altKey || e.metaKey) return;             /* Ctrl+R, Ctrl+C тощо працюють як завжди; AltGr (Ctrl+Alt) друкує символи */
    var tg = e.target && e.target.tagName;
    if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
    if (phase !== "word") {
      /* між словами, у відліку й на фініші: пробіл не гортає сторінку, натискання нічого не штрафують */
      if (e.key === " " || e.key === "Spacebar" || e.key === "'" || e.key === "/") e.preventDefault();
      return;
    }
    var expected = Core.currentChar(race);
    var key = e.key;
    /* CapsLock: велика літера тієї самої клавіші теж зараховується */
    var ev0 = { key: key, code: e.code };
    if (typeof key === "string" && key.length === 1 && key !== key.toLowerCase() && key.toLowerCase() === expected) ev0.key = key.toLowerCase();
    var cls = Klav.classify(LANG, expected, ev0);
    if (cls === "ignore") return;                                 /* Shift, Tab, Enter, стрілки: не блокуємо */
    e.preventDefault();                                           /* пробіл не гортає сторінку, ' і / не відкривають швидкий пошук */
    if (e.repeat) return;
    if (cls === "layout") {
      var w = $("layoutWarn");
      w.textContent = T("layoutHint"); w.hidden = false;
      say(T("layoutHint"));
      return;
    }
    $("layoutWarn").hidden = true;
    var res = Core.key(race, cls === "ok");
    if (!res) return;
    if (res.type === "error") { flashBad(); }
    else if (res.type === "ok") { paintWord(); }
    else { handleEvent(res); }
  }
  function onKeyUp(e) {
    if (view === "race" && !modalOpen && (e.key === " " || e.key === "Spacebar")) e.preventDefault();
  }

  /* ---------- кнопки й події ---------- */
  $("diffList").addEventListener("click", function (e) {
    var b = e.target;
    while (b && b !== this && !(b.getAttribute && b.getAttribute("data-id"))) b = b.parentNode;
    if (!b || b === this) return;
    var id = b.getAttribute("data-id");
    for (var i = 0; i < diffs.length; i++) if (diffs[i].id === id) startRace(diffs[i]);
  });
  $("backBtn").addEventListener("click", function () { showMenu(); });
  $("restartBtn").addEventListener("click", function () { startRace(currentDiff); });
  $("mRetry").addEventListener("click", function () { startRace(currentDiff); });
  $("mMenu").addEventListener("click", function () { showMenu(); });
  $("resetProgress").addEventListener("click", function () {
    if (!window.confirm(T("resetConfirm"))) return;
    saved = { v: 1, uk: {}, en: {} };
    if (window.GIStorage) GIStorage.remove(STORE_ID);
    syncSummary();
    renderMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (modalOpen) {
      if (e.key === "Escape") { showMenu(); return; }
      if (e.key === "Tab") {      /* фокус не виходить із вікна: Tab ходить по колу кнопок */
        var bs = modal.querySelectorAll("button"), f = bs[0], l = bs[bs.length - 1];
        if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); }
        else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); }
      }
      return;
    }
    onKeyDown(e);
  });
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", function () { if (view === "race" && race) updateStrip(); });
  /* вкладка прихована: годинник слова не йде (цикл зупиняється, а після повернення dt починається з нуля) */
  document.addEventListener("visibilitychange", function () {
    if (view !== "race" || !race) return;
    if (document.hidden) { stopLoop(); lastTs = 0; } else if (phase !== "done") startLoop();
  });

  /* ---------- прямі посилання: #easy, #medium, #hard ---------- */
  function hashDiff() {
    var h = (location.hash || "").replace(/^#/, "");
    for (var i = 0; i < diffs.length; i++) if (diffs[i].id === h) return diffs[i];
    return null;
  }
  window.addEventListener("hashchange", function () {
    var d = hashDiff();
    if (d && !(view === "race" && currentDiff === d)) startRace(d);
    else if (!d && location.hash && location.hash !== "#") { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ок */ } }
  });

  /* ---------- старт ---------- */
  modal = $("modal");
  scene = $("scene");
  GIData.loadJSON(ROOT + "content/perehony/words.json").then(function (doc) {
    try {
      cfg = doc; diffs = doc.difficulties;
      loadSaved(); syncSummary();
      if (touchOnly()) $("touchNotice").hidden = false;
      var d = hashDiff();
      if (d) startRace(d); else showMenu(true);
    } catch (err) {
      $("viewMenu").hidden = true; $("viewRace").hidden = true;
      $("loadError").hidden = false;
      throw err;
    }
    window.__perehony = { Core: Core, get race() { return race; }, get saved() { return saved; } };
  });
})();
