/* Агенти КіберЩиту — інтерфейс вебквесту.
   Місії читаються з content/agenty-kibershchytu/<lang>.json, правила живуть у quest-core.js,
   усі рядки інтерфейсу беруться зі словника (T("…")). Вміст малюється DOM-методами: createElement, textContent, GII18n.md. */
(function () {
  "use strict";
  var Core = window.QuestCore;
  var NS = "agenty-kibershchytu.";
  function T(key, params) { return t(NS + key, params); }
  var md = GII18n.md;

  var ROOT = document.documentElement.getAttribute("data-root") || "";
  var LANG = GII18n.lang;
  var STORE_ID = "agenty-kibershchytu:v4", OLD_STORE_ID = "agenty-kibershchytu:v3", LEGACY_KEY = "kiberquest-v3", SLUG = "agenty-kibershchytu";
  var M = [], WORD = "", TOTAL = 0, S = null, resumeTo = null;
  var view = document.getElementById("view");
  var reduced = false;
  try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* ---------- DOM-помічники ---------- */
  function add(node, kids) {
    if (kids === undefined || kids === null || kids === false) return node;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (k) {
      if (k === undefined || k === null || k === false) return;
      node.appendChild(typeof k === "object" ? k : document.createTextNode(String(k)));
    });
    return node;
  }
  /* el("div", "клас", [діти], {атрибут: значення}); діти — вузли або рядки (рядок стає текстом) */
  function el(tag, cls, kids, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k] === true ? "" : attrs[k]); });
    return add(e, kids);
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function on(node, ev, fn) { node.addEventListener(ev, fn); return node; }
  function byId(id) { return document.getElementById(id); }
  function button(cls, label, fn, attrs) {
    var b = el("button", cls, label, attrs || {});
    if (!attrs || !attrs.type) b.type = "button";
    return on(b, "click", fn);
  }

  /* ---------- SVG-ілюстрації інтерфейсу (константи без тексту; контентні малюнки лежать у content/…/scenes) ---------- */
  var svgCache = {};
  function svgNode(markup) {
    if (!svgCache[markup]) {
      var d = new DOMParser().parseFromString(markup.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" '), "image/svg+xml");
      svgCache[markup] = d.documentElement;
    }
    return document.importNode(svgCache[markup], true);
  }
  var ICONS = {
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/></svg>',
    hook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v11a5 5 0 0 1-10 0v-2l3 2"/><circle cx="14" cy="3" r="1.2"/><path d="M18 8l3-2M18 12h3"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><circle cx="12" cy="11" r="2"/><path d="M12 13v3"/></svg>',
    steps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="8" cy="8" rx="2.6" ry="4"/><path d="M6.5 15h3"/><ellipse cx="16" cy="12" rx="2.6" ry="4"/><path d="M14.5 19h3"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M12 13.5s-3-1.8-3-3.8a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2-3 3.8-3 3.8z"/></svg>',
    bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="8" width="10" height="12" rx="5"/><path d="M9 8a3 3 0 0 1 6 0M12 12v8M3 13h4M17 13h4M4 7l3 2M20 7l-3 2M4 19l3-2M20 19l-3-2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M8 9h5M8 12h3"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/><path d="M12 7.5l3 1.2v2c0 1.8-1.3 3-3 3.5-1.7-.5-3-1.7-3-3.5v-2z"/></svg>',
    file: '<svg viewBox="0 0 30 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 2h16l8 8v24H3z"/><path d="M19 2v8h8"/></svg>',
    badge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.5l8 3v6.2c0 4.9-3.4 8.3-8 9.8-4.6-1.5-8-4.9-8-9.8V5.5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>'
  };
  var LOCK_OK = '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="8" rx="1.5" fill="#17905A"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#17905A" stroke-width="1.8" fill="none"/></svg>';
  var LOCK_NO = '<svg viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="8" rx="1.5" fill="#CF3F37"/><path d="M5 7V5a3 3 0 0 1 6 0" stroke="#CF3F37" stroke-width="1.8" fill="none"/><path d="M1 15L15 1" stroke="#CF3F37" stroke-width="1.6"/></svg>';
  var VILLAIN = '<svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="78" style="fill:var(--accent-soft)"/><path d="M80 18c-30 0-50 24-50 56v44h100V74c0-32-20-56-50-56z" fill="#24324D"/><ellipse cx="80" cy="76" rx="29" ry="33" fill="#F5F8FF"/><path d="M62 70l13 5M98 70l-13 5" stroke="#14213A" stroke-width="5" stroke-linecap="round"/><path d="M68 94q12 7 24 0" stroke="#14213A" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M50 30l-6-12M110 30l6-12" stroke="#24324D" stroke-width="5" stroke-linecap="round"/><rect x="30" y="108" width="100" height="40" rx="6" fill="#2D55E0"/><path d="M48 122h20M48 132h34M96 120l8 8-8 8" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
  /* картинки для чату за id із поля image */
  var CHAT_IMAGES = {
    "photo-fall": '<svg viewBox="0 0 170 100"><rect width="170" height="100" fill="#BFE0FF"/><rect y="70" width="170" height="30" fill="#7FBF6A"/><circle cx="48" cy="64" r="9" fill="#F5C9A6"/><path d="M56 66h40M96 66l14-10M96 66l14 8M70 66l-6-14M82 66l4-14" stroke="#24324D" stroke-width="5" stroke-linecap="round"/><circle cx="138" cy="36" r="11" fill="#FFC23D"/><path d="M128 30l20 12M148 30l-20 12" stroke="#B5523B" stroke-width="1.5"/></svg>'
  };

  /* ---------- Контентні малюнки (SVG-файли) ---------- */
  var sceneCache = {};
  function showLoadError() {
    var le = byId("loadError");
    if (le) { le.textContent = t("common.loadError"); le.hidden = false; le.removeAttribute("hidden"); }
  }
  /* Знімаємо з чужого SVG усе, що виконується: скрипти, foreignObject, on*-обробники, javascript:-посилання */
  function cleanSvg(root) {
    var bad = root.querySelectorAll("script,foreignObject,iframe,object,embed");
    Array.prototype.forEach.call(bad, function (n) { n.parentNode.removeChild(n); });
    Array.prototype.forEach.call(root.querySelectorAll("*"), function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || (/href$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
      });
    });
    return root;
  }
  function loadScene(name) {
    if (!sceneCache[name]) {
      sceneCache[name] = fetch(ROOT + "content/agenty-kibershchytu/scenes/" + LANG + "/" + name + ".svg").then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      }).then(function (txt) {
        var d = new DOMParser().parseFromString(txt, "image/svg+xml");
        if (d.getElementsByTagName("parsererror").length || d.documentElement.nodeName !== "svg") throw new Error("SVG");
        return cleanSvg(d.documentElement);
      });
    }
    return sceneCache[name].then(function (root) { return document.importNode(root, true); });
  }

  /* ---------- Стан і сховище ---------- */
  /* Ім’я і клас учня не зберігаються (персональні дані) — лише в пам’яті, поки відкрита сторінка. */
  function loadState() {
    if (!window.GIStorage) return null;
    var s = Core.sanitize(GIStorage.load(STORE_ID), M);
    if (s) return s;
    /* v3 (номери місій і завдань) → v4 (id) */
    var old = GIStorage.load(OLD_STORE_ID, LEGACY_KEY);
    s = old ? Core.migrateV3(old, M) : null;
    if (s) { GIStorage.save(STORE_ID, Core.publicState(s)); GIStorage.remove(OLD_STORE_ID); }
    return s;
  }
  function syncSummary() { try { if (window.GIStorage) GIStorage.setSummary(SLUG, S ? S.done.length : 0, M.length); } catch (e) {} }
  function save() {
    try { if (window.GIStorage) GIStorage.save(STORE_ID, Core.publicState(S)); } catch (e) {}
    syncSummary();
  }
  function letterOf(m) { return Core.letterOf(S, m); }
  function mission() { return M[Core.missionIndex(M, S.cur)]; }
  function elapsed() { return Core.elapsed(S, Date.now()); }

  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  /* ---------- Маршрутизація ----------
     hash відповідає екрану: #map, #<id місії>, #final, #cert; start і resume — без hash. Старе #mission-N працює.
     go(screen)           — новий запис історії, якщо hash змінився (Назад повертає на попередній екран);
     go(screen,"replace") — той самий запис історії (start, resume, посвідчення після слова). */
  function curHash() { return (location.hash || "").replace(/^#/, ""); }
  function syncHash(screen, mode) {
    var h = Core.hashFor(screen, S);
    if (h === curHash()) return;
    try {
      if (mode === "replace" || mode === "route" || !h || screen === "resume") history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
      else history.pushState(null, "", "#" + h);
    } catch (e) {}
  }
  function focusHead() {
    try { var h = view.querySelector("h1,h2,.qtext"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } } catch (e) {}
  }
  function go(screen, mode) {
    clearTimers(); S.screen = screen; save(); syncHash(screen, mode); render();
    if (mode !== "route") focusHead();
    if (mode === "route") window.scrollTo(0, 0);
    else { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); } }
  }
  window.addEventListener("hashchange", function () {
    if (!S || S.screen === "resume") return;           // діалог «Продовжити?» не чіпаємо
    var h = curHash(), legacy = Core.legacyHash(h, M);
    if (legacy !== null) { h = legacy; try { history.replaceState(null, "", "#" + h); } catch (e) {} }
    if (h === Core.hashFor(S.screen, S) && S.started) return;
    var r = Core.resolveHash(h, M, S);
    if (r.cur !== undefined) Core.startMission(S, r.cur, M);
    go(r.screen, "route");
  });

  /* ---------- Шапка ---------- */
  var timerEl = byId("timer");
  function header() {
    var k = clear(byId("keys"));
    M.forEach(function (m, i) {
      var got = Core.isDone(S, m.id);
      add(k, el("div", "key" + (got ? " got" : ""), got ? letterOf(m) : "?", { title: T("keyTitle", { n: i + 1 }) }));
    });
    byId("pts").textContent = Core.score(S);
    timerEl.textContent = Core.fmtTime(elapsed());
  }
  setInterval(function () { if (S) timerEl.textContent = Core.fmtTime(elapsed()); }, 1000);

  function render() {
    header();
    byId("restart").hidden = !S.started;
    clear(view);
    var screens = { start: startScreen, resume: resumeScreen, map: mapScreen, brief: briefScreen, task: taskScreen, done: doneScreen, final: finalScreen, cert: certScreen };
    (screens[S.screen] || startScreen)();
  }

  /* ---------- Екрани ---------- */
  function nameField(id, label, placeholder, maxlen, cls, value) {
    var input = el("input", "", null, { type: "text", id: id, autocomplete: "off", maxlength: maxlen, placeholder: placeholder, value: value || "" });
    return el("label", "fld" + (cls ? " " + cls : ""), [label, input], { "for": id });
  }
  function nameValid(input) { return input.value.trim().length >= 2; }

  function startScreen() {
    var nameLabel = nameField("fname", T("nameLabel"), T("namePlaceholder"), 40, "", S.name);
    var clsLabel = nameField("fcls", T("clsLabel"), T("clsPlaceholder"), 8, "cls", S.cls);
    var startBtn = el("button", "btn", T("startBtn"), { id: "startBtn", type: "submit", disabled: true });
    var form = el("form", "panel stack", [
      el("h3", "", T("regTitle")),
      el("div", "row", [nameLabel, clsLabel]),
      el("div", "row", [startBtn, el("span", "muted t14", T("startNote"))])
    ], { id: "reg" });
    add(view, [
      el("section", "hero", [
        el("div", "stack", [
          el("div", "eyebrow", T("eyebrow")),
          el("h1", "", el("span", "hl", T("title"))),
          el("p", "", md(T("startLead", { count: M.length })))
        ]),
        el("div", "villain", [svgNode(VILLAIN), el("span", "", T("villain"))])
      ]),
      el("div", "how", [
        el("div", "", [el("b", "", T("howMissions", { count: M.length })), T("howMissionsText")]),
        el("div", "", [el("b", "", T("howKeys", { count: M.length })), T("howKeysText")]),
        el("div", "", [el("b", "", T("howWord")), T("howWordText")])
      ]),
      form
    ]);
    var n = nameLabel.querySelector("input"), c = clsLabel.querySelector("input");
    function upd() { startBtn.disabled = !nameValid(n); }
    on(n, "input", upd); upd();
    on(form, "submit", function (e) {
      e.preventDefault(); if (startBtn.disabled) return;
      S.name = n.value.trim(); S.cls = c.value.trim();
      S.started = Date.now(); S.letters = Core.lettersById(M, Core.makeLetters(WORD)); go("map");
    });
  }

  function resumeScreen() {
    var h = el("h2", "", T("resumeTitle"), { id: "rh", tabindex: "-1" });
    add(view, el("section", "panel stack", [
      el("div", "eyebrow", T("resumeEyebrow")), h,
      el("p", "", md(T("resumeInfo", { done: S.done.length, total: M.length, points: Core.score(S) }))),
      el("p", "muted t15", T("resumeHint")),
      el("div", "row", [
        button("btn", T("resumeContinue"), function () { go(resumeTo || "map"); }),
        button("btn ghost", T("resumeNew"), resetAll)
      ])
    ]));
    h.focus();
  }

  function mapScreen() {
    var open = Core.nextOpen(M, S), rows = [];
    M.forEach(function (m, i) {
      var done = Core.isDone(S, m.id), can = i === open;
      var chip = done ? el("span", "chip ok", T("chipKey", { letter: letterOf(m) })) : can ? el("span", "chip go", T("chipStart")) : el("span", "chip lock", T("chipLocked"));
      var inner = [
        el("span", "ic", svgNode(ICONS[m.icon])),
        el("span", "t", [el("small", "", T("missionN", { n: i + 1 })), el("span", "", m.title)]),
        chip
      ];
      if (can) rows.push(button("mrow", inner, function () { Core.startMission(S, m.id, M); go("brief"); }));
      else rows.push(el("div", "mrow " + (done ? "done" : "locked"), inner));
    });
    add(view, [
      el("div", "stack", [
        el("div", "eyebrow", S.name ? T("agentNamed", { name: S.name }) : T("agent")),
        el("h2", "", T("mapTitle")),
        el("p", "muted", T("mapLead"))
      ]),
      el("div", "map", rows),
      open < 0 ? button("btn", T("toFinal"), function () { go("final"); }) : null
    ]);
  }

  function briefScreen() {
    var m = mission(), i = Core.missionIndex(M, m.id);
    add(view, [
      el("div", "mhead", [
        el("span", "ic", svgNode(ICONS[m.icon])),
        el("div", "stack", [el("div", "eyebrow", T("missionOf", { n: i + 1, total: M.length })), el("h2", "", m.title)])
      ]),
      el("p", "", md(m.intro)),
      el("section", "panel brief stack", [
        el("h3", "", T("briefTitle")),
        el("ul", "", m.facts.map(function (f) { return el("li", "", el("span", "", md(f))); }))
      ]),
      el("div", "row", [
        button("btn", T("toTasks", { count: m.tasks.length }), function () { S.task = m.tasks[0].id; go("task"); }),
        button("btn ghost", T("toMap"), function () { go("map"); })
      ])
    ]);
  }

  function taskScreen() {
    var m = mission(), ti = Core.taskIndex(m, S.task), tk = m.tasks[ti], mi = Core.missionIndex(M, m.id);
    var area = el("div", "stack"), fb = el("div", "stack");
    add(view, [
      el("div", "stack", [
        el("div", "eyebrow", T("taskCrumb", { n: mi + 1, title: m.title, task: ti + 1, total: m.tasks.length })),
        el("p", "qtext", md(tk.q))
      ]),
      area, fb
    ]);
    /* finish: body — вузол, фрагмент або рядок; бали зараховуються лише з першого проходження */
    function finish(pts, ok, title, body) {
      var got = Core.recordScore(S, m.id, tk.id, pts);
      save(); header();
      var last = ti + 1 >= m.tasks.length;
      var next = button("btn", last ? T("finishMission") : T("nextTask"), function () {
        go(Core.nextStep(S, m));
      });
      clear(fb);
      add(fb, [
        el("div", "fb " + (ok ? "ok" : "bad"), [
          el("h3", "", title),
          body ? el("div", "", body) : null,
          el("div", "muted t14", T("fbPoints", { got: got, max: Core.maxPts(tk) }))
        ]),
        el("div", "row", next)
      ]);
      try { next.focus({ preventScroll: true }); } catch (e) {}
      fb.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
    }
    var renderers = { password: tPassword, choice: tChoice, multi: tMulti, classify: tClassify, hotspots: tHotspots, scene: tScene, privacy: tPrivacy, chat: tChat, memory: tMemory, order: tOrder, wordsearch: tWordsearch };
    renderers[tk.type](tk, area, finish);
  }

  /* ---------- Типи завдань ---------- */
  function optLetter(i) { return T("optionLetters").charAt(i); }

  /* Макет вікна браузера: адреса, замочок за https, сторінка входу зі спільного task.browserPage */
  function browserView(t, o) {
    var secure = /^https:/i.test(o.url), p = t.browserPage;
    var page = [];
    if (o.banner) page.push(el("div", "bm-ban", o.banner));
    page.push(el("div", "bm-logo", p.logo));
    p.fields.forEach(function (f) { page.push(el("div", "bm-in", f)); });
    page.push(el("div", "bm-btn", p.button));
    return el("div", "bm", [
      el("div", "bm-bar", [svgNode(secure ? LOCK_OK : LOCK_NO), el("span", "", o.url)]),
      el("div", "bm-page", page)
    ]);
  }

  function tChoice(t, area, finish) {
    var btns = t.options.map(function (o, i) {
      var b = el("button", "opt" + (o.view ? " card" : ""), [
        el("span", "mark", optLetter(i)),
        o.view === "browser" ? browserView(t, o) : el("span", "", md(o.text))
      ], { type: "button" });
      return on(b, "click", function () {
        var ok = Core.choiceCorrect(t, i);
        btns.forEach(function (x, j) {
          x.disabled = true;
          if (t.options[j].correct) x.classList.add("right"); else if (j === i) x.classList.add("wrong");
        });
        finish(ok ? 1 : 0, ok, T(ok ? "right" : "notQuite"), md(t.explain));
      });
    });
    add(area, el("div", "opts" + (t.layout === "grid" ? " grid" : ""), btns));
  }

  function tMulti(t, area, finish) {
    var sel = {}, chk = button("btn", T("check"), check, { disabled: true });
    var btns = t.options.map(function (o, i) {
      var mark = el("span", "mark");
      var b = el("button", "opt multi", [mark, el("span", "", md(o.text))], { type: "button", "aria-pressed": "false" });
      return on(b, "click", function () {
        sel[i] = !sel[i]; b.classList.toggle("sel", sel[i]); b.setAttribute("aria-pressed", String(!!sel[i]));
        mark.textContent = sel[i] ? "✓" : "";
        chk.disabled = !Object.keys(sel).some(function (k) { return sel[k]; });
      });
    });
    var row = el("div", "row", chk);
    add(area, [el("div", "opts", btns), row]);
    function check() {
      var picked = [];
      btns.forEach(function (b, i) { if (sel[i]) picked.push(i); });
      var ok = Core.multiCorrect(t, picked);
      btns.forEach(function (b, i) {
        var mark = b.firstChild;
        b.disabled = true; b.classList.remove("sel");
        if (t.options[i].correct) { b.classList.add("right"); mark.textContent = "✓"; }
        else if (sel[i]) { b.classList.add("wrong"); mark.textContent = "✗"; }
      });
      row.parentNode.removeChild(row);
      finish(ok ? 1 : 0, ok, T(ok ? "right" : "notQuite"), ok ? md(t.explain) : md(t.explain + " " + T("greenMarked")));
    }
  }

  function tClassify(t, area, finish) {
    var ans = {}, rows = [], files = t.kind === "file";
    var left = el("span", "muted t14"), chk = button("btn", T("check"), check, { disabled: true });
    t.items.forEach(function (it, i) {
      var segBtns = t.labels.map(function (l, v) {
        return on(el("button", "", l, { type: "button" }), "click", function () {
          ans[i] = v;
          segBtns.forEach(function (x) { x.classList.toggle("sel", x === segBtns[v]); });
          upd();
        });
      });
      var ex = el("div", "ex", "", { hidden: true });
      var row = el("div", "ci", [
        el("div", "msg", [
          files ? svgNode(ICONS.file) : null,
          el("div", "", [it.from ? el("div", "from", it.from) : null, el("div", "txt" + (files ? " file" : ""), it.text)])
        ]),
        el("div", "seg", segBtns, { role: "group", "aria-label": T("segAria") }),
        ex
      ]);
      rows.push({ row: row, seg: segBtns, ex: ex });
    });
    var bar = el("div", "row", [chk, left]);
    add(area, [el("div", "cls", rows.map(function (r) { return r.row; })), bar]);
    function upd() {
      var n = t.items.length - Object.keys(ans).length;
      chk.disabled = n > 0; left.textContent = n > 0 ? T("leftToSort", { count: n }) : "";
    }
    upd();
    function check() {
      var res = Core.classifyResult(t, ans);
      t.items.forEach(function (it, i) {
        var r = rows[i], ok = ans[i] === it.answer;
        r.row.classList.add(ok ? "right" : "wrong");
        r.seg.forEach(function (x) { x.disabled = true; });
        if (t.showAll || !ok) {
          r.ex.textContent = (ok ? "" : T("correctAnswer", { label: t.labels[it.answer] }) + " ") + it.explain;
          r.ex.hidden = false;
        }
      });
      bar.parentNode.removeChild(bar);
      finish(res.pts, res.ok, res.all ? T("flawless") : T("classifyScore", { right: res.right, total: res.total }), res.all ? T("classifyAllOk") : T("classifySeeRed"));
    }
  }

  function tHotspots(t, area, finish) {
    var total = Core.countClues(t), found = 0, wrong = 0, ended = false, parts = [], btns = [];
    function part(p) {
      var b = el("button", "hs" + (p.mono ? " mono-sm" : ""), p.text, { type: "button" });
      parts.push(p); btns.push(b);
      return on(b, "click", function () {
        if (ended || b.classList.contains("found") || b.classList.contains("nope")) return;
        if (p.clue) { found++; b.classList.add("found"); add(b, el("sup", "", String(found))); msg.textContent = T("hsFound", { clue: p.clue }); }
        else { wrong++; b.classList.add("nope"); msg.textContent = T("hsNope"); }
        upd();
        if (found === total) end(false);
      });
    }
    function joined(list) {
      var out = [];
      list.forEach(function (p, i) { if (i) out.push(" "); out.push(part(p)); });
      return out;
    }
    var head = t.head.map(function (r) { return el("div", "", [el("span", "l", r.label), el("span", "", joined(r.parts))]); });
    var body = t.body.map(function (r) { return el("p", "", joined(r)); });
    var stat = el("span", "lvl"), msg = el("div", "muted msgline", "", { "aria-live": "polite" });
    var giveup = button("btn ghost small", T("giveUp"), function () { end(true); });
    add(area, [
      el("div", "mail", [el("div", "mail-head", head), el("div", "mail-body", body)]),
      el("div", "row", [stat, giveup]), msg
    ]);
    function upd() { stat.textContent = T("hsStat", { found: found, total: total, wrong: wrong }); }
    upd();
    function end(gaveUp) {
      ended = true;
      btns.forEach(function (b, i) { b.disabled = true; if (parts[i].clue && !b.classList.contains("found")) b.classList.add("missed"); });
      giveup.parentNode.removeChild(giveup); msg.textContent = "";
      var res = Core.searchResult(found, wrong, gaveUp);
      var list = el("ol", "clues", parts.filter(function (p) { return p.clue; }).map(function (p) { return el("li", "", p.clue); }));
      finish(res.pts, res.ok, T(gaveUp ? "hsGaveTitle" : "hsDoneTitle"), [(gaveUp ? T("hsMissed") + " " : "") + T("hsAll", { what: t.listTitle }), list]);
    }
  }

  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function markSpot(svg, g, label, missed) {
    var b = g.getBBox(), grp = svgEl("g", { "pointer-events": "none", transform: g.getAttribute("transform") || "" });
    grp.appendChild(svgEl("rect", { x: b.x - 7, y: b.y - 7, width: b.width + 14, height: b.height + 14, rx: 10, fill: missed ? "rgba(207,63,55,.10)" : "rgba(255,194,61,.22)", stroke: missed ? "#CF3F37" : "#FFB000", "stroke-width": 4, "stroke-dasharray": missed ? "10 6" : "none" }));
    var cx = Math.max(16, b.x - 4), cy = Math.max(16, b.y - 4);
    grp.appendChild(svgEl("circle", { cx: cx, cy: cy, r: 14, fill: missed ? "#CF3F37" : "#14213A", stroke: "#FFFFFF", "stroke-width": 2.5 }));
    var tx = svgEl("text", { x: cx, y: cy + 5, "text-anchor": "middle", "font-size": 15, "font-weight": 800, fill: "#FFFFFF" });
    tx.textContent = label; grp.appendChild(tx);
    svg.appendChild(grp);
  }
  function tScene(t, area, finish) {
    var total = t.spots.length, found = [], wrong = 0, ended = false, tried = {}, svg = null;
    var box = el("div", "scene"), stat = el("span", "lvl"), msg = el("div", "muted msgline", T("sceneHint"), { "aria-live": "polite" });
    var list = el("ol", "slist"), giveup = button("btn ghost small", T("giveUp"), function () { if (svg) end(true); });
    add(area, [box, el("div", "row", [stat, giveup]), msg, list]);
    function upd() { stat.textContent = T("hsStat", { found: found.length, total: total, wrong: wrong }); }
    upd();
    function spotIndex(id) {
      for (var i = 0; i < t.spots.length; i++) if (t.spots[i].id === id) return i;
      return -1;
    }
    function end(gaveUp) {
      ended = true; box.classList.add("ended");
      if (giveup.parentNode) giveup.parentNode.removeChild(giveup);
      t.spots.forEach(function (s, i) {
        if (found.indexOf(i) < 0) {
          markSpot(svg, svg.querySelector('[data-spot="' + s.id + '"]'), "!", true);
          add(list, el("li", "miss", md(T("sceneMissedItem", { name: s.name, why: s.why }))));
        }
      });
      msg.textContent = "";
      var res = Core.searchResult(found.length, wrong, gaveUp);
      finish(res.pts, res.ok, T(gaveUp ? "hsGaveTitle" : "sceneDoneTitle"), T(gaveUp ? "sceneGaveText" : "sceneDoneText"));
    }
    loadScene(t.picture).then(function (node) {
      svg = node; box.appendChild(svg);
      on(svg, "click", function (e) {
        if (ended) return;
        var spot = e.target.closest("[data-spot]"), decoy = e.target.closest("[data-decoy]");
        if (spot) {
          var i = spotIndex(spot.getAttribute("data-spot"));
          if (i < 0 || found.indexOf(i) > -1) return;
          found.push(i); markSpot(svg, spot, String(found.length), false);
          var s = t.spots[i];
          add(list, el("li", "", md(T("sceneItem", { name: s.name, why: s.why }))));
          msg.textContent = T("sceneFound", { name: s.name });
        } else if (decoy) {
          var d = decoy.getAttribute("data-decoy");
          msg.textContent = t.decoys[d] || "";
          if (!tried[d]) { tried[d] = 1; wrong++; }
        } else {
          msg.textContent = T("sceneMiss");
        }
        upd();
        if (found.length === total) end(false);
      });
    }, function () { showLoadError(); });
  }

  function tPrivacy(t, area, finish) {
    var st = Core.privacyStart(t), rows = [];
    var pvl = el("div"), pvc = el("div", "pv-count");
    var sets = el("section", "panel sets", el("div", "eyebrow", t.panel));
    t.sets.forEach(function (s, i) {
      var why = el("small", "why", "", { hidden: true });
      var sw = el("button", "sw", null, { type: "button", role: "switch", "aria-labelledby": "sl" + i, "aria-checked": String(st[i]) });
      on(sw, "click", function () { st[i] = !st[i]; sw.setAttribute("aria-checked", String(st[i])); draw(); });
      var row = el("div", "set", [el("div", "", [el("b", "", s.label, { id: "sl" + i }), el("small", "", s.sub), why]), sw]);
      rows.push({ row: row, sw: sw, why: why });
      sets.appendChild(row);
    });
    var chkRow = el("div", "row", button("btn", t.saveBtn, check));
    add(area, [
      el("div", "priv", [
        sets,
        el("section", "panel pv", [
          el("div", "eyebrow", t.pvTitle),
          el("div", "pv-top", [el("div", "pv-av", t.who.av), el("div", "", [el("b", "", t.who.name), el("div", "muted t13", t.who.sub)])]),
          pvl, pvc
        ])
      ]),
      chkRow
    ]);
    function draw() {
      var shown = t.sets.filter(function (s, i) { return Core.privacyExposed(s, st[i]); });
      clear(pvl);
      if (shown.length) add(pvl, el("ul", "", shown.map(function (s) { return el("li", "", s.show); })));
      else add(pvl, el("div", "safe", t.safeMsg));
      pvc.textContent = T("privCount", { label: t.countLbl, n: shown.length, total: t.sets.length });
      pvc.className = "pv-count " + (shown.length ? "bad" : "ok");
    }
    draw();
    function check() {
      var res = Core.privacyResult(t, st);
      rows.forEach(function (r, i) {
        var ok = !Core.privacyExposed(t.sets[i], st[i]);
        r.sw.disabled = true; r.row.classList.add(ok ? "right" : "wrong");
        if (!ok) { r.why.textContent = t.sets[i].why; r.why.hidden = false; }
      });
      chkRow.parentNode.removeChild(chkRow);
      finish(res.pts, res.ok, res.all ? t.okTitle : T("privScore", { right: res.right, total: res.total }), res.all ? t.okText : T("privFix"));
    }
  }

  function tChat(t, area, finish) {
    var log = el("div", "chat-log", null, { "aria-live": "polite" }), ask = el("div", "chat-ask", null, { hidden: true });
    add(area, el("div", "chat", [
      el("div", "chat-top", [el("div", "pv-av", t.avatar), el("div", "", [el("b", "", t.title), el("div", "muted t13", t.sub)])]),
      log, ask
    ]));
    var step = 0, pts = 0, firstTry = true, D = reduced ? 150 : 850;
    function bubble(kids, cls) { add(log, el("div", "bub" + (cls ? " " + cls : ""), kids)); log.scrollTop = log.scrollHeight; }
    function msgKids(m) { return [el("small", "", m.from), m.text, m.image && CHAT_IMAGES[m.image] ? svgNode(CHAT_IMAGES[m.image]) : null]; }
    function typing(cb) {
      var x = el("div", "typing", T("typing")); log.appendChild(x); log.scrollTop = log.scrollHeight;
      later(function () { if (x.parentNode) x.parentNode.removeChild(x); cb(); }, D);
    }
    function playMsgs(arr, cb) {
      var k = 0;
      (function nx() { if (k >= arr.length) { cb(); return; } var m = arr[k++]; typing(function () { bubble(msgKids(m)); nx(); }); })();
    }
    function run() {
      if (step >= t.script.length) {
        ask.hidden = true;
        var total = Core.chatAsks(t).length;
        finish(pts, pts === total, pts === total ? t.outro.best : t.outro.ok, t.outro.text + " " + T("chatFirstTry", { pts: pts, total: total }));
        return;
      }
      var s = t.script[step];
      if (s.system) { bubble(s.system, "sys"); step++; later(run, D / 2); return; }
      if (s.from) { typing(function () { bubble(msgKids(s)); step++; run(); }); return; }
      if (s.ask) {
        firstTry = true; ask.hidden = false; clear(ask);
        add(ask, el("b", "", s.ask));
        s.options.forEach(function (o, i) {
          var b = button("opt", [el("span", "mark", optLetter(i)), el("span", "", o.text)], function () {
            if (o.correct) {
              if (firstTry) pts++;
              ask.hidden = true; clear(ask);
              bubble([el("small", "", T("you")), o.text], "me");
              step++;
              playMsgs(o.reply || [], function () { later(run, D / 2); });
            } else {
              firstTry = false; b.disabled = true; b.classList.add("wrong");
              bubble([el("small", "", T("you")), o.text], "me");
              bubble([el("b", "", T("stop")), " ", o.note], "note");
            }
          });
          ask.appendChild(b);
        });
        log.scrollTop = log.scrollHeight;
      }
    }
    run();
  }

  function tMemory(t, area, finish) {
    var cards = Core.memoryCards(t), open = [], moves = 0, matched = 0, busy = false;
    var stat = el("span", "lvl");
    var btns = cards.map(function (c, i) {
      var b = el("button", "mc", el("div", "mc-in", [el("div", "mc-b", svgNode(ICONS.badge)), el("div", "mc-f" + (c.term ? " term" : ""), c.text)]), { type: "button", "aria-label": T("cardClosed") });
      return on(b, "click", function () {
        if (busy || b.classList.contains("open") || b.classList.contains("matched")) return;
        b.classList.add("open"); b.setAttribute("aria-label", c.text); open.push(i);
        if (open.length < 2) return;
        moves++;
        if (cards[open[0]].pair === cards[open[1]].pair) {
          open.forEach(function (k) { btns[k].classList.remove("open"); btns[k].classList.add("matched"); });
          open = []; matched++; upd();
          if (matched === t.pairs.length) {
            var pts = Core.memoryPoints(moves), st = Core.MEMORY_STEPS;
            later(function () { finish(pts, pts >= 2, T("memDoneTitle"), T("memDoneText", { moves: moves, a: st[0], b: st[1], c: st[2] })); }, 400);
          }
        } else {
          busy = true; upd();
          later(function () { open.forEach(function (k) { btns[k].classList.remove("open"); btns[k].setAttribute("aria-label", T("cardClosed")); }); open = []; busy = false; }, 1000);
        }
      });
    });
    add(area, [el("div", "mem", btns), el("div", "row", stat)]);
    function upd() { stat.textContent = T("memStat", { moves: moves, found: matched, total: t.pairs.length }); }
    upd();
  }

  function tOrder(t, area, finish) {
    var n = t.items.length, ord = Core.orderStart(n), done = false;
    var ol = el("ol", "ord"), chkRow = el("div", "row", button("btn", T("checkOrder"), check));
    add(area, [ol, chkRow]);
    function draw(focus) {
      clear(ol);
      ord.forEach(function (v, pos) {
        var li = el("li", "ord-i" + (done ? (v === pos ? " right" : " wrong") : ""), [el("span", "ord-n", String(pos + 1)), el("span", "ord-t", t.items[v])]);
        if (done) { if (v !== pos) add(li, el("small", "", T("orderShould", { n: v + 1 }))); }
        else add(li, el("span", "ord-b", [
          el("button", "", "▲", { type: "button", "data-mv": "-1", "data-p": String(pos), "aria-label": T("moveUp"), disabled: pos === 0 }),
          el("button", "", "▼", { type: "button", "data-mv": "1", "data-p": String(pos), "aria-label": T("moveDown"), disabled: pos === n - 1 })
        ]));
        ol.appendChild(li);
      });
      if (focus) { var b = ol.querySelector('[data-p="' + focus.p + '"][data-mv="' + focus.mv + '"]'); if (b && !b.disabled) b.focus(); }
    }
    on(ol, "click", function (e) {
      var b = e.target.closest("[data-mv]"); if (!b || done) return;
      var p = +b.getAttribute("data-p"), mv = +b.getAttribute("data-mv"), q = p + mv;
      if (q < 0 || q >= n) return;
      var x = ord[p]; ord[p] = ord[q]; ord[q] = x; draw({ p: q, mv: mv });
    });
    draw();
    function check() {
      done = true; draw();
      chkRow.parentNode.removeChild(chkRow);
      var res = Core.orderResult(ord);
      finish(res.pts, res.ok, res.all ? T("orderOk") : T("orderScore", { right: res.right, total: res.total }),
        [md(t.explain), el("ol", "clues mt", t.items.map(function (s) { return el("li", "", s); }))]);
    }
  }

  function tWordsearch(t, area, finish) {
    var g = Core.buildGrid(t), first = null, found = [], ended = false, cells = {};
    var chips = t.words.map(function (w) { return el("span", "chip lock", w.word); });
    var grid = el("div", "ws");
    g.forEach(function (row, r) {
      row.forEach(function (ch, c) {
        var b = el("button", "wc", ch, { type: "button", "data-r": String(r), "data-c": String(c), "aria-label": T("wsCell", { letter: ch, row: r + 1, col: c + 1 }) });
        cells[r + "," + c] = b; grid.appendChild(b);
      });
    });
    var stat = el("span", "lvl"), msg = el("div", "muted msgline ws-msg", T("wsHint"), { "aria-live": "polite" });
    var giveup = button("btn ghost small", T("giveUp"), function () { end(true); });
    add(area, [el("div", "ws-words", chips), grid, el("div", "row center-row", [stat, giveup]), msg]);
    function cell(r, c) { return cells[r + "," + c]; }
    function upd() { stat.textContent = T("wsStat", { found: found.length, total: t.words.length }); }
    upd();
    function end(gaveUp) {
      ended = true; if (giveup.parentNode) giveup.parentNode.removeChild(giveup);
      t.words.forEach(function (w, k) { if (found.indexOf(k) < 0) Core.wordCells(w).forEach(function (p) { cell(p[0], p[1]).classList.add("miss"); }); });
      Object.keys(cells).forEach(function (k) { cells[k].disabled = true; });
      msg.textContent = "";
      finish(found.length, found.length === t.words.length, T(gaveUp ? "wsGaveTitle" : "wsDoneTitle"), T(gaveUp ? "wsGaveText" : "wsDoneText"));
    }
    on(grid, "click", function (e) {
      var b = e.target.closest(".wc"); if (!b || ended) return;
      var R = +b.getAttribute("data-r"), C = +b.getAttribute("data-c");
      if (!first) { first = [R, C]; b.classList.add("sel"); return; }
      var fb = cell(first[0], first[1]); fb.classList.remove("sel");
      if (first[0] === R && first[1] === C) { first = null; return; }
      var hit = Core.findWord(t, first, [R, C]);
      first = null;
      if (hit > -1 && found.indexOf(hit) < 0) {
        found.push(hit); Core.wordCells(t.words[hit]).forEach(function (p) { cell(p[0], p[1]).classList.add("f"); });
        chips[hit].className = "chip ok";
        msg.textContent = T("wsFound", { word: t.words[hit].word }); upd();
        if (found.length === t.words.length) end(false);
      } else if (hit > -1) {
        msg.textContent = T("wsAlready");
      } else {
        msg.textContent = T("wsNone");
        fb.classList.add("bad"); b.classList.add("bad");
        later(function () { fb.classList.remove("bad"); b.classList.remove("bad"); }, 500);
      }
    });
  }

  function tPassword(t, area, finish) {
    var crit = [], i;
    for (i = 1; i <= Core.PASSWORD_CHECKS; i++) crit.push(el("li", "", T("pwCrit" + i)));
    var pw = el("input", "mono", null, { type: "text", id: "pw", autocomplete: "off", autocapitalize: "off", spellcheck: "false", maxlength: "40", placeholder: T("pwPlaceholder") });
    var bars = [];
    for (i = 0; i < Core.PASSWORD_CHECKS; i++) bars.push(el("i"));
    var meter = el("div", "meter l0", bars, { "aria-hidden": "true" });
    var lvl = el("div", "lvl", T("pwLevel", { name: T("pwName0") }), { "aria-live": "polite" });
    var chk = button("btn", T("pwSubmit"), function () {
      pw.disabled = true; chkRow.parentNode.removeChild(chkRow);
      finish(1, true, T("pwDoneTitle"), T("pwDoneText"));
    }, { disabled: true });
    var chkRow = el("div", "row", chk);
    add(area, [
      el("div", "panel stack", [
        el("div", "warn", T("pwWarn")),
        el("label", "fld", [T("pwLabel"), pw], { "for": "pw" }),
        meter, lvl,
        el("ul", "checks", crit),
        el("p", "muted t14", T("pwHint"))
      ]),
      chkRow
    ]);
    on(pw, "input", function () {
      var p = pw.value, checks = Core.passwordChecks(p, t.weak), n = Core.passwordLevel(checks, p);
      crit.forEach(function (li, k) { li.classList.toggle("on", checks[k]); });
      meter.className = "meter l" + n;
      lvl.textContent = T("pwLevel", { name: T("pwName" + n) });
      chk.disabled = n < Core.PASSWORD_CHECKS;
    });
    try { pw.focus({ preventScroll: true }); } catch (e) {}
  }

  function doneScreen() {
    var m = mission(), sc = Core.missionScore(S, m), last = Core.nextOpen(M, S) < 0, L = letterOf(m);
    add(view, el("section", "panel stack center", [
      el("div", "eyebrow", T("doneEyebrow", { n: Core.missionIndex(M, m.id) + 1 })),
      el("div", "bigkey", L, { "aria-label": T("keyAria", { letter: L }) }),
      el("h2", "", T("keyYours", { letter: L })),
      el("p", "muted", T("doneScore", { got: sc.got, max: sc.max }) + " " + (last ? T("allKeys") : T("keysLeft", { count: M.length - S.done.length }))),
      button("btn", last ? T("toFinal") : T("toMapBtn"), function () { go(last ? "final" : "map"); })
    ]));
  }

  function finalScreen() {
    var picked = [], tries = 0, tiles = M.map(letterOf);
    var slots = el("div", "slots"), tileBox = el("div", "tiles"), hint = el("p", "muted hint-c", "", { "aria-live": "polite" });
    add(view, [
      el("div", "stack center", [el("div", "eyebrow", T("finalEyebrow")), el("h2", "", T("finalTitle")), el("p", "muted", T("finalLead"))]),
      slots, tileBox,
      el("div", "row center-row", button("btn ghost small", T("clear"), function () { picked = []; draw(); })),
      hint
    ]);
    function draw() {
      clear(slots); clear(tileBox);
      WORD.split("").forEach(function (_, i) { add(slots, el("div", "slot" + (picked[i] !== undefined ? " f" : ""), picked[i] !== undefined ? tiles[picked[i]] : "")); });
      tiles.forEach(function (l, i) {
        add(tileBox, button("tile", l, function () { pick(i); }, { disabled: picked.indexOf(i) > -1 }));
      });
    }
    function pick(i) {
      if (picked.length >= WORD.length) return;
      picked.push(i); draw();
      if (picked.length === WORD.length) {
        if (Core.wordMatches(WORD, picked.map(function (j) { return tiles[j]; }))) {
          if (!S.finished) S.finished = Date.now();
          save(); hint.textContent = T("finalOk"); later(function () { go("cert", "replace"); }, 600);
        } else {
          tries++; slots.classList.remove("shake"); void slots.offsetWidth; slots.classList.add("shake");
          hint.textContent = tries > 1 ? T("finalHint") : T("finalWrong");
          later(function () { picked = []; draw(); }, 700);
        }
      }
    }
    draw();
  }

  function nameGate() {
    var nameLabel = nameField("fname", T("nameLabel"), T("namePlaceholder"), 40, "", "");
    var clsLabel = nameField("fcls", T("ngClsLabel"), T("clsPlaceholder"), 8, "cls", "");
    var b = el("button", "btn", T("ngSubmit"), { id: "ngb", type: "submit", disabled: true });
    var h = el("h2", "", T("ngTitle"), { id: "ngh", tabindex: "-1" });
    var form = el("form", "panel stack", [h, el("p", "muted t15", T("ngNote")), el("div", "row", [nameLabel, clsLabel]), el("div", "row", b)], { id: "ng" });
    add(view, form);
    var n = nameLabel.querySelector("input"), c = clsLabel.querySelector("input");
    function upd() { b.disabled = !nameValid(n); }
    on(n, "input", upd); upd();
    on(form, "submit", function (e) {
      e.preventDefault(); if (b.disabled) return;
      S.name = n.value.trim(); S.cls = c.value.trim(); render();
    });
    h.focus();
  }

  function certScreen() {
    if (!S.name) { nameGate(); return; }
    var pts = Core.score(S), rk = T("rank." + Core.rank(pts / TOTAL)), d = new Date(S.finished || Date.now()), date = LANG === "uk" ? Core.fmtDate(d) : GII18n.formatDate(d, { day: "numeric", month: "short", year: "numeric" }), time = Core.fmtTime(elapsed());
    var line = T("resultLine", { who: S.name + (S.cls ? ", " + S.cls : ""), pts: pts, total: TOTAL, rank: rk, time: time, date: date });
    var cmsg = el("span", "muted t14", "", { "aria-live": "polite" });
    var cbox = el("div", "copybox", line);
    function fact(label, value) { return el("div", "", [el("small", "", label), el("b", "", value)]); }
    var again = button("btn ghost small", T("again"), function () {
      if (!armed) { armed = true; again.textContent = T("againArmed"); return; }
      S = Core.freshState(); go("start", "replace");
    }), armed = false;
    add(view, [
      el("section", "cert stack", [
        el("div", "stamp", [T("stampTop"), el("br"), T("stampBottom"), el("br"), date]),
        el("div", "eyebrow", T("certEyebrow")),
        el("div", "who", S.name),
        el("p", "", [S.cls ? T("certClass", { cls: S.cls }) + " " : null, md(T("certText", { count: M.length, word: WORD }))]),
        el("div", "facts", [fact(T("factRank"), rk), fact(T("factPoints"), pts + " / " + TOTAL), fact(T("factTime"), time)])
      ]),
      el("section", "panel stack", [
        el("h3", "", T("handoffTitle")), el("p", "muted t15", T("handoffText")), cbox,
        el("div", "row", [button("btn small", T("copy"), function () {
          function sel() {
            try { var r = document.createRange(); r.selectNodeContents(cbox); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
            cmsg.textContent = T("copySelect");
          }
          try { navigator.clipboard.writeText(line).then(function () { cmsg.textContent = T("copied"); }, sel); } catch (e) { sel(); }
        }), cmsg])
      ]),
      el("div", "row", again)
    ]);
  }

  /* ---------- Скидання ---------- */
  function resetAll() {
    clearTimers();
    try { if (window.GIStorage) GIStorage.remove(STORE_ID); } catch (e) {}
    S = Core.freshState(); go("start", "replace");
  }
  var rb = byId("restart"), rbArmed = null, rbLabel = rb.querySelector("span");
  function disarm() { clearTimeout(rbArmed); rbArmed = null; rb.classList.remove("armed"); rbLabel.textContent = T("restart"); }
  on(rb, "click", function () {
    if (!rbArmed) { rb.classList.add("armed"); rbLabel.textContent = T("restartConfirm"); rbArmed = setTimeout(disarm, 4000); return; }
    disarm(); resetAll();
  });

  /* ---------- Запуск ---------- */
  GIData.loadJSON(ROOT + "content/agenty-kibershchytu/" + LANG + ".json").then(function (data) {
    M = data.missions; WORD = data.word; TOTAL = Core.totalPoints(M);
    S = loadState() || Core.freshState();
    S.name = ""; S.cls = "";
    /* Літери ключів потрібні, щойно квест розпочато (у збереженому стані їх могло не бути, наприклад після переходу з іншої мови) */
    if (S.started && !S.letters) { S.letters = Core.lettersById(M, Core.makeLetters(WORD)); save(); }
    /* Знайдено збережений квест — спершу питаємо, продовжувати чи почати заново. */
    if (S.started) { resumeTo = Core.resumeTarget(S); S.screen = "resume"; }
    syncSummary();
    if (!S.started && curHash()) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    render();
  }, function () { /* повідомлення про помилку вже показав GIData */ });
})();
