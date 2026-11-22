/* Geek Informatic — локалізація інтерфейсу (ES5, без залежностей).
   Мова береться з <html lang>, рядки — з <script type="application/json" id="i18n-data">
   ({"common": {...}, "<id>": {...}}). Докладніше: docs/architecture.md, розділи 3-5. */
(function (g) {
  "use strict";
  var doc = g.document || null;
  var lang = "uk";
  var data = {};
  var rulesCache = {};

  function warn(msg) {
    try { if (g.console && g.console.warn) g.console.warn("[i18n] " + msg); } catch (e) {}
  }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function readLang() {
    try {
      var l = (doc.documentElement.getAttribute("lang") || "").toLowerCase().split("-")[0];
      return l || "uk";
    } catch (e) { return "uk"; }
  }
  function readData() {
    try {
      var el = doc.getElementById("i18n-data");
      if (el) return JSON.parse(el.textContent) || {};
    } catch (e) { warn("не вдалося прочитати #i18n-data: " + e.message); }
    return {};
  }

  /* Категорія множини: Intl.PluralRules, а якщо його немає, ручні правила для uk і en. */
  function plural(n) {
    n = Number(n);
    try {
      if (g.Intl && g.Intl.PluralRules) {
        if (!rulesCache[lang]) rulesCache[lang] = new g.Intl.PluralRules(lang);
        return rulesCache[lang].select(n);
      }
    } catch (e) {}
    if (lang === "uk") {
      if (n % 1 !== 0) return "other";
      var m10 = Math.abs(n) % 10, m100 = Math.abs(n) % 100;
      if (m10 === 1 && m100 !== 11) return "one";
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "few";
      return "many";
    }
    return n === 1 ? "one" : "other";
  }

  function lookup(key) {
    var i = String(key).indexOf(".");
    if (i < 1) return undefined;
    var ns = data[key.slice(0, i)];
    var k = key.slice(i + 1);
    return ns && has(ns, k) ? ns[k] : undefined;
  }

  function t(key, params) {
    var v = lookup(key);
    if (v === undefined || v === null) { warn("немає ключа " + key); return key; }
    if (typeof v === "object") {
      var cat = plural(params && params.count);
      v = has(v, cat) ? v[cat] : v.other;
      if (v === undefined) { warn("немає форми множини для " + key); return key; }
    }
    return String(v).replace(/\{(\w+)\}/g, function (m, name) {
      if (params && has(params, name) && params[name] !== undefined && params[name] !== null) return String(params[name]);
      warn("немає параметра {" + name + "} для " + key);
      return m;
    });
  }

  function formatDate(d, opts) {
    try { return new g.Intl.DateTimeFormat(lang, opts).format(d); } catch (e) { return String(d); }
  }

  /* Безпечна міні-розмітка **жирний** -> DocumentFragment без innerHTML. */
  function md(str) {
    var frag = doc.createDocumentFragment();
    var parts = String(str).split(/\*\*(.+?)\*\*/);
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2) {
        var b = doc.createElement("strong");
        b.appendChild(doc.createTextNode(parts[i]));
        frag.appendChild(b);
      } else {
        frag.appendChild(doc.createTextNode(parts[i]));
      }
    }
    return frag;
  }

  var api = {
    lang: lang,
    t: t,
    plural: plural,
    formatDate: formatDate,
    md: md,
    has: function (key) { return lookup(key) !== undefined; },
    /* Для тестів і нестандартних сторінок: задати мову й словники вручну. */
    init: function (l, d) { lang = l; api.lang = l; data = d || {}; }
  };

  if (doc) { lang = readLang(); api.lang = lang; data = readData(); }

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    g.GII18n = api;
    g.t = t;
  }
})(typeof window !== "undefined" ? window : this);
