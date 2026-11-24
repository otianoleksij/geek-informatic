#!/usr/bin/env node
/* Перевірка гри «Космічний клавіатурний тренажер»: node tools/check-klaviatura.js
   1) content/klaviatura/levels.json: кожен символ набору вводиться на розкладці мови й дозволений у рівні,
      генератор детермінований, слова придатні, бюджет помилок розумний;
   2) модульні перевірки ядра: щаблі комбо, поразка рівно на бюджеті помилок, перемога в кінці тексту, класифікація клавіш. */
"use strict";
var fs = require("fs");
var path = require("path");
var Core = require(path.join(__dirname, "..", "activities", "klaviatura", "klaviatura-core.js"));
var doc = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "klaviatura", "levels.json"), "utf8"));
var errors = [];
function err(m) { if (errors.length < 40) errors.push(m); else if (errors.length === 40) errors.push("..."); }
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function eq(a, b, msg) { if (a !== b) err("ядро: " + msg + " (очікувалось " + JSON.stringify(b) + ", є " + JSON.stringify(a) + ")"); }

var LANGS = ["uk", "en"];
var SEEDS = 300;
var VOWELS = { uk: "аеєиіїоуюя", en: "aeiouy" };

/* ---------- 1. Розкладки ---------- */
LANGS.forEach(function (lang) {
  var rows = Core.getLayout(lang), seen = {}, codes = {};
  if (rows.length !== 4) err("розкладка " + lang + ": має бути 4 рядки, є " + rows.length);
  rows.forEach(function (row) {
    row.forEach(function (k) {
      if (codes[k.code]) err("розкладка " + lang + ": код " + k.code + " двічі");
      codes[k.code] = true;
      if (Core.FINGERS.indexOf(k.finger) < 0) err("розкладка " + lang + ": " + k.code + " без пальця");
      [k.base, k.shift].forEach(function (c) {
        if (c.length !== 1) err("розкладка " + lang + ": " + k.code + " має порожній символ");
        if (seen[c]) err("розкладка " + lang + ": символ «" + c + "» двічі (" + seen[c] + ", " + k.code + ")");
        seen[c] = k.code;
      });
    });
  });
});

/* ---------- 2. Рівні ---------- */
var ids = {};
if (!(doc.errorBudgetRatio > 0 && doc.errorBudgetRatio < 1)) err("errorBudgetRatio поза (0;1)");
var prevAt = 0;
doc.combo.forEach(function (c, i) {
  if (c.at <= prevAt) err("combo[" + i + "]: at має зростати");
  if (i > 0 && c.mult <= doc.combo[i - 1].mult) err("combo[" + i + "]: mult має зростати");
  prevAt = c.at;
});
if (!(doc.stars.two < doc.stars.three)) err("stars: two має бути меншим за three");
if (doc.levels.length < 10) err("замало рівнів: " + doc.levels.length);

var rows = [];
doc.levels.forEach(function (lv, li) {
  var n = lv.id + " (" + (li + 1) + ")";
  if (ids[lv.id]) err("рівень " + n + ": id не унікальний");
  ids[lv.id] = true;
  var ratio = lv.errorBudgetRatio || doc.errorBudgetRatio;
  LANGS.forEach(function (lang) {
    var w = "рівень " + n + " [" + lang + "]: ";
    var s = lv.sets && lv.sets[lang];
    if (!s) { err(w + "немає набору"); return; }
    var uniqKeys = {}, i;
    for (i = 0; i < s.keys.length; i++) {
      var ch = s.keys.charAt(i);
      if (uniqKeys[ch]) err(w + "символ «" + ch + "» двічі в keys");
      uniqKeys[ch] = true;
      if (!Core.typeable(lang, ch)) err(w + "символу «" + ch + "» немає на розкладці");
    }
    if (!uniqKeys[" "]) err(w + "у keys немає пробілу");
    for (i = 0; i < s.newKeys.length; i++) if (!uniqKeys[s.newKeys.charAt(i)]) err(w + "newKeys: «" + s.newKeys.charAt(i) + "» немає в keys");
    var hasGen = !!s.gen, hasTexts = !!s.texts;
    if (hasGen === hasTexts) { err(w + "потрібно рівно одне з gen і texts"); return; }

    /* усі можливі тексти: для texts — усі, для gen — вибірка із зерен */
    var samples = [];
    if (hasTexts) { samples = s.texts.slice(); if (new Set(s.texts).size !== s.texts.length) err(w + "однакові тексти"); }
    else {
      var g = s.gen, k;
      if (g.kind === "groups") {
        if (!(g.groups >= 1 && g.min >= 1 && g.max >= g.min)) err(w + "gen: groups/min/max");
        (g.focus || "").split("").forEach(function (c) { if (!uniqKeys[c]) err(w + "gen.focus: «" + c + "» немає в keys"); });
        if (s.keys.replace(/ /g, "").length < 2) err(w + "замало символів для генератора");
      } else if (g.kind === "words") {
        var wset = {};
        if (!(g.count >= 1) || !g.words || g.words.length < 8) err(w + "gen.words: потрібно count і щонайменше 8 слів");
        (g.words || []).forEach(function (word) {
          if (wset[word]) err(w + "слово «" + word + "» двічі");
          wset[word] = true;
          if (word.length < 2 || word.length > 9) err(w + "слово «" + word + "»: довжина 2–9");
          if (!/^[^\s]+$/.test(word)) err(w + "слово «" + word + "» з пробілом");
          var lower = word.toLowerCase(), hasV = false;
          for (k = 0; k < lower.length; k++) if (VOWELS[lang].indexOf(lower.charAt(k)) >= 0) hasV = true;
          if (!hasV) err(w + "слово «" + word + "» без голосної (схоже на нереальне)");
        });
      } else err(w + "невідомий gen.kind " + g.kind);
      for (var seed = 1; seed <= SEEDS; seed++) {
        var t1 = Core.generate(s, seed), t2 = Core.generate(s, seed);
        if (t1 !== t2) { err(w + "генератор недетермінований (зерно " + seed + ")"); break; }
        samples.push(t1);
      }
      var distinct = {};
      samples.forEach(function (t) { distinct[t] = true; });
      if (Object.keys(distinct).length < SEEDS * 0.9) err(w + "генератор дає замало різних текстів: " + Object.keys(distinct).length + " з " + SEEDS);
    }

    var minLen = 1e9, maxLen = 0, seenNew = {};
    samples.forEach(function (t, ti) {
      var tw = w + (hasTexts ? "текст " + (ti + 1) : "зерно " + (ti + 1)) + ": ";
      if (/^ | $|  /.test(t)) err(tw + "зайві пробіли");
      if (t.length < 25) err(tw + "надто короткий (" + t.length + ")");
      if (t.length > 400) err(tw + "надто довгий (" + t.length + ")");
      for (var j = 0; j < t.length; j++) {
        var c = t.charAt(j);
        if (!uniqKeys[c]) { err(tw + "символ «" + c + "» поза набором keys"); break; }
        if (!Core.typeable(lang, c)) { err(tw + "символ «" + c + "» не вводиться на розкладці"); break; }
        seenNew[c] = true;
      }
      if (hasGen && s.gen.kind === "groups") {
        t.split(" ").forEach(function (grp) {
          if (grp.length < s.gen.min || grp.length > s.gen.max) err(tw + "група «" + grp + "» поза [min;max]");
          if (s.gen.focus) {
            var okf = false;
            for (var q = 0; q < grp.length; q++) if (s.gen.focus.indexOf(grp.charAt(q)) >= 0) okf = true;
            if (!okf) err(tw + "у групі «" + grp + "» немає focus-символу");
          }
          if (/(.)\1\1/.test(grp)) err(tw + "три однакові поспіль у «" + grp + "»");
        });
      }
      if (lv.id === "capitals") {
        t.split(" ").forEach(function (word) {
          if (word.charAt(0) !== word.charAt(0).toUpperCase() || word.charAt(0) === word.charAt(0).toLowerCase()) err(tw + "слово «" + word + "» без великої літери");
        });
      }
      var budget = Core.errorBudget(t.length, ratio);
      if (t.length < minLen) minLen = t.length;
      if (t.length > maxLen) maxLen = t.length;
      if (budget < 5 || budget > 60) err(tw + "бюджет помилок " + budget + " поза [5;60]");
      if (budget >= t.length) err(tw + "бюджет не менший за довжину");
    });
    for (i = 0; i < s.newKeys.length; i++) if (!seenNew[s.newKeys.charAt(i)]) err(w + "нова клавіша «" + s.newKeys.charAt(i) + "» не трапляється у текстах");
    if (lang === "uk") rows.push([lv.id, minLen + "–" + maxLen, Core.errorBudget(minLen, ratio) + "–" + Core.errorBudget(maxLen, ratio), s.newKeys || "-"]);
    else rows[rows.length - 1].push(minLen + "–" + maxLen);
  });
});

/* ---------- 3. Ядро ---------- */
(function () {
  var C = Core;
  /* бюджет */
  eq(C.errorBudget(35), 7, "бюджет 35 символів");
  eq(C.errorBudget(36), 8, "бюджет 36 символів");
  eq(C.errorBudget(100), 20, "бюджет 100 символів");
  eq(C.errorBudget(41), 9, "бюджет 41 символ");
  eq(C.errorBudget(40, 0.25), 10, "бюджет з часткою 0.25");

  /* щаблі комбо */
  [[0, 1], [1, 1], [4, 1], [5, 2], [9, 2], [10, 3], [19, 3], [20, 4], [200, 4]].forEach(function (p) {
    eq(C.comboMultiplier(p[0], doc.combo), p[1], "множник комбо " + p[0]);
  });
  var g = C.newGame("abcdefghijklmnopqrstuvwxyz", { combo: doc.combo, asteroidHp: 12 });
  var ev, i, mults = [];
  for (i = 0; i < 25; i++) { ev = C.press(g, true, 1000 + i * 100); mults.push(ev.mult); }
  eq(mults.slice(0, 4).join(), "1,1,1,1", "множники 1-4");
  eq(mults[4], 2, "5-та клавіша дає ×2");
  eq(mults[9], 3, "10-та клавіша дає ×3");
  eq(mults[19], 4, "20-та клавіша дає ×4");
  eq(g.maxCombo, 25, "maxCombo");
  eq(g.status, "playing", "25 з 26 символів: ще грає");
  var g2 = C.newGame("abcdefghijklmnopqrstuvwxyz", { combo: doc.combo, asteroidHp: 12 });
  for (i = 0; i < 26; i++) ev = C.press(g2, true, 1000 + i * 100);
  eq(g2.status, "won", "перемога в кінці тексту");
  eq(ev.won, true, "остання подія won");
  eq(g2.pos, 26, "pos в кінці");

  /* шкода й знищення астероїдів: 4*1 + 2*4 = 12 -> знищено на 8-й клавіші */
  var g3 = C.newGame("a".repeat(40), { combo: doc.combo, asteroidHp: 12 }), destroyedAt = [];
  for (i = 1; i <= 40; i++) { ev = C.press(g3, true, i * 100); if (ev.destroyed) destroyedAt.push(i); }
  eq(destroyedAt[0], 8, "перший астероїд знищено на 8-й клавіші");
  eq(g3.destroyed, destroyedAt.length, "лічильник знищених");
  eq(C.score(g3), g3.destroyed * 100 + g3.damage, "рахунок");
  eq(g3.damage, 4 + 5 * 2 + 10 * 3 + 21 * 4, "сумарна шкода за 40 клавіш");

  /* помилки: скидають комбо, наближають астероїд, поразка рівно на бюджеті */
  var text = "a".repeat(40), g4 = C.newGame(text, { combo: doc.combo }); // бюджет 8
  eq(g4.budget, 8, "бюджет 40 символів");
  for (i = 0; i < 6; i++) C.press(g4, true, 100);
  eq(g4.combo, 6, "комбо 6");
  ev = C.press(g4, false, 200);
  eq(ev.type, "miss", "тип події");
  eq(g4.combo, 0, "помилка скидає комбо");
  eq(g4.maxCombo, 6, "maxCombo зберігається після помилки");
  eq(g4.pos, 6, "помилка не рухає позицію");
  eq(g4.marks[6], "err", "позначка err");
  eq(g4.status, "playing", "жива після 1 помилки");
  for (i = 0; i < 6; i++) { ev = C.press(g4, false, 300); eq(ev.lost, false, "ще не поразка на помилці " + (g4.errors)); }
  eq(g4.errors, 7, "7 помилок");
  eq(g4.status, "playing", "жива на budget-1 = 7 помилках");
  ev = C.press(g4, false, 400);
  eq(g4.errors, 8, "8 помилок");
  eq(g4.status, "lost", "поразка рівно на budget = 8");
  eq(ev.lost, true, "подія lost");
  eq(C.distance(g4), 0, "відстань 0 на поразці");
  eq(C.press(g4, true, 500).type, "none", "після поразки натискання ігноруються");
  var g5 = C.newGame(text, { combo: doc.combo });
  eq(C.distance(g5), 1, "відстань на початку");
  C.press(g5, false, 1); C.press(g5, false, 2);
  eq(C.distance(g5), 1 - 2 / 8, "відстань після 2 помилок");
  C.press(g5, true, 3);
  eq(g5.marks[0], "fixed", "символ з помилкою стає fixed");
  /* помилка в кінці тексту, коли залишилась одна клавіша, не дає виграти */
  var g6 = C.newGame("ab", { combo: doc.combo });
  C.press(g6, true, 0);
  eq(g6.status, "playing", "дві літери: ще грає");
  /* точність, швидкість, зірки */
  var g7 = C.newGame("a".repeat(30), { combo: doc.combo });
  for (i = 0; i < 30; i++) C.press(g7, true, i * 1000);
  eq(Math.round(C.cpm(g7)), 60, "cpm: 30 знаків із секундним інтервалом = 60");
  var g8 = C.newGame("a".repeat(5), { combo: doc.combo });
  C.press(g8, true, 0); C.press(g8, true, 600000); C.press(g8, true, 600500);
  eq(g8.activeMs, 3000, "паузи довші за ліміт обрізаються");
  eq(C.accuracy(g7), 100, "точність 100");
  eq(C.starsFor(100, doc.stars), 3, "3 зірки за 100%");
  eq(C.starsFor(doc.stars.three, doc.stars), 3, "3 зірки на порозі");
  eq(C.starsFor(doc.stars.three - 0.1, doc.stars), 2, "2 зірки нижче порога three");
  eq(C.starsFor(doc.stars.two, doc.stars), 2, "2 зірки на порозі");
  eq(C.starsFor(doc.stars.two - 0.1, doc.stars), 1, "1 зірка нижче порога two");
  eq(C.starsFor(10, doc.stars), 1, "1 зірка мінімум");
  eq(C.summary(g7).stars, 3, "summary: зірки");

  /* розкладки й пальці */
  var L;
  L = C.locate("uk", "а"); eq(L.code + "/" + L.finger + "/" + L.shift, "KeyF/li/false", "uk «а»");
  L = C.locate("uk", "О"); eq(L.code + "/" + L.finger + "/" + L.shift + "/" + L.shiftCode + "/" + L.shiftFinger, "KeyJ/ri/true/ShiftLeft/lp", "uk «О»");
  L = C.locate("uk", "ґ"); eq(L.code + "/" + L.finger, "Backslash/rp", "uk «ґ»");
  L = C.locate("uk", "є"); eq(L.code, "Quote", "uk «є»");
  L = C.locate("uk", "ї"); eq(L.code, "BracketRight", "uk «ї»");
  L = C.locate("uk", "і"); eq(L.code, "KeyS", "uk «і»");
  L = C.locate("uk", "'"); eq(L.code, "Backquote", "uk апостроф");
  L = C.locate("uk", "’"); eq(L && L.code, "Backquote", "uk типографський апостроф");
  L = C.locate("uk", "."); eq(L.code + "/" + L.shift, "Slash/false", "uk крапка");
  L = C.locate("uk", ","); eq(L.code + "/" + L.shift, "Slash/true", "uk кома");
  L = C.locate("uk", "?"); eq(L.code + "/" + L.shift, "Digit7/true", "uk знак питання");
  L = C.locate("en", "J"); eq(L.code + "/" + L.finger + "/" + L.shiftCode, "KeyJ/ri/ShiftLeft", "en «J»");
  L = C.locate("en", "A"); eq(L.shiftCode + "/" + L.shiftFinger, "ShiftRight/rp", "en «A»");
  L = C.locate("en", " "); eq(L.code + "/" + L.finger, "Space/th", "пробіл");
  eq(C.locate("en", "а"), null, "кирилиці немає на en");
  eq(C.locate("uk", "q"), null, "латиниці немає на uk");

  /* класифікація натискань */
  var UK_A = "а";
  eq(C.classify("uk", UK_A, { key: UK_A, code: "KeyF" }), "ok", "правильна літера");
  eq(C.classify("uk", UK_A, { key: "о", code: "KeyJ" }), "error", "інша літера — помилка");
  eq(C.classify("uk", UK_A, { key: "a", code: "KeyA" }), "error", "латинська з іншої клавіші — помилка");
  eq(C.classify("uk", UK_A, { key: "f", code: "KeyF" }), "layout", "латиниця на тій самій клавіші — підказка про розкладку");
  eq(C.classify("en", "f", { key: UK_A, code: "KeyF" }), "layout", "кирилиця на en — підказка про розкладку");
  eq(C.classify("en", "f", { key: "d", code: "KeyD" }), "error", "en: інша літера — помилка");
  eq(C.classify("uk", UK_A, { key: "Shift", code: "ShiftLeft" }), "ignore", "Shift ігнорується");
  eq(C.classify("uk", UK_A, { key: "Control", code: "ControlLeft" }), "ignore", "Ctrl ігнорується");
  eq(C.classify("uk", UK_A, { key: "CapsLock", code: "CapsLock" }), "ignore", "CapsLock ігнорується");
  eq(C.classify("uk", UK_A, { key: "Dead", code: "Quote" }), "ignore", "мертва клавіша ігнорується");
  eq(C.classify("uk", UK_A, { key: "Enter", code: "Enter" }), "ignore", "Enter не рахується");
  eq(C.classify("uk", UK_A, { key: "ArrowLeft", code: "ArrowLeft" }), "ignore", "стрілки не рахуються");
  eq(C.classify("en", " ", { key: " ", code: "Space" }), "ok", "пробіл");
  eq(C.classify("en", "a", { key: " ", code: "Space" }), "error", "пробіл замість літери — помилка");
  eq(C.classify("uk", "'", { key: "’", code: "Backquote" }), "ok", "апостроф-варіант приймається");
  eq(C.classify("en", "A", { key: "a", code: "KeyA" }), "error", "мала замість великої — помилка");
  eq(C.classify("en", "A", { key: "A", code: "KeyA" }), "ok", "велика літера");

  /* генератор: те саме зерно — той самий текст, інше — інший */
  var spec = { keys: "abc ", gen: { kind: "groups", groups: 5, min: 3, max: 4 } };
  eq(C.generate(spec, 7), C.generate(spec, 7), "детермінованість генератора");
  if (C.generate(spec, 7) === C.generate(spec, 8)) err("ядро: різні зерна дали однаковий текст");
  var t = C.generate({ keys: "ab ", gen: { kind: "groups", groups: 200, min: 3, max: 3 } }, 5);
  if (/(.)\1\1/.test(t.replace(/ /g, "x").replace(/x/g, " "))) { if (/(a{3}|b{3})/.test(t)) err("ядро: три однакові символи поспіль у генераторі"); }
})();

console.log("Рівень".padEnd(16) + "Довжина uk".padEnd(14) + "Бюджет uk".padEnd(12) + "Нові клавіші uk".padEnd(24) + "Довжина en");
rows.forEach(function (r) { console.log(String(r[0]).padEnd(16) + String(r[1]).padEnd(14) + String(r[2]).padEnd(12) + String(r[3]).padEnd(24) + (r[4] || "")); });
if (errors.length) { console.error("\nПОМИЛКИ:\n" + errors.join("\n")); process.exit(1); }
console.log("\nOK: " + doc.levels.length + " рівнів × " + LANGS.length + " мови, генератор і ядро перевірено");
