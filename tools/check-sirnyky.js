#!/usr/bin/env node
/* Перевірка задач з сірниками: node tools/check-sirnyky.js
   Розв'язує кожну задачу тим самим ядром, що й сторінка (activities/sirnyky/sirnyky-core.js),
   і порівнює з полем answers. */
"use strict";
var fs = require("fs"), path = require("path");
var Core = require(path.join(__dirname, "..", "activities", "sirnyky", "sirnyky-core.js"));
var FILE = path.join(__dirname, "..", "content", "sirnyky", "puzzles.json");
var EXPECTED = 50;

var doc;
try { doc = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { console.error("content/sirnyky/puzzles.json: " + e.message); process.exit(1); }
var errors = [];
function err(id, msg) { errors.push(id + ": " + msg); }
if (doc.format !== 1) errors.push("format має бути 1");
var list = doc.puzzles;
if (!Array.isArray(list)) { console.error("puzzles не є масивом"); process.exit(1); }
if (list.length !== EXPECTED) errors.push("задач має бути " + EXPECTED + ", а є " + list.length);

var seen = {}, goals = {};
list.forEach(function (p, i) {
  var id = (p && p.id) || "#" + (i + 1);
  if (!p) { err(id, "порожній запис"); return; }
  if (seen[p.id]) err(id, "дублікат id");
  seen[p.id] = 1;
  if (["fix", "max", "min"].indexOf(p.goal) < 0) { err(id, "невідома мета " + p.goal); return; }
  goals[p.goal] = (goals[p.goal] || 0) + 1;
  if (typeof p.expr !== "string" || !/^[0-9+\-=]+$/.test(p.expr)) { err(id, "expr має складатися з цифр і знаків + - ="); return; }
  for (var k = 0; k < p.expr.length; k++) {
    try { Core.segsOf(p.expr.charAt(k)); } catch (e) { err(id, "символ «" + p.expr.charAt(k) + "» не малюється"); }
  }
  if (p.goal !== "fix" && !/^[0-9]+$/.test(p.expr)) err(id, "для мети " + p.goal + " вираз має містити лише цифри");
  if (p.goal === "fix" && Core.isTrueEquation(p.expr)) err(id, "вираз " + p.expr + " уже є правильною рівністю");
  if (p.level !== 1 && p.level !== 2 && p.level !== 3) err(id, "level має бути 1, 2 або 3");
  if (!Array.isArray(p.answers) || !p.answers.length) { err(id, "немає answers"); return; }
  var solved = Core.solve(p.expr, p.goal);
  if (!solved.length) err(id, "задача " + p.expr + " (" + p.goal + ") не має розв'язку");
  if (p.answers.indexOf(p.expr) >= 0) err(id, "вираз сам є відповіддю");
  if (JSON.stringify(solved) !== JSON.stringify(p.answers)) {
    err(id, "answers " + JSON.stringify(p.answers) + " ≠ обчислено " + JSON.stringify(solved));
  }
  p.answers.forEach(function (a) { if (!Core.moveFor(p.expr, a)) err(id, "для відповіді " + a + " немає ходу"); });
});

if (errors.length) {
  console.error("ПОМИЛКИ (" + errors.length + "):");
  errors.forEach(function (e) { console.error(" - " + e); });
  process.exit(1);
}
console.log("OK: " + list.length + " задач з сірниками пройшли перевірку (" +
  Object.keys(goals).sort().map(function (g) { return g + "=" + goals[g]; }).join(", ") + ").");
