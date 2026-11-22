/* Ребуси: показ по одному у випадковому порядку, перевірка, підказки.
   Набір читається з content/rebusy/<мова>.json, рядки беруться зі словника (t("rebusy.…")). */
(function () {
  "use strict";
  var C = window.RebusCore, ALL = [], GROUPS = [], GRADE_LABEL = {};
  var LANG = (window.GII18n && GII18n.lang) || "uk";
  var STORE_ID = "rebusy:" + LANG + ":v1", OLD_STORE_ID = "rebusy:v1", LEGACY_KEY = "geek-rebus-solved-v1", SLUG = "rebusy";
  var ROOT = document.documentElement.getAttribute("data-root") || "";
  var CONFETTI = ["#FFE45C", "#F08CA4", "#6FCB98", "#7FA3F5", "#B591F2", "#F0A96A"];

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    card: $("card"), counter: $("counter"), grade: $("grade"), seen: $("seen"), pieces: $("pieces"),
    form: $("form"), input: $("ans"), check: $("check"), row: $("row"), boxes: $("boxes"), lettersSr: $("lettersSr"),
    bulb: $("bulb"), bulbTxt: $("bulbTxt"), reveal: $("reveal"), next: $("next"),
    feedback: $("feedback"), solved: $("solved"), confetti: $("confetti"), filters: $("filters")
  };
  try { $("yr").textContent = new Date().getFullYear(); } catch (e) {}

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* --- збереження --- */
  var solvedSet = {};
  try {
    /* rebusy:v1 (і давній geek-rebus-solved-v1) — той самий масив id, лише без мови в ключі: переносимо */
    var raw = window.GIStorage ? GIStorage.load(STORE_ID) : null;
    if (!(raw && raw.forEach) && window.GIStorage) {
      raw = GIStorage.load(OLD_STORE_ID, LEGACY_KEY);
      if (raw && raw.forEach) { GIStorage.save(STORE_ID, raw); GIStorage.remove(OLD_STORE_ID); }
    }
    if (raw && raw.forEach) raw.forEach(function (id) { solvedSet[id] = 1; });
  } catch (e) { solvedSet = {}; }
  function syncSummary() {
    if (!window.GIStorage) return;
    var done = 0;
    ALL.forEach(function (r) { if (solvedSet[r.id]) done++; });
    GIStorage.setSummary(SLUG, done, ALL.length);
  }
  function persist() {
    if (window.GIStorage) GIStorage.save(STORE_ID, Object.keys(solvedSet));
    syncSummary();
  }

  /* --- стан --- */
  var filter = "all", deck = [], pos = 0, cur = null;
  var hintStep = 0, finished = false, sessionSolved = 0, lastId = null;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function buildDeck() {
    deck = shuffle(ALL.filter(function (r) { return filter === "all" || r.g === filter; }));
    if (deck.length > 1 && lastId && deck[0].id === lastId) { var t = deck[0]; deck[0] = deck[1]; deck[1] = t; }
    pos = 0;
  }

  /* --- допоміжне для DOM --- */
  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var ORD = { 1: t("rebusy.ord.1"), 2: t("rebusy.ord.2"), 3: t("rebusy.ord.3"), 4: t("rebusy.ord.4"),
    5: t("rebusy.ord.5"), 6: t("rebusy.ord.6"), 7: t("rebusy.ord.7"), 8: t("rebusy.ord.8") };

  function ariaFor(p, kind) {
    var s = [kind === "num" ? t("rebusy.pieceNum", { num: p.num }) : t("rebusy.piecePic")];
    if (p.rev) s.push(t("rebusy.pieceRev"));
    if (p.keep && p.keep.length) s.push(t("rebusy.pieceKeep", { list: p.keep.join(", ") }));
    if (p.l) s.push(t("rebusy.pieceLeft", { count: p.l }));
    if (p.r) s.push(t("rebusy.pieceRight", { count: p.r }));
    (p.rep || []).forEach(function (r) { s.push(t("rebusy.pieceReplace", { from: r[0], to: r[1] })); });
    return s.join(", ");
  }

  function renderPiece(p, i) {
    var k = C.kind(p), tile;
    if (k === "txt") {
      tile = mk("div", "tile txt");
      tile.setAttribute("role", "img");
      tile.setAttribute("aria-label", p.x && p.x.length
        ? t("rebusy.pieceLettersStruck", { letters: p.t, positions: p.x.map(function (n) { return ORD[n] || n; }).join(", ") })
        : t("rebusy.pieceLetters", { letters: p.t }));
      var wrap = mk("div", "letters");
      wrap.setAttribute("aria-hidden", "true");
      Array.from(p.t).forEach(function (ch, idx) {
        wrap.appendChild(mk("span", (p.x && p.x.indexOf(idx + 1) >= 0) ? "x" : "", ch));
      });
      tile.appendChild(wrap);
      return tile;
    }
    tile = mk("div", "tile " + (k === "num" ? "num " : "pic ") + "c" + (i % 6));
    tile.setAttribute("role", "img");
    tile.setAttribute("aria-label", ariaFor(p, k));
    if (p.keep && p.keep.length) {
      var kp = mk("div", "keeps");
      kp.setAttribute("aria-hidden", "true");
      p.keep.forEach(function (n) { kp.appendChild(mk("span", "", String(n))); });
      tile.appendChild(kp);
    }
    if (p.rev) {
      var rm = mk("span", "revmark", "↻");
      rm.setAttribute("aria-hidden", "true");
      rm.title = t("rebusy.revTitle");
      tile.appendChild(rm);
    }
    var row = mk("div", "pic-row");
    row.setAttribute("aria-hidden", "true");
    if (p.l) row.appendChild(mk("span", "commas", new Array(p.l + 1).join(",")));
    row.appendChild(k === "num" ? mk("span", "numtxt", p.num) : mk("span", "emoji" + (p.rev ? " rev" : ""), p.pic));
    if (p.r) row.appendChild(mk("span", "commas", new Array(p.r + 1).join(",")));
    tile.appendChild(row);
    if (p.rep && p.rep.length) {
      var reps = mk("div", "reps");
      reps.setAttribute("aria-hidden", "true");
      p.rep.forEach(function (r) { reps.appendChild(mk("span", "chip", r[0] + " = " + r[1])); });
      tile.appendChild(reps);
    }
    return tile;
  }

  function renderBoxes() {
    var n = Array.from(C.normalize(cur.answer)).length;
    var v = Array.from(C.normalize(el.input.value));
    el.boxes.textContent = "";
    for (var i = 0; i < n; i++) el.boxes.appendChild(mk("span", "b", v[i] || ""));
    el.boxes.appendChild(mk("span", "count", t("rebusy.letters", { count: n })));
  }

  function clearFeedback() { el.feedback.textContent = ""; }
  /* прибирає лише повідомлення про спробу, а відкриті підказки лишає */
  function clearStatus() {
    Array.prototype.forEach.call(el.feedback.querySelectorAll(".msg:not(.hint)"), function (m) { m.remove(); });
  }
  var finePointer = false;
  try { finePointer = window.matchMedia("(pointer: fine)").matches; } catch (e) {}
  function addMsg(cls, html) {
    var m = mk("div", "msg " + cls);
    if (typeof html === "string") m.textContent = html; else m.appendChild(html);
    el.feedback.appendChild(m);
    return m;
  }

  /* --- показ ребуса --- */
  function show() {
    cur = deck[pos];
    lastId = cur.id;
    setHash(cur.id);
    hintStep = 0; finished = false;
    el.pieces.textContent = "";
    cur.parts.forEach(function (p, i) { el.pieces.appendChild(renderPiece(p, i)); });
    el.counter.textContent = t("rebusy.counter", { n: pos + 1, total: deck.length });
    el.grade.textContent = GRADE_LABEL[cur.g] || cur.g;
    el.seen.hidden = !solvedSet[cur.id];
    el.input.disabled = false; el.input.value = "";
    el.check.disabled = false;
    el.bulb.disabled = false; el.bulbTxt.textContent = t("rebusy.hint");
    el.reveal.hidden = true;
    el.next.classList.remove("next"); el.next.classList.add("ghost");
    el.row.classList.remove("shake");
    el.card.classList.remove("pop");
    clearFeedback();
    el.lettersSr.textContent = t("rebusy.lettersSr", { count: Array.from(C.normalize(cur.answer)).length });
    renderBoxes();
    updateSolved();
  }
  /* --- маршрутизація: #r017 (replaceState, без нових записів історії) --- */
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
  /* Показує ребус із hash. true, якщо hash вказував на існуючий ребус. */
  function applyHash(initial) {
    var id = (location.hash || "").replace(/^#/, "");
    if (!id) return false;
    var r = findById(id);
    if (!r) { cleanHash(); return false; }
    if (cur && cur.id === r.id) return true;
    if (filter !== "all" && r.g !== filter) setFilterPills("all");
    buildDeck();
    for (var i = 0; i < deck.length; i++) if (deck[i].id === id) { pos = i; break; }
    show();
    if (!initial) {
      try { el.counter.setAttribute("tabindex", "-1"); el.counter.focus({ preventScroll: true }); } catch (e) {}
    }
    return true;
  }
  function setFilterPills(g) {
    filter = g;
    Array.prototype.forEach.call(document.querySelectorAll(".pill"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-g") === g ? "true" : "false");
    });
  }
  window.addEventListener("hashchange", function () { if (ALL.length) applyHash(false); });

  function updateSolved() { el.solved.textContent = t("rebusy.solved", { count: sessionSolved }); }

  function nextRebus() {
    if (!deck.length) return;
    pos++;
    if (pos >= deck.length) buildDeck();
    show();
    if (finePointer) el.input.focus({ preventScroll: true });
  }

  function setFilter(g) {
    setFilterPills(g);
    lastId = null;
    buildDeck();
    show();
  }

  /* --- перевірка --- */
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

  function lock() {
    finished = true;
    el.input.disabled = true; el.check.disabled = true; el.bulb.disabled = true; el.reveal.hidden = true;
  }

  function onSuccess() {
    lock();
    el.input.value = cur.answer;
    renderBoxes();
    if (!solvedSet[cur.id]) { solvedSet[cur.id] = 1; persist(); }
    sessionSolved++; updateSolved();
    el.seen.hidden = false;
    clearFeedback();
    var box = document.createElement("span");
    box.appendChild(GII18n.md(t("rebusy.correct", { answer: cur.answer, hint: cur.hint })));
    addMsg("good", box);
    el.next.classList.remove("ghost"); el.next.classList.add("next");
    if (!reduce) { el.card.classList.remove("pop"); void el.card.offsetWidth; el.card.classList.add("pop"); }
    confettiBurst();
    el.next.focus();
  }

  function onWrong() {
    clearStatus();
    addMsg("bad", t("rebusy.wrong"));
    if (!reduce) {
      el.row.classList.remove("shake"); void el.row.offsetWidth; el.row.classList.add("shake");
    }
    el.input.focus();
  }

  function onSubmit(e) {
    e.preventDefault();
    if (finished) return;
    var v = C.normalize(el.input.value);
    if (!v) { clearStatus(); addMsg("warn", t("rebusy.empty")); el.input.focus(); return; }
    if (v === C.normalize(cur.answer)) onSuccess(); else onWrong();
  }

  /* --- підказки --- */
  function onBulb() {
    if (finished) return;
    if (hintStep >= 2) return;
    hintStep++;
    clearFeedback();
    addMsg("hint", t("rebusy.hintMsg", { hint: cur.hint }));
    if (hintStep >= 2) {
      var m = addMsg("hint", t("rebusy.meaningsTitle"));
      var list = mk("div", "meanings");
      var any = false;
      cur.parts.forEach(function (p) {
        var k = C.kind(p);
        if (k === "pic" || k === "num") {
          any = true;
          list.appendChild(mk("span", "", t("rebusy.meaning", { symbol: k === "pic" ? p.pic : p.num, word: p.w })));
        }
      });
      if (any) m.appendChild(list);
      el.bulb.disabled = true;
      el.reveal.hidden = false;
    } else {
      el.bulbTxt.textContent = t("rebusy.hintMore");
    }
  }

  function onReveal() {
    if (finished) return;
    lock();
    el.input.value = cur.answer;
    renderBoxes();
    clearFeedback();
    var box = document.createElement("span");
    box.appendChild(GII18n.md(t("rebusy.revealed", { answer: cur.answer, hint: cur.hint })));
    addMsg("warn", box);
    el.next.classList.remove("ghost"); el.next.classList.add("next");
    el.next.focus();
  }

  /* --- події --- */
  el.form.addEventListener("submit", onSubmit);
  el.input.addEventListener("input", function () { if (cur) renderBoxes(); });
  el.bulb.addEventListener("click", onBulb);
  el.reveal.addEventListener("click", onReveal);
  el.next.addEventListener("click", nextRebus);
  el.row.addEventListener("animationend", function () { el.row.classList.remove("shake"); });
  /* кнопки фільтра: «Усі» і групи з content/rebusy/<мова>.json */
  function buildFilters() {
    var items = [{ id: "all", label: t("rebusy.filterAll") }].concat(GROUPS);
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

  GIData.loadJSON(ROOT + "content/rebusy/" + LANG + ".json").then(function (data) {
    ALL = data.rebuses || [];
    GROUPS = data.groups || [];
    GROUPS.forEach(function (g) { GRADE_LABEL[g.id] = g.label; });
    buildFilters();
    syncSummary();
    if (!applyHash(true)) { buildDeck(); show(); }
  }, function () { /* повідомлення про помилку вже показав GIData */ });
})();
