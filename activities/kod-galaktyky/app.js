/* «Код Галактики»: інтерфейс, Blockly, анімації. Логіка виконання — у galaxy-core.js (спільна з валідатором).
   Рівні читаються з content/kod-galaktyky/levels.json, рядки — зі словника (t). */
(function () {
  "use strict";
  var Core = window.GalaxyCore, LEVELS = [];
  var STORE_ID = "kod-galaktyky:v3", OLD_STORE_ID = "kod-galaktyky:v2", LEGACY_KEY = "geek-galaxy-v2", SLUG = "kod-galaktyky";
  var ROOT = document.documentElement.getAttribute("data-root") || "";
  var $ = function (id) { return document.getElementById(id); };
  var reduced = function () { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var SPEEDS = [1, 2, 4];
  var ROT = { E: 0, N: -90, W: 180, S: 90 };
  var CANCEL = { cancel: true };

  /* ---------- рядки ---------- */
  function levelTitle(lv) { return GIData.pick(lv.title); }
  /* Мініророзмітка: **жирний** і [[клавіша]] -> DOM без innerHTML */
  function rich(el, str) {
    el.textContent = "";
    String(str).split(/(\*\*.+?\*\*|\[\[.+?\]\])/).forEach(function (part) {
      if (!part) return;
      var m = /^\*\*(.+)\*\*$/.exec(part), k = /^\[\[(.+)\]\]$/.exec(part), node;
      if (m) { node = document.createElement("b"); node.textContent = m[1]; }
      else if (k) { node = document.createElement("kbd"); node.textContent = k[1]; }
      else node = document.createTextNode(part);
      el.appendChild(node);
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-rich]"), function (el) { rich(el, t(el.getAttribute("data-rich"))); });

  /* ---------- збереження ---------- */
  /* kod-galaktyky:v3 — {stars: {"<id рівня>": 1..3}, cur: "<id>", progs: {"<id>": Blockly-JSON}, speed}.
     v2 (і ще давніший geek-galaxy-v2) зберігав номери рівнів з 1: переносимо за позицією в масиві. */
  var state = { stars: {}, cur: "", progs: {}, speed: 1 };
  function isState(o) { return o && typeof o === "object" && !Array.isArray(o); }
  function idByNum(k) {
    var n = parseInt(k, 10);
    return n >= 1 && n <= LEVELS.length && String(n) === String(k) ? LEVELS[n - 1].id : null;
  }
  function applyState(s, fromV2) {
    function key(k) { return fromV2 ? idByNum(k) : (levelIndex(k) >= 0 ? k : null); }
    var k, id;
    state.stars = {}; state.progs = {};
    if (isState(s.stars)) for (k in s.stars) { id = key(k); if (id && s.stars[k] >= 1 && s.stars[k] <= 3) state.stars[id] = +s.stars[k]; }
    if (isState(s.progs)) for (k in s.progs) { id = key(k); if (id) state.progs[id] = s.progs[k]; }
    state.cur = fromV2 ? (idByNum(s.cur) || "") : (levelIndex(s.cur) >= 0 ? s.cur : "");
    state.speed = SPEEDS.indexOf(s.speed) >= 0 ? s.speed : 1;
  }
  function loadState() {
    try {
      if (!window.GIStorage) return;
      var s = GIStorage.load(STORE_ID);
      if (isState(s)) { applyState(s, false); return; }
      var old = GIStorage.load(OLD_STORE_ID, LEGACY_KEY);
      if (isState(old)) {
        applyState(old, true);
        GIStorage.save(STORE_ID, state);
        GIStorage.remove(OLD_STORE_ID);
      }
    } catch (e) { /* пошкоджені дані: починаємо з нуля */ }
  }
  function saveState() { if (window.GIStorage) GIStorage.save(STORE_ID, state); syncSummary(); }
  function wipeState() {
    if (window.GIStorage) GIStorage.remove(STORE_ID);
    state = { stars: {}, cur: "", progs: {}, speed: 1 };
    syncSummary();
  }
  function syncSummary() {
    if (!window.GIStorage) return;
    var done = 0;
    LEVELS.forEach(function (l) { if ((state.stars[l.id] || 0) > 0) done++; });
    GIStorage.setSummary(SLUG, done, LEVELS.length);
  }
  function levelIndex(id) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return i;
    return -1;
  }
  function unlocked(i) { return i === 0 || (state.stars[LEVELS[i - 1].id] || 0) > 0; }
  function totalStars() { var t = 0; for (var k in state.stars) t += state.stars[k]; return t; }

  /* ---------- фонові зірки ---------- */
  (function () {
    var host = $("stars"), frag = document.createDocumentFragment();
    for (var i = 0; i < 90; i++) {
      var s = document.createElement("span"), sz = rnd(1, 2.6);
      s.className = "st";
      s.style.cssText = "left:" + rnd(0, 100) + "%;top:" + rnd(0, 100) + "%;width:" + sz + "px;height:" + sz + "px;animation-duration:" + rnd(3, 7) + "s;animation-delay:" + rnd(-7, 0) + "s";
      frag.appendChild(s);
    }
    host.appendChild(frag);
  })();

  /* ---------- екрани ---------- */
  var viewMap = $("viewMap"), viewGame = $("viewGame"), viewNoEditor = $("viewNoEditor");
  function showMap() {
    cancelRun(true);
    closeModal();
    viewGame.hidden = true; viewNoEditor.hidden = true; viewMap.hidden = false;
    renderMap();
    window.scrollTo(0, 0);
  }
  var starSvg = '<svg class="mstar" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5l8.5 17.2 19 2.8-13.8 13.4 3.3 18.9L32 48.4l-17 8.9 3.3-18.9L4.5 25l19-2.8z" fill="#ffc94a" stroke="#7a5a00" stroke-width="3" stroke-linejoin="round"/></svg>';

  function renderMap() {
    var ol = $("planets"); ol.innerHTML = "";
    LEVELS.forEach(function (lv, i) {
      var n = i + 1, st = state.stars[lv.id] || 0, open = unlocked(i), title = levelTitle(lv);
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button";
      b.className = "planet" + (open ? "" : " locked") + (n === LEVELS.length ? " boss" : "") + ((lv.id === state.cur || (!state.cur && i === 0)) && open ? " cur" : "");
      b.disabled = !open;
      b.setAttribute("aria-label", open ? t("kod-galaktyky.levelAria", { n: n, title: title, count: st }) : t("kod-galaktyky.levelLocked", { n: n, title: title }));
      var orb = document.createElement("span"), pname = document.createElement("span"), pstars = document.createElement("span");
      orb.className = "orb"; orb.style.setProperty("--h", (n * 47 + 180) % 360); orb.textContent = open ? n : "🔒";
      pname.className = "pname"; pname.textContent = title;
      pstars.className = "pstars"; pstars.setAttribute("aria-hidden", "true");
      for (var k = 1; k <= 3; k++) {
        if (k <= st) pstars.appendChild(document.createTextNode("★"));
        else { var off = document.createElement("span"); off.className = "off"; off.textContent = "★"; pstars.appendChild(off); }
      }
      b.appendChild(orb); b.appendChild(pname); b.appendChild(pstars);
      b.addEventListener("click", function () { navigate(lv.id, "push"); });
      li.appendChild(b); ol.appendChild(li);
    });
    $("totalStars").textContent = t("kod-galaktyky.starsTotal", { stars: totalStars(), total: LEVELS.length * 3 });
  }

  var resetBtn = $("resetProg"), resetTimer = null;
  resetBtn.addEventListener("click", function () {
    if (resetTimer) {
      clearTimeout(resetTimer); resetTimer = null;
      resetBtn.textContent = t("kod-galaktyky.resetProgress");
      wipeState(); renderMap();
      return;
    }
    resetBtn.textContent = t("kod-galaktyky.resetConfirm");
    resetTimer = setTimeout(function () { resetTimer = null; resetBtn.textContent = t("kod-galaktyky.resetProgress"); }, 4000);
  });

  /* ---------- ігрове поле ---------- */
  var stage = $("stage"), stageBg = $("stageBg"), objs = $("objs"), fxl = $("fxl"), trail = $("trail");
  var ship = $("ship"), shipFly = $("shipFly"), shipRot = $("shipRot"), streak = $("streak");
  var statusEl = $("status"), runBtn = $("run"), stopBtn = $("stop");
  var lv = null, pm = null, N = 6, crystalEls = {}, rockEls = {};
  var sx = 0, sy = 0, srot = 0, sdir = "E", got = 0;
  var puffTimers = [], warping = null;

  var ROCK_SVG = '<svg viewBox="0 0 64 64"><path d="M12 24 L26 8 L48 11 L58 30 L51 52 L26 58 L8 42 Z" fill="#6b5a4e" stroke="#2d241e" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 24 L26 8 L48 11 L40 22 L22 27 Z" fill="#8a7564"/><circle cx="24" cy="38" r="6" fill="#4d4038"/><circle cx="42" cy="31" r="4" fill="#4d4038"/><circle cx="40" cy="46" r="3" fill="#4d4038"/></svg>';
  var CRYSTAL_SVG = '<svg viewBox="0 0 64 64"><path d="M32 4 L50 24 L32 60 L14 24 Z" fill="#5ee6ff" stroke="#0b5a73" stroke-width="2.4" stroke-linejoin="round"/><path d="M32 4 L50 24 L32 30 L14 24 Z" fill="#b8f6ff"/><path d="M32 30 L50 24 L32 60 Z" fill="#2bb8d6"/><path d="M24 20 L28 12" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';

  function place(el, x, y) {
    el.style.left = (x * 100 / N) + "%"; el.style.top = (y * 100 / N) + "%";
    el.style.width = (100 / N) + "%"; el.style.height = (100 / N) + "%";
  }
  function setShip(x, y, instant) {
    if (instant) { ship.style.transition = "none"; }
    place(ship, x, y); sx = x; sy = y;
    if (instant) { void ship.offsetWidth; ship.style.transition = ""; }
  }
  function setRot(deg, instant) {
    srot = deg;
    if (instant) { shipRot.style.transition = "none"; }
    shipRot.style.transform = "rotate(" + deg + "deg)";
    if (instant) { void shipRot.offsetWidth; shipRot.style.transition = ""; }
  }
  function updatePos() { $("pos").textContent = t("kod-galaktyky.pos", { dir: t("kod-galaktyky.dir." + sdir) }); }
  function updateCrystalHud() { $("crystalCount").textContent = got + "/" + (pm ? pm.crystals.length : 0); }

  function buildObjs() {
    objs.innerHTML = ""; crystalEls = {}; rockEls = {};
    Object.keys(pm.rocks).forEach(function (k) {
      var p = k.split(","), d = document.createElement("div");
      d.className = "obj rock"; d.innerHTML = ROCK_SVG; place(d, +p[0], +p[1]);
      d.firstChild.style.transform = "rotate(" + Math.round(rnd(-25, 25)) + "deg)";
      objs.appendChild(d); rockEls[k] = d;
    });
    pm.crystals.forEach(function (c) {
      var d = document.createElement("div");
      d.className = "obj crystal"; d.innerHTML = CRYSTAL_SVG; place(d, c.x, c.y);
      d.firstChild.style.animationDelay = rnd(-1.8, 0) + "s";
      objs.appendChild(d); crystalEls[c.x + "," + c.y] = d;
    });
  }

  function buildStage(level) {
    lv = level; pm = Core.parseMap(level); N = pm.w;
    stage.style.setProperty("--n", N);
    stageBg.innerHTML = "";
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var c = document.createElement("div");
      c.className = "cell" + (x === pm.start.x && y === pm.start.y ? " pad" : "");
      c.style.animationDelay = rnd(0, 0.55) + "s";
      stageBg.appendChild(c);
    }
    trail.setAttribute("viewBox", "0 0 " + N + " " + N);
    buildObjs();
  }

  function clearAnims(el) { if (el.getAnimations) el.getAnimations().forEach(function (a) { a.cancel(); }); }
  function stopPuffs() { puffTimers.forEach(clearInterval); puffTimers = []; document.querySelectorAll(".puff,.fxfix").forEach(function (e) { e.remove(); }); }

  /* Повертає стан до старту (без варпу) */
  function resetStage() {
    clearAnims(shipFly); clearAnims(ship); clearAnims(streak); stopPuffs();
    ship.classList.remove("wreck", "go", "boost", "launch", "hide");
    streak.style.opacity = 0;
    trail.innerHTML = "";
    buildObjs();
    got = 0; sdir = lv.start.dir;
    setShip(pm.start.x, pm.start.y, true); setRot(ROT[sdir], true);
    updatePos(); updateCrystalHud();
    clearMarks();
    if (ws) ws.highlightBlock(null);
  }

  /* Варп-приліт на стартову клітинку */
  function warpIn() {
    resetStage();
    if (reduced()) { ship.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }); return; }
    var v = Core.VEC[lv.start.dir], far = N + 2, dur = 1500;
    ship.classList.add("boost");
    stage.classList.remove("appear"); void stage.offsetWidth; stage.classList.add("appear");
    var a = shipFly.animate([
      { transform: "translate(" + (-v[0] * far * 100) + "%," + (-v[1] * far * 100) + "%)", easing: "cubic-bezier(.05,.75,.2,1)" },
      { transform: "translate(" + (v[0] * 16) + "%," + (v[1] * 16) + "%)", offset: 0.7, easing: "ease-in-out" },
      { transform: "translate(" + (-v[0] * 6) + "%," + (-v[1] * 6) + "%)", offset: 0.85, easing: "ease-in-out" },
      { transform: "translate(0,0)" }
    ], { duration: dur });
    streak.animate([
      { opacity: 1, transform: "scaleX(1)" }, { opacity: 0.85, transform: "scaleX(.55)", offset: 0.55 }, { opacity: 0, transform: "scaleX(.1)" }
    ], { duration: dur * 0.8 });
    warping = a;
    setTimeout(function () { ship.classList.remove("boost"); }, dur * 0.7);
    a.onfinish = a.oncancel = function () { if (warping === a) warping = null; };
  }
  function finishWarp() { if (warping) { try { warping.finish(); } catch (e) { /* ок */ } warping = null; } ship.classList.remove("boost"); }

  /* ---------- Blockly ---------- */
  var ws = null, startBlock = null, loading = false, syncing = false, saveTimer = null;
  var pathMap = {}, lastProgram = [], marked = [];

  function defineBlocks() {
    var T = function (k) { return t("kod-galaktyky." + k); };
    Blockly.defineBlocksWithJsonArray([
      { type: "g_start", message0: T("block.start"), nextStatement: null, colour: "#F59E0B", tooltip: T("tt.start") },
      { type: "g_forward", message0: T("cmd.F"), previousStatement: null, nextStatement: null, colour: "#3B82F6", tooltip: T("tt.forward") },
      { type: "g_left", message0: T("cmd.L"), previousStatement: null, nextStatement: null, colour: "#A855F7", tooltip: T("tt.left") },
      { type: "g_right", message0: T("cmd.R"), previousStatement: null, nextStatement: null, colour: "#A855F7", tooltip: T("tt.right") },
      { type: "g_collect", message0: T("cmd.C"), previousStatement: null, nextStatement: null, colour: "#0EA5B7", tooltip: T("tt.collect") },
      { type: "g_repeat", message0: T("block.repeat"), args0: [{ type: "field_number", name: "N", value: 3, min: 2, max: 9, precision: 1 }],
        message1: "%1", args1: [{ type: "input_statement", name: "DO" }], previousStatement: null, nextStatement: null, colour: "#16A34A", tooltip: T("tt.repeat") }
    ]);
  }
  var BLOCK_OF = { F: "g_forward", L: "g_left", R: "g_right", C: "g_collect", rep: "g_repeat" };

  function toolboxFor(level) {
    var c = [];
    ["F", "L", "R", "C", "rep"].forEach(function (t) {
      if (level.allowed.indexOf(t) < 0) return;
      if (level.limits && level.limits[t] === 0) return;
      c.push({ kind: "block", type: BLOCK_OF[t] });
    });
    return { kind: "flyoutToolbox", contents: c };
  }

  function initBlockly() {
    if (ws) return;
    defineBlocks();
    var theme = Blockly.Theme.defineTheme("galaxy", {
      base: Blockly.Themes.Classic, startHats: true,
      componentStyles: {
        workspaceBackgroundColour: "#0b1129", toolboxBackgroundColour: "#141c40", toolboxForegroundColour: "#e8ecff",
        flyoutBackgroundColour: "#141c40", flyoutForegroundColour: "#e8ecff", flyoutOpacity: 1,
        scrollbarColour: "#3a4785", insertionMarkerColour: "#ffffff", insertionMarkerOpacity: 0.35, cursorColour: "#5ee6ff"
      },
      fontStyle: { family: "Nunito, sans-serif", weight: "700", size: 13 }
    });
    /* На телефоні вертикальна панель блоків з'їдає майже всю ширину — кладемо її рядком зверху. */
    var narrow = window.innerWidth < 600;
    ws = Blockly.inject("blockly", {
      toolbox: toolboxFor(LEVELS[0]), theme: theme, renderer: "zelos", trashcan: true,
      horizontalLayout: narrow, toolboxPosition: "start",
      grid: { spacing: 24, length: 2, colour: "#1c2654", snap: true },
      zoom: { controls: true, startScale: narrow ? 0.75 : 0.85, maxScale: 1.6, minScale: 0.5 },
      move: { scrollbars: true, drag: true, wheel: false },
      sounds: false, media: ROOT + "vendor/blockly@10.4.3/media/"
    });
    /* Клавіатурна навігація (WCAG 2.1.1): плагін необов'язковий — якщо не завантажився, гра працює мишею. */
    try {
      if (typeof NavigationController === "function") {
        var kbNav = new NavigationController();
        kbNav.init();
        kbNav.addWorkspace(ws);
      }
    } catch (err) { if (window.console) console.warn("Keyboard navigation unavailable:", err); }
    ws.addChangeListener(onChange);
    var rs = function () { if (ws && !viewGame.hidden) Blockly.svgResize(ws); };
    window.addEventListener("resize", rs);
    window.addEventListener("orientationchange", function () { setTimeout(rs, 200); });
    if (window.ResizeObserver) new ResizeObserver(rs).observe($("blockly"));
  }

  function makeStart() {
    var b = ws.newBlock("g_start"); b.initSvg(); b.render();
    var v = ws.getMetricsManager().getViewMetrics(true);
    b.moveBy(v.left + 24, v.top + 24); b.setDeletable(false);
    return b;
  }

  function loadProgram(id) {
    loading = true;
    ws.clear();
    var saved = state.progs[id];
    if (saved) { try { Blockly.serialization.workspaces.load(saved, ws); } catch (e) { ws.clear(); } }
    startBlock = ws.getAllBlocks(false).filter(function (b) { return b.type === "g_start"; })[0] || null;
    if (!startBlock) startBlock = makeStart();
    startBlock.setDeletable(false);
    loading = false;
    syncEnabled(); updateCounts();
  }

  function syncEnabled() {
    if (syncing || !ws) return;
    syncing = true;
    try {
      ws.getAllBlocks(false).forEach(function (b) {
        var inProg = b.getRootBlock() === startBlock;
        if (b.isEnabled() !== inProg) b.setEnabled(inProg);
      });
    } finally { syncing = false; }
  }

  function onChange(e) {
    if (e.isUiEvent || loading || syncing) return;
    clearMarks(); syncEnabled(); updateCounts();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProgram, 400);
  }
  function saveProgram() {
    if (!ws || !lv) return;
    try { state.progs[lv.id] = Blockly.serialization.workspaces.save(ws); saveState(); } catch (e) { /* ок */ }
  }

  /* Блоки Blockly -> програма-дерево (той самий формат, що в levels.js) */
  function buildProgram() {
    pathMap = {};
    function chain(b, base) {
      var list = [], i = 0;
      while (b) {
        var path = base.concat(i);
        pathMap[path.join(".")] = b;
        if (b.type === "g_forward") list.push("F");
        else if (b.type === "g_left") list.push("L");
        else if (b.type === "g_right") list.push("R");
        else if (b.type === "g_collect") list.push("C");
        else if (b.type === "g_repeat") list.push({ rep: Number(b.getFieldValue("N")) || 2, body: chain(b.getInputTargetBlock("DO"), path) });
        i++; b = b.getNextBlock();
      }
      return list;
    }
    lastProgram = chain(startBlock.getNextBlock(), []);
    return lastProgram;
  }
  function looseCount() { return ws.getTopBlocks(false).filter(function (b) { return b !== startBlock; }).length; }

  function clearMarks() {
    marked.forEach(function (m) { try { m.b.getSvgRoot().classList.remove(m.cls); } catch (e) { /* ок */ } });
    marked = [];
  }
  function markPaths(paths, cls) {
    (paths || []).forEach(function (p) {
      var b = pathMap[p.join(".")];
      if (b && b.getSvgRoot) { b.getSvgRoot().classList.add(cls); marked.push({ b: b, cls: cls }); }
    });
  }
  function highlightPath(path) {
    if (!path) { ws.highlightBlock(null); return; }
    var b = pathMap[path.join(".")];
    ws.highlightBlock(b ? b.id : null);
  }

  function chip(cls, str) {
    var sp = document.createElement("span");
    sp.className = cls; rich(sp, str);
    return sp;
  }
  function updateCounts() {
    if (!ws || !lv || !startBlock) return;
    var prog = buildProgram(), v = Core.validate(lv, prog), box = $("chips");
    $("count").textContent = t("kod-galaktyky.count", { n: v.total, max: lv.maxBlocks });
    box.textContent = "";
    box.appendChild(chip("chip" + (v.total > lv.maxBlocks ? " over" : ""), t("kod-galaktyky.chipBlocks", { n: v.total, max: lv.maxBlocks })));
    Object.keys(lv.limits || {}).forEach(function (c) {
      var lim = lv.limits[c], name = t("kod-galaktyky.chip." + c);
      if (lim === 0) box.appendChild(chip("chip off", t("kod-galaktyky.chipOff", { name: name })));
      else box.appendChild(chip("chip" + (v.counts[c] > lim ? " over" : ""), t("kod-galaktyky.chipLimit", { name: name, n: v.counts[c], limit: lim })));
    });
    box.appendChild(chip("chip", t("kod-galaktyky.chipStars", { par: lv.par })));
  }

  /* ---------- повідомлення ---------- */
  function say(msg, cls) { statusEl.className = "status" + (cls ? " " + cls : ""); statusEl.textContent = msg; }

  /* ---------- відкриття рівня ---------- */
  var hintBtn = $("hintBtn"), hintBox = $("hintBox");
  function openLevel(idx, force) {
    if (!force && !unlocked(idx)) return;
    cancelRun(true);
    closeModal();
    if (typeof Blockly === "undefined" || !Blockly.inject) {
      viewMap.hidden = true; viewGame.hidden = true; viewNoEditor.hidden = false;
      window.scrollTo(0, 0);
      $("reloadPage").focus();
      return;
    }
    var level = LEVELS[idx];
    state.cur = level.id; saveState();
    viewMap.hidden = true; viewGame.hidden = false;
    initBlockly();
    lv = level;
    $("lvlNum").textContent = t("kod-galaktyky.levelNum", { n: idx + 1, total: LEVELS.length });
    $("lvlTitle").textContent = levelTitle(level);
    $("story").textContent = GIData.pick(level.story);
    hintBox.hidden = true; hintBox.textContent = "💡 " + GIData.pick(level.tip);
    hintBtn.setAttribute("aria-expanded", "false");
    say(t("kod-galaktyky.ready"));
    buildStage(level);
    try { ws.updateToolbox(toolboxFor(level)); } catch (e) { /* ок */ }
    Blockly.svgResize(ws);
    loadProgram(level.id);
    requestAnimationFrame(function () { Blockly.svgResize(ws); });
    warpIn();
    window.scrollTo(0, 0);
  }

  $("reloadPage").addEventListener("click", function () { location.reload(); });
  $("noEditorMap").addEventListener("click", function () { goMap(); });

  hintBtn.addEventListener("click", function () {
    hintBox.hidden = !hintBox.hidden;
    hintBtn.setAttribute("aria-expanded", String(!hintBox.hidden));
  });
  $("toMap").addEventListener("click", function () { saveProgram(); goMap(); });
  $("speed").addEventListener("click", function () {
    state.speed = SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length];
    $("speed").textContent = "⏩ ×" + state.speed; saveState();
  });

  /* ---------- допоміжні для анімацій ---------- */
  var runToken = 0, running = false;
  function D(ms) { return reduced() ? Math.min(ms, 120) : Math.max(70, ms / state.speed); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function T(ms, token) { await sleep(ms); if (token !== runToken) throw CANCEL; }
  function pct(v) { return (v * 100 / N) + "%"; }

  function burst(cxCell, cyCell, count, colors, dist, square) {
    if (reduced()) return;
    var frag = document.createDocumentFragment(), items = [];
    for (var i = 0; i < count; i++) {
      var p = document.createElement("span"), sz = rnd(4, 9);
      p.className = "fx";
      p.style.cssText = "left:" + pct(cxCell) + ";top:" + pct(cyCell) + ";width:" + sz + "px;height:" + sz + "px;background:" + colors[i % colors.length] + ";" +
        (square ? "border-radius:2px;" : "box-shadow:0 0 6px " + colors[i % colors.length] + ";");
      frag.appendChild(p); items.push(p);
    }
    fxl.appendChild(frag);
    items.forEach(function (p) {
      var a = rnd(0, Math.PI * 2), d = rnd(dist * 0.4, dist);
      var an = p.animate([
        { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
        { transform: "translate(" + Math.cos(a) * d + "px," + (Math.sin(a) * d + (square ? 14 : 0)) + "px) rotate(" + rnd(-300, 300) + "deg) scale(.2)", opacity: 0 }
      ], { duration: rnd(450, 800), easing: "cubic-bezier(.2,.7,.3,1)" });
      an.onfinish = function () { p.remove(); };
    });
  }
  function ringFlash(cx, cy, color) {
    if (reduced()) return;
    var f = document.createElement("span");
    f.className = "fx";
    f.style.cssText = "left:" + pct(cx) + ";top:" + pct(cy) + ";width:" + (100 / N) + "%;height:" + (100 / N) + "%;margin:" + (-50 / N) + "% 0 0 " + (-50 / N) + "%;background:radial-gradient(circle," + color + " 0%,transparent 70%)";
    fxl.appendChild(f);
    var an = f.animate([{ transform: "scale(.3)", opacity: 1 }, { transform: "scale(2.2)", opacity: 0 }], { duration: 520, easing: "ease-out" });
    an.onfinish = function () { f.remove(); };
  }
  function redFlash() {
    if (reduced()) return;
    var f = $("flash"); f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
  }
  function puff(x, y, size, dark) {
    if (reduced()) return;
    var p = document.createElement("span");
    p.className = "puff";
    p.style.cssText = "left:" + (x - size / 2) + "px;top:" + (y - size / 2) + "px;width:" + size + "px;height:" + size + "px;" + (dark ? "filter:brightness(.7);" : "");
    document.body.appendChild(p);
    var an = p.animate([{ transform: "scale(.4)", opacity: 0.9 }, { transform: "translate(" + rnd(-20, 20) + "px," + rnd(6, 26) + "px) scale(2)", opacity: 0 }], { duration: rnd(700, 1100), easing: "ease-out" });
    an.onfinish = function () { p.remove(); };
  }
  function shake(el, amp, dur) {
    if (reduced()) return Promise.resolve();
    var k = [];
    for (var i = 0; i < 9; i++) k.push({ translate: (i % 2 ? amp : -amp) * (1 - i / 10) + "px " + (i % 3 - 1) * amp * 0.4 + "px" });
    k.push({ translate: "0 0" });
    return el.animate(k, { duration: dur }).finished.catch(function () {});
  }

  /* ---------- виконання ---------- */
  function blockLabel(path, locative) {
    var node = null;
    Core.walk(lastProgram, function (n, p) { if (p.join(".") === path.join(".")) node = n; });
    var c = Core.isRep(node) ? "rep" : node;
    return t(locative ? "kod-galaktyky.blockAt" : "kod-galaktyky.blockNom", { n: Core.ordinalOf(lastProgram, path), name: t("kod-galaktyky.cmd." + c) });
  }
  /* Проблеми від Core.validate (коди) -> текст зі словника */
  function problemText(p) {
    var T = function (k, params) { return t("kod-galaktyky.problem." + k, params); };
    var name = p.cmd ? t("kod-galaktyky.cmd." + p.cmd) : "";
    if (p.kind === "allowed") return T("allowed", { name: name });
    if (p.kind === "limit") {
      if (p.limit === 0) return T("forbidden", { name: name });
      return T(p.cmd === "F" ? "limitForward" : "limit", { name: name, limit: p.limit, count: p.count });
    }
    if (p.kind === "max") return T("max", { max: p.max, count: p.count });
    if (p.kind === "depth") return T("depth", { max: p.max });
    return T("repn", { min: p.min, max: p.max });
  }

  function setRunning(on) {
    running = on;
    runBtn.hidden = on; stopBtn.hidden = !on;
    $("reset").disabled = on;
  }
  function cancelRun(silent) {
    runToken++;
    if (running) { setRunning(false); }
    if (!silent && lv) { resetStage(); }
  }

  runBtn.addEventListener("click", startRun);
  stopBtn.addEventListener("click", function () {
    cancelRun(false);
    say(t("kod-galaktyky.stopped"));
  });
  $("reset").addEventListener("click", function () {
    if (running) return;
    closeModal(); finishWarp(); resetStage();
    say(t("kod-galaktyky.resetDone"));
  });

  function scrollToStage() {
    if (!window.matchMedia("(max-width:899px)").matches) return;
    var r = $("stageBox").getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) $("stageBox").scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
  }

  async function startRun() {
    if (running || !lv || !ws) return;
    closeModal(); finishWarp(); clearMarks(); ws.highlightBlock(null);
    var prog = buildProgram(), loose = looseCount();
    if (!prog.length) {
      say(t(loose ? "kod-galaktyky.emptyLoose" : "kod-galaktyky.emptyProgram"), "bad");
      return;
    }
    var v = Core.validate(lv, prog);
    if (!v.ok) {
      v.problems.forEach(function (p) { markPaths(p.paths, "limit-block"); });
      say(t("kod-galaktyky.problems", { list: v.problems.map(problemText).join(" ") }), "warn");
      return;
    }
    var res = Core.run(lv, prog), token = ++runToken;
    setRunning(true); scrollToStage();
    resetStage();
    say(t(loose ? "kod-galaktyky.runningLoose" : "kod-galaktyky.running"));
    try {
      await T(D(250), token);
      await play(res, token);
      if (token === runToken) finishRun(res, prog);
    } catch (e) {
      if (e !== CANCEL) { console.error(e); setRunning(false); say(t("kod-galaktyky.error"), "bad"); }
    }
  }

  async function play(res, token) {
    stage.style.setProperty("--step", D(420) + "ms");
    shipRot.style.setProperty("--step", D(420) + "ms");
    for (var i = 0; i < res.events.length; i++) {
      var ev = res.events[i];
      if (ev.t === "start") continue;
      if (ev.t !== "move") ship.classList.remove("go");
      if (ev.path) highlightPath(ev.path);
      if (ev.t === "rep") { await T(D(120), token); }
      else if (ev.t === "move") {
        ship.classList.add("go");
        setShip(ev.x, ev.y, false);
        await T(D(420), token);
        addTrail(ev.fx, ev.fy, ev.x, ev.y);
      } else if (ev.t === "turn") {
        sdir = ev.dir; setRot(srot + (ev.side === "L" ? -90 : 90), false); updatePos();
        await T(D(340), token);
      } else if (ev.t === "collect") await collectAnim(ev, token);
      else if (ev.t === "crash") await crashAnim(ev, token);
      else if (ev.t === "nocrystal") await noCrystalAnim(ev, token);
      else if (ev.t === "win") await winAnim(token);
    }
    ship.classList.remove("go");
  }

  function addTrail(fx, fy, x, y) {
    var l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", fx + 0.5); l.setAttribute("y1", fy + 0.5); l.setAttribute("x2", x + 0.5); l.setAttribute("y2", y + 0.5);
    trail.appendChild(l);
  }

  async function collectAnim(ev, token) {
    var key = ev.x + "," + ev.y, el = crystalEls[key], cx = ev.x + 0.5, cy = ev.y + 0.5;
    if (reduced()) {
      if (el) el.style.visibility = "hidden";
      got = ev.collected; updateCrystalHud(); pulseHud();
      await T(D(160), token);
      return;
    }
    // корабель підіймається, вмикається промінь-тягач
    shipFly.animate([{ transform: "translate(0,0)" }, { transform: "translate(0,-36%)" }], { duration: D(180), fill: "forwards", easing: "ease-out" });
    var beam = document.createElement("div");
    beam.className = "beam";
    beam.style.cssText = "left:" + pct(ev.x + 0.14) + ";top:" + pct(ev.y + 0.22) + ";width:" + (72 / N) + "%;height:" + (34 / N) + "%";
    fxl.appendChild(beam);
    beam.animate([{ opacity: 0 }, { opacity: 0.95, offset: 0.25 }, { opacity: 0.9, offset: 0.75 }, { opacity: 0 }], { duration: D(760) }).onfinish = function () { beam.remove(); };
    await T(D(180), token);
    // кристал крутиться, зменшується й летить у лічильник
    if (el) {
      var r = el.getBoundingClientRect(), tr = $("hudCrystal").getBoundingClientRect();
      var clone = document.createElement("div");
      clone.className = "fxfix";
      clone.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;display:grid;place-items:center";
      clone.innerHTML = CRYSTAL_SVG; clone.firstChild.style.cssText = "width:74%;height:74%;filter:drop-shadow(0 0 10px #5ee6ff)";
      document.body.appendChild(clone);
      el.style.visibility = "hidden";
      var dx = tr.left + tr.width / 2 - (r.left + r.width / 2), dy = tr.top + tr.height / 2 - (r.top + r.height / 2);
      var fly = clone.animate([
        { transform: "translate(0,0) rotate(0) scale(1)", offset: 0 },
        { transform: "translate(0,-12%) rotate(260deg) scale(1.3)", offset: 0.35, easing: "ease-in" },
        { transform: "translate(" + dx + "px," + dy + "px) rotate(720deg) scale(.3)", offset: 1 }
      ], { duration: D(820), easing: "cubic-bezier(.5,0,.7,1)", fill: "forwards" });
      fly.onfinish = function () {
        clone.remove();
        got = ev.collected; updateCrystalHud(); pulseHud();
        hudSparks(tr);
      };
      burst(cx, cy, 10, ["#5ee6ff", "#ffffff", "#b8f6ff", "#ffc94a"], 38, false);
      ringFlash(cx, cy, "#b8f6ff");
      await T(D(820), token);
    }
    shipFly.animate([{ transform: "translate(0,-36%)" }, { transform: "translate(0,0)" }], { duration: D(160), fill: "forwards", easing: "ease-in" });
    await T(D(170), token);
    clearAnims(shipFly);
  }
  function pulseHud() {
    var h = $("hudCrystal"); h.classList.remove("pulse"); void h.offsetWidth; h.classList.add("pulse");
  }
  function hudSparks(rect) {
    if (reduced()) return;
    for (var i = 0; i < 10; i++) {
      var s = document.createElement("span"), a = rnd(0, 6.28), d = rnd(16, 36);
      s.className = "fxfix";
      s.style.cssText = "left:" + (rect.left + rect.width / 2) + "px;top:" + (rect.top + rect.height / 2) + "px;width:6px;height:6px;border-radius:50%;background:" + (i % 2 ? "#5ee6ff" : "#fff");
      document.body.appendChild(s);
      s.animate([{ transform: "translate(0,0)", opacity: 1 }, { transform: "translate(" + Math.cos(a) * d + "px," + Math.sin(a) * d + "px)", opacity: 0 }], { duration: 500 }).onfinish = (function (el) { return function () { el.remove(); }; })(s);
    }
  }

  async function crashAnim(ev, token) {
    var v = Core.VEC[ev.dir], hitX = ev.x + 0.5 + v[0] * 0.5, hitY = ev.y + 0.5 + v[1] * 0.5;
    ship.classList.add("go");
    shipFly.animate([{ transform: "translate(0,0)" }, { transform: "translate(" + v[0] * 44 + "%," + v[1] * 44 + "%)" }], { duration: D(230), fill: "forwards", easing: "ease-in" });
    await T(D(230), token);
    ship.classList.remove("go"); ship.classList.add("wreck");
    redFlash();
    burst(hitX, hitY, 18, ["#ff6b6b", "#ffc94a", "#ff8a3d", "#ffffff", "#9aa5d1"], 52, true);
    burst(hitX, hitY, 8, ["#ffc94a", "#ffffff"], 40, false);
    ringFlash(hitX, hitY, "#ffb84a");
    var rock = rockEls[ev.tx + "," + ev.ty];
    if (rock) { rock.classList.remove("hit"); void rock.offsetWidth; rock.classList.add("hit"); }
    await shake(ship, 7, D(450));
    await T(D(150), token);
  }

  async function noCrystalAnim(ev, token) {
    redFlash();
    var q = document.createElement("span");
    q.className = "fx"; q.textContent = "?";
    q.style.cssText = "left:" + pct(ev.x + 0.5) + ";top:" + pct(ev.y - 0.1) + ";width:auto;height:auto;font:800 28px var(--f-display);color:#ff9a9a;border-radius:0;transform:translate(-50%,-50%)";
    fxl.appendChild(q);
    if (!reduced()) q.animate([{ opacity: 0, transform: "translate(-50%,0) scale(.4)" }, { opacity: 1, transform: "translate(-50%,-60%) scale(1.2)", offset: 0.4 }, { opacity: 0, transform: "translate(-50%,-110%) scale(1)" }], { duration: 900 }).onfinish = function () { q.remove(); };
    else setTimeout(function () { q.remove(); }, 900);
    await shake(ship, 5, D(380));
    await T(D(120), token);
  }

  async function winAnim(token) {
    await T(D(200), token);
    // розвернутися носом угору
    var delta = (((-90 - srot) % 360) + 540) % 360 - 180;
    sdir = "N"; updatePos();
    if (delta) { setRot(srot + delta, false); await T(D(delta ? 420 : 0), token); }
    var r0 = ship.getBoundingClientRect();
    if (reduced()) {
      ship.classList.add("boost");
      await shipFly.animate([{ transform: "translate(0,0)", opacity: 1 }, { transform: "translate(0,-80px)", opacity: 0 }], { duration: 250, fill: "forwards" }).finished.catch(function () {});
      ship.classList.add("hide");
      return;
    }
    ship.classList.add("boost");
    // тремтіння на старті
    await shake(shipFly.parentNode, 4, D(520));
    ship.classList.add("launch");
    var dist = r0.bottom + 160, dur = Math.max(450, 1250 / state.speed);
    var timer = setInterval(function () {
      var r = ship.getBoundingClientRect();
      var tx = r.left + r.width / 2, ty = r.top + r.height / 2 + r.height * 0.55;
      puff(tx + rnd(-8, 8), ty, rnd(18, 34), false); puff(tx + rnd(-12, 12), ty + 10, rnd(14, 26), true);
    }, 55);
    puffTimers.push(timer);
    var a = shipFly.animate([{ transform: "translate(0,0)" }, { transform: "translate(0," + (-dist * 0.12) + "px)", offset: 0.15 }, { transform: "translate(0," + (-dist) + "px)" }], { duration: dur, fill: "forwards", easing: "cubic-bezier(.5,0,.9,.5)" });
    await a.finished.catch(function () {});
    clearInterval(timer);
    if (token !== runToken) throw CANCEL;
    ship.classList.add("hide");
    await T(300, token);
  }

  /* ---------- завершення спроби ---------- */
  function finishRun(res, prog) {
    ws.highlightBlock(null);
    setRunning(false);
    if (res.status === "win") { onWin(prog); return; }
    if (res.status === "crash") {
      var ev = res.events[res.events.length - 1];
      markPaths([res.failPath], "crash-block");
      say(t(ev.reason === "rock" ? "kod-galaktyky.crashRock" : "kod-galaktyky.crashEdge", { block: blockLabel(res.failPath, true) }), "bad");
    } else if (res.status === "nocrystal") {
      markPaths([res.failPath], "crash-block");
      say(t("kod-galaktyky.noCrystal", { block: blockLabel(res.failPath) }), "bad");
    } else {
      say(t("kod-galaktyky.incomplete", { collected: res.collected, total: res.total }), "warn");
    }
  }

  function onWin(prog) {
    var blocks = Core.countBlocks(prog), stars = Core.starsFor(lv, blocks), id = lv.id;
    var best = Math.max(state.stars[id] || 0, stars);
    state.stars[id] = best; saveProgram(); saveState();
    say(t("kod-galaktyky.win", { blocks: blocks, stars: stars }), "ok");
    showWin(blocks, stars);
  }

  /* ---------- модальне вікно ---------- */
  var modal = $("modal"), lastFocus = null;
  function closeModal() { modal.classList.remove("show"); }
  function showWin(blocks, stars) {
    var last = levelIndex(lv.id) === LEVELS.length - 1, box = $("mstars");
    box.innerHTML = starSvg + starSvg + starSvg;
    $("mtitle").textContent = t(last ? "kod-galaktyky.finalTitle" : "kod-galaktyky.winTitle");
    var tail = stars === 3 ? t("kod-galaktyky.tailPerfect") : t("kod-galaktyky.tailBetter", { count: lv.par });
    $("mtext").textContent = last
      ? t("kod-galaktyky.finalText", { stars: totalStars(), total: LEVELS.length * 3, tail: tail })
      : t("kod-galaktyky.winText", { count: blocks, tail: tail });
    $("mNext").textContent = t(last ? "kod-galaktyky.toMapShort" : "kod-galaktyky.next");
    modal.classList.add("show");
    $("mNext").focus();
    var els = box.children;
    for (var i = 0; i < stars; i++) (function (el, i) { setTimeout(function () { el.classList.add("on"); }, reduced() ? 0 : 350 + i * 380); })(els[i], i);
    if (last) confetti();
  }
  $("mNext").addEventListener("click", function () {
    closeModal();
    var i = levelIndex(lv.id);
    if (i >= LEVELS.length - 1) goMap(); else navigate(LEVELS[i + 1].id, "replace");
  });
  $("mBetter").addEventListener("click", function () { closeModal(); finishWarp(); resetStage(); say(t("kod-galaktyky.improve")); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("show")) { closeModal(); $("run").focus(); } });

  function confetti() {
    if (reduced()) return;
    var colors = ["#5EE6FF", "#FFC94A", "#B08CFF", "#4BE39A", "#FF6B6B", "#ffffff"], frag = document.createDocumentFragment();
    for (var i = 0; i < 90; i++) {
      var c = document.createElement("span");
      c.className = "confetti";
      c.style.cssText = "left:" + rnd(0, 100) + "%;background:" + colors[i % colors.length] + ";--dx:" + rnd(-160, 160) + "px;--rot:" + rnd(300, 1100) + "deg;animation-duration:" + rnd(2.6, 5) + "s;animation-delay:" + rnd(0, 1.2) + "s";
      frag.appendChild(c);
      setTimeout((function (e) { return function () { e.remove(); }; })(c), 7000);
    }
    document.body.appendChild(frag);
  }

  /* ---------- маршрутизація: #<id рівня> (старий формат #level-N теж працює; без hash — карта рівнів) ---------- */
  var curRoute = null;       // що зараз показано: "" (карта) або id рівня; null — ще нічого
  var cameFromMap = false;   // попередній запис історії — карта цього ж застосунку
  function parseRoute() {
    var h = (location.hash || "").replace(/^#/, "");
    if (!h) return { key: "" };
    var i = levelIndex(h);
    if (i >= 0) return { key: h, idx: i };
    var m = /^level-(\d+)$/.exec(h), n = m ? parseInt(m[1], 10) : 0;
    if (n >= 1 && n <= LEVELS.length) return { key: LEVELS[n - 1].id, idx: n - 1, legacy: true };
    return { key: "", bad: true };
  }
  function focusHead(el) {
    try { el.setAttribute("tabindex", "-1"); el.focus({ preventScroll: true }); } catch (e) { /* ок */ }
  }
  /* Єдине місце, що перемикає екрани за hash. Робочий простір Blockly один (initBlockly) — витоку немає. */
  function route(initial) {
    var r = parseRoute();
    if (r.bad) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; } }
    if (r.legacy) { try { history.replaceState(null, "", location.pathname + location.search + "#" + r.key); } catch (e) { /* ок */ } }
    if (r.key === curRoute) return;
    var prev = curRoute;
    curRoute = r.key;
    clearTimeout(saveTimer);
    if (prev && prev !== "") saveProgram();   // зберегти програму рівня, який покидаємо (lv ще старий)
    if (r.key === "") {
      showMap(); cameFromMap = false;
      if (!initial) focusHead($("mapTitle"));
    } else {
      if (!initial && prev === "") cameFromMap = true; else if (prev !== null) cameFromMap = false;
      openLevel(r.idx, true);   // force: пряме посилання на закритий рівень теж відкриваємо
      if (!initial && !viewGame.hidden) focusHead($("lvlTitle"));
    }
  }
  /* push — новий запис історії (далі спрацює hashchange); replace — без нового запису */
  function navigate(key, mode) {
    if (mode === "replace") {
      try { history.replaceState(null, "", key ? "#" + key : location.pathname + location.search); } catch (e) { location.hash = key; return; }
      route(false);
    } else {
      if ((location.hash || "").replace(/^#/, "") === key) { route(false); return; }
      location.hash = key;
    }
  }
  function goMap() {
    if (curRoute === "") { showMap(); return; }
    if (cameFromMap && window.history && history.length > 1) {
      history.back();
      setTimeout(function () { if (curRoute !== "") navigate("", "replace"); }, 400);
    } else navigate("", "replace");
  }
  window.addEventListener("hashchange", function () { route(false); });

  /* ---------- старт ---------- */
  GIData.loadJSON(ROOT + "content/kod-galaktyky/levels.json").then(function (data) {
    LEVELS = data.levels || [];
    loadState();
    syncSummary();
    $("speed").textContent = "⏩ ×" + state.speed;
    renderMap();
    route(true);
  }, function () { /* повідомлення про помилку вже показав GIData */ });
})();
