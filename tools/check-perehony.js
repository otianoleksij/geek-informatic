#!/usr/bin/env node
/* Перевірка гри «Перегони слів»: node tools/check-perehony.js
   1) content/perehony/words.json: рівні слів (довжини в межах minLen..maxLen, діапазони не перетинаються й ідуть по зростанню),
      не менше 40 слів на рівень на мову, без повторів у межах мови, лише малі літери мови, кожен символ можна ввести на
      розкладці мови (klaviatura-core: locate), без Shift; складності посилаються на наявні рівні; ліміти часу правдоподібні
      (швидкість, якої вимагають, у межах 20..110 зн/хв), а за замовчуванням збігаються з документованими 2,5/1,8; 2,0/1,1; 1,5/0,7;
   2) модульні перевірки ядра: добір слів із зерна (детермінований, без повторів, легші перед складнішими), ліміт часу,
      15 машин (14 суперників за кількістю слів), старт 15-м, слово вчасно піднімає рівно на одне місце, таймаут місце не змінює
      (слово пропущено), усі 14 слів вчасно дають 1-ше місце, вище за 1-ше не піднятися, кубки за місцем, швидкість і точність. */
"use strict";
var fs = require("fs");
var path = require("path");
var Klav = require(path.join(__dirname, "..", "activities", "klaviatura", "klaviatura-core.js"));
var Core = require(path.join(__dirname, "..", "activities", "perehony", "perehony-core.js"));
var doc = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "perehony", "words.json"), "utf8"));
var errors = [];
function err(m) { if (errors.length < 40) errors.push(m); else if (errors.length === 40) errors.push("..."); }
function eq(a, b, msg) { if (a !== b) err("ядро: " + msg + " (очікувалось " + JSON.stringify(b) + ", є " + JSON.stringify(a) + ")"); }
function near(a, b, msg) { if (Math.abs(a - b) > 1e-6) err("ядро: " + msg + " (очікувалось " + b + ", є " + a + ")"); }

var MIN_PER_TIER = 40;
var LETTERS = { uk: /^[а-щьюяєіїґ']+$/, en: /^[a-z]+$/ };   /* а-щ ь ю я є і ї ґ ' / a-z */
var DEFAULT_DIFF = { easy: [2.5, 1.8], medium: [2.0, 1.1], hard: [1.5, 0.7] };
var DIFF_ORDER = ["easy", "medium", "hard"];

/* ---------- 1. Слова ---------- */
if (doc.raceLength !== 14) err("raceLength має бути 14 (за специфікацією), є " + doc.raceLength);
if (doc.opponents !== doc.raceLength) err("opponents має дорівнювати raceLength (кожне слово вчасно обганяє одну машину): " + doc.opponents + " != " + doc.raceLength);
["uk", "en"].forEach(function (lang) {
  var tiers = doc.words[lang], seen = {}, prevMax = 0, ids = {};
  tiers.forEach(function (t, i) {
    var w = lang + " рівень " + t.tier;
    if (ids[t.tier]) err(w + ": рівень двічі");
    ids[t.tier] = true;
    if (t.tier !== i + 1) err(w + ": рівні мають іти 1, 2, 3, ... підряд, на місці " + (i + 1) + " стоїть " + t.tier);
    if (t.minLen > t.maxLen) err(w + ": minLen > maxLen");
    if (t.minLen <= prevMax) err(w + ": діапазон " + t.minLen + ".." + t.maxLen + " перетинається з попереднім (до " + prevMax + ")");
    prevMax = t.maxLen;
    if (t.list.length < MIN_PER_TIER) err(w + ": слів " + t.list.length + ", потрібно не менше " + MIN_PER_TIER);
    t.list.forEach(function (word) {
      if (seen[word]) err(w + ": «" + word + "» повторюється (також у рівні " + seen[word] + ")");
      seen[word] = t.tier;
      if (!LETTERS[lang].test(word)) { err(w + ": «" + word + "» не слово малими літерами мови " + lang); return; }
      if (word.length < t.minLen || word.length > t.maxLen) err(w + ": «" + word + "» має " + word.length + " символів, а рівень " + t.minLen + ".." + t.maxLen);
      if (word.charAt(0) === "'" || word.charAt(word.length - 1) === "'") err(w + ": «" + word + "»: апостроф на краю слова");
      for (var i2 = 0; i2 < word.length; i2++) {
        var loc = Klav.locate(lang, word.charAt(i2));
        if (!loc) err(w + ": «" + word + "»: символу «" + word.charAt(i2) + "» немає на розкладці " + lang);
        else if (loc.shift) err(w + ": «" + word + "»: символ «" + word.charAt(i2) + "» вимагає Shift");
      }
    });
  });
  /* апострофів у вищих рівнях небагато: не більше чверті слів рівня */
  tiers.forEach(function (t) {
    var n = t.list.filter(function (x) { return x.indexOf("'") >= 0; }).length;
    if (n > t.list.length / 4) err(lang + " рівень " + t.tier + ": забагато слів з апострофом (" + n + ")");
  });
});
/* літери укр. алфавіту, що мають бути представлені: і ї є ґ */
["і", "ї", "є", "ґ"].forEach(function (ch) {
  var found = doc.words.uk.some(function (t) { return t.list.some(function (x) { return x.indexOf(ch) >= 0; }); });
  if (!found) err("uk: у словах немає літери «" + ch + "»");
});

/* ---------- складності ---------- */
var maxTier = doc.words.uk.length;
if (doc.words.en.length !== maxTier) err("кількість рівнів слів у uk і en різна");
var ids = {};
doc.difficulties.forEach(function (d) {
  if (ids[d.id]) err("складність " + d.id + " двічі");
  ids[d.id] = d;
  if (d.tiers[0] >= d.tiers[1]) err("складність " + d.id + ": tiers мають зростати");
  d.tiers.forEach(function (t) { if (t < 1 || t > maxTier) err("складність " + d.id + ": немає рівня слів " + t); });
  ["uk", "en"].forEach(function (lang) {
    var r = Core.lengthRange(d, doc.words[lang]);
    [3, 6, 9, 12].forEach(function (n) {
      var cpm = Core.requiredCpm(d, n);
      if (n >= 6 && (cpm < 20 || cpm > 110)) err("складність " + d.id + ": слово з " + n + " літер вимагає " + Math.round(cpm) + " зн/хв, поза 20..110");
    });
    if (!(r.min >= 3)) err("складність " + d.id + "/" + lang + ": найкоротше слово " + r.min);
  });
});
DIFF_ORDER.forEach(function (id, i) {
  var d = ids[id];
  if (!d) { err("немає складності " + id); return; }
  if (d.reaction !== DEFAULT_DIFF[id][0] || d.perLetter !== DEFAULT_DIFF[id][1]) err("складність " + id + ": " + d.reaction + " + n * " + d.perLetter + " відрізняється від документованих " + DEFAULT_DIFF[id].join(" + n * "));
  if (i && !(d.perLetter < ids[DIFF_ORDER[i - 1]].perLetter)) err("складність " + id + " має бути швидшою за " + DIFF_ORDER[i - 1]);
});

/* ---------- 2. Ядро ---------- */
var easy = ids.easy, medium = ids.medium, hard = ids.hard;
near(Core.limitSeconds(easy, "abcd"), 9.7, "easy: 4 літери = 9,7 с");
near(Core.limitSeconds(medium, "abcdef"), 8.6, "medium: 6 літер = 8,6 с");
near(Core.limitSeconds(hard, "abcdefgh"), 7.1, "hard: 8 літер = 7,1 с");
eq(Core.limitMs(easy, "abcd"), 9700, "limitMs easy 4");

["uk", "en"].forEach(function (lang) {
  doc.difficulties.forEach(function (d) {
    var a = Core.pickWords(doc.words[lang], d, doc.raceLength, Klav.createRng(1234));
    var b = Core.pickWords(doc.words[lang], d, doc.raceLength, Klav.createRng(1234));
    eq(JSON.stringify(a), JSON.stringify(b), lang + "/" + d.id + ": те саме зерно дає ті самі слова");
    for (var seed = 1; seed <= 300; seed++) {
      var ws = Core.pickWords(doc.words[lang], d, doc.raceLength, Klav.createRng(seed)), set = {}, half = Math.floor(doc.raceLength / 2);
      if (ws.length !== doc.raceLength) { err("ядро: " + lang + "/" + d.id + " зерно " + seed + ": слів " + ws.length); break; }
      var lowList = Core.listOf(doc.words[lang], d.tiers[0]), highList = Core.listOf(doc.words[lang], d.tiers[1]), bad = "";
      ws.forEach(function (w, i) {
        if (set[w]) bad = "повтор «" + w + "»";
        set[w] = true;
        if (i < half && lowList.indexOf(w) < 0) bad = "«" + w + "» у першій половині не з нижнього рівня";
        if (i >= half && highList.indexOf(w) < 0) bad = "«" + w + "» у другій половині не з верхнього рівня";
        if (i && i !== half && ws[i - 1].length > w.length) bad = "слова не за зростанням довжини: «" + ws[i - 1] + "» «" + w + "»";
      });
      if (bad) { err("ядро: " + lang + "/" + d.id + " зерно " + seed + ": " + bad); break; }
    }
  });
});

function mk(words) { return Core.newRace(words, medium); }
function typeWord(race, word) { var ev = null; for (var i = 0; i < word.length; i++) ev = Core.key(race, true); return ev; }
function seq(n) { var out = [], i; for (i = 0; i < n; i++) out.push("aa"); return out; }

(function () {
  var r = mk(["aaa", "bbb", "ccc"]);
  eq(r.cars, 4, "машин на одну більше за слова (3 слова: 4 машини)");
  eq(Core.place(r), 4, "старт: останнє місце");
  eq(r.order.length, r.cars, "усі машини в порядку");
  eq(Core.startWord(r), "aaa", "перше слово");
  eq(Core.currentChar(r), "a", "поточна літера");
  var ev = Core.key(r, false);
  eq(ev.type, "error", "помилка");
  eq(Core.currentChar(r), "a", "після помилки літера та сама");
  eq(r.wordPos, 0, "помилка не просуває");
  eq(Core.key(r, true).type, "ok", "правильна літера");
  Core.tick(r, 1000);
  ev = typeWord(r, "aa");
  eq(ev.type, "overtake", "слово набране вчасно: обгін");
  eq(ev.moved, true, "обгін рухає");
  eq(ev.from, 4, "з 4-го");
  eq(ev.to, 3, "на 3-є");
  eq(ev.passed, "c3", "обігнано машину безпосередньо попереду");
  eq(ev.fast, true, "1 с з ліміту 5,3 с: швидко");
  eq(Core.place(r), 3, "місце 3");
  eq(ev.last, false, "не останнє слово");
  eq(r.status, "between", "після слова пауза");
  eq(Core.key(r, true), null, "поза словом клавіші ігноруються");
  eq(Core.tick(r, 5000), null, "поза словом час не йде");

  /* не швидко: рівно половина ліміту й більше */
  eq(Core.startWord(r), "bbb", "друге слово");
  var half = Core.limitMs(medium, "bbb") / 2;
  Core.tick(r, half);
  ev = typeWord(r, "bbb");
  eq(ev.type, "overtake", "на половині ліміту ще вчасно");
  eq(ev.fast, false, "рівно половина: не «швидко»");
  eq(ev.to, 2, "місце 2");

  /* таймаут: слово пропущено, місце й порядок не змінюються */
  var before = r.order.join(",");
  eq(Core.startWord(r), "ccc", "третє слово");
  Core.key(r, true);
  var lim = Core.limitMs(medium, "ccc");
  eq(Core.tick(r, lim - 1), null, "за мить до ліміту ще немає таймауту");
  ev = Core.tick(r, 5);
  eq(ev && ev.type, "timeout", "ліміт вичерпано: таймаут");
  eq(ev.moved, false, "таймаут нікого не рухає");
  eq(ev.passed, null, "таймаут: нікого не обігнано");
  eq(ev.passer, undefined, "таймаут: гравця ніхто не обганяє");
  eq(ev.to, 2, "місце після таймауту те саме");
  eq(ev.place, 2, "подія несе поточне місце");
  eq(r.order.join(","), before, "порядок машин після таймауту той самий");
  eq(ev.last, true, "останнє слово");
  eq(Core.startWord(r), null, "слів більше немає");
  eq(r.status, "finished", "фініш");
  var s = Core.summary(r);
  eq(s.place, 2, "підсумкове місце");
  eq(s.cars, 4, "у підсумку машин 4");
  eq(s.inTime, 2, "вчасно 2");
  eq(r.missed, 1, "пропущено 1");
  eq(s.total, 3, "усього 3");
  eq(s.win, false, "не перемога");
  eq(s.cups, 2, "2 місце: 2 кубки");
  eq(r.errors, 1, "одна помилка");
  eq(s.accuracy, Math.round(r.correctKeys / r.keystrokes * 1000) / 10, "точність");
  if (!(s.cpm > 0)) err("ядро: швидкість має бути додатною");
})();

/* повний заїзд зі зразковою кількістю слів: 14 слів, 15 машин, старт 15-м */
(function () {
  var n = doc.raceLength, words = seq(n), r = mk(words), ev, i;
  eq(r.cars, n + 1, "машин на одну більше за слова");
  eq(r.cars, 15, "у перегонах 15 машин");
  eq(r.order.length, 15, "у порядку 15 машин");
  eq(Core.place(r), 15, "старт 15-м");
  eq(r.order[14], Core.PLAYER, "гравець останній у порядку");
  eq(r.order.slice(0, 14).join(","), Core.opponentIds(14).join(","), "суперники c1..c14 попереду");
  var seen = {};
  r.order.forEach(function (id) { seen[id] = true; });
  eq(Object.keys(seen).length, 15, "15 різних машин без дублів");
  for (i = 0; i < n; i++) {
    Core.startWord(r);
    ev = typeWord(r, words[i]);
    eq(ev.moved, true, "слово " + (i + 1) + " вчасно: обгін");
    eq(ev.from, 15 - i, "слово " + (i + 1) + ": було місце " + (15 - i));
    eq(ev.to, 14 - i, "слово " + (i + 1) + ": рівно на одне місце вище");
    eq(ev.passed, "c" + (14 - i), "слово " + (i + 1) + ": обігнано машину безпосередньо попереду");
    eq(Core.place(r), 14 - i, "місце після слова " + (i + 1));
    eq(ev.last, i === n - 1, "ознака останнього слова");
  }
  eq(Core.place(r), 1, "14 слів з 14 вчасно: 1-ше місце");
  eq(r.order[0], Core.PLAYER, "гравець першим");
  eq(r.order.slice(1).join(","), Core.opponentIds(14).join(","), "суперники в початковому порядку");
  eq(Core.startWord(r), null, "слів більше немає");
  var s = Core.summary(r);
  eq(s.place, 1, "підсумок: 1 місце");
  eq(s.win, true, "перемога");
  eq(s.cups, 3, "3 кубки");
  eq(s.inTime, 14, "усі 14 вчасно");
  eq(s.kind, "win", "тон підсумку: перемога");

  /* один пропущений: 2 місце, ніхто не обганяє гравця */
  var r2 = mk(words);
  for (i = 0; i < n; i++) {
    Core.startWord(r2);
    if (i === 5) { ev = Core.tick(r2, Core.currentLimit(r2)); eq(ev.type, "timeout", "таймаут"); eq(ev.moved, false, "таймаут не рухає"); eq(Core.place(r2), 15 - 5, "місце після таймауту те саме"); }
    else typeWord(r2, words[i]);
  }
  eq(Core.place(r2), 2, "13 з 14 вчасно: 2-ге місце");
  eq(Core.summary(r2).cups, 2, "2-ге місце: 2 кубки");

  /* усі слова пропущено: лишаємося останніми, порядок не змінюється */
  var r3 = mk(words);
  for (i = 0; i < n; i++) {
    Core.startWord(r3);
    ev = Core.tick(r3, Core.currentLimit(r3));
    eq(ev.type, "timeout", "таймаут " + (i + 1));
    eq(ev.moved, false, "таймаут не рухає " + (i + 1));
    eq(Core.place(r3), 15, "лишається 15-м");
  }
  eq(r3.order.join(","), Core.startOrder(14).join(","), "порядок не змінився");
  eq(Core.summary(r3).cups, 0, "15-те місце: 0 кубків");
  eq(Core.summary(r3).kind, "keep", "тон підсумку: підтримка");

  /* вище за 1-ше не піднятися (слів більше, ніж суперників) */
  var r4 = Core.newRace(seq(16), medium);
  r4.order = Core.startOrder(14);       /* 15 машин, 16 слів */
  for (i = 0; i < 14; i++) { Core.startWord(r4); typeWord(r4, "aa"); }
  eq(Core.place(r4), 1, "після 14 обгонів 1-ше місце");
  Core.startWord(r4);
  ev = typeWord(r4, "aa");
  eq(ev.type, "overtake", "на 1-му ще набирається слово");
  eq(ev.moved, false, "вище за 1-ше не піднятися");
  eq(ev.passed, null, "нікого обганяти");
  eq(Core.place(r4), 1, "лишається 1-ше");
  eq(r4.order[0], Core.PLAYER, "гравець першим");

  /* порядок суперників зберігається, коли гравець проходить крізь стрій */
  var r5 = mk(["aa", "bb", "cc"]);       /* 4 машини */
  Core.startWord(r5); typeWord(r5, "aa");
  Core.startWord(r5); typeWord(r5, "bb");
  eq(r5.order.join(","), "c1,p,c2,c3", "гравець 2-й: суперники в тому ж порядку");
  eq(Core.resultKind(1, 15), "win", "тон: 1 — перемога");
  eq(Core.resultKind(2, 15), "podium", "тон: 2 — подіум");
  eq(Core.resultKind(3, 15), "podium", "тон: 3 — подіум");
  eq(Core.resultKind(4, 15), "good", "тон: 4 — гарний заїзд");
  eq(Core.resultKind(8, 15), "good", "тон: 8 — гарний заїзд");
  eq(Core.resultKind(9, 15), "keep", "тон: 9 — підтримка");
})();

eq(Core.cupsFor(1), 3, "1 місце: 3 кубки");
eq(Core.cupsFor(2), 2, "2 місце: 2 кубки");
eq(Core.cupsFor(3), 1, "3 місце: 1 кубок");
eq(Core.cupsFor(4), 0, "4 місце: 0 кубків");
eq(Core.cupsFor(15), 0, "15 місце: 0 кубків");
eq(Core.isBetter({ place: 2, cpm: 10 }, { place: 3, cpm: 99 }), true, "краще місце важливіше за швидкість");
eq(Core.isBetter({ place: 3, cpm: 50 }, { place: 3, cpm: 40 }), true, "те саме місце: швидкість вирішує");
eq(Core.isBetter({ place: 3, cpm: 40 }, { place: 3, cpm: 50 }), false, "гірша швидкість не рекорд");
eq(Core.isBetter({ place: 15, cpm: 0 }, null), true, "перший результат завжди рекорд");

/* швидкість: 40 правильних знаків за 30 с активного часу = 80 зн/хв */
(function () {
  var r = Core.newRace(["x"], medium);
  r.correctKeys = 40; r.typingMs = 30000; r.keystrokes = 50;
  eq(Math.round(Core.cpm(r)), 80, "40 знаків за 30 с = 80 зн/хв");
  eq(Core.accuracy(r), 80, "точність 40/50 = 80%");
  eq(Core.accuracy(Core.newRace(["x"], medium)), 100, "без натискань точність 100%");
})();

/* сумісність із klaviatura-core: помилкова розкладка не штрафується, звичайна помилка так */
eq(Klav.classify("uk", "а", { key: "f", code: "KeyF" }), "layout", "латиниця замість кирилиці: підказка про розкладку");
eq(Klav.classify("uk", "а", { key: "а", code: "KeyF" }), "ok", "правильна літера");
eq(Klav.classify("uk", "а", { key: "Shift", code: "ShiftLeft" }), "ignore", "модифікатор ігнорується");

if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
var counts = ["uk", "en"].map(function (l) { return l + " " + doc.words[l].map(function (t) { return t.list.length; }).join("/"); }).join(", ");
console.log("OK: перегони, слів по рівнях: " + counts + "; " + doc.difficulties.length + " складності, " + doc.raceLength + " слів і " + doc.opponents + " суперників у перегонах");
