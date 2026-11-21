/* Я керую роботом! — логіка інтерфейсу */
(function () {
  "use strict";
  var Core = window.RobotCore, LEVELS = window.ROBOT_LEVELS || [];
  var KEY = "geek-robot-v1";
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };
  var NAMES = { U: "Вгору", D: "Вниз", L: "Вліво", R: "Вправо" };

  /* ---------- SVG ---------- */
  var ARROWS = {
    U: '<path d="M12 20V5M5.5 11.5L12 5l6.5 6.5"/>',
    D: '<path d="M12 4v15M5.5 12.5L12 19l6.5-6.5"/>',
    L: '<path d="M20 12H5M11.5 5.5L5 12l6.5 6.5"/>',
    R: '<path d="M4 12h15M12.5 5.5L19 12l-6.5 6.5"/>'
  };
  function arrowSVG(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ARROWS[d] + '</svg>';
  }
  var GEM = '<svg class="gem-svg" viewBox="0 0 64 64" aria-hidden="true">' +
    '<path d="M24 12h16l12 13-20 29L12 25z" fill="#2DD4BF" stroke="#14213A" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M24 12h16l-4 13h-8z" fill="#8FF5E4"/><path d="M12 25l12-13 4 13z" fill="#19B5A2"/><path d="M52 25L40 12l-4 13z" fill="#19B5A2"/>' +
    '<path d="M12 25h16l4 29z" fill="#8B5CF6"/><path d="M28 25h8l-4 29z" fill="#5EEAD4"/><path d="M36 25h16L32 54z" fill="#6D3FE0"/>' +
    '<path d="M24 12h16l12 13-20 29L12 25zM12 25h40M28 25l4 29 4-29" fill="none" stroke="#14213A" stroke-width="1.6" stroke-linejoin="round" opacity=".55"/>' +
    '<path class="spk" d="M20 18l1.8 3.6 3.6 1.8-3.6 1.8L20 28.8l-1.8-3.6-3.6-1.8 3.6-1.8z" fill="#fff"/></svg>';
  var STONE = '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="55" rx="23" ry="5" fill="rgba(20,33,58,.28)"/>' +
    '<path d="M9 49l3-21 10-12 18-4 12 10 4 20-8 10H18z" fill="#A3AEC1" stroke="#14213A" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M40 12l12 10 4 20-8 10-4-16z" fill="#7C879B"/><path d="M15 30l9-10 14-3" stroke="#E3E9F3" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
    '<path d="M26 34l5 6-3 8M40 36l-6 4" stroke="#14213A" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/></svg>';
  var ROBOT = '<svg class="face" viewBox="0 0 100 100" aria-hidden="true">' +
    '<ellipse cx="50" cy="93" rx="27" ry="4.5" fill="rgba(20,33,58,.28)"/>' +
    '<rect class="wheel" x="22" y="76" width="22" height="16" rx="8" fill="#14213A"/><rect class="wheel" x="56" y="76" width="22" height="16" rx="8" fill="#14213A"/>' +
    '<circle cx="33" cy="84" r="3.2" fill="#FFE45C"/><circle cx="67" cy="84" r="3.2" fill="#FFE45C"/>' +
    '<rect x="29" y="58" width="42" height="24" rx="9" fill="#FFC531" stroke="#14213A" stroke-width="3"/>' +
    '<circle cx="50" cy="70" r="5" fill="#F0556A" stroke="#14213A" stroke-width="2.2"/>' +
    '<rect x="13" y="35" width="10" height="16" rx="5" fill="#FFC531" stroke="#14213A" stroke-width="3"/><rect x="77" y="35" width="10" height="16" rx="5" fill="#FFC531" stroke="#14213A" stroke-width="3"/>' +
    '<rect x="20" y="22" width="60" height="42" rx="20" fill="#3B6CF0" stroke="#14213A" stroke-width="3"/>' +
    '<path d="M27 36q4-9 15-10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>' +
    '<rect x="27" y="31" width="46" height="28" rx="13" fill="#EAF2FF" stroke="#14213A" stroke-width="2.5"/>' +
    '<g class="look">' +
      '<g class="e-norm blink"><ellipse cx="40" cy="44" rx="5" ry="6.5" fill="#14213A"/><ellipse cx="60" cy="44" rx="5" ry="6.5" fill="#14213A"/><circle cx="41.8" cy="41.8" r="1.8" fill="#fff"/><circle cx="61.8" cy="41.8" r="1.8" fill="#fff"/></g>' +
      '<g class="e-oops" stroke="#14213A" stroke-width="3.4" stroke-linecap="round"><path d="M35 39l10 10M45 39L35 49M55 39l10 10M65 39L55 49"/></g>' +
      '<g class="e-happy" stroke="#14213A" stroke-width="3.6" stroke-linecap="round" fill="none"><path d="M34 47q6-11 12 0M54 47q6-11 12 0"/></g>' +
    '</g>' +
    '<path class="m-norm" d="M43 53q7 4 14 0" stroke="#14213A" stroke-width="2.8" fill="none" stroke-linecap="round"/>' +
    '<ellipse class="m-oops" cx="50" cy="54" rx="4" ry="4.6" fill="#14213A"/>' +
    '<path class="m-happy" d="M41 51q9 11 18 0z" fill="#F0556A" stroke="#14213A" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M50 22v-9" stroke="#14213A" stroke-width="3.5" stroke-linecap="round"/>' +
    '<circle class="bulb" cx="50" cy="10" r="6.5" fill="#F0556A" stroke="#14213A" stroke-width="2.6"/><circle cx="48" cy="8" r="1.8" fill="#fff"/></svg>';
  function starSVG(on) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z" fill="' +
      (on ? "var(--star)" : "none") + '" stroke="' + (on ? "#14213A" : "var(--muted)") + '" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  }
  var LOCK = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  /* ---------- Прогрес ---------- */
  function loadProgress() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "null");
      if (o && typeof o === "object" && o.stars && typeof o.stars === "object") return o;
    } catch (e) {}
    return { stars: {} };
  }
  function saveProgress() { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) {} }
  var progress = loadProgress();
  function starsOf(n) { var s = +progress.stars[n]; return s >= 1 && s <= 3 ? s : 0; }
  function unlocked(n) { return n === 1 || starsOf(n - 1) > 0; }

  /* ---------- Вибір рівнів ---------- */
  var COLORS = ["var(--k-u)", "var(--k-d)", "var(--k-l)", "var(--k-rep)", "var(--k-r)"];
  function renderSelect() {
    var host = $("levels"), total = 0;
    host.innerHTML = "";
    LEVELS.forEach(function (lv, i) {
      var st = starsOf(lv.n), open = unlocked(lv.n); total += st;
      var b = document.createElement("button");
      b.type = "button"; b.className = "sticker"; b.disabled = !open;
      b.style.setProperty("--c", COLORS[i % COLORS.length]);
      b.style.setProperty("--rot", ((i % 3) - 1) * 1.4 + "deg");
      b.setAttribute("aria-label", open ? "Рівень " + lv.n + ": " + lv.title + ". Зірок: " + st + " з 3" : "Рівень " + lv.n + " закрито");
      var stars = "";
      for (var k = 1; k <= 3; k++) stars += starSVG(k <= st);
      b.innerHTML = '<span class="num">' + lv.n + '</span><span class="nm">' + esc(lv.title) + '</span>' +
        (open ? '<span class="stars" aria-hidden="true">' + stars + '</span>' : LOCK);
      b.addEventListener("click", function () { openLevel(i); });
      host.appendChild(b);
    });
    $("progressTxt").textContent = "Зірок: " + total + " з " + LEVELS.length * 3;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var resetArmed = false, resetTimer = 0;
  $("resetProgress").addEventListener("click", function () {
    var b = this;
    if (!resetArmed) {
      resetArmed = true; b.textContent = "Стерти прогрес? Ще раз"; b.classList.add("armed");
      resetTimer = setTimeout(disarm, 4000);
    } else {
      disarm(); progress = { stars: {} }; saveProgress(); renderSelect();
    }
  });
  function disarm() {
    resetArmed = false; clearTimeout(resetTimer);
    var b = $("resetProgress"); b.textContent = "Скинути прогрес"; b.classList.remove("armed");
  }

  /* ---------- Стан гри ---------- */
  var lvIdx = 0, level = null, map = null, program = [], openIdx = -1;
  var board, robotEl, cells = [], gemEls = [];
  var speed = "slow";              // slow | fast
  var plan = null;                 // активний запуск: {groups, gi, mode}
  var timers = [], autoReset = 0, locked = false, lastKey = "", gemShown = 0, removing = false;
  var modalOpen = false;

  function later(fn, ms) { var id = setTimeout(function () { var k = timers.indexOf(id); if (k >= 0) timers.splice(k, 1); fn(); }, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; clearTimeout(autoReset); }
  function durs() {
    if (reduce) return { move: 0, gap: 220 };
    return speed === "slow" ? { move: 380, gap: 560 } : { move: 170, gap: 250 };
  }

  function show(which) {
    $("screenSelect").hidden = which !== "select";
    $("screenPlay").hidden = which !== "play";
    window.scrollTo(0, 0);
  }

  function openLevel(i) {
    if (i < 0 || i >= LEVELS.length || !unlocked(LEVELS[i].n)) return;
    stopAll(true);
    lvIdx = i; level = LEVELS[i]; map = Core.parseMap(level);
    program = []; openIdx = -1; lastKey = "";
    $("lvTitle").textContent = "Рівень " + level.n + " · " + level.title;
    $("tip").textContent = level.tip;
    $("addRep").hidden = !level.loops;
    $("gemIcon").innerHTML = GEM;
    buildBoard();
    renderProgram(); updateLimit();
    setMsg("", "info");
    show("play");
    try { $("lvTitle").setAttribute("tabindex", "-1"); $("lvTitle").focus({ preventScroll: true }); } catch (e) {}
  }

  /* ---------- Поле ---------- */
  function buildBoard() {
    board = $("board");
    board.innerHTML = "";
    board.style.setProperty("--w", map.w); board.style.setProperty("--h", map.h);
    board.setAttribute("aria-label", "Ігрове поле " + map.w + " на " + map.h + ", кристалів: " + map.gems.length);
    cells = []; gemEls = [];
    for (var y = 0; y < map.h; y++) {
      cells[y] = [];
      for (var x = 0; x < map.w; x++) {
        var c = document.createElement("div");
        c.className = "cell" + ((x + y) % 2 ? " alt" : "");
        if (x === map.start.x && y === map.start.y) c.classList.add("start");
        if (map.stones[x + "," + y]) c.innerHTML = '<span class="art">' + STONE + '</span>';
        board.appendChild(c); cells[y][x] = c;
      }
    }
    map.gems.forEach(function (g, k) {
      var a = document.createElement("span"); a.className = "art gem"; a.innerHTML = GEM;
      cells[g.y][g.x].appendChild(a); gemEls[k] = a;
    });
    robotEl = document.createElement("div");
    robotEl.className = "robot";
    robotEl.innerHTML = '<div class="rb">' + ROBOT + '</div>';
    board.appendChild(robotEl);
    placeRobot(map.start.x, map.start.y, true);
    setMood("norm"); robotEl.dataset.face = "R"; robotEl.dataset.look = "R";
    setGems(0);
  }
  function placeRobot(x, y, instant) {
    if (instant) robotEl.style.transition = "none";
    robotEl.style.setProperty("--x", x); robotEl.style.setProperty("--y", y);
    robotEl.dataset.x = x; robotEl.dataset.y = y;
    if (instant) { void robotEl.offsetWidth; robotEl.style.transition = ""; }
  }
  function setMood(m) { robotEl.dataset.mood = m; }
  function face(d) { robotEl.dataset.look = d; if (d === "L") robotEl.dataset.face = "L"; else if (d === "R") robotEl.dataset.face = "R"; }
  function setGems(n) {
    gemShown = n;
    var t = n + " / " + map.gems.length;
    $("gemTxt").textContent = t;
    $("gemcount").setAttribute("aria-label", "Кристали: " + n + " з " + map.gems.length);
  }
  function resetRobot() {
    clearTimers(); plan = null;
    robotEl.classList.remove("bump", "cheer", "moving");
    placeRobot(map.start.x, map.start.y, true);
    setMood("norm"); robotEl.dataset.face = "R"; robotEl.dataset.look = "R";
    gemEls.forEach(function (g) { g.classList.remove("gone", "hop"); });
    for (var y = 0; y < map.h; y++) for (var x = 0; x < map.w; x++) { var d = cells[y][x].querySelector(".dot"); if (d) d.remove(); }
    setGems(0);
    clearHighlight();
    setLocked(false);
  }

  /* ---------- Програма ---------- */
  function blocks() { return Core.countBlocks(program); }
  function updateLimit() {
    var el = $("limit");
    el.textContent = "Блоків: " + blocks() + " / " + level.maxBlocks;
  }
  function limitBounce() {
    var el = $("limit"); el.classList.remove("over"); void el.offsetWidth; el.classList.add("over");
    setMsg("Забагато блоків! Максимум — " + level.maxBlocks + ". Прибери зайві або скористайся «Повтори».", "bad");
    later(function () { el.classList.remove("over"); }, 700);
  }
  function isDirty() { return +robotEl.dataset.x !== map.start.x || +robotEl.dataset.y !== map.start.y || gemShown > 0 || robotEl.dataset.mood !== "norm"; }

  function addCmd(d) {
    if (locked || modalOpen || !level) return;
    if (blocks() + 1 > level.maxBlocks) { limitBounce(); return; }
    if (isDirty()) { resetRobot(); setMsg("", "info"); }
    if (openIdx >= 0 && program[openIdx] && typeof program[openIdx] === "object") {
      program[openIdx].body.push(d); lastKey = openIdx + "-" + (program[openIdx].body.length - 1);
    } else {
      openIdx = -1; program.push(d); lastKey = String(program.length - 1);
    }
    renderProgram(); updateLimit();
  }
  function addRep() {
    if (locked || modalOpen || !level.loops) return;
    if (blocks() + 1 > level.maxBlocks) { limitBounce(); return; }
    if (isDirty()) { resetRobot(); setMsg("", "info"); }
    program.push({ rep: 2, body: [] }); openIdx = program.length - 1; lastKey = "r" + openIdx;
    renderProgram(); updateLimit();
  }
  function removeAt(i, j) {
    if (locked || removing) return;
    var sel = j < 0 ? '[data-k="' + i + '"]' : '[data-k="' + i + '-' + j + '"]';
    var el = $("program").querySelector(sel);
    removing = true;
    if (el) el.classList.add("out");
    setTimeout(function () {
      removing = false;
      if (j < 0) { program.splice(i, 1); if (openIdx === i) openIdx = -1; else if (openIdx > i) openIdx--; }
      else if (program[i] && program[i].body) program[i].body.splice(j, 1);
      lastKey = "";
      if (isDirty()) resetRobot();
      renderProgram(); updateLimit();
    }, reduce ? 0 : 170);
  }
  function setRep(i, delta) {
    var it = program[i]; if (locked || !it) return;
    it.rep = Math.max(2, Math.min(5, it.rep + delta));
    if (isDirty()) resetRobot();
    renderProgram();
  }

  function renderProgram() {
    var host = $("program");
    host.innerHTML = "";
    host.classList.toggle("locked", locked);
    if (!program.length) {
      var e = document.createElement("span"); e.className = "empty"; e.textContent = "Тут буде твоя програма. Натискай стрілки!";
      host.appendChild(e); return;
    }
    program.forEach(function (it, i) {
      if (typeof it === "string") host.appendChild(chip(it, String(i), i, -1));
      else host.appendChild(repBlock(it, i));
    });
    if (lastKey) {
      var n = host.querySelector('[data-k="' + lastKey.replace(/^r/, "") + '"]');
      if (n && !reduce) { n.classList.add("new"); }
      lastKey = "";
    }
  }
  function chip(d, key, i, j) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.dataset.d = d; b.dataset.k = key; b.disabled = locked;
    b.setAttribute("aria-label", NAMES[d] + ". Прибрати");
    b.innerHTML = arrowSVG(d);
    b.addEventListener("click", function (ev) { ev.stopPropagation(); removeAt(i, j); });
    return b;
  }
  function repBlock(it, i) {
    var w = document.createElement("div");
    w.className = "rep-block" + (openIdx === i ? " open" : ""); w.dataset.k = String(i);
    var head = document.createElement("div"); head.className = "rep-head";
    var lab = document.createElement("span"); lab.className = "tl"; lab.textContent = "Повтори";
    var st = document.createElement("span"); st.className = "stepper";
    var m = mini("−", "Менше повторів", function () { setRep(i, -1); }); m.disabled = locked || it.rep <= 2;
    var n = document.createElement("button"); n.type = "button"; n.className = "n"; n.textContent = it.rep; n.disabled = locked;
    n.setAttribute("aria-label", "Повторів: " + it.rep + ". Натисни, щоб збільшити");
    n.addEventListener("click", function (ev) { ev.stopPropagation(); setRep(i, it.rep >= 5 ? -3 : 1); });
    var p = mini("+", "Більше повторів", function () { setRep(i, 1); }); p.disabled = locked || it.rep >= 5;
    st.appendChild(m); st.appendChild(n); st.appendChild(p);
    var times = document.createElement("span"); times.textContent = "разів";
    var iter = document.createElement("span"); iter.className = "iter"; iter.hidden = true;
    head.appendChild(lab); head.appendChild(st); head.appendChild(times); head.appendChild(iter);
    var btns = document.createElement("span"); btns.className = "rep-btns";
    if (openIdx === i && !locked) {
      var done = document.createElement("button"); done.type = "button"; done.className = "mini done"; done.textContent = "Готово"; done.setAttribute("aria-label", "Готово: закрити блок «Повтори»");
      done.addEventListener("click", function (ev) { ev.stopPropagation(); openIdx = -1; renderProgram(); });
      btns.appendChild(done);
    }
    var del = document.createElement("button"); del.type = "button"; del.className = "mini"; del.textContent = "✕"; del.disabled = locked;
    del.setAttribute("aria-label", "Прибрати весь блок «Повтори»");
    del.addEventListener("click", function (ev) { ev.stopPropagation(); removeAt(i, -1); });
    btns.appendChild(del);
    head.appendChild(btns);
    var body = document.createElement("div"); body.className = "rep-body";
    it.body.forEach(function (d, j) { body.appendChild(chip(d, i + "-" + j, i, j)); });
    if (!it.body.length) { var h = document.createElement("span"); h.className = "hint"; h.textContent = openIdx === i ? "↑ натискай стрілки — вони потраплять сюди" : "порожньо"; body.appendChild(h); }
    w.appendChild(head); w.appendChild(body);
    w.addEventListener("click", function () { if (locked) return; openIdx = openIdx === i ? -1 : i; renderProgram(); });
    function mini(t, label, fn) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = t; b.setAttribute("aria-label", label);
      b.addEventListener("click", function (ev) { ev.stopPropagation(); fn(); }); return b;
    }
    return w;
  }
  // клік поза програмою й палітрою закриває відкритий блок
  document.addEventListener("click", function (e) {
    if (openIdx < 0 || locked) return;
    if (e.target.closest && (e.target.closest("#program") || e.target.closest("#palette"))) return;
    openIdx = -1; renderProgram();
  });

  function clearProgram() {
    if (locked) return;
    program = []; openIdx = -1; lastKey = "";
    if (isDirty()) resetRobot();
    renderProgram(); updateLimit(); setMsg("", "info");
  }

  /* ---------- Підсвітка ---------- */
  function clearHighlight() {
    var host = $("program");
    host.querySelectorAll(".active,.culprit").forEach(function (n) { n.classList.remove("active", "culprit"); });
    host.querySelectorAll(".iter").forEach(function (n) { n.hidden = true; });
  }
  function highlight(ev, culprit) {
    var host = $("program");
    clearHighlight();
    var key = ev.j < 0 ? String(ev.i) : ev.i + "-" + ev.j;
    var el = host.querySelector('[data-k="' + key + '"]');
    if (el) {
      el.classList.add(culprit ? "culprit" : "active");
    }
    if (ev.j >= 0) {
      var rb = host.querySelector('.rep-block[data-k="' + ev.i + '"]');
      if (rb) {
        rb.classList.toggle("active", !culprit);
        var it = rb.querySelector(".iter"); it.hidden = false; it.textContent = ev.iter + "/" + ev.reps;
      }
    }
  }

  /* ---------- Повідомлення ---------- */
  function setMsg(t, kind) { var m = $("msg"); m.textContent = t; m.className = "msg " + (kind || "info"); }

  /* ---------- Запуск ---------- */
  function setLocked(v) {
    locked = v;
    $("palette").querySelectorAll(".cmd").forEach(function (b) { b.disabled = v; });
    $("clear").disabled = v;
    $("step").disabled = false;
    renderProgram();
  }
  function uiRunning(auto) {
    var active = !!plan;
    $("stop").hidden = !active;
    $("runTxt").textContent = active && !auto ? "Далі" : "Запустити";
    $("run").disabled = !!(plan && auto);
    $("step").disabled = !!(plan && auto);
  }

  function prepare() {
    if (!program.length || !blocks()) { setMsg("Додай хоча б одну стрілку до програми.", "info"); return false; }
    for (var i = 0; i < program.length; i++) {
      var it = program[i];
      if (typeof it === "object" && !it.body.length) {
        openIdx = i; renderProgram();
        setMsg("У блоці «Повтори» ще порожньо. Додай у нього стрілки.", "info"); return false;
      }
    }
    openIdx = -1;
    resetRobot();
    var res = Core.run(level, program);
    var groups = [];
    res.events.forEach(function (ev) {
      if (ev.type === "move" || ev.type === "crash" || ev.type === "edge" || ev.type === "end") groups.push([ev]);
      else groups[groups.length - 1].push(ev);
    });
    plan = { groups: groups, gi: 0, res: res };
    setLocked(true);
    setMsg("", "info");
    return true;
  }
  function run(auto) {
    if (modalOpen || (plan && plan.finishing)) return;
    if (!plan) { if (!prepare()) return; }
    uiRunning(auto);
    showBoard();
    if (auto) tick(true); else tick(false);
  }
  /* На вузьких екранах кнопки під полем: прокрутити, щоб робота було видно. */
  function showBoard() {
    var b = $("board"); if (!b || !b.getBoundingClientRect) return;
    var r = b.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return;
    var smooth = true;
    try { smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    b.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  }
  function tick(auto) {
    if (!plan) return;
    var g = plan.groups[plan.gi++];
    if (!g) { finish(null); return; }
    var terminal = execGroup(g);
    if (terminal) return;
    if (auto && plan) later(function () { tick(true); }, durs().gap);
    else uiRunning(false);
  }

  /* Виконує одну групу подій; true, якщо запуск завершено. */
  function execGroup(g) {
    var d = durs(), main = g[0];
    if (main.type === "move") {
      var fx = +robotEl.dataset.x, fy = +robotEl.dataset.y;
      face(main.dir); highlight(main);
      robotEl.style.setProperty("--dur", d.move + "ms");
      robotEl.classList.add("moving");
      dropDot(fx, fy);
      placeRobot(main.x, main.y, d.move === 0);
      later(function () { robotEl.classList.remove("moving"); }, d.move);
      var gemEv = null, win = false;
      g.forEach(function (e) { if (e.type === "gem") gemEv = e; if (e.type === "win") win = true; });
      if (gemEv) later(function () { collect(gemEv); }, Math.max(0, d.move - 40));
      if (win) {
        plan.finishing = true;
        later(function () { onWin(); }, d.move + 500);
        return true;
      }
      return false;
    }
    if (main.type === "crash" || main.type === "edge") { onCrash(main); return true; }
    if (main.type === "end") { finish("end"); return true; }
    return false;
  }
  function dropDot(x, y) {
    var c = cells[y][x];
    if (c.querySelector(".dot")) return;
    var s = document.createElement("i"); s.className = "dot"; c.appendChild(s);
  }
  function finish(kind) {
    var res = plan ? plan.res : null;
    plan = null; uiRunning(false); setLocked(false);
    clearHighlight();
    if (kind === "end" && res) {
      setMsg("Команди скінчилися. Зібрано " + res.gemsCollected + " з " + res.total + " кристалів. Додай ще команди або спробуй інакше.", "info");
    }
  }
  function stopAll(silent) {
    clearTimers(); plan = null;
    if (robotEl) { robotEl.classList.remove("moving", "bump", "cheer"); }
    $("stop").hidden = true; $("run").disabled = false; $("step").disabled = false; $("runTxt").textContent = "Запустити";
    closeModal(true);
    if (level && robotEl) { resetRobot(); if (!silent) setMsg("", "info"); }
  }

  /* ---------- Кристал ---------- */
  function collect(ev) {
    var el = gemEls[ev.gem]; if (!el) return;
    var r = el.getBoundingClientRect();
    var target = $("gemIcon").getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    el.classList.add("hop");
    function land() { setGems(Math.min(gemShown + 1, map.gems.length)); var gc = $("gemcount"); gc.classList.remove("pulse"); void gc.offsetWidth; gc.classList.add("pulse"); }
    if (reduce || !el.animate) { el.classList.add("gone"); land(); return; }
    burst(cx, cy, ["#2DD4BF", "#8B5CF6", "#FFE45C", "#fff"], 10, "dotp", r.width * 0.16, 52);
    later(function () {
      el.classList.add("gone");
      var f = document.createElement("div"); f.className = "fx fly"; f.innerHTML = GEM;
      f.style.width = r.width + "px"; f.style.height = r.height + "px";
      document.body.appendChild(f);
      var dx = target.left + target.width / 2 - cx, dy = target.top + target.height / 2 - cy, sc = target.width / r.width;
      var a = f.animate([
        { transform: "translate(" + (cx - r.width / 2) + "px," + (cy - r.height / 2) + "px) scale(1.2)", opacity: 1 },
        { transform: "translate(" + (cx - r.width / 2 + dx * .5) + "px," + (cy - r.height / 2 + dy * .5 - 40) + "px) scale(.9)", opacity: 1, offset: .5 },
        { transform: "translate(" + (cx - r.width / 2 + dx) + "px," + (cy - r.height / 2 + dy) + "px) scale(" + sc + ")", opacity: .9 }
      ], { duration: 650, easing: "ease-in", fill: "forwards" });
      a.onfinish = function () { f.remove(); land(); };
    }, 220);
  }
  /* Частинки (WAAPI) у фіксованих координатах екрана */
  function burst(cx, cy, colors, n, kind, size, dist) {
    if (reduce || !document.body.animate) return;
    for (var i = 0; i < n; i++) {
      var p = document.createElement("i"); p.className = "fx " + kind;
      var s = size * (0.7 + Math.random() * 0.8);
      p.style.width = p.style.height = s + "px";
      p.style.background = colors[i % colors.length];
      document.body.appendChild(p);
      var ang = Math.random() * Math.PI * 2, dd = dist * (0.6 + Math.random() * 0.8);
      var x0 = cx - s / 2, y0 = cy - s / 2;
      var a = p.animate([
        { transform: "translate(" + x0 + "px," + y0 + "px) scale(1) rotate(0)", opacity: 1 },
        { transform: "translate(" + (x0 + Math.cos(ang) * dd) + "px," + (y0 + Math.sin(ang) * dd + 14) + "px) scale(.2) rotate(" + (Math.random() * 360) + "deg)", opacity: 0 }
      ], { duration: 520 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" });
      a.onfinish = (function (el) { return function () { el.remove(); }; })(p);
    }
  }

  /* ---------- Врізання ---------- */
  function onCrash(ev) {
    var what = ev.type === "edge" ? "Це край поля" : "Камінь";
    var vx = ev.tx - ev.x, vy = ev.ty - ev.y;
    plan = null; setLocked(false); $("stop").hidden = true; $("run").disabled = false; $("step").disabled = false; $("runTxt").textContent = "Запустити";
    face(ev.dir); highlight(ev, true);
    robotEl.style.setProperty("--bx", vx * 42 + "%"); robotEl.style.setProperty("--by", vy * 42 + "%");
    robotEl.classList.remove("bump"); void robotEl.offsetWidth; robotEl.classList.add("bump");
    setMood("oops");
    var rr = robotEl.getBoundingClientRect();
    var cx = rr.left + rr.width / 2 + vx * rr.width * 0.5, cy = rr.top + rr.height / 2 + vy * rr.height * 0.5;
    burst(cx, cy, ["#FFE45C", "#FF7A1A", "#fff", "#F0556A"], 12, "star", rr.width * 0.22, rr.width * 0.8);
    if (!reduce) {
      board.classList.remove("shake"); void board.offsetWidth; board.classList.add("shake");
      var f = $("flash"); f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
      later(function () { board.classList.remove("shake"); }, 520);
    }
    setMsg("Ой! " + what + " на кроці " + ev.step + (ev.type === "edge" ? ": далі за поле йти не можна." : "."), "bad");
    // «Спробувати ще» — кнопка в повідомленні + автоповернення
    var m = $("msg"), b = document.createElement("button");
    b.type = "button"; b.className = "btn ghost"; b.textContent = "Спробувати ще"; b.style.cssText = "min-height:40px;padding:4px 14px;margin-left:12px";
    m.appendChild(b);
    function back() {
      clearTimeout(autoReset);
      if (!robotEl.dataset.mood || robotEl.dataset.mood !== "oops") return;
      resetRobot(); highlightKeepCulprit(ev); setMsg("Спробуй ще раз: зміни програму й натисни «Запустити».", "info");
    }
    b.addEventListener("click", back);
    autoReset = setTimeout(back, 1200);
  }
  function highlightKeepCulprit(ev) {
    var key = ev.j < 0 ? String(ev.i) : ev.i + "-" + ev.j;
    var el = $("program").querySelector('[data-k="' + key + '"]');
    if (el) el.classList.add("culprit");
  }

  /* ---------- Перемога ---------- */
  function onWin() {
    plan = null;
    $("stop").hidden = true; $("run").disabled = false; $("step").disabled = false; $("runTxt").textContent = "Запустити";
    setLocked(false); clearHighlight();
    setGems(map.gems.length);
    setMood("happy");
    robotEl.classList.remove("cheer"); void robotEl.offsetWidth; robotEl.classList.add("cheer");
    confetti();
    var blk = blocks(), stars = blk <= level.par ? 3 : blk <= level.par + 2 ? 2 : 1;
    if (stars > starsOf(level.n)) { progress.stars[level.n] = stars; saveProgress(); }
    setMsg("Супер! Усі кристали зібрано!", "good");
    later(function () { showModal(stars, blk); }, reduce ? 200 : 1100);
  }
  function showModal(stars, blk) {
    modalOpen = true;
    var last = lvIdx >= LEVELS.length - 1;
    var h = $("modalHost");
    var st = "";
    for (var i = 0; i < 3; i++) st += '<span class="st ' + (i < stars ? "on" : "off") + '" style="animation-delay:' + (reduce ? 0 : 350 + i * 380) + 'ms">' + starSVG(i < stars) + '</span>';
    var txt = stars === 3 ? "Ідеально! Це найкоротша програма." : "Блоків: " + blk + ". Для трьох зірок потрібно " + level.par + " або менше.";
    h.innerHTML = '<div class="modal" id="modal"><div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="mTitle">' +
      '<h3 id="mTitle">Рівень пройдено!</h3><div class="bigstars" role="img" aria-label="Зірок: ' + stars + ' з 3">' + st + '</div>' +
      '<p class="sub">' + esc(txt) + '</p><div class="btns">' +
      '<button class="btn go" id="mNext" type="button">' + (last ? "До рівнів" : "Наступний рівень") + '</button>' +
      '<button class="btn ghost" id="mAgain" type="button">Покращити</button></div></div></div>';
    $("mNext").addEventListener("click", function () { closeModal(true); if (last) { goSelect(); } else openLevel(lvIdx + 1); });
    $("mAgain").addEventListener("click", function () { closeModal(true); resetRobot(); setMsg("Спробуй скласти коротшу програму!", "info"); });
    $("mNext").focus();
    $("modal").addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var a = $("mNext"), b = $("mAgain");
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    });
  }
  function closeModal(silent) {
    if (!modalOpen) return;
    modalOpen = false; $("modalHost").innerHTML = "";
    if (!silent) { resetRobot(); }
  }

  /* ---------- Конфеті ---------- */
  var confRAF = 0;
  function confetti() {
    if (reduce) return;
    var cv = $("confetti"), ctx = cv.getContext && cv.getContext("2d"); if (!ctx) return;
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    var cols = ["#FF7A1A", "#2DD4BF", "#8B5CF6", "#FFC21A", "#F0556A", "#4F7CFF", "#1FB57F"], ps = [], i;
    for (i = 0; i < 150; i++) {
      ps.push({ x: cv.width * (0.2 + Math.random() * 0.6), y: cv.height * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
        w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[i % cols.length] });
    }
    var t0 = performance.now(); cancelAnimationFrame(confRAF);
    (function frame(t) {
      var el = t - t0; ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach(function (p) {
        p.vy += 0.32; p.vx *= 0.995; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, Math.min(1, (3400 - el) / 900));
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      if (el < 3400) confRAF = requestAnimationFrame(frame); else ctx.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  /* ---------- Події ---------- */
  function goSelect() { stopAll(true); renderSelect(); show("select"); }
  $("back").addEventListener("click", goSelect);
  $("palette").addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".cmd"); if (!b) return;
    if (b.id === "addRep") addRep(); else addCmd(b.dataset.d);
  });
  $("palette").querySelectorAll(".cmd[data-d]").forEach(function (b) { b.innerHTML = arrowSVG(b.dataset.d); });
  $("clear").addEventListener("click", clearProgram);
  $("run").addEventListener("click", function () { run(true); });
  $("step").addEventListener("click", function () { run(false); });
  $("stop").addEventListener("click", function () { stopAll(true); setMsg("Зупинено. Можна змінити програму.", "info"); });
  function setSpeed(s) {
    speed = s;
    $("spSlow").setAttribute("aria-pressed", s === "slow"); $("spFast").setAttribute("aria-pressed", s === "fast");
  }
  $("spSlow").addEventListener("click", function () { setSpeed("slow"); });
  $("spFast").addEventListener("click", function () { setSpeed("fast"); });

  var KEYDIR = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R" };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modalOpen) { $("mAgain").click(); return; }
    if ($("screenPlay").hidden || modalOpen || e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (KEYDIR[e.key]) {
      e.preventDefault(); addCmd(KEYDIR[e.key]);
      var b = $("palette").querySelector('.cmd[data-d="' + KEYDIR[e.key] + '"]');
      if (b) { b.classList.add("pressed"); setTimeout(function () { b.classList.remove("pressed"); }, 110); }
    } else if (e.key === "Enter" && tag !== "BUTTON" && tag !== "A") {
      e.preventDefault(); if (!plan) run(true);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      if (locked || !program.length) return;
      var it = openIdx >= 0 ? program[openIdx] : null;
      if (it && typeof it === "object" && it.body.length) removeAt(openIdx, it.body.length - 1);
      else removeAt(program.length - 1, -1);
    }
  });

  try { $("yr").textContent = new Date().getFullYear(); } catch (e) {}
  renderSelect();
  show("select");
})();
