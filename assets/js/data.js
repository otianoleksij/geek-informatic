/* Geek Informatic — завантаження JSON-контенту (ES5 + fetch/Promise).
   Потрібен assets/js/i18n.js. Докладніше: docs/architecture.md, розділ 5. */
(function (g) {
  "use strict";
  var doc = g.document || null;

  function currentLang() { return (g.GII18n && g.GII18n.lang) || "uk"; }

  /* Для полів {uk, en}: obj[lang] || obj.uk; рядок повертається як є. */
  function pick(obj) {
    if (obj === null || obj === undefined) return "";
    if (typeof obj !== "object") return obj;
    var v = obj[currentLang()];
    if (v === undefined || v === null || v === "") v = obj.uk;
    return v === undefined || v === null ? "" : v;
  }

  function showError() {
    if (!doc) return;
    var el = doc.getElementById("loadError");
    if (!el) return;
    try { if (g.t) el.textContent = g.t("common.loadError"); } catch (e) {}
    el.hidden = false;
    el.removeAttribute("hidden");
  }

  /* fetch + JSON.parse. URL відносний, тож розв'язується від адреси сторінки. */
  function loadJSON(url) {
    var p;
    if (!g.fetch) p = Promise.reject(new Error("fetch недоступний"));
    else {
      p = g.fetch(url).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " для " + url);
        return r.json();
      });
    }
    return p.then(null, function (err) { showError(); throw err; });
  }

  var api = { loadJSON: loadJSON, pick: pick };
  if (typeof module === "object" && module.exports) module.exports = api;
  else g.GIData = api;
})(typeof window !== "undefined" ? window : this);
