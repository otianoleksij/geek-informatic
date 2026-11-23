/* Задачі з сірниками: показ по одній у випадковому порядку, хід одним сірником, перевірка, підказки.
   Модель сірників у sirnyky-core.js, задачі з content/sirnyky/puzzles.json, рядки зі словника (t("sirnyky.…")). */
(function () {
  "use strict";
  var C = window.SirnykyCore, ALL = [];
  var STORE_ID = "sirnyky:v1", SLUG = "sirnyky";
  var ROOT = document.documentElement.getAttribute("data-root") || "";
  var CONFETTI = ["#FFE45C", "#F08CA4", "#6FCB98", "#7FA3F5", "#B591F2", "#F0A96A"];
  /* ширина клітинок і проміжку в умовних одиницях (див. sirnyky.css) */
  var W_DIGIT = 6, W_SIGN = 4.8, W_GAP = 1, U_MAX = 12, U_MIN = 3.6;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    card: $("card"), counter: $("counter"), level: $("level"), seen: $("seen"), task: $("task"), answersCount: $("answersCount"),
    boardWrap: $("boardWrap"), board: $("board"), found: $("found"), foundList: $("foundList"),
    undo: $("undo"), retry: $("retry"), hint: $("hint"), hintTxt: $("hintTxt"), next: $("next"),
    feedback: $("feedback"), solved: $("solved"), confetti: $("confetti"), filters: $("filters")
  };
  try { $("yr").textContent = new Date().getFullYear(); } catch (e) {}

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* --- збереження: {v: 1, done: [id, …]} --- */
  var solvedSet = {};
  try {
    var raw = window.GIStorage ? GIStorage.load(STORE_ID) : null;
    if (raw && raw.done && raw.done.forEach) raw.done.forEach(function (id) { solvedSet[id] = 1; });
  } catch (e) { solvedSet = {}; }
  function doneCount() {
    var n = 0;
    ALL.forEach(function (p) { if (solvedSet[p.id]) n++; });
    return n;
  }
  function syncSummary() {
    if (window.GIStorage) GIStorage.setSummary(SLUG, doneCount(), ALL.length);
  }
  function persist() {
    if (window.GIStorage) GIStorage.save(STORE_ID, { v: 1, done: Object.keys(solvedSet) });
    syncSummary();
  }
  function updateProgress() { el.solved.textContent = t("sirnyky.progress", { count: doneCount(), total: ALL.length }); }

  /* --- стан --- */
  var filter = "all", deck = [], pos = 0, cur = null, lastId = null;
  var start = [], st = [];          // початковий і поточний стан клітинок
  var btns = [];                    // btns[клітинка][позиція] -> кнопка
  var lifted = null, moved = null, locked = false, revealed = false;
  var found = [], shown = [], hintStep = 0, hintAns = null, hintMv = null;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return a;
  }
  function buildDeck() {
    deck = shuffle(ALL.filter(function (p) { return filter === "all" || p.goal === filter; }));
    if (deck.length > 1 && lastId && deck[0].id === lastId) { var x = deck[0]; deck[0] = deck[1]; deck[1] = x; }
    pos = 0;
  }

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function addMsg(cls, content) {
    var m = mk("div", "msg " + cls);
    if (typeof content === "string") m.textContent = content;
    else { var s = document.createElement("span"); s.appendChild(content); m.appendChild(s); }
    el.feedback.appendChild(m);
    return m;
  }
  function addRich(cls, key, params) { return addMsg(cls, GII18n.md(t(key, params))); }
  function clearFeedback() { el.feedback.textContent = ""; }

  /* --- розкладка: масштаб --u підганяє ширину ряду клітинок під контейнер --- */
  function layout() {
    if (!cur) return;
    var units = 0, i;
    for (i = 0; i < start.length; i++) units += start[i].k === "d" ? W_DIGIT : W_SIGN;
    units += W_GAP * (start.length - 1);
    units += 0.6;                       /* голівки трохи виступають за клітинку */
    var cs = null, pad = 0;
    try { cs = window.getComputedStyle(el.boardWrap); pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); } catch (e) { pad = 0; }
    var avail = el.boardWrap.clientWidth - (pad || 0) - 4;
    if (avail <= 0) return;
    var u = Math.floor((avail / units) * 10) / 10;
    u = Math.max(U_MIN, Math.min(U_MAX, u));
    el.board.style.setProperty("--u", u + "px");
  }
  window.addEventListener("resize", layout);
  try { if (window.ResizeObserver) new ResizeObserver(layout).observe(el.boardWrap); } catch (e) {}

  /* --- дошка --- */
  function symLabel(i) {
    var ch = C.decodeCell(st[i]);
    if (ch === null) return t("sirnyky.symBad");
    if (ch === "+") return t("sirnyky.symPlus");
    if (ch === "-") return t("sirnyky.symMinus");
    if (ch === "=") return t("sirnyky.symEq");
    return t("sirnyky.symDigit", { ch: ch });
  }
  function buildBoard() {
    el.board.textContent = "";
    btns = [];
    start.forEach(function (cellState, i) {
      var cell = mk("div", "cell " + (cellState.k === "d" ? "digit" : "sign"));
      var row = {};
      var positions = C.positionsOf(cellState.k);
      for (var j = 0; j < positions.length; j++) {
        (function (seg) {
          var b = mk("button", "stick p-" + seg);
          b.type = "button";
          b.addEventListener("click", function () { onStick(i, seg); });
          row[seg] = b;
          cell.appendChild(b);
        })(positions.charAt(j));
      }
      btns.push(row);
      el.board.appendChild(cell);
    });
    el.board.setAttribute("aria-label", t("sirnyky.boardAria", { expr: cur.expr }));
  }

  function isHere(o, i, s) { return o && o.cell === i && o.seg === s; }
  function refresh() {
    for (var i = 0; i < st.length; i++) {
      var sym = symLabel(i);
      var positions = C.positionsOf(st[i].k);
      for (var j = 0; j < positions.length; j++) {
        var s = positions.charAt(j), b = btns[i][s];
        var present = C.hasSeg(st, i, s);
        var cls = "stick p-" + s + (present ? " has" : " free");
        if (isHere(lifted, i, s)) cls += " on";
        if (moved && isHere(moved.to, i, s)) cls += " moved";
        if (hintStep === 1 && !lifted && !locked && hintMv && isHere(hintMv.from, i, s)) cls += " hint";
        b.className = cls;
        b.disabled = locked;
        b.hidden = !present && !(lifted && !locked);
        var lbl = t(present ? "sirnyky.stickHave" : "sirnyky.stickFree", { pos: t("sirnyky.pos." + s), cell: i + 1, sym: sym });
        b.setAttribute("aria-label", lbl);
        if (present) b.setAttribute("aria-pressed", isHere(lifted, i, s) ? "true" : "false");
        else b.removeAttribute("aria-pressed");
      }
    }
    el.board.className = "board" + (lifted ? " lifting" : "") + (locked ? " locked" : "");
    el.undo.disabled = !lifted;
    el.undo.hidden = locked;          /* після ходу його замінює «Спробувати ще» / «Шукати ще» */
    el.hint.disabled = found.length >= cur.answers.length;
  }
  function focusStick(i, s) {
    try { btns[i][s].focus({ preventScroll: true }); } catch (e) {}
  }
  function focusFirst() {
    var b = el.board.querySelector("button.stick:not([hidden]):not(:disabled)");
    if (b) { try { b.focus({ preventScroll: true }); } catch (e) {} }
  }

  /* --- хід --- */
  function onStick(i, s) {
    if (locked) return;
    var present = C.hasSeg(st, i, s);
    if (present) {
      if (isHere(lifted, i, s)) { lifted = null; clearFeedback(); }
      else { lifted = { cell: i, seg: s }; clearFeedback(); addMsg("info", t("sirnyky.lifted")); }
      refresh();
      focusStick(i, s);
    } else if (lifted) {
      place({ cell: i, seg: s });
    }
  }
  function place(to) {
    var from = lifted;
    var next = C.applyMove(st, from, to);
    if (!next) return;
    st = next; moved = { from: from, to: to }; lifted = null; locked = true;
    refresh();
    evaluate(C.fromState(st));
  }

  function showRetry(kind) {
    el.retry.textContent = t(kind === "again" ? "sirnyky.again" : "sirnyky.retry");
    el.retry.hidden = false;
    el.retry.focus();
  }
  function renderFound() {
    el.foundList.textContent = "";
    found.forEach(function (r) { el.foundList.appendChild(mk("span", "chip", r)); });
    el.found.hidden = !found.length;
  }
  function confettiBurst() {
    if (reduce) return;
    el.confetti.textContent = "";
    var w = el.card.clientWidth;
    for (var i = 0; i < 26; i++) {
      var s = document.createElement("i");
      s.style.left = (w * (0.15 + Math.random() * 0.7)) + "px";
      s.style.background = CONFETTI[i % CONFETTI.length];
      s.style.setProperty("--dx", ((Math.random() - 0.5) * 220) + "px");
      s.style.setProperty("--dy", (-60 + Math.random() * 150) + "px");
      s.style.setProperty("--rot", ((Math.random() - 0.5) * 720) + "deg");
      s.style.animationDelay = (Math.random() * 0.15) + "s";
      el.confetti.appendChild(s);
    }
    setTimeout(function () { el.confetti.textContent = ""; }, 1700);
  }

  function evaluate(result) {
    var v = C.verdict(result, cur.goal, cur.answers);
    clearFeedback();
    if (!v.ok) {
      addRich("bad", "sirnyky.wrong." + v.code, { result: result || "" });
      showRetry("retry");
      return;
    }
    if (found.indexOf(result) >= 0) {
      addRich("warn", "sirnyky.dup", { result: result });
      showRetry("again");
      return;
    }
    found.push(result);
    if (!solvedSet[cur.id]) { solvedSet[cur.id] = 1; persist(); }
    el.seen.hidden = false;
    updateProgress();
    renderFound();
    var total = cur.answers.length;
    if (found.length < total) {
      addRich("good", "sirnyky.okMore", { result: result, found: found.length, total: total });
      refresh();
      showRetry("again");
    } else {
      addRich("good", total > 1 ? "sirnyky.okAll" : "sirnyky.ok", { result: result, total: total });
      el.next.classList.remove("ghost"); el.next.classList.add("next");
      refresh();
      el.next.focus();
    }
    if (!reduce) { el.card.classList.remove("pop"); void el.card.offsetWidth; el.card.classList.add("pop"); }
    confettiBurst();
  }

  /* повертає дошку на початок (без втрати знайдених відповідей) */
  function reset() {
    st = C.cloneState(start);
    lifted = null; moved = null; locked = false; revealed = false;
    hintStep = 0; hintAns = null; hintMv = null;
    el.retry.hidden = true;
    el.hintTxt.textContent = t("sirnyky.hint");
    clearFeedback();
    refresh();
  }
  function onUndo() {
    if (lifted) {
      var l = lifted;
      lifted = null; clearFeedback(); refresh(); focusStick(l.cell, l.seg);
    } else if (locked) {
      reset(); focusFirst();
    }
  }
  function onRetry() { reset(); focusFirst(); }

  /* --- підказка: спершу підсвічує сірник, другий раз показує відповідь (не зараховується) --- */
  function pickAnswer() {
    var rest = cur.answers.filter(function (a) { return found.indexOf(a) < 0; });
    var fresh = rest.filter(function (a) { return shown.indexOf(a) < 0; });
    if (!fresh.length) { shown = []; fresh = rest; }
    return fresh[0] || null;
  }
  function onHint() {
    if (found.length >= cur.answers.length) return;
    if (hintStep === 0) {
      if (locked || lifted) reset();
      hintAns = pickAnswer();
      if (!hintAns) return;
      hintMv = C.moveFor(cur.expr, hintAns);
      if (!hintMv) return;
      hintStep = 1;
      clearFeedback();
      addMsg("hint", t("sirnyky.hintMsg"));
      el.hintTxt.textContent = t("sirnyky.reveal");
      refresh();
    } else {
      var ans = hintAns, mv = hintMv;
      reset();
      st = C.applyMove(st, mv.from, mv.to) || st;
      moved = { from: mv.from, to: mv.to }; locked = true; revealed = true;
      shown.push(ans);
      addRich("warn", "sirnyky.revealed", { answer: ans });
      refresh();
      showRetry("retry");
    }
  }

  /* --- показ задачі --- */
  function show() {
    cur = deck[pos];
    lastId = cur.id;
    setHash(cur.id);
    start = C.toState(cur.expr);
    found = []; shown = [];
    buildBoard();
    el.counter.textContent = t("sirnyky.counter", { n: pos + 1, total: deck.length });
    el.level.textContent = t("sirnyky.level", { n: cur.level });
    el.seen.hidden = !solvedSet[cur.id];
    el.task.textContent = t("sirnyky.task." + cur.goal);
    el.answersCount.textContent = t("sirnyky.answersCount", { count: cur.answers.length });
    el.next.classList.remove("next"); el.next.classList.add("ghost");
    el.card.classList.remove("pop");
    renderFound();
    reset();
    layout();
    updateProgress();
  }
  function nextPuzzle() {
    if (!deck.length) return;
    pos++;
    if (pos >= deck.length) buildDeck();
    show();
  }
  function setFilterPills(g) {
    filter = g;
    Array.prototype.forEach.call(el.filters.querySelectorAll(".pill"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-g") === g ? "true" : "false");
    });
  }
  function setFilter(g) {
    setFilterPills(g);
    lastId = null;
    buildDeck();
    show();
  }
  function buildFilters() {
    var items = [
      { id: "all", label: t("sirnyky.filterAll") },
      { id: "fix", label: t("sirnyky.goal.fix") },
      { id: "max", label: t("sirnyky.goal.max") },
      { id: "min", label: t("sirnyky.goal.min") }
    ];
    el.filters.textContent = "";
    items.forEach(function (g, i) {
      var b = mk("button", "pill", g.label);
      b.type = "button";
      b.setAttribute("data-g", g.id);
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      b.addEventListener("click", function () { setFilter(g.id); });
      el.filters.appendChild(b);
    });
  }

  /* --- маршрутизація: #m07 (replaceState, без нових записів історії) --- */
  function setHash(id) {
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* ок */ }
  }
  function cleanHash() {
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ок */ }
  }
  function findById(id) {
    for (var i = 0; i < ALL.length; i++) if (ALL[i].id === id) return ALL[i];
    return null;
  }
  /* Показує задачу з hash. true, якщо hash вказував на існуючу задачу. */
  function applyHash(initial) {
    var id = (location.hash || "").replace(/^#/, "");
    if (!id) return false;
    var p = findById(id);
    if (!p) { cleanHash(); return false; }
    if (cur && cur.id === p.id) return true;
    if (filter !== "all" && p.goal !== filter) setFilterPills("all");
    buildDeck();
    for (var i = 0; i < deck.length; i++) if (deck[i].id === id) { pos = i; break; }
    show();
    if (!initial) {
      try { el.counter.setAttribute("tabindex", "-1"); el.counter.focus({ preventScroll: true }); } catch (e) {}
    }
    return true;
  }
  window.addEventListener("hashchange", function () { if (ALL.length) applyHash(false); });

  /* --- клавіатура: стрілки переходять між видимими сірниками, Esc скасовує підняття --- */
  el.board.addEventListener("keydown", function (e) {
    var key = e.key || e.keyIdentifier;
    if (key === "Escape" || key === "Esc") {
      if (lifted) { e.preventDefault(); onUndo(); }
      return;
    }
    var d = 0;
    if (key === "ArrowRight" || key === "ArrowDown" || key === "Right" || key === "Down") d = 1;
    else if (key === "ArrowLeft" || key === "ArrowUp" || key === "Left" || key === "Up") d = -1;
    if (!d) return;
    var list = Array.prototype.slice.call(el.board.querySelectorAll("button.stick:not([hidden]):not(:disabled)"));
    var idx = list.indexOf(document.activeElement);
    if (idx < 0 || !list.length) return;
    e.preventDefault();
    var n = list[(idx + d + list.length) % list.length];
    try { n.focus(); } catch (err) {}
  });

  el.undo.addEventListener("click", onUndo);
  el.retry.addEventListener("click", onRetry);
  el.hint.addEventListener("click", onHint);
  el.next.addEventListener("click", nextPuzzle);

  GIData.loadJSON(ROOT + "content/sirnyky/puzzles.json").then(function (data) {
    ALL = data.puzzles || [];
    buildFilters();
    syncSummary();
    if (!applyHash(true)) { buildDeck(); show(); }
  }, function () { /* повідомлення про помилку вже показав GIData */ });
})();
