/* «Марсохід у лабіринті»: інтерфейс, Blockly, анімації. Логіка — у mars-core.js (спільна з тестом). */
(function () {
  "use strict";
  var Core = window.MarsCore;
  var STORE_ID = "mars:v1", LEGACY_KEY = "geek-mars-v1", SLUG = "mars";
  var CELL = 60, MAX_STEPS = 1500;
  var NS = "http://www.w3.org/2000/svg";
  var $ = function (id) { return document.getElementById(id); };
  var reduced = function () { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var DIR_NAMES = ["⬆ північ", "➜ схід", "⬇ південь", "⬅ захід"];
  var STEP_MS = { 1: 480, 3: 170, 10: 14 };
  var CHECK_MS = { 1: 170, 3: 45, 10: 0 };
  var COND_NAMES = { notFinish: "не на фініші", wallAhead: "спереду стіна", clearAhead: "спереду вільно" };

  var field = $("field"), rv = $("rv"), rvRot = $("rvRot"), rvShake = $("rvShake"), fx = $("fx");
  var statusEl = $("status");

  /* ---------- збереження ---------- */
  /* solved — прапорець «програма пройшла 3 лабіринти поспіль» (назавжди, навіть якщо потім змінити програму) */
  var saved = { prog: null, speed: 1, solved: false };
  function loadSaved() {
    try {
      var s = window.GIStorage ? GIStorage.load(STORE_ID, LEGACY_KEY) : null;
      if (s && typeof s === "object") { saved.prog = s.prog || null; if (STEP_MS[s.speed]) saved.speed = s.speed; saved.solved = s.solved === true; }
    } catch (e) { /* пошкоджені дані: починаємо з нуля */ }
  }
  function persist() {
    if (!window.GIStorage) return;
    GIStorage.save(STORE_ID, saved);
    syncSummary();
  }
  function syncSummary() { if (window.GIStorage) GIStorage.setSummary(SLUG, saved.solved ? 1 : 0, 1); }

  /* ---------- фонові зірки ---------- */
  (function () {
    var host = $("stars"), frag = document.createDocumentFragment();
    for (var i = 0; i < 90; i++) {
      var s = document.createElement("span"), sz = rnd(1, 2.6);
      s.className = "st";
      s.style.cssText = "left:" + rnd(0, 100).toFixed(1) + "%;top:" + rnd(0, 100).toFixed(1) + "%;width:" + sz.toFixed(1) + "px;height:" + sz.toFixed(1) + "px;animation-delay:-" + rnd(0, 4).toFixed(1) + "s;animation-duration:" + rnd(2.6, 6).toFixed(1) + "s";
      frag.appendChild(s);
    }
    host.appendChild(frag);
  })();

  /* ---------- допоміжне SVG ---------- */
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function cx(x) { return x * CELL + CELL / 2; }

  /* ---------- стан гри ---------- */
  var maze = null, mazeNo = 0, seed = 0;
  var pos = { x: 0, y: 0 }, angle = 0, dir = 1;
  var speed = 1, running = false, runId = 0, sleepTimer = null, sleepRes = null;
  var prog = { sig: "", count: 0, streak: 0, done: {}, celebrated: false };
  var hintLevel = 0;

  function newSeed() { return (Math.floor(Math.random() * 4294967294) + 1) >>> 0; }

  /* ---------- малювання лабіринту ---------- */
  function buildMaze() {
    var w = maze.w, h = maze.h, walls = $("walls"), i;
    walls.innerHTML = "";
    var d = "", x, y, c;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      c = maze.walls[y * w + x];
      if (c & 1) d += "M" + x * CELL + " " + y * CELL + "H" + (x + 1) * CELL;
      if (c & 8) d += "M" + x * CELL + " " + y * CELL + "V" + (y + 1) * CELL;
      if ((c & 4) && y === h - 1) d += "M" + x * CELL + " " + (y + 1) * CELL + "H" + (x + 1) * CELL;
      if ((c & 2) && x === w - 1) d += "M" + (x + 1) * CELL + " " + y * CELL + "V" + (y + 1) * CELL;
    }
    var g = el("g", { filter: "url(#rough)" }, walls);
    el("path", { "class": "wall-shadow", d: d, transform: "translate(2.5 4)" }, g);
    el("path", { "class": "wall-main", d: d }, g);
    el("path", { "class": "wall-hi", d: d, transform: "translate(-1 -1.6)" }, g);
    /* валуни у вузлах, де сходяться стіни */
    var rng = Core.makeRng(seed ^ 0x9e3779b9);
    function wallAt(vx, vy) {            /* скільки стін торкається вузла (vx,vy) */
      var n = 0;
      function cw(xx, yy, bit) { return xx >= 0 && yy >= 0 && xx < w && yy < h && (maze.walls[yy * w + xx] & bit) !== 0; }
      if (cw(vx, vy, 1)) n++;
      if (cw(vx - 1, vy, 1)) n++;
      if (cw(vx, vy, 8)) n++;
      if (cw(vx, vy - 1, 8)) n++;
      return n;
    }
    for (y = 0; y <= h; y++) for (x = 0; x <= w; x++) {
      var r = rng(), n = wallAt(x, y);
      if (n >= 2 && r < 0.4) {
        var rr = 5 + rng() * 3.5;
        el("circle", { "class": "boulder", cx: x * CELL + (rng() - .5) * 2, cy: y * CELL + (rng() - .5) * 2, r: rr.toFixed(1) }, walls);
        el("circle", { "class": "boulder-hi", cx: x * CELL - rr * .3, cy: y * CELL - rr * .35, r: (rr * .38).toFixed(1) }, walls);
      }
    }
    var gd = "";
    for (i = 1; i < w; i++) gd += "M" + i * CELL + " 0V" + h * CELL;
    for (i = 1; i < h; i++) gd += "M0 " + i * CELL + "H" + w * CELL;
    $("gridL").setAttribute("d", gd);
    $("finishMark").setAttribute("transform", "translate(" + cx(maze.finish.x) + " " + cx(maze.finish.y) + ")");
    $("startMark").setAttribute("transform", "translate(" + (cx(maze.start.x) - 30) + " " + (cx(maze.start.y) - 30) + ")");
  }

  /* ---------- повідомлення ---------- */
  function say(msg, cls) { statusEl.className = "status" + (cls ? " " + cls : ""); statusEl.textContent = msg; }

  /* ---------- марсохід ---------- */
  function setRover(x, y) {
    rv.style.transform = "translate(" + cx(x) + "px," + cx(y) + "px)";
  }
  function setAngle(a) { rvRot.style.transform = "rotate(" + a + "deg)"; }
  function setStepVars() {
    var ms = reduced() ? 100 : STEP_MS[speed];
    field.style.setProperty("--step", ms + "ms");
  }
  function placeRoverAtStart() {
    rv.classList.add("nt"); rvRot.classList.add("nt");
    pos = { x: maze.start.x, y: maze.start.y }; dir = maze.start.dir; angle = (dir - 1) * 90;
    setRover(pos.x, pos.y); setAngle(angle);
    void rv.getBoundingClientRect();
    rv.classList.remove("nt"); rvRot.classList.remove("nt");
    rvShake.classList.remove("shake", "hop"); rv.classList.remove("go");
    $("pos").textContent = "курс: " + DIR_NAMES[dir];
  }
  function clearField() {
    $("trail").innerHTML = ""; fx.innerHTML = "";
    field.classList.remove("won");
  }
  function resetRover() {
    cancelRun();
    clearField(); placeRoverAtStart(); clearMarks();
    if (ws) ws.highlightBlock(null);
  }

  function setMaze(newSeed_) {
    seed = newSeed_; mazeNo++;
    maze = Core.generate(seed, 10, 10);
    $("mazeNo").textContent = "Лабіринт №" + mazeNo;
    buildMaze(); clearField(); placeRoverAtStart();
  }

  /* ---------- очікування, що скасовується ---------- */
  function sleep(ms) {
    return new Promise(function (res) {
      sleepRes = res;
      sleepTimer = setTimeout(function () { sleepTimer = null; sleepRes = null; res(); }, ms);
    });
  }
  function cancelRun() {
    runId++;
    if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null; }
    if (sleepRes) { var r = sleepRes; sleepRes = null; r(); }
    if (running) { running = false; setRunUi(false); rv.classList.remove("go"); }
  }
  function setRunUi(on) {
    $("run").hidden = on; $("stop").hidden = !on;
    $("newMaze").disabled = false;
  }

  /* ---------- ефекти ---------- */
  function burst(x, y, n, colors, spread, cls, life) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, d = spread * (0.45 + Math.random() * 0.55);
      var c = el("circle", { cx: x, cy: y, r: (1.6 + Math.random() * 2.2).toFixed(1), fill: colors[i % colors.length], "class": cls || "spark" }, fx);
      c.style.setProperty("--dx", (Math.cos(a) * d).toFixed(1) + "px");
      c.style.setProperty("--dy", (Math.sin(a) * d).toFixed(1) + "px");
      c.style.setProperty("--t", (life || 0.8) + "s");
      (function (n2) { setTimeout(function () { if (n2.parentNode) n2.parentNode.removeChild(n2); }, (life || 0.9) * 1000 + 150); })(c);
    }
  }
  function bumpFx() {
    var vx = Core.DX[dir], vy = Core.DY[dir];
    var nx = cx(pos.x) + vx * 27, ny = cx(pos.y) + vy * 27;
    burst(nx, ny, 7, ["#e9b88c", "#d89b6e", "#c98558"], 22, "dust", 0.9);
    burst(nx, ny, 8, ["#ffe45c", "#ffb13b", "#fff3b0"], 26, "spark", 0.5);
  }
  function fireworks() {
    var cols = ["#ffd54a", "#ff6b4a", "#3fe0d0", "#ffffff", "#ff9ad5"];
    var fxp = cx(maze.finish.x), fyp = cx(maze.finish.y);
    [[0, 0, 0], [-90, -70, 280], [60, -110, 520], [-30, -160, 760]].forEach(function (b) {
      setTimeout(function () { burst(fxp + b[0], fyp + b[1], 16, cols, 62, "spark", 1); }, b[2]);
    });
  }
  var confettiCols = ["#ff7a3d", "#3fe0d0", "#ffd54a", "#e5483a", "#ffffff", "#b08cff"];
  function confetti(n) {
    if (reduced()) return;
    for (var i = 0; i < n; i++) {
      var c = document.createElement("span"), dur = rnd(2.2, 4.2);
      c.className = "confetti";
      c.style.cssText = "left:" + rnd(0, 100).toFixed(1) + "vw;background:" + confettiCols[i % confettiCols.length] + ";animation-duration:" + dur.toFixed(1) + "s;animation-delay:" + rnd(0, 0.6).toFixed(2) + "s;--dx:" + rnd(-140, 140).toFixed(0) + "px;--rot:" + rnd(240, 900).toFixed(0) + "deg";
      document.body.appendChild(c);
      (function (n2) { setTimeout(function () { if (n2.parentNode) n2.parentNode.removeChild(n2); }, (dur + 1) * 1000); })(c);
    }
  }

  /* ---------- Blockly ---------- */
  var ws = null, startBlock = null, loading = false, syncing = false, saveTimer = null;
  var pathMap = {}, marked = [];
  var COND_ALL = [["не на фініші", "notFinish"], ["спереду стіна", "wallAhead"], ["спереду вільно", "clearAhead"]];
  var COND_IF = [["спереду стіна", "wallAhead"], ["спереду вільно", "clearAhead"], ["не на фініші", "notFinish"]];

  function defineBlocks() {
    Blockly.defineBlocksWithJsonArray([
      { type: "mars_start", message0: "▶ коли запущено", nextStatement: null, colour: "#F59E0B", tooltip: "Початок програми. Блоки під ним виконуються згори донизу." },
      { type: "mars_forward", message0: "⬆ вперед", previousStatement: null, nextStatement: null, colour: "#3B82F6", tooltip: "Проїхати одну клітинку вперед. Якщо спереду стіна, марсохід вдариться." },
      { type: "mars_left", message0: "↺ ліворуч", previousStatement: null, nextStatement: null, colour: "#A855F7", tooltip: "Повернути на місці на 90° ліворуч" },
      { type: "mars_right", message0: "↻ праворуч", previousStatement: null, nextStatement: null, colour: "#A855F7", tooltip: "Повернути на місці на 90° праворуч" },
      { type: "mars_while", message0: "🔁 повторювати поки %1", args0: [{ type: "field_dropdown", name: "COND", options: COND_ALL }],
        message1: "%1", args1: [{ type: "input_statement", name: "DO" }], previousStatement: null, nextStatement: null, colour: "#16A34A", tooltip: "Виконувати вкладені блоки, поки умова істинна" },
      { type: "mars_if", message0: "❓ якщо %1 то", args0: [{ type: "field_dropdown", name: "COND", options: COND_IF }],
        message1: "%1", args1: [{ type: "input_statement", name: "THEN" }], previousStatement: null, nextStatement: null, colour: "#DB2777", tooltip: "Виконати вкладені блоки, якщо умова істинна" },
      { type: "mars_ifelse", message0: "❓ якщо %1 то", args0: [{ type: "field_dropdown", name: "COND", options: COND_IF }],
        message1: "%1", args1: [{ type: "input_statement", name: "THEN" }], message2: "інакше", message3: "%1", args3: [{ type: "input_statement", name: "ELSE" }],
        previousStatement: null, nextStatement: null, colour: "#DB2777", tooltip: "Якщо умова істинна, виконати перші блоки, інакше другі" }
    ]);
  }
  var TOOLBOX = { kind: "flyoutToolbox", contents: [
    { kind: "block", type: "mars_forward" }, { kind: "block", type: "mars_left" }, { kind: "block", type: "mars_right" },
    { kind: "block", type: "mars_while" }, { kind: "block", type: "mars_if" }, { kind: "block", type: "mars_ifelse" }
  ] };

  /* Blockly не завантажився (файли Blockly не завантажились): замість гри показуємо пояснення. */
  function showNoEditor() {
    $("ruleCard").hidden = true; $("gameArea").hidden = true;
    $("viewNoEditor").hidden = false;
    $("reloadPage").focus();
  }
  $("reloadPage").addEventListener("click", function () { location.reload(); });

  function initBlockly() {
    if (typeof Blockly === "undefined" || !Blockly.inject || !Blockly.defineBlocksWithJsonArray) { showNoEditor(); return false; }
    defineBlocks();
    var theme = Blockly.Theme.defineTheme("mars", {
      base: Blockly.Themes.Classic, startHats: true,
      componentStyles: {
        workspaceBackgroundColour: "#100c20", toolboxBackgroundColour: "#1a1432", toolboxForegroundColour: "#f3e9e1",
        flyoutBackgroundColour: "#1a1432", flyoutForegroundColour: "#f3e9e1", flyoutOpacity: 1,
        scrollbarColour: "#5a4a85", insertionMarkerColour: "#ffffff", insertionMarkerOpacity: 0.35, cursorColour: "#3fe0d0"
      },
      fontStyle: { family: "Nunito, sans-serif", weight: "700", size: 13 }
    });
    /* Довгі блоки «поки … / інакше» роблять бічну панель дуже широкою: якщо полотно вузьке, ставимо панель рядком зверху. */
    var bw = (document.getElementById("blockly") || {}).clientWidth || window.innerWidth;
    var narrow = bw < 640;
    ws = Blockly.inject("blockly", {
      toolbox: TOOLBOX, theme: theme, renderer: "zelos", trashcan: true,
      horizontalLayout: narrow, toolboxPosition: "start",
      grid: { spacing: 24, length: 2, colour: "#241c40", snap: true },
      zoom: { controls: true, startScale: narrow ? 0.75 : 0.85, maxScale: 1.6, minScale: 0.5 },
      move: { scrollbars: true, drag: true, wheel: false },
      sounds: false, media: "../vendor/blockly@10.4.3/media/"
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
    var rs = function () { if (ws) Blockly.svgResize(ws); };
    window.addEventListener("resize", rs);
    window.addEventListener("orientationchange", function () { setTimeout(rs, 200); });
    if (window.ResizeObserver) new ResizeObserver(rs).observe($("blockly"));
    return true;
  }

  function makeStart() {
    var b = ws.newBlock("mars_start"); b.initSvg(); b.render();
    var v = ws.getMetricsManager().getViewMetrics(true);
    b.moveBy(v.left + 24, v.top + 24); b.setDeletable(false);
    return b;
  }
  function loadProgram() {
    loading = true;
    ws.clear();
    if (saved.prog) { try { Blockly.serialization.workspaces.load(saved.prog, ws); } catch (e) { ws.clear(); } }
    startBlock = ws.getAllBlocks(false).filter(function (b) { return b.type === "mars_start"; })[0] || null;
    if (!startBlock) startBlock = makeStart();
    startBlock.setDeletable(false);
    loading = false;
    syncEnabled();
    prog.sig = JSON.stringify(buildProgram());
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

  /* Блоки -> дерево програми. Адреси шляхів збігаються з тими, що видає mars-core. */
  function buildProgram() {
    pathMap = {};
    function chain(b, prefix) {
      var list = [], i = 0;
      while (b) {
        var path = prefix + i;
        pathMap[path] = b;
        var t = b.type;
        if (t === "mars_forward") list.push("F");
        else if (t === "mars_left") list.push("L");
        else if (t === "mars_right") list.push("R");
        else if (t === "mars_while") list.push({ while: b.getFieldValue("COND"), body: chain(b.getInputTargetBlock("DO"), path + ".b.") });
        else if (t === "mars_if") list.push({ if: b.getFieldValue("COND"), then: chain(b.getInputTargetBlock("THEN"), path + ".t."), else: [] });
        else if (t === "mars_ifelse") list.push({ if: b.getFieldValue("COND"), then: chain(b.getInputTargetBlock("THEN"), path + ".t."), else: chain(b.getInputTargetBlock("ELSE"), path + ".e.") });
        i++; b = b.getNextBlock();
      }
      return list;
    }
    return chain(startBlock.getNextBlock(), "");
  }
  function looseCount() { return ws.getTopBlocks(false).filter(function (b) { return b !== startBlock; }).length; }

  function clearMarks() {
    marked.forEach(function (m) { try { m.b.getSvgRoot().classList.remove(m.cls); } catch (e) { /* ок */ } });
    marked = [];
  }
  function markPath(path, cls) {
    var b = pathMap[path];
    if (b && b.getSvgRoot) { b.getSvgRoot().classList.add(cls); marked.push({ b: b, cls: cls }); }
  }
  function highlightPath(path) {
    var b = path != null ? pathMap[path] : null;
    ws.highlightBlock(b ? b.id : null);
  }

  /* ---------- лічильник ---------- */
  function renderCounter() {
    $("cnt").textContent = prog.count;
    var dots = $("streak").querySelectorAll("i");
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("on", i < prog.streak);
    $("streak").setAttribute("title", "Поспіль без помилок: " + Math.min(prog.streak, 3) + " з 3");
  }
  function resetProgress() { prog.count = 0; prog.streak = 0; prog.done = {}; prog.celebrated = false; renderCounter(); }

  function onChange(e) {
    if (e.isUiEvent || loading || syncing) return;
    if (running) { cancelRun(); resetRover(); say("Програму змінено, запуск зупинено.", "warn"); }
    clearMarks(); syncEnabled();
    var sig = JSON.stringify(buildProgram());
    if (sig !== prog.sig) { prog.sig = sig; resetProgress(); }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { saved.prog = Blockly.serialization.workspaces.save(ws); persist(); } catch (er) { /* ок */ }
    }, 400);
  }

  /* ---------- запуск ---------- */
  function scrollToField() {
    if (window.innerWidth >= 900) return;
    var r = $("stageCard").getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) $("stageCard").scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  }

  function onWin() {
    field.classList.add("won");
    rv.classList.remove("go");
    if (!reduced()) { rvShake.classList.remove("shake"); rvShake.classList.add("hop"); fireworks(); }
    var msg;
    if (prog.done[seed]) {
      msg = "Фініш! Але цей лабіринт уже зараховано. Натисни «Новий лабіринт» і перевір алгоритм на іншому.";
    } else {
      prog.done[seed] = true; prog.count++; prog.streak++;
      msg = "Фініш! Марсохід на базі. Тепер натисни «Новий лабіринт»: чи пройде ця програма й інший?";
    }
    renderCounter();
    say(msg, "ok");
    if (prog.streak >= 3 && !prog.celebrated) {
      prog.celebrated = true;
      if (!saved.solved) { saved.solved = true; persist(); }
      setTimeout(openModal, reduced() ? 100 : 1300);
    }
  }
  function onFail(kind, path) {
    prog.streak = 0; renderCounter();
    rv.classList.remove("go");
    if (kind === "bump") {
      markPath(path, "crash-block");
      say("Бум! Спереду стіна. Перевір умову перед рухом.", "bad");
    } else if (kind === "limit") {
      markPath(path, "limit-block");
      say("Схоже, марсохід ходить по колу. Подумай, як завжди триматися правої стіни.", "warn");
    } else {
      say("Програма скінчилась, а марсохід ще не на фініші.", "warn");
    }
  }

  async function handleEvent(ev) {
    var ms = reduced() ? 100 : STEP_MS[speed];
    if (ev.type === "check") {
      if (CHECK_MS[speed] && !reduced()) await sleep(CHECK_MS[speed]);
      return;
    }
    if (ev.type === "turn") {
      angle += ev.side === "R" ? 90 : -90; dir = ev.dir;
      setAngle(angle); $("pos").textContent = "курс: " + DIR_NAMES[dir];
      await sleep(ms * 0.8);
    } else if (ev.type === "move") {
      var fx0 = cx(ev.from.x), fy0 = cx(ev.from.y), tx = cx(ev.to.x), ty = cx(ev.to.y);
      var nx = -Core.DY[ev.dir] * 7, ny = Core.DX[ev.dir] * 7, t = $("trail");
      [1, -1].forEach(function (s) {
        el("path", { "class": "trk", d: "M" + (fx0 + nx * s) + " " + (fy0 + ny * s) + "L" + (tx + nx * s) + " " + (ty + ny * s) }, t);
      });
      rv.classList.add("go");
      pos = { x: ev.to.x, y: ev.to.y }; setRover(pos.x, pos.y);
      await sleep(ms);
      rv.classList.remove("go");
    } else if (ev.type === "bump") {
      var ox = Core.DX[ev.dir] * 11, oy = Core.DY[ev.dir] * 11;
      rv.style.transform = "translate(" + (cx(pos.x) + ox) + "px," + (cx(pos.y) + oy) + "px)";
      await sleep(Math.max(ms * 0.35, 60));
      bumpFx();
      if (!reduced()) { rvShake.classList.remove("shake"); void rvShake.getBoundingClientRect(); rvShake.classList.add("shake"); }
      setRover(pos.x, pos.y);
      await sleep(Math.max(ms * 0.5, 120));
    }
  }

  async function run() {
    if (running || !ws) return;
    closeModal(); clearMarks(); ws.highlightBlock(null);
    var program = buildProgram(), loose = looseCount();
    if (!program.length) {
      say(loose ? "Блоки не приєднані до «▶ коли запущено» (вони сірі). Підтягни їх під стартовий блок, щоб вони клацнули." : "Програма порожня. Перетягни блоки зліва під «▶ коли запущено».", "bad");
      return;
    }
    clearField(); placeRoverAtStart(); setStepVars();
    running = true; var my = ++runId; setRunUi(true);
    say("Марсохід їде…");
    scrollToField();
    var gen = Core.createRun(maze, program, { maxSteps: MAX_STEPS }), last = null, frames = 0;
    while (true) {
      var r = gen.next();
      if (r.done) break;
      var ev = r.value;
      if (my !== runId) return;
      if (ev.path != null) highlightPath(ev.path);
      if (ev.type === "finish" || ev.type === "limit" || ev.type === "end" || ev.type === "bump") { last = ev; }
      if (ev.type === "check" || ev.type === "turn" || ev.type === "move" || ev.type === "bump") await handleEvent(ev);
      if (my !== runId) return;
      if (ev.type === "check" && CHECK_MS[speed] === 0 && (++frames % 200 === 0)) await sleep(0);
      if (last) break;
    }
    if (my !== runId) return;
    running = false; setRunUi(false);
    ws.highlightBlock(null);
    if (!last) { last = { type: "end" }; }
    if (last.type === "finish") onWin();
    else onFail(last.type, last.path);
    $("run").focus({ preventScroll: true });
  }

  /* ---------- модальне ---------- */
  var modal = $("modal");
  function openModal() { modal.classList.add("show"); confetti(90); $("mNew").focus(); }
  function closeModal() { modal.classList.remove("show"); }

  /* ---------- підказки ---------- */
  var HINTS = [
    "Ідея: уяви, що йдеш лабіринтом і весь час торкаєшся правою рукою стіни справа. Рука «веде» тебе уздовж стіни й обов'язково виводить до виходу.",
    "Спочатку спробуй повернути праворуч. А поки спереду стіна, повертай ліворуч. Коли шлях вільний, їдь уперед. І так повторюй, поки марсохід не на фініші.",
    "Схема з порожніми місцями:\nповторювати поки [ ??? ]\n    повернути [ ??? ]\n    повторювати поки [ ??? ]\n        повернути [ ??? ]\n    [ ??? ]"
  ];
  function renderHints() {
    var box = $("hintBox");
    if (!hintLevel) { box.hidden = true; box.innerHTML = ""; }
    else {
      box.hidden = false;
      var html = "<ol>";
      for (var i = 0; i < hintLevel; i++) {
        if (i === 2) {
          var parts = HINTS[2].split("\n");
          html += "<li>" + parts[0] + "<pre></pre></li>";
        } else html += "<li>" + HINTS[i] + "</li>";
      }
      box.innerHTML = html + "</ol>";
      if (hintLevel >= 3) box.querySelector("pre").textContent = HINTS[2].split("\n").slice(1).join("\n");
    }
    var b = $("hintBtn");
    b.setAttribute("aria-expanded", hintLevel ? "true" : "false");
    b.textContent = hintLevel >= 3 ? "💡 Усі підказки показано" : (hintLevel ? "💡 Ще підказка (" + hintLevel + "/3)" : "💡 Підказка");
    b.disabled = hintLevel >= 3;
  }

  /* ---------- кнопки ---------- */
  function setSpeed(s) {
    speed = s; saved.speed = s; persist(); setStepVars();
    Array.prototype.forEach.call(document.querySelectorAll(".speed button"), function (b) {
      b.setAttribute("aria-pressed", Number(b.getAttribute("data-speed")) === s ? "true" : "false");
    });
  }
  $("run").addEventListener("click", run);
  $("stop").addEventListener("click", function () { resetRover(); say("Зупинено. Марсохід повернувся на старт."); });
  $("reset").addEventListener("click", function () { resetRover(); say("Марсохід на старті. Той самий лабіринт, програма не змінилась."); });
  $("newMaze").addEventListener("click", function () {
    cancelRun(); clearMarks(); if (ws) ws.highlightBlock(null);
    var ns = newSeed();
    setMaze(ns); setHash(ns);
    say("Новий лабіринт. Програма та сама: спробуй її на ньому.");
  });
  $("hintBtn").addEventListener("click", function () { if (hintLevel < 3) { hintLevel++; renderHints(); } });
  Array.prototype.forEach.call(document.querySelectorAll(".speed button"), function (b) {
    b.addEventListener("click", function () { setSpeed(Number(b.getAttribute("data-speed"))); });
  });
  $("mClose").addEventListener("click", closeModal);
  $("mNew").addEventListener("click", function () { closeModal(); $("newMaze").click(); });
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("show")) closeModal(); });

  /* ---------- маршрутизація: #maze-<seed> (replaceState, без нових записів історії) ---------- */
  function hashSeed() {
    var m = /^#maze-(\d{1,10})$/.exec(location.hash || ""), n = m ? parseInt(m[1], 10) : 0;
    return n >= 1 && n <= 4294967295 ? n : 0;
  }
  function setHash(sd) { try { history.replaceState(null, "", "#maze-" + sd); } catch (e) { /* ок */ } }
  window.addEventListener("hashchange", function () {
    var sd = hashSeed();
    if (!sd) { if (location.hash && location.hash !== "#") setHash(seed); return; }
    if (sd === seed) return;
    cancelRun(); clearMarks(); if (ws) ws.highlightBlock(null);
    setMaze(sd);
    say("Відкрито лабіринт за посиланням. Програма та сама.");
    try { var mn = $("mazeNo"); mn.setAttribute("tabindex", "-1"); mn.focus({ preventScroll: true }); } catch (e) { /* ок */ }
  });

  /* ---------- старт ---------- */
  loadSaved();
  syncSummary();
  setSpeed(saved.speed);
  var initSeed = hashSeed() || newSeed();
  setMaze(initSeed); setHash(initSeed);
  renderHints(); renderCounter();
  if (initBlockly()) { loadProgram(); requestAnimationFrame(function () { Blockly.svgResize(ws); }); }
  window.__mars = { Core: Core, get maze() { return maze; }, get ws() { return ws; } };
})();
