/* Спільна логіка ребусів: її використовують і сторінка, і перевірка tools/check-rebuses.js */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebusCore = factory();
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  // Прибирає пробіли, дефіси та всі види апострофа, переводить у верхній регістр
  function normalize(s) {
    return String(s == null ? "" : s)
      .trim()
      .toUpperCase()
      .replace(/[\s\-‐‑‒–—'’ʼ‘ʻ´`]/g, "");
  }

  // Операції над словом картинки/числа: rev -> keep -> rep -> l/r
  function applyOps(w, p) {
    if (typeof w !== "string" || !w) throw new Error("немає поля w");
    var a = Array.from(w);
    if (p.rev) a.reverse();
    var hasKeep = Array.isArray(p.keep) && p.keep.length > 0;
    if (hasKeep) {
      if ((p.l || 0) || (p.r || 0)) throw new Error("keep не поєднується з l/r");
      a = p.keep.map(function (i) {
        if (!Number.isInteger(i) || i < 1 || i > a.length) throw new Error("keep: позиція " + i + " поза словом «" + a.join("") + "»");
        return a[i - 1];
      });
    }
    var s = a.join("");
    (p.rep || []).forEach(function (r) {
      if (!Array.isArray(r) || r.length !== 2) throw new Error("rep: очікується [from, to]");
      var idx = s.indexOf(r[0]);
      if (idx < 0) throw new Error("rep: «" + r[0] + "» немає в «" + s + "»");
      s = s.slice(0, idx) + r[1] + s.slice(idx + r[0].length);
    });
    var l = p.l || 0, rr = p.r || 0;
    if (l < 0 || rr < 0 || l + rr >= s.length) throw new Error("l/r забагато для «" + s + "»");
    return s.slice(l, s.length - rr);
  }

  function lettersOf(p) {
    var a = Array.from(p.t);
    var x = p.x || [];
    x.forEach(function (i) {
      if (!Number.isInteger(i) || i < 1 || i > a.length) throw new Error("x: позиція " + i + " поза «" + p.t + "»");
    });
    return a.filter(function (_, i) { return x.indexOf(i + 1) < 0; }).join("");
  }

  function kind(p) {
    if (p && typeof p.pic === "string") return "pic";
    if (p && typeof p.num === "string") return "num";
    if (p && typeof p.t === "string") return "txt";
    return null;
  }

  function solvePiece(p) {
    var k = kind(p);
    if (k === "pic" || k === "num") return applyOps(p.w, p);
    if (k === "txt") return lettersOf(p);
    throw new Error("невідомий тип частини");
  }

  function solve(parts) {
    if (!Array.isArray(parts) || !parts.length) throw new Error("немає parts");
    return parts.map(solvePiece).join("");
  }

  return { normalize: normalize, applyOps: applyOps, lettersOf: lettersOf, kind: kind, solvePiece: solvePiece, solve: solve };
});
