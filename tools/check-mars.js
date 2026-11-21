#!/usr/bin/env node
/* Перевірка гри «Марсохід у лабіринті»: node tools/check-mars.js */
"use strict";
var path = require("path");
var Core = require(path.join(__dirname, "..", "mars", "mars-core.js"));
var errors = [];
function err(m) { if (errors.length < 30) errors.push(m); else if (errors.length === 30) errors.push("..."); }
var N = 500, MAX = 1500;

/* 1. Генератор */
var diffSeeds = {};
for (var seed = 1; seed <= N; seed++) {
  var m = Core.generate(seed, 10, 10);
  if (m.w !== 10 || m.h !== 10 || m.walls.length !== 100) { err("зерно " + seed + ": розмір"); continue; }
  var passages = 0, sym = true, x, y;
  for (y = 0; y < 10; y++) for (x = 0; x < 10; x++) {
    var c = m.walls[y * 10 + x];
    if (x < 9) { var okE = ((c & 2) !== 0) === ((m.walls[y * 10 + x + 1] & 8) !== 0); if (!okE) sym = false; if (!(c & 2)) passages++; }
    else if (!(c & 2)) sym = false;
    if (y < 9) { var okS = ((c & 4) !== 0) === ((m.walls[(y + 1) * 10 + x] & 1) !== 0); if (!okS) sym = false; if (!(c & 4)) passages++; }
    else if (!(c & 4)) sym = false;
    if (x === 0 && !(c & 8)) sym = false;
    if (y === 0 && !(c & 1)) sym = false;
  }
  if (!sym) err("зерно " + seed + ": стіни несиметричні або немає зовнішньої рамки");
  if (passages !== 99) err("зерно " + seed + ": проходів " + passages + " замість 99");
  var seen = {}, q = [0], cnt = 1; seen[0] = true;
  while (q.length) {
    var cur = q.pop(), cx = cur % 10, cy = (cur - cx) / 10;
    for (var d = 0; d < 4; d++) {
      if (m.walls[cur] & Core.BIT[d]) continue;
      var nx = cx + Core.DX[d], ny = cy + Core.DY[d], ni = ny * 10 + nx;
      if (!seen[ni]) { seen[ni] = true; cnt++; q.push(ni); }
    }
  }
  if (cnt !== 100) err("зерно " + seed + ": досяжних клітинок " + cnt);
  if (JSON.stringify(Core.generate(seed, 10, 10).walls) !== JSON.stringify(m.walls)) err("зерно " + seed + ": недетермінований");
  diffSeeds[m.walls.join(",")] = 1;
}
if (Object.keys(diffSeeds).length < N * 0.99) err("замало різних лабіринтів: " + Object.keys(diffSeeds).length);

/* 2-4. Програми */
var RIGHT = [{ while: "notFinish", body: ["R", { while: "wallAhead", body: ["L"] }, "F"] }];
var LEFT = [{ while: "notFinish", body: ["L", { while: "wallAhead", body: ["R"] }, "F"] }];
var NAIVE = [{ while: "notFinish", body: [{ if: "wallAhead", then: ["L"], else: ["F"] }] }];
function stats(prog) {
  var win = 0, sum = 0, max = 0, fail = {};
  for (var s = 1; s <= N; s++) {
    var r = Core.runAll(Core.generate(s, 10, 10), prog, { maxSteps: MAX });
    if (r.status === "finish") { win++; sum += r.steps; if (r.steps > max) max = r.steps; }
    else fail[r.status] = (fail[r.status] || 0) + 1;
  }
  return { win: win, avg: win ? sum / win : 0, max: max, fail: fail };
}
var sr = stats(RIGHT), sl = stats(LEFT), sn = stats(NAIVE);
if (sr.win !== N) err("права рука пройшла лише " + sr.win + " з " + N);
if (sl.win !== N) err("ліва рука пройшла лише " + sl.win + " з " + N);
if (sn.win === N) err("наївна програма пройшла всі лабіринти (має провалюватися)");
console.log("Права рука: " + sr.win + "/" + N + ", кроків (рухи+повороти) середнє " + sr.avg.toFixed(1) + ", максимум " + sr.max + " (ліміт " + MAX + ")");
console.log("Ліва рука:  " + sl.win + "/" + N + ", середнє " + sl.avg.toFixed(1) + ", максимум " + sl.max);
console.log("Наївна:     " + sn.win + "/" + N + " пройшли, провалів " + ((N - sn.win) / N * 100).toFixed(1) + "% " + JSON.stringify(sn.fail));

/* 5. Удар і ліміт */
var m1 = Core.generate(7, 10, 10);
var bump = Core.runAll(m1, ["F", "F", "F", "F", "F", "F", "F", "F", "F", "F", "F"], { maxSteps: MAX });
if (bump.status !== "bump" && bump.status !== "finish") err("очікувався bump, а " + bump.status);
var wallProg = ["L", "F"];                      /* з (0,0) на північ — зовнішня стіна */
var b2 = Core.runAll(m1, wallProg);
if (b2.status !== "bump") err("рух у зовнішню стіну має давати bump, а " + b2.status);
var evs = [], g = Core.createRun(m1, wallProg), r;
while (!(r = g.next()).done) evs.push(r.value.type);
if (evs.join() !== "turn,bump") err("події: " + evs.join());
var lim = Core.runAll(m1, [{ while: "notFinish", body: ["L"] }], { maxSteps: 100 });
if (lim.status !== "limit") err("очікувався limit, а " + lim.status);
var lim2 = Core.runAll(m1, [{ while: "notFinish", body: [] }], { maxSteps: 100 });
if (lim2.status !== "limit") err("порожній цикл має давати limit, а " + lim2.status);
var end = Core.runAll(m1, ["R"]);
if (end.status !== "end") err("очікувався end, а " + end.status);
console.log("Удар/ліміт/кінець програми: " + [bump.status, lim.status, end.status].join(", "));

if (errors.length) { console.error("ПОМИЛКИ:\n" + errors.join("\n")); process.exit(1); }
console.log("OK");
