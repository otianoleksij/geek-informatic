/* Фільтри каталогу на головній + прогрес на картках. ES5, без залежностей.
   Стан фільтрів у URL: ?grade=7&type=game&topic=loops&level=2 */
(function (root) {
  "use strict";

  var PARAMS = [["grade", "f-grade"], ["type", "f-type"], ["topic", "f-topic"], ["level", "f-level"]];

  /* ---------- чисті функції (їх тестують у Node) ---------- */

  function emptyFilters() { return { grade: "", type: "", topic: "", level: "" }; }

  /* search: рядок "?grade=7&…"; valid: {grade:[..], type:[..], topic:[..], level:[..]} — дозволені значення.
     Некоректні значення ігноруються. */
  function parseQuery(search, valid) {
    var f = emptyFilters();
    var q = String(search || "").replace(/^\?/, "");
    if (!q) return f;
    q.split("&").forEach(function (pair) {
      var i = pair.indexOf("=");
      var k = i < 0 ? pair : pair.slice(0, i);
      var v = i < 0 ? "" : pair.slice(i + 1);
      try { k = decodeURIComponent(k); v = decodeURIComponent(v.replace(/\+/g, " ")); } catch (e) { return; }
      if (!Object.prototype.hasOwnProperty.call(f, k)) return;
      if (valid && valid[k] && valid[k].indexOf(v) >= 0) f[k] = v;
    });
    return f;
  }

  function buildQuery(f) {
    var parts = [];
    PARAMS.forEach(function (p) {
      if (f[p[0]]) parts.push(p[0] + "=" + encodeURIComponent(f[p[0]]));
    });
    return parts.length ? "?" + parts.join("&") : "";
  }

  /* card: {type, grades:[строки], topics:[строки], difficulty:"1"} */
  function matches(card, f) {
    if (f.grade && card.grades.indexOf(f.grade) < 0) return false;
    if (f.type && card.type !== f.type) return false;
    if (f.topic && card.topics.indexOf(f.topic) < 0) return false;
    if (f.level && card.difficulty !== f.level) return false;
    return true;
  }

  function pluralCategory(n) {
    try {
      if (typeof Intl !== "undefined" && Intl.PluralRules) return new Intl.PluralRules("uk").select(n);
    } catch (e) {}
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return "one";
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "few";
    return "many";
  }

  function countText(n) {
    var c = pluralCategory(n);
    var w = c === "one" ? "активність" : c === "few" ? "активності" : "активностей";
    return "Знайдено: " + n + " " + w;
  }

  function progressText(done, total) {
    return done >= total ? "Пройдено ✓" : "Пройдено " + done + " з " + total;
  }

  var api = {
    parseQuery: parseQuery, buildQuery: buildQuery, matches: matches,
    countText: countText, progressText: progressText
  };
  root.GICatalog = api;

  /* ---------- робота з DOM ---------- */
  var doc = root.document;
  if (!doc || !doc.getElementById) return;

  function words(s) { return (s || "").split(/\s+/).filter(Boolean); }

  function init() {
    var panel = doc.getElementById("filters");
    var cards = [].slice.call(doc.querySelectorAll("article.book[data-id]"));

    if (panel && cards.length) initFilters(panel, cards);
    try { initProgress(cards); } catch (e) {}
  }

  function initFilters(panel, cards) {
    var sections = [].slice.call(doc.querySelectorAll("section[data-type]"))
      .filter(function (s) { return s.querySelector("article.book[data-id]"); });
    var selects = {}, valid = {};
    PARAMS.forEach(function (p) {
      var el = doc.getElementById(p[1]);
      selects[p[0]] = el;
      valid[p[0]] = [].map.call(el.options, function (o) { return o.value; }).filter(Boolean);
    });
    var count = doc.getElementById("f-count");
    var empty = doc.getElementById("f-empty");
    var data = cards.map(function (el) {
      return {
        el: el,
        card: {
          type: el.getAttribute("data-type") || "",
          grades: words(el.getAttribute("data-grades")),
          topics: words(el.getAttribute("data-topics")),
          difficulty: el.getAttribute("data-difficulty") || ""
        }
      };
    });

    function read() {
      var f = emptyFilters();
      PARAMS.forEach(function (p) { f[p[0]] = selects[p[0]].value; });
      return f;
    }
    function write(f) { PARAMS.forEach(function (p) { selects[p[0]].value = f[p[0]]; }); }

    function apply(updateUrl) {
      var f = read(), shown = 0;
      data.forEach(function (d) {
        var ok = matches(d.card, f);
        d.el.hidden = !ok;
        if (ok) shown++;
      });
      sections.forEach(function (s) {
        s.hidden = !s.querySelector("article.book[data-id]:not([hidden])");
      });
      count.textContent = countText(shown);
      empty.hidden = shown !== 0;
      if (updateUrl && root.history && root.history.replaceState) {
        try { root.history.replaceState(null, "", root.location.pathname + buildQuery(f) + root.location.hash); } catch (e) {}
      }
    }

    function reset() { write(emptyFilters()); apply(true); selects.grade.focus(); }

    write(parseQuery(root.location.search, valid));
    PARAMS.forEach(function (p) { selects[p[0]].addEventListener("change", function () { apply(true); }); });
    doc.getElementById("f-reset").addEventListener("click", reset);
    doc.getElementById("f-reset2").addEventListener("click", reset);
    panel.hidden = false;
    apply(false);
  }

  function initProgress(cards) {
    if (!root.GIStorage || typeof root.GIStorage.getSummary !== "function") return;
    var sum = root.GIStorage.getSummary() || {};
    cards.forEach(function (el) {
      var s = sum[el.getAttribute("data-id")];
      if (!s || !(s.done > 0) || !(s.total > 0)) return;
      var done = Math.min(s.done, s.total);
      var box = doc.createElement("div");
      box.className = "prog" + (done >= s.total ? " done" : "");
      var t = doc.createElement("span");
      t.className = "prog-t";
      t.textContent = progressText(done, s.total);
      var bar = doc.createElement("span");
      bar.className = "prog-bar";
      bar.setAttribute("aria-hidden", "true");
      var fill = doc.createElement("i");
      fill.style.width = Math.round(done / s.total * 100) + "%";
      bar.appendChild(fill);
      box.appendChild(t);
      box.appendChild(bar);
      var label = el.querySelector(".label"), go = el.querySelector(".go");
      if (label) label.insertBefore(box, go && go.parentNode === label ? go : null);
    });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : this);
