#!/usr/bin/env node
/* Перевірка рівнів: node tools/check-robot.js */
"use strict";
var path = require("path");
var root = path.join(__dirname, "..", "robot");
var Core = require(path.join(root, "robot-core.js"));
var levels = require(path.join(root, "levels.js"));
var errors = [], rows = [];
function err(n, msg) { errors.push("рівень " + n + ": " + msg); }

if (!Array.isArray(levels) || levels.length !== 10) { console.error("потрібно рівно 10 рівнів"); process.exit(1); }
var okCount = 0;
levels.forEach(function (lv, idx) {
  var n = lv.n, before = errors.length;
  if (n !== idx + 1) err(n, "номер має бути " + (idx + 1));
  ["title", "tip"].forEach(function (f) { if (!lv[f]) err(n, "немає " + f); });
  var map = lv.map;
  if (!Array.isArray(map) || !map.length) { err(n, "немає map"); return; }
  var w = map[0].length, starts = 0, gems = 0, bad = false;
  map.forEach(function (r, y) {
    if (r.length !== w) { err(n, "поле не прямокутне (рядок " + (y + 1) + ")"); bad = true; }
    for (var x = 0; x < r.length; x++) {
      var c = r.charAt(x);
      if (".#SG".indexOf(c) < 0) { err(n, "невідомий символ «" + c + "»"); bad = true; }
      if (c === "S") starts++;
      if (c === "G") gems++;
    }
  });
  if (bad) return;
  if (starts !== 1) err(n, "стартів має бути 1, а є " + starts);
  if (gems < 1) err(n, "немає кристалів");
  if (typeof lv.maxBlocks !== "number" || typeof lv.par !== "number") err(n, "немає maxBlocks/par");
  if (typeof lv.loops !== "boolean") err(n, "loops має бути boolean");
  var sol = lv.solution, minMoves = Core.shortestPath(lv), blocks = "—";
  if (!Array.isArray(sol)) { err(n, "немає solution"); }
  else {
    blocks = Core.countBlocks(sol);
    var hasRep = false;
    sol.forEach(function (it) {
      if (typeof it === "string") { if (!Core.VEC[it]) err(n, "невідома команда " + it); }
      else {
        hasRep = true;
        if (!it.body || !it.body.length) err(n, "порожній повтор");
        if (!(it.rep >= 2 && it.rep <= 5)) err(n, "повтор має бути 2–5, а є " + it.rep);
        (it.body || []).forEach(function (d) { if (typeof d !== "string" || !Core.VEC[d]) err(n, "вкладені повтори/невідома команда у повторі"); });
      }
    });
    if (hasRep && !lv.loops) err(n, "розв'язок має повтор, а loops:false");
    var res = Core.run(lv, sol);
    if (!res.win) err(n, "розв'язок не виграє (зібрано " + res.gemsCollected + "/" + res.total + ", crashedAt " + res.crashedAt + ")");
    if (blocks > lv.maxBlocks) err(n, "блоків у розв'язку " + blocks + " > maxBlocks " + lv.maxBlocks);
    if (lv.par !== blocks) err(n, "par " + lv.par + " ≠ блоків у розв'язку " + blocks);
    if (res.win && minMoves >= 0 && res.moves < minMoves) err(n, "розв'язок коротший за мінімум (?)");
  }
  if (minMoves < 0) err(n, "shortestPath: кристали недосяжні");
  else if (lv.loops && !(lv.maxBlocks < minMoves)) err(n, "для loops maxBlocks (" + lv.maxBlocks + ") має бути меншим за мін. ходів (" + minMoves + ")");
  var size = w + "×" + map.length;
  rows.push([n, size, gems, minMoves, blocks, lv.maxBlocks, lv.loops ? "так" : "—"]);
  if (errors.length === before) okCount++;
});

var head = ["Рівень", "Розмір", "Кристали", "Мін.ходів", "Блоків", "maxBlocks", "Повтори"];
function pad(s, k) { s = String(s); while (s.length < k) s += " "; return s; }
console.log(head.map(function (h, i) { return pad(h, i === 0 ? 7 : 10); }).join(""));
rows.forEach(function (r) { console.log(r.map(function (c, i) { return pad(c, i === 0 ? 7 : 10); }).join("")); });
if (errors.length) { console.error("\nПОМИЛКИ:\n" + errors.join("\n")); process.exit(1); }
console.log("\nOK: " + okCount + "/" + levels.length);
