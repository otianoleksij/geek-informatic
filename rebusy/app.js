/* Ребуси: показ по одному у випадковому порядку, перевірка, підказки */
(function () {
  "use strict";
  var C = window.RebusCore, ALL = window.REBUSES || [];
  var LS_KEY = "geek-rebus-solved-v1";
  var GRADE_LABEL = { "1-4": "1–4 клас", "5-6": "5–6 клас", "7-9": "7–9 клас", "10-11": "10–11 клас" };
  var CONFETTI = ["#FFE45C", "#F08CA4", "#6FCB98", "#7FA3F5", "#B591F2", "#F0A96A"];

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    card: $("card"), counter: $("counter"), grade: $("grade"), seen: $("seen"), pieces: $("pieces"),
    form: $("form"), input: $("ans"), check: $("check"), row: $("row"), boxes: $("boxes"), lettersSr: $("lettersSr"),
    bulb: $("bulb"), bulbTxt: $("bulbTxt"), reveal: $("reveal"), next: $("next"),
    feedback: $("feedback"), solved: $("solved"), confetti: $("confetti")
  };
  try { $("yr").textContent = new Date().getFullYear(); } catch (e) {}

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* --- збереження --- */
  var solvedSet = {};
  try {
    var raw = window.localStorage.getItem(LS_KEY);
    if (raw) JSON.parse(raw).forEach(function (id) { solvedSet[id] = 1; });
  } catch (e) { solvedSet = {}; }
  function persist() {
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(Object.keys(solvedSet))); } catch (e) {}
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
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  var ORD = { 1: "перша", 2: "друга", 3: "третя", 4: "четверта", 5: "п’ята", 6: "шоста", 7: "сьома", 8: "восьма" };

  function ariaFor(p, kind) {
    var s = [kind === "num" ? "число " + p.num : "картинка"];
    if (p.rev) s.push("догори дриґом, читати навпаки");
    if (p.keep && p.keep.length) s.push("взяти літери за номерами " + p.keep.join(", "));
    if (p.l) s.push(p.l + " " + plural(p.l, "кома", "коми", "ком") + " зліва: прибрати стільки літер на початку");
    if (p.r) s.push(p.r + " " + plural(p.r, "кома", "коми", "ком") + " справа: прибрати стільки літер у кінці");
    (p.rep || []).forEach(function (r) { s.push("заміна: літеру " + r[0] + " на " + r[1]); });
    return s.join(", ");
  }

  function renderPiece(p, i) {
    var k = C.kind(p), tile;
    if (k === "txt") {
      tile = mk("div", "tile txt");
      var lab = p.t;
      if (p.x && p.x.length) lab += ", закреслені літери: " + p.x.map(function (n) { return ORD[n] || n; }).join(", ");
      tile.setAttribute("role", "img");
      tile.setAttribute("aria-label", "літери " + lab);
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
      rm.title = "Перевернута картинка: читай навпаки";
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
    el.boxes.appendChild(mk("span", "count", n + " " + plural(n, "літера", "літери", "літер")));
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
    hintStep = 0; finished = false;
    el.pieces.textContent = "";
    cur.parts.forEach(function (p, i) { el.pieces.appendChild(renderPiece(p, i)); });
    el.counter.textContent = "Ребус " + (pos + 1) + " з " + deck.length;
    el.grade.textContent = GRADE_LABEL[cur.g] || cur.g;
    el.seen.hidden = !solvedSet[cur.id];
    el.input.disabled = false; el.input.value = "";
    el.check.disabled = false;
    el.bulb.disabled = false; el.bulbTxt.textContent = "Підказка";
    el.reveal.hidden = true;
    el.next.classList.remove("next"); el.next.classList.add("ghost");
    el.row.classList.remove("shake");
    el.card.classList.remove("pop");
    clearFeedback();
    el.lettersSr.textContent = "У відповіді " + Array.from(C.normalize(cur.answer)).length + " " + plural(Array.from(C.normalize(cur.answer)).length, "літера", "літери", "літер");
    renderBoxes();
    updateSolved();
  }
  function updateSolved() { el.solved.textContent = "Розгадано: " + sessionSolved; }

  function nextRebus() {
    if (!deck.length) return;
    pos++;
    if (pos >= deck.length) buildDeck();
    show();
    if (finePointer) el.input.focus({ preventScroll: true });
  }

  function setFilter(g) {
    filter = g;
    Array.prototype.forEach.call(document.querySelectorAll(".pill"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-g") === g ? "true" : "false");
    });
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
    var strong = mk("strong", "", cur.answer);
    box.appendChild(document.createTextNode("Правильно! Це "));
    box.appendChild(strong);
    box.appendChild(document.createTextNode(". " + cur.hint));
    addMsg("good", box);
    el.next.classList.remove("ghost"); el.next.classList.add("next");
    if (!reduce) { el.card.classList.remove("pop"); void el.card.offsetWidth; el.card.classList.add("pop"); }
    confettiBurst();
    el.next.focus();
  }

  function onWrong() {
    clearStatus();
    addMsg("bad", "Ще не те. Спробуй ще раз");
    if (!reduce) {
      el.row.classList.remove("shake"); void el.row.offsetWidth; el.row.classList.add("shake");
    }
    el.input.focus();
  }

  function onSubmit(e) {
    e.preventDefault();
    if (finished) return;
    var v = C.normalize(el.input.value);
    if (!v) { clearStatus(); addMsg("warn", "Спочатку впиши слово."); el.input.focus(); return; }
    if (v === C.normalize(cur.answer)) onSuccess(); else onWrong();
  }

  /* --- підказки --- */
  function onBulb() {
    if (finished) return;
    if (hintStep >= 2) return;
    hintStep++;
    clearFeedback();
    addMsg("hint", "💡 " + cur.hint);
    if (hintStep >= 2) {
      var m = addMsg("hint", "Що означають картинки:");
      var list = mk("div", "meanings");
      var any = false;
      cur.parts.forEach(function (p) {
        var k = C.kind(p);
        if (k === "pic" || k === "num") {
          any = true;
          list.appendChild(mk("span", "", (k === "pic" ? p.pic : p.num) + " — " + p.w));
        }
      });
      if (any) m.appendChild(list);
      el.bulb.disabled = true;
      el.reveal.hidden = false;
    } else {
      el.bulbTxt.textContent = "Ще підказка";
    }
  }

  function onReveal() {
    if (finished) return;
    lock();
    el.input.value = cur.answer;
    renderBoxes();
    clearFeedback();
    var box = document.createElement("span");
    box.appendChild(document.createTextNode("Відповідь: "));
    box.appendChild(mk("strong", "", cur.answer));
    box.appendChild(document.createTextNode(". " + cur.hint));
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
  Array.prototype.forEach.call(document.querySelectorAll(".pill"), function (b) {
    b.addEventListener("click", function () { setFilter(b.getAttribute("data-g")); });
  });

  if (!C || !ALL.length) {
    el.pieces.textContent = "Не вдалося завантажити ребуси.";
  } else {
    buildDeck();
    show();
  }
})();
