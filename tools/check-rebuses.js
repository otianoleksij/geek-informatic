#!/usr/bin/env node
/* Перевірка ребусів: node tools/check-rebuses.js
   Читає content/rebusy/<мова>.json. Рахує відповідь із parts тією самою функцією, що й сторінка (activities/rebusy/rebus-core.js). */
"use strict";
var fs = require("fs"), path = require("path");
var CONTENT = path.join(__dirname, "..", "content", "rebusy");
var Core = require(path.join(__dirname, "..", "activities", "rebusy", "rebus-core.js"));

/* Дозволені емодзі для pic (Windows 10 з Segoe UI Emoji ≥ 1809 і Android 9 знають лише Emoji ≤ 11.0).
   Ключ з \uFE0F означає, що за замовчуванням символ текстовий (Emoji_Presentation=No) і FE0F обов'язковий.
   Значення — версія Emoji за unicode.org/Public/emoji/latest/emoji-test.txt. */
var MAX_EMOJI_VERSION = 11.0;
var EMOJI_TABLE = {
  "⚖\uFE0F": "1.0", "⛰\uFE0F": "0.7", "🌙": "0.6", "🌴": "0.6", "🌽": "0.6", "🍅": "0.6",
  "🍇": "0.6", "🍋": "1.0", "🍌": "0.6", "🍍": "0.6", "🍎": "0.6", "🍐": "1.0", "🍞": "0.6",
  "🍯": "0.6", "🎂": "0.6", "🎻": "0.6", "🏠": "0.6", "🏹": "1.0", "🐂": "1.0", "🐉": "1.0",
  "🐍": "0.6", "🐐": "1.0", "🐘": "0.6", "🐝": "0.6", "🐟": "0.6", "🐢": "0.6", "🐧": "0.6",
  "🐭": "0.6", "🐯": "0.6", "🐱": "0.6", "🐴": "0.6", "🐷": "0.6", "🐸": "0.6", "🐺": "0.6",
  "🐻": "0.6", "🐼": "0.6", "👁\uFE0F": "0.7", "👃": "0.6", "📖": "0.6", "🔑": "0.6", "🔥": "0.6",
  "🚀": "0.6", "🚜": "1.0", "🛁": "1.0", "🥁": "3.0", "🦀": "1.0", "🦁": "1.0", "🦆": "3.0",
  "🦈": "3.0", "🦌": "3.0", "🦓": "5.0", "🦔": "5.0", "🦷": "11.0", "🧀": "1.0", "🧚": "5.0",
  "🧱": "11.0"
};
var EMOJI_INFO = {};
Object.keys(EMOJI_TABLE).forEach(function (k) {
  EMOJI_INFO[k.replace(/\uFE0F/g, "")] = { v: EMOJI_TABLE[k], needFE: k.indexOf("\uFE0F") >= 0 };
});
function cps(s) { return Array.from(s).map(function (c) { return "U+" + c.codePointAt(0).toString(16).toUpperCase(); }).join(" "); }
function checkEmoji(p) {
  var base = p.replace(/\uFE0F/g, ""), info = EMOJI_INFO[base], hasFE = p.indexOf("\uFE0F") >= 0;
  if (!info) {
    return "емодзі «" + p + "» (" + cps(base) + ") немає в таблиці EMOJI_TABLE. Перевірте його версію на emojipedia.org або unicode.org (emoji-test.txt): вона має бути ≤ " +
      MAX_EMOJI_VERSION.toFixed(1) + " (інакше на Windows 10 та Android 9 буде квадратик). Якщо версія підходить — додайте емодзі в таблицю EMOJI_TABLE у tools/check-rebuses.js (з \\uFE0F у ключі, якщо його Emoji_Presentation=No)";
  }
  if (parseFloat(info.v) > MAX_EMOJI_VERSION) return "емодзі «" + p + "» має версію Emoji " + info.v + " > " + MAX_EMOJI_VERSION.toFixed(1) + " — на старих системах не відобразиться";
  if (info.needFE && !hasFE) return "емодзі «" + p + "» (" + cps(base) + ") має текстове відображення за замовчуванням: додайте після нього U+FE0F, інакше воно може показатися чорно-білим";
  if (!info.needFE && hasFE) return "емодзі «" + p + "» має зайвий U+FE0F: стандартне відображення цього емодзі вже кольорове";
  return null;
}


var files = fs.existsSync(CONTENT) ? fs.readdirSync(CONTENT).filter(function (f) { return /\.json$/.test(f); }).sort() : [];
if (!files.length) { console.error("немає content/rebusy/*.json"); process.exit(1); }
var failed = 0;
files.forEach(function (f) { if (!checkFile(f)) failed++; });
if (failed) process.exit(1);

function checkFile(file) {
var doc;
try { doc = JSON.parse(fs.readFileSync(path.join(CONTENT, file), "utf8")); } catch (e) { console.error(file + ": " + e.message); return false; }
var lang = file.replace(/\.json$/, "");
var data = doc.rebuses;
var GROUPS = {}, groupList = [];
var errors = [];
function err(id, msg) { errors.push(id + ": " + msg); }

if (doc.format !== 1) errors.push("format має бути 1");
if (doc.lang !== lang) errors.push("lang «" + doc.lang + "» не збігається з назвою файлу " + file);
if (!Array.isArray(data)) { console.error(file + ": rebuses не є масивом"); return false; }
if (!Array.isArray(doc.groups) || !doc.groups.length) { console.error(file + ": немає groups"); return false; }
doc.groups.forEach(function (g) {
  if (!g || !g.id || !g.label) { errors.push("група без id або label"); return; }
  if (GROUPS[g.id] !== undefined) errors.push("група " + g.id + " повторюється");
  GROUPS[g.id] = true; groupList.push(g.id);
});
if (!data.length) errors.push("немає жодного ребуса");

var seenId = {}, seenAns = {}, count = {}, rows = [];
var seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("uk", { granularity: "grapheme" }) : null;

data.forEach(function (r, idx) {
  var id = (r && r.id) || "#" + idx;
  ["id", "g", "answer", "hint", "parts"].forEach(function (f) { if (!r || r[f] == null || r[f] === "") err(id, "немає поля " + f); });
  if (!r) return;
  if (seenId[r.id]) err(id, "дублікат id"); seenId[r.id] = 1;
  if (GROUPS[r.g] === undefined) err(id, "невідома група " + r.g); else count[r.g] = (count[r.g] || 0) + 1;
  var na = Core.normalize(r.answer);
  if (!/^[А-ЯІЇЄҐ]+$/.test(na)) err(id, "відповідь має містити лише великі українські літери: " + na);
  if (seenAns[na]) err(id, "дублікат відповіді " + na + " (також " + seenAns[na] + ")"); seenAns[na] = r.id;
  if (r.hint) {
    var h = Core.normalize(r.hint).toLowerCase();
    var root4 = na.toLowerCase().slice(0, Math.min(4, na.length));
    if (na.length <= 4 ? h.indexOf(na.toLowerCase()) >= 0 : h.indexOf(root4) >= 0) err(id, "підказка містить слово/корінь відповіді («" + root4 + "»)");
    if (r.hint.length > 120) err(id, "підказка задовга (" + r.hint.length + ")");
  }
  var computed = "";
  try { computed = Core.solve(r.parts); } catch (e) { err(id, "помилка в parts: " + e.message); }
  if (computed && Core.normalize(computed) !== na) err(id, "відповідь " + na + " ≠ обчислено " + Core.normalize(computed));
  if (Array.isArray(r.parts)) {
    if (r.parts.length < 2 || r.parts.length > 4) err(id, "частин має бути 2–4, а є " + r.parts.length);
    var hasVisual = false, plain = 0;
    r.parts.forEach(function (p, i) {
      var k = Core.kind(p);
      if (!k) { err(id, "частина " + (i + 1) + ": невідомий тип"); return; }
      if (k === "pic") {
        hasVisual = true;
        if (seg && Array.from(seg.segment(p.pic)).length !== 1) err(id, "частина " + (i + 1) + ": pic має бути одним емодзі");
        var em = checkEmoji(p.pic); if (em) err(id, "частина " + (i + 1) + ": " + em);
      }
      if (k === "num") { hasVisual = true; if (!/^\d+$/.test(p.num)) err(id, "частина " + (i + 1) + ": num має бути числом"); }
      if (k !== "txt" && !/^[А-ЯІЇЄҐ]+$/.test(p.w || "")) err(id, "частина " + (i + 1) + ": w має бути великими літерами");
      if (k === "txt") plain += Array.from(Core.lettersOf(p)).length;
    });
    if (!hasVisual) err(id, "немає жодної картинки");
    if (!r.parts.some(function (p) { return Core.kind(p) === "pic"; })) err(id, "потрібна хоча б одна картинка");
    if (na.length && plain / na.length > 0.41) err(id, "завелика частка звичайних літер: " + plain + "/" + na.length);
  }
  rows.push([r.id, r.g, na, computed ? Core.normalize(computed) : "—"]);
});

groupList.forEach(function (g) { if (!count[g]) errors.push("група " + g + " порожня: у ній немає жодного ребуса (додайте ребус або приберіть групу з groups)"); });

function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
console.log("\n== " + file + " ==");
console.log(pad("id", 6) + pad("група", 7) + pad("відповідь", 18) + "обчислено");
rows.forEach(function (r) { console.log(pad(r[0], 6) + pad(r[1], 7) + pad(r[2], 18) + r[3] + (r[2] === r[3] ? "" : "   <-- НЕ СПІВПАДАЄ")); });

var bad = {};
errors.forEach(function (e) { bad[e.split(":")[0]] = 1; });
console.log("\nУсього: " + data.length + " | груп: " + Object.keys(count).map(function (g) { return g + "=" + count[g]; }).join(", "));
if (errors.length) {
  console.error("\nПОМИЛКИ (" + errors.length + "), id: " + Object.keys(bad).join(", "));
  errors.forEach(function (e) { console.error(" - " + e); });
  return false;
}
console.log("OK: " + file + ": " + data.length + " ребусів пройшли перевірку.");
return true;
}
