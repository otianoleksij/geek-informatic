#!/usr/bin/env node
/* Перевірка рівнів «Коду Галактики»: node tools/check-galaxy.js */
"use strict";
var fs = require("fs");
var path = require("path");
var Core = require(path.join(__dirname, "..", "activities", "kod-galaktyky", "galaxy-core.js"));
var file = path.join(__dirname, "..", "content", "kod-galaktyky", "levels.json");
var doc;
try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { console.error("content/kod-galaktyky/levels.json: " + e.message); process.exit(1); }
var levels = doc.levels;
var errors = [], rows = [], seenIds = {};
function err(n, msg) { errors.push("рівень " + n + ": " + msg); }

/* Мінімальна вартість програми, де повтори НЕ вкладені (тіло — лише F/L/R/C).
   Dijkstra по станах (x,y,dir,mask); вартість: атом 1, повтор 1 + довжина тіла.
   Обмеження рівня (limits) не враховуємо — це лише сильніша перевірка. Повертає Infinity, якщо ≤ budget не вдалося. */
function minFlatCost(level, budget) {
  var m = Core.parseMap(level), k = m.crystals.length, full = (1 << k) - 1;
  var D = ["E", "N", "W", "S"], dIdx = { E: 0, N: 1, W: 2, S: 3 };
  var best = Infinity;
  function key(s) { return ((s.mask * m.h + s.y) * m.w + s.x) * 4 + s.d; }
  /* Один крок; повертає null при аварії/помилці, інакше новий стан (mask може стати full) */
  function stepOf(s, c) {
    if (c === "F") {
      var v = Core.VEC[D[s.d]], nx = s.x + v[0], ny = s.y + v[1];
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || m.rocks[nx + "," + ny]) return null;
      return { x: nx, y: ny, d: s.d, mask: s.mask };
    }
    if (c === "L") return { x: s.x, y: s.y, d: (s.d + 1) % 4, mask: s.mask };
    if (c === "R") return { x: s.x, y: s.y, d: (s.d + 3) % 4, mask: s.mask };
    var ci = m.crystalAt[s.x + "," + s.y];
    if (ci === undefined || (s.mask & (1 << ci))) return null;
    return { x: s.x, y: s.y, d: s.d, mask: s.mask | (1 << ci) };
  }
  var dist = {}, buckets = [];
  for (var i = 0; i <= budget; i++) buckets.push([]);
  var s0 = { x: m.start.x, y: m.start.y, d: dIdx[m.dir], mask: 0 };
  dist[key(s0)] = 0; buckets[0].push(s0);
  for (var c = 0; c <= budget && best === Infinity; c++) {
    var list = buckets[c];
    for (var qi = 0; qi < list.length && best === Infinity; qi++) {
      var s = list[qi];
      if (dist[key(s)] !== c) continue;
      /* атоми */
      "FLRC".split("").forEach(function (a) {
        var t = stepOf(s, a);
        if (!t) return;
        if (t.mask === full) { best = Math.min(best, c + 1); return; }
        var kk = key(t);
        if (c + 1 <= budget && (dist[kk] === undefined || dist[kk] > c + 1)) { dist[kk] = c + 1; buckets[c + 1].push(t); }
      });
      if (best !== Infinity) break;
      /* повтор з плоским тілом */
      (function dfs(body, cur) {
        var len = body.length;
        if (len > 0) {
          var t = cur, ok = true;
          for (var n = 2; n <= 9 && ok; n++) {
            /* ще одна ітерація тіла */
            for (var j = 0; j < len; j++) {
              t = stepOf(t, body[j]);
              if (!t) { ok = false; break; }
              if (t.mask === full) { best = Math.min(best, c + 1 + len); ok = false; break; }
            }
            if (ok && n >= 2) {
              var kk = key(t), cost = c + 1 + len;
              if (cost <= budget && (dist[kk] === undefined || dist[kk] > cost)) { dist[kk] = cost; buckets[cost].push(t); }
            }
          }
        }
        if (c + 1 + len + 1 > budget) return;
        for (var ci = 0; ci < 4; ci++) {
          var a = "FLRC".charAt(ci);
          /* перевіряємо префікс (перший прохід) на аварію */
          var p = s, good = true;
          for (var q = 0; q < len; q++) { p = stepOf(p, body[q]); if (!p) { good = false; break; } }
          if (!good) return;
          if (!stepOf(p, a)) continue;
          body.push(a); dfs(body, s); body.pop();
        }
      })([], s);
    }
  }
  return best;
}

if (doc.format !== 1) { console.error("format має бути 1"); process.exit(1); }
if (!Array.isArray(levels) || levels.length !== 15) { console.error("потрібно рівно 15 рівнів"); process.exit(1); }
var okCount = 0;
levels.forEach(function (lv, idx) {
  var n = idx + 1, before = errors.length, label = (lv.id || "#" + n) + " (" + n + ")";
  var err = function (_n, msg) { errors.push("рівень " + label + ": " + msg); };
  if (lv.n !== undefined) err(n, "поле n більше не використовується (порядок задає позиція в масиві)");
  if (typeof lv.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(lv.id)) err(n, "id має бути kebab-case латиницею");
  else if (seenIds[lv.id]) err(n, "id не унікальний");
  seenIds[lv.id] = true;
  ["title", "story", "tip"].forEach(function (f) {
    if (!lv[f] || typeof lv[f] !== "object") { err(n, "немає " + f + " {uk, en}"); return; }
    ["uk", "en"].forEach(function (l) { if (typeof lv[f][l] !== "string" || !lv[f][l].trim()) err(n, "немає " + f + "." + l); });
  });
  var map = lv.map;
  if (!Array.isArray(map) || !map.length) { err(n, "немає map"); return; }
  var h = map.length, w = map[0].length, starts = 0, gems = 0, bad = false;
  if (w !== h) { err(n, "карта не квадратна (" + w + "×" + h + ")"); bad = true; }
  if (lv.size !== w || lv.size < 6 || lv.size > 9) { err(n, "size " + lv.size + " не збігається з картою або поза 6..9"); bad = true; }
  map.forEach(function (r, y) {
    if (r.length !== w) { err(n, "рядок " + (y + 1) + " має іншу довжину"); bad = true; }
    for (var x = 0; x < r.length; x++) {
      var c = r.charAt(x);
      if (".#S*".indexOf(c) < 0) { err(n, "невідомий символ «" + c + "»"); bad = true; }
      if (c === "S") starts++;
      if (c === "*") gems++;
    }
  });
  if (bad) return;
  if (starts !== 1) err(n, "стартів має бути 1, а є " + starts);
  if (gems < 1) err(n, "немає кристалів");
  if (!lv.start || ["E", "N", "W", "S"].indexOf(lv.start.dir) < 0) err(n, "start.dir має бути E/N/W/S");
  if (typeof lv.maxBlocks !== "number" || typeof lv.par !== "number") err(n, "немає maxBlocks/par");
  if (!Array.isArray(lv.allowed) || !lv.limits || typeof lv.limits !== "object") err(n, "немає allowed/limits");
  var sol = lv.solution, blocks = "—", minInfo = null, flat = "—";
  if (!Array.isArray(sol)) { err(n, "немає solution"); return; }
  blocks = Core.countBlocks(sol);
  /* структура розв'язку */
  Core.walk(sol, function (node, p, depth) {
    if (typeof node === "string") { if (!/^[FLRC]$/.test(node)) err(n, "невідома команда " + node); }
    else if (Core.isRep(node)) {
      if (!node.body.length) err(n, "порожній повтор");
      if (!(node.rep >= 2 && node.rep <= 9 && node.rep % 1 === 0)) err(n, "повтор має бути 2..9, а є " + node.rep);
      if (depth > 3) err(n, "глибина повторів > 3");
    } else err(n, "невідомий вузол");
  });
  var res = Core.run(lv, sol);
  if (!res.win) err(n, "розв'язок не виграє (статус " + res.status + ", зібрано " + res.collected + "/" + res.total + ")");
  var v = Core.validate(lv, sol);
  if (!v.ok) v.problems.forEach(function (p) { err(n, "розв'язок порушує обмеження: " + p.kind + (p.cmd ? " " + p.cmd : "")); });
  if (blocks > lv.maxBlocks) err(n, "блоків " + blocks + " > maxBlocks " + lv.maxBlocks);
  if (lv.par !== blocks) err(n, "par " + lv.par + " ≠ блоків у розв'язку " + blocks);
  if (lv.par > lv.maxBlocks) err(n, "par > maxBlocks");
  if (n <= 3 && Core.countByType(sol).rep) err(n, "на рівнях 1–3 повторів бути не повинно");
  if (n <= 3 && lv.allowed.indexOf("rep") >= 0) err(n, "на рівнях 1–3 «повторити» не має бути в allowed");
  if (n >= 4 && lv.allowed.indexOf("rep") < 0) err(n, "на рівнях 4+ має бути rep в allowed");
  /* досяжність кристалів */
  var pm = Core.parseMap(lv), seen = {}, st = [pm.start];
  seen[pm.start.x + "," + pm.start.y] = 1;
  while (st.length) {
    var cur = st.pop();
    ["E", "N", "W", "S"].forEach(function (d) {
      var nx = cur.x + Core.VEC[d][0], ny = cur.y + Core.VEC[d][1], kk = nx + "," + ny;
      if (nx < 0 || ny < 0 || nx >= pm.w || ny >= pm.h || pm.rocks[kk] || seen[kk]) return;
      seen[kk] = 1; st.push({ x: nx, y: ny });
    });
  }
  pm.crystals.forEach(function (c) { if (!seen[c.x + "," + c.y]) err(n, "кристал (" + c.x + "," + c.y + ") недосяжний"); });

  minInfo = Core.minMovesNoRepeat(lv);
  var minStr = (minInfo.exact ? "" : "≥") + minInfo.value;
  if (n <= 3) {
    if (minInfo.value < 0 || minInfo.value > lv.maxBlocks) err(n, "BFS-мінімум " + minInfo.value + " > maxBlocks " + lv.maxBlocks);
    else if (lv.maxBlocks - minInfo.value > 3) err(n, "запас maxBlocks − мін = " + (lv.maxBlocks - minInfo.value) + " > 3");
  }
  if (n >= 4) {
    if (minInfo.value >= 0 && !(minInfo.value > lv.maxBlocks)) err(n, "без повторів можна пройти за " + minInfo.value + " ходів ≤ maxBlocks " + lv.maxBlocks);
    if (Core.countByType(sol).rep === 0) err(n, "на рівнях 4+ розв'язок має містити повтор");
  }
  var nested = Core.hasNested(sol);
  if (n >= 10) {
    if (!nested) err(n, "у розв'язку немає вкладеного повтору");
    var f = minFlatCost(lv, lv.maxBlocks);
    flat = f === Infinity ? ">" + lv.maxBlocks : String(f);
    if (f !== Infinity) err(n, "є розв'язок без вкладених повторів на " + f + " блоків ≤ maxBlocks " + lv.maxBlocks);
  }
  if (n === 15 && Core.maxDepth(sol) < 3) err(n, "у фіналі очікується глибина вкладення 3");
  var lim = Object.keys(lv.limits).map(function (k) { return k + ":" + lv.limits[k]; }).join(" ") || "—";
  rows.push([lv.id, w + "×" + h, gems, lv.maxBlocks, blocks, lim, minStr, n >= 10 ? flat : "—", nested ? "так" : "—", lv.allowed.indexOf("rep") >= 0 ? "так" : "—"]);
  if (errors.length === before) okCount++;
});

var head = ["Рівень", "Розмір", "Кристали", "maxBlocks", "par", "Ліміти", "Мін.ходів", "Мін.плоский", "Вкладені", "Повтори"];
var widths = [18, 8, 10, 11, 6, 14, 11, 13, 10, 8];
function pad(s, k) { s = String(s); while (s.length < k) s += " "; return s; }
console.log(head.map(function (h, i) { return pad(h, widths[i]); }).join(""));
rows.forEach(function (r) { console.log(r.map(function (c, i) { return pad(c, widths[i]); }).join("")); });
if (errors.length) { console.error("\nПОМИЛКИ:\n" + errors.join("\n")); process.exit(1); }
console.log("\nOK: " + okCount + "/" + levels.length);
