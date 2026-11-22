#!/usr/bin/env node
/* Перевірка вебквесту «Агенти КіберЩиту»: node tools/check-kiber.js
   Глибша за схему (schemas/quest.schema.json): 8 місій, унікальні id, правильні відповіді за типами завдань,
   літери й секретне слово, посилання на малюнки і підказки, відсутність HTML у рядках, використання ключів словника.
   Потім проходить квест на ядрі (quest-core.js) з правильними відповідями й перевіряє бали, ключі, слово й міграцію з v3. */
"use strict";
var fs = require("fs");
var path = require("path");
var ROOT = path.join(__dirname, "..");
var Core = require(path.join(ROOT, "activities", "agenty-kibershchytu", "quest-core.js"));
var errors = [];
function err(where, msg) { errors.push(where + ": " + msg); }
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
var KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var ICONS = ["lock", "hook", "shield", "steps", "chat", "bug", "search", "phone"];
var EXPECTED_MISSIONS = 8;

var langs = fs.readdirSync(path.join(ROOT, "content", "agenty-kibershchytu")).filter(function (f) { return /^[a-z]{2}\.json$/.test(f); });
if (!langs.length) { console.error("немає content/agenty-kibershchytu/<lang>.json"); process.exit(1); }

/* ---------- рядки: без HTML, збалансована розмітка ** ---------- */
function eachString(v, at, fn) {
  if (typeof v === "string") fn(v, at);
  else if (Array.isArray(v)) v.forEach(function (x, i) { eachString(x, at + "[" + i + "]", fn); });
  else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { eachString(v[k], at + "." + k, fn); });
}
var STRUCT_KEYS = { id: 1, type: 1, icon: 1, view: 1, url: 1, picture: 1, layout: 1, kind: 1, initial: 1, image: 1, dir: 1, $schema: 1, lang: 1 };
function checkStrings(doc, label) {
  eachString(doc, "$", function (s, at) {
    var key = at.replace(/\[\d+\]/g, "").split(".").pop();
    if (STRUCT_KEYS[key] || /\.decoys\./.test(at) && false) return;
    if (/<\/?[a-zA-Z!][^>]*>/.test(s.replace(/<[^\s<>@]+@[^\s<>]+>/g, ""))) err(label + " " + at, "HTML у рядку: «" + s.slice(0, 50) + "»");
    if (/&(?:[a-z]+|#\d+);/i.test(s)) err(label + " " + at, "HTML-сутність у рядку: «" + s.slice(0, 50) + "»");
    if ((s.match(/\*\*/g) || []).length % 2) err(label + " " + at, "непарна розмітка ** у «" + s.slice(0, 50) + "»");
    if (!s.trim()) err(label + " " + at, "порожній рядок");
  });
}

/* ---------- завдання за типами ---------- */
function checkTask(t, where, lang, mission) {
  var i;
  if (typeof t.id !== "string" || !KEBAB.test(t.id)) err(where, "id має бути kebab-case латиницею");
  if (Core.TASK_TYPES.indexOf(t.type) < 0) { err(where, "невідомий type «" + t.type + "»"); return; }
  if (typeof t.q !== "string" || !t.q.trim()) err(where, "немає q");
  function need(f) { if (t[f] === undefined) { err(where, "немає поля " + f + " для " + t.type); return false; } return true; }
  function correctCount(opts) { return opts.filter(function (o) { return o.correct === true; }).length; }
  switch (t.type) {
    case "password":
      if (need("weak")) { if (!Array.isArray(t.weak) || !t.weak.length) err(where, "weak має бути непорожнім масивом"); }
      /* контрольний пароль має проходити всі шість умов, а слабкий — ні */
      var good = Core.passwordChecks("Kit#Hmara7Pirig", t.weak);
      if (good.indexOf(false) >= 0) err(where, "контрольний пароль «Kit#Hmara7Pirig» не проходить умови: " + good.join(","));
      if (Core.passwordChecks("Qwerty#12345678", t.weak).every(Boolean)) err(where, "пароль із «qwerty» мав би бути слабким");
      break;
    case "scene":
      if (!need("picture") || !need("spots") || !need("decoys")) break;
      var svgFile = path.join(ROOT, "content", "agenty-kibershchytu", "scenes", lang, t.picture + ".svg");
      if (!fs.existsSync(svgFile)) { err(where, "немає малюнка " + path.relative(ROOT, svgFile)); break; }
      var svg = fs.readFileSync(svgFile, "utf8");
      if (/<script|\son\w+\s*=|<foreignObject|javascript:/i.test(svg)) err(where, "SVG містить скрипти або обробники");
      var spotIds = {}, decoyIds = {};
      (svg.match(/data-spot="[^"]*"/g) || []).forEach(function (m) { spotIds[m.slice(11, -1)] = true; });
      (svg.match(/data-decoy="[^"]*"/g) || []).forEach(function (m) { decoyIds[m.slice(12, -1)] = true; });
      t.spots.forEach(function (s) {
        if (!KEBAB.test(s.id)) err(where, "id місця «" + s.id + "» має бути kebab-case");
        if (!spotIds[s.id]) err(where, "у SVG немає data-spot=\"" + s.id + "\"");
      });
      Object.keys(spotIds).forEach(function (id) { if (!t.spots.some(function (s) { return s.id === id; })) err(where, "у SVG data-spot=\"" + id + "\" не описано в spots"); });
      if (new Set(t.spots.map(function (s) { return s.id; })).size !== t.spots.length) err(where, "id місць повторюються");
      Object.keys(decoyIds).forEach(function (id) { if (!has(t.decoys, id)) err(where, "у SVG data-decoy=\"" + id + "\" немає підказки в decoys"); });
      Object.keys(t.decoys).forEach(function (id) { if (!decoyIds[id]) err(where, "підказка decoys." + id + " не використана в SVG"); });
      break;
    case "choice":
    case "multi":
      if (!need("options") || !need("explain")) break;
      if (!Array.isArray(t.options) || t.options.length < 2) { err(where, "потрібно щонайменше 2 варіанти"); break; }
      var cc = correctCount(t.options);
      t.options.forEach(function (o, k) {
        if (typeof o.correct !== "boolean") err(where + " options[" + k + "]", "correct має бути boolean");
        if (o.view === "browser") {
          if (typeof o.url !== "string" || !/^https?:\/\/\S+$/.test(o.url)) err(where + " options[" + k + "]", "browser без url");
          if (o.text !== undefined) err(where + " options[" + k + "]", "browser не має text");
          if (!t.browserPage) err(where + " options[" + k + "]", "немає task.browserPage");
        } else if (o.view !== undefined) err(where + " options[" + k + "]", "невідомий view " + o.view);
        else if (typeof o.text !== "string" || !o.text.trim()) err(where + " options[" + k + "]", "немає text");
      });
      if (t.type === "choice" && cc !== 1) err(where, "choice: має бути рівно 1 правильний варіант, а є " + cc);
      if (t.type === "multi" && (cc < 1 || cc >= t.options.length)) err(where, "multi: правильних має бути від 1 до " + (t.options.length - 1) + ", а є " + cc);
      if (t.type === "multi" && t.options.some(function (o) { return o.view; })) err(where, "multi не підтримує view");
      break;
    case "classify":
      if (!need("labels") || !need("items") || !need("showAll")) break;
      if (!Array.isArray(t.labels) || t.labels.length !== 2) err(where, "labels має містити 2 підписи");
      var seen = [0, 0];
      t.items.forEach(function (it, k) {
        if (!it || typeof it !== "object") { err(where + " items[" + k + "]", "очікується об'єкт"); return; }
        if (it.answer !== 0 && it.answer !== 1) err(where + " items[" + k + "]", "answer має бути 0 або 1");
        else seen[it.answer]++;
        if (!it.text || !it.explain) err(where + " items[" + k + "]", "немає text або explain");
      });
      if (!seen[0] || !seen[1]) err(where, "обидві категорії мають мати хоча б один рядок (" + seen.join("/") + ")");
      break;
    case "hotspots":
      if (!need("listTitle") || !need("head") || !need("body")) break;
      var clues = Core.countClues(t);
      if (clues < 2) err(where, "потрібно щонайменше 2 ознаки (clue), а є " + clues);
      var plain = 0;
      t.head.forEach(function (r) { r.parts.forEach(function (p) { if (!p.clue) plain++; }); });
      t.body.forEach(function (r) { r.forEach(function (p) { if (!p.clue) plain++; }); });
      if (!plain) err(where, "потрібні й нейтральні фрагменти без clue");
      break;
    case "privacy":
      ["panel", "pvTitle", "who", "countLbl", "safeMsg", "saveBtn", "okTitle", "okText", "initial", "sets"].forEach(need);
      if (["exposed", "on"].indexOf(t.initial) < 0) err(where, "initial має бути exposed або on");
      if (Array.isArray(t.sets)) {
        if (!t.sets.some(function (s) { return s.safe === false; })) err(where, "немає небезпечного налаштування (safe:false)");
        var st = Core.privacyStart(t);
        if (Core.privacyResult(t, st).all) err(where, "початковий стан уже правильний: завдання тривіальне");
        var allSafe = t.sets.map(function (s) { return s.safe; });
        if (!Core.privacyResult(t, allSafe).all) err(where, "правильний стан (усі safe) не дає повного результату");
      }
      break;
    case "chat":
      ["title", "sub", "avatar", "outro", "script"].forEach(need);
      if (!Array.isArray(t.script)) break;
      var asks = Core.chatAsks(t);
      if (!asks.length) err(where, "у чаті немає жодного ask");
      t.script.forEach(function (s, k) {
        var w = where + " script[" + k + "]";
        var kinds = ["from", "system", "ask"].filter(function (f) { return s[f] !== undefined; });
        if (kinds.length !== 1) { err(w, "крок має бути або {from,text}, або {system}, або {ask,options}"); return; }
        if (s.from !== undefined && !s.text) err(w, "немає text");
        if (s.image && Core.CHAT_IMAGES.indexOf(s.image) < 0) err(w, "невідома картинка " + s.image);
        if (s.ask !== undefined) {
          if (!Array.isArray(s.options) || s.options.length < 2) { err(w, "ask без options"); return; }
          var c = correctCount(s.options);
          if (c !== 1) err(w, "ask: має бути рівно 1 правильна відповідь, а є " + c);
          s.options.forEach(function (o, j) {
            if (o.correct && (!Array.isArray(o.reply) || o.note !== undefined)) err(w + " options[" + j + "]", "правильна відповідь має reply і не має note");
            if (!o.correct && (!o.note || o.reply !== undefined)) err(w + " options[" + j + "]", "хибна відповідь має note і не має reply");
          });
        }
      });
      break;
    case "memory":
      if (!need("pairs")) break;
      var terms = {};
      t.pairs.forEach(function (p) { if (terms[p.term]) err(where, "термін «" + p.term + "» повторюється"); terms[p.term] = 1; });
      var cardTexts = [];
      t.pairs.forEach(function (p) { cardTexts.push(p.term, p.meaning); });
      if (new Set(cardTexts).size !== cardTexts.length) err(where, "тексти карток мають бути різними");
      break;
    case "order":
      if (!need("items") || !need("explain")) break;
      if (!Array.isArray(t.items) || t.items.length < 2) err(where, "потрібно щонайменше 2 кроки");
      else if (new Set(t.items).size !== t.items.length) err(where, "кроки повторюються");
      else if (t.items.some(function (s) { return typeof s !== "string"; })) err(where, "кроки мають бути рядками");
      break;
    case "wordsearch":
      if (!need("size") || !need("alphabet") || !need("words")) break;
      var grid = {}, wseen = {};
      t.words.forEach(function (w) {
        if (wseen[w.word]) err(where, "слово «" + w.word + "» повторюється"); wseen[w.word] = 1;
        if (w.dir !== "h" && w.dir !== "v") err(where, w.word + ": dir має бути h або v");
        Core.wordCells(w).forEach(function (p, k) {
          if (p[0] < 0 || p[1] < 0 || p[0] >= t.size || p[1] >= t.size) { err(where, w.word + ": виходить за межі сітки " + t.size + "×" + t.size); return; }
          var key = p[0] + "," + p[1], ch = w.word.charAt(k);
          if (grid[key] && grid[key] !== ch) err(where, w.word + ": конфлікт літер у клітинці " + key);
          grid[key] = ch;
        });
      });
      /* слово знаходиться за першою й останньою клітинкою; перевіряємо, що збіг однозначний */
      t.words.forEach(function (w, k) {
        var cs = Core.wordCells(w);
        if (Core.findWord(t, cs[0], cs[cs.length - 1]) !== k) err(where, w.word + ": початок і кінець не визначають слово однозначно");
      });
      break;
  }
}

/* ---------- ключі словника ---------- */
function checkDictionary() {
  var dictFile = path.join(ROOT, "i18n", "uk", "agenty-kibershchytu.json");
  var dict = JSON.parse(fs.readFileSync(dictFile, "utf8"));
  var app = fs.readFileSync(path.join(ROOT, "activities", "agenty-kibershchytu", "app.js"), "utf8");
  var page = fs.readFileSync(path.join(ROOT, "activities", "agenty-kibershchytu", "page.html"), "utf8");
  var tpl = fs.readFileSync(path.join(ROOT, "templates", "activity.html"), "utf8");
  var literal = {}, prefixes = [];
  var re = /\bT\(\s*"([A-Za-z0-9_.-]+)"(\s*\+)?/g, m;
  while ((m = re.exec(app))) { if (m[2]) prefixes.push(m[1]); else literal[m[1]] = true; }
  /* ключі, що передаються змінною: T(ok ? "a" : "b") — беремо всі рядкові літерали, схожі на ключі словника */
  Object.keys(dict).forEach(function (k) { if (app.indexOf('"' + k + '"') >= 0) literal[k] = true; });
  var re2 = /\{\{\s*agenty-kibershchytu\.([\w.-]+)\s*\}\}/g;
  while ((m = re2.exec(page))) literal[m[1]] = true;
  if (/\{\{\s*ns\.footer\s*\}\}/.test(tpl)) literal.footer = true;
  Object.keys(literal).forEach(function (k) { if (!has(dict, k)) err("app.js/page.html", "ключа «" + k + "» немає в i18n/uk/agenty-kibershchytu.json"); });
  Object.keys(dict).forEach(function (k) {
    if (literal[k]) return;
    if (prefixes.some(function (p) { return k.indexOf(p) === 0; })) return;
    err("i18n/uk/agenty-kibershchytu.json", "ключ «" + k + "» ніде не використовується");
  });
  /* Сума «ключів-літер» усіх рангів і букв варіантів для показу */
  if (!has(dict, "optionLetters") || dict.optionLetters.length < 6) err("i18n", "optionLetters має мати щонайменше 6 букв (максимум варіантів)");
  return dict;
}

/* ---------- проходження квесту на ядрі ---------- */
function solve(t) {
  /* повертає { pts } за ідеальної відповіді; перевіряє, що Core визнає її правильною */
  switch (t.type) {
    case "password":
      return Core.passwordLevel(Core.passwordChecks("Kit#Hmara7Pirig", t.weak), "Kit#Hmara7Pirig") === Core.PASSWORD_CHECKS ? 1 : -1;
    case "choice":
      var ci = t.options.map(function (o, i) { return o.correct ? i : -1; }).filter(function (i) { return i >= 0; })[0];
      return Core.choiceCorrect(t, ci) ? 1 : -1;
    case "multi":
      var picked = t.options.map(function (o, i) { return o.correct ? i : -1; }).filter(function (i) { return i >= 0; });
      var wrongSet = picked.slice(1);
      return Core.multiCorrect(t, picked) && !Core.multiCorrect(t, wrongSet) ? 1 : -1;
    case "classify":
      var ans = {}; t.items.forEach(function (it, i) { ans[i] = it.answer; });
      var r = Core.classifyResult(t, ans);
      return r.all && r.pts === t.items.length ? r.pts : -1;
    case "hotspots":
      var total = Core.countClues(t), res = Core.searchResult(total, 0, false);
      return res.ok && res.pts === total ? res.pts : -1;
    case "scene":
      var rs = Core.searchResult(t.spots.length, 0, false);
      return rs.ok && rs.pts === t.spots.length ? rs.pts : -1;
    case "privacy":
      var pr = Core.privacyResult(t, t.sets.map(function (s) { return s.safe; }));
      return pr.all ? pr.pts : -1;
    case "chat":
      return Core.chatAsks(t).length;
    case "memory":
      var cards = Core.memoryCards(t), by = {};
      cards.forEach(function (c, i) { (by[c.pair] = by[c.pair] || []).push(i); });
      return Object.keys(by).every(function (k) { return by[k].length === 2 && cards[by[k][0]].term !== cards[by[k][1]].term; }) && Core.memoryPoints(t.pairs.length) === 3 ? 3 : -1;
    case "order":
      var o = Core.orderResult(t.items.map(function (_, i) { return i; }));
      var start = Core.orderStart(t.items.length);
      return o.all && o.pts === 2 && !Core.orderResult(start).all ? 2 : -1;
    case "wordsearch":
      var g = Core.buildGrid(t), good = true;
      t.words.forEach(function (w, k) {
        Core.wordCells(w).forEach(function (p, j) { if (g[p[0]][p[1]] !== w.word.charAt(j)) good = false; });
      });
      return good ? t.words.length : -1;
  }
  return -1;
}

function playQuest(doc, label) {
  var M = doc.missions, S = Core.freshState(), T = Core.totalPoints(M);
  S.started = 1000; S.letters = Core.lettersById(M, Core.makeLetters(doc.word));
  var got = 0;
  M.forEach(function (m) {
    if (Core.nextOpen(M, S) !== Core.missionIndex(M, m.id)) err(label, "місія " + m.id + " недоступна у своєму порядку");
    Core.startMission(S, m.id, M);
    m.tasks.forEach(function (t) {
      var pts = solve(t);
      if (pts !== Core.maxPts(t)) err(label + " " + m.id + "/" + t.id, "ідеальна відповідь дає " + pts + " замість " + Core.maxPts(t));
      Core.recordScore(S, m.id, t.id, pts);
      Core.recordScore(S, m.id, t.id, 0);       // повторно бали не змінюються
      got += pts;
      var step = Core.nextStep(S, m);
      var last = m.tasks[m.tasks.length - 1] === t;
      if (step !== (last ? "done" : "task")) err(label + " " + m.id + "/" + t.id, "nextStep дав " + step);
    });
    if (!Core.isDone(S, m.id)) err(label, "місія " + m.id + " не завершилась");
    if (Core.missionScore(S, m).got !== Core.missionMax(m)) err(label, "бали місії " + m.id + " ≠ максимум");
  });
  if (Core.nextOpen(M, S) !== -1) err(label, "після всіх місій nextOpen ≠ -1");
  if (Core.score(S) !== T || got !== T) err(label, "сума балів " + Core.score(S) + " ≠ TOTAL " + T);
  /* слово з ключів: літери місій перемішано, правильний порядок дає слово */
  var tiles = M.map(function (m) { return Core.letterOf(S, m); });
  if (tiles.slice().sort().join("") !== doc.word.split("").sort().join("")) err(label, "літери ключів не є перестановкою слова");
  if (tiles.join("") === doc.word) err(label, "літери ключів не перемішано");
  var order = [], used = {};
  doc.word.split("").forEach(function (ch) {
    for (var i = 0; i < tiles.length; i++) if (!used[i] && tiles[i] === ch) { used[i] = 1; order.push(tiles[i]); return; }
  });
  if (!Core.wordMatches(doc.word, order)) err(label, "складене в правильному порядку слово не збігається");
  if (Core.wordMatches(doc.word, tiles.slice().reverse()) && tiles.slice().reverse().join("") !== doc.word) err(label, "хибне слово визнано правильним");
  /* стан зберігається без імені й класу */
  S.name = "Тест"; S.cls = "6-А";
  var pub = Core.publicState(S);
  if (has(pub, "name") || has(pub, "cls")) err(label, "publicState містить ім'я або клас");
  var back = Core.sanitize(JSON.parse(JSON.stringify(pub)), M);
  if (!back || back.done.length !== M.length || Core.score(back) !== T) err(label, "стан не переживає збереження");
  /* маршрути */
  var S2 = Core.freshState();
  if (Core.resolveHash("map", M, S2).screen !== "start") err(label, "без старту hash має вести на start");
  S2.started = 1; S2.screen = "map";
  if (Core.resolveHash(M[1].id, M, S2).screen !== "map") err(label, "закрита місія відкрилася через hash");
  var r0 = Core.resolveHash(M[0].id, M, S2);
  if (r0.screen !== "brief" || r0.cur !== M[0].id) err(label, "перша місія має відкриватися через hash");
  if (Core.legacyHash("mission-3", M) !== M[2].id) err(label, "mission-3 має вести на id третьої місії");
  if (Core.legacyHash("mission-99", M) !== "map") err(label, "mission-99 має вести на map");
  if (Core.legacyHash("map", M) !== null) err(label, "legacyHash(map) має бути null");
  if (Core.resolveHash("cert", M, S2).screen !== "map") err(label, "посвідчення без проходження недоступне");
  /* міграція v3 → v4 */
  var old = { name: "", cls: "", started: 5000, finished: 0, done: [0, 1], scores: { "0-0": 1, "0-1": 5, "1-2": 1, "9-9": 4 }, screen: "task", cur: 2, task: 1,
    letters: doc.word.split("").reverse() };
  var mg = Core.migrateV3(old, M);
  if (!mg) { err(label, "migrateV3 повернула null"); return; }
  if (mg.done.join() !== M[0].id + "," + M[1].id) err(label, "міграція: done " + mg.done.join());
  if (mg.scores[M[0].id + "/" + M[0].tasks[0].id] !== 1 || mg.scores[M[0].id + "/" + M[0].tasks[1].id] !== 5 || mg.scores[M[1].id + "/" + M[1].tasks[2].id] !== 1) err(label, "міграція: бали втрачено");
  if (Object.keys(mg.scores).length !== 3) err(label, "міграція: зайві бали " + Object.keys(mg.scores).join());
  if (mg.cur !== M[2].id || mg.task !== M[2].tasks[1].id || mg.screen !== "task") err(label, "міграція: cur/task/screen");
  if (mg.letters[M[0].id] !== old.letters[0] || mg.letters[M[7].id] !== old.letters[7]) err(label, "міграція: літери");
  var mg2 = Core.migrateV3({ started: 1, done: [], scores: {}, screen: "brief", cur: 42, task: 0 }, M);
  if (mg2.screen !== "map" || mg2.cur !== null) err(label, "міграція: невідома місія має вести на map");
}

/* ---------- основний прохід ---------- */
var summary = [];
langs.forEach(function (file) {
  var label = "content/agenty-kibershchytu/" + file, lang = file.slice(0, 2);
  var doc;
  try { doc = JSON.parse(fs.readFileSync(path.join(ROOT, label), "utf8")); } catch (e) { err(label, e.message); return; }
  if (doc.format !== 1) err(label, "format має бути 1");
  if (doc.lang !== lang) err(label, "lang «" + doc.lang + "» ≠ ім'я файлу");
  if (!Array.isArray(doc.missions) || doc.missions.length !== EXPECTED_MISSIONS) { err(label, "потрібно рівно " + EXPECTED_MISSIONS + " місій"); return; }
  checkStrings(doc, label);
  var ids = {}, taskIds = {}, nTasks = 0;
  doc.missions.forEach(function (m, i) {
    var w = label + " місія " + (m.id || "#" + (i + 1));
    if (typeof m.id !== "string" || !KEBAB.test(m.id)) err(w, "id має бути kebab-case латиницею");
    else if (Core.RESERVED_IDS.indexOf(m.id) >= 0) err(w, "id «" + m.id + "» зайнятий екраном (hash)");
    if (ids[m.id]) err(w, "id не унікальний"); ids[m.id] = true;
    if (ICONS.indexOf(m.icon) < 0) err(w, "невідома icon «" + m.icon + "»");
    if (typeof m.letter !== "string" || m.letter.length !== 1) err(w, "letter має бути однією літерою");
    if (!m.title || !m.intro) err(w, "немає title або intro");
    if (!Array.isArray(m.facts) || !m.facts.length) err(w, "немає facts");
    if (!Array.isArray(m.tasks) || m.tasks.length < 3) { err(w, "щонайменше 3 завдання"); return; }
    m.tasks.forEach(function (t, j) {
      var tw = w + " / " + (t.id || "#" + (j + 1)) + " (" + t.type + ")";
      if (taskIds[t.id]) err(tw, "id завдання не унікальний у квесті");
      taskIds[t.id] = true; nTasks++;
      checkTask(t, tw, lang, m);
    });
  });
  var letters = doc.missions.map(function (m) { return m.letter; }).join("");
  if (doc.word !== letters) err(label, "word «" + doc.word + "» ≠ літери місій «" + letters + "»");
  if (doc.word.length !== doc.missions.length) err(label, "довжина слова ≠ кількості місій");
  if (!errors.length) playQuest(doc, label);
  summary.push(lang + ": " + doc.missions.length + " місій, " + nTasks + " завдань, " + Core.totalPoints(doc.missions) + " балів, слово «" + doc.word + "»");
});
if (!errors.length) checkDictionary(); else try { checkDictionary(); } catch (e) { err("словник", e.message); }

if (errors.length) { console.error(errors.join("\n")); console.error("\nПомилок: " + errors.length); process.exit(1); }
console.log(summary.join("\n"));
console.log("OK: вебквест «Агенти КіберЩиту» (" + langs.join(", ") + ")");
