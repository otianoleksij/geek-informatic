/* Ядро вебквесту «Агенти КіберЩиту»: без DOM, працює в браузері (window.QuestCore) і в Node (tools/check-kiber.js).
   Тут лише правила: перевірка відповідей за типами завдань, бали, літери й секретне слово, порядок відкриття місій,
   стан квесту та перетворення стану. Малює все app.js. Дані місій: content/agenty-kibershchytu/<lang>.json. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.QuestCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TASK_TYPES = ["password", "scene", "choice", "multi", "classify", "hotspots", "privacy", "chat", "memory", "order", "wordsearch"];
  var CHAT_IMAGES = ["photo-fall"];
  /* Такі hash уже зайняті екранами, тож id місії не може їх повторювати */
  var RESERVED_IDS = ["map", "final", "cert", "start"];
  var PASSWORD_MIN = 12, PASSWORD_CHECKS = 6;
  var MEMORY_STEPS = [9, 13, 18];          // до 9 ходів — 3 бали, до 13 — 2, до 18 — 1
  var STATE_VERSION = 4;

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /* ---------- перемішування й літери ---------- */
  function shuffle(a, rnd) {
    rnd = rnd || Math.random;
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), x = a[i];
      a[i] = a[j]; a[j] = x;
    }
    return a;
  }
  /* Літери ключів: перестановка літер слова, яка не збігається зі словом і не починається так само */
  function makeLetters(word, rnd) {
    var base = word.split(""), a = shuffle(base, rnd), tries = 0;
    while ((a.join("") === word || a.slice(0, 3).join("") === word.slice(0, 3)) && tries++ < 200) a = shuffle(base, rnd);
    return a;
  }
  /* { id місії: літера } з масиву літер за позиціями місій */
  function lettersById(missions, arr) {
    var o = {};
    missions.forEach(function (m, i) { o[m.id] = arr[i]; });
    return o;
  }
  function letterOf(S, mission) {
    return (S.letters && S.letters[mission.id]) || mission.letter;
  }
  function secretWord(missions) { return missions.map(function (m) { return m.letter; }).join(""); }
  /* Складене слово: picked — масив літер у порядку натискання */
  function wordMatches(word, picked) { return picked.join("") === word; }

  /* ---------- бали ---------- */
  function countClues(task) {
    var n = 0;
    task.head.forEach(function (r) { r.parts.forEach(function (p) { if (p.clue) n++; }); });
    task.body.forEach(function (r) { r.forEach(function (p) { if (p.clue) n++; }); });
    return n;
  }
  function chatAsks(task) { return task.script.filter(function (s) { return s.ask; }); }
  function maxPts(task) {
    switch (task.type) {
      case "classify": return task.items.length;
      case "hotspots": return countClues(task);
      case "scene": return task.spots.length;
      case "privacy": return task.sets.length;
      case "chat": return chatAsks(task).length;
      case "memory": return 3;
      case "order": return 2;
      case "wordsearch": return task.words.length;
      default: return 1;
    }
  }
  function missionMax(mission) { return mission.tasks.reduce(function (s, t) { return s + maxPts(t); }, 0); }
  function totalPoints(missions) { return missions.reduce(function (s, m) { return s + missionMax(m); }, 0); }

  /* ---------- відповіді за типами ---------- */
  function choiceCorrect(task, i) { return !!(task.options[i] && task.options[i].correct); }
  /* selected: масив індексів відмічених варіантів */
  function multiCorrect(task, selected) {
    return task.options.every(function (o, i) { return !!o.correct === (selected.indexOf(i) > -1); });
  }
  /* answers: { індекс рядка: 0|1 } */
  function classifyResult(task, answers) {
    var right = 0, total = task.items.length;
    task.items.forEach(function (it, i) { if (answers[i] === it.answer) right++; });
    return { right: right, total: total, all: right === total, ok: right >= Math.ceil(total * 0.7), pts: right };
  }
  /* hotspots і scene: знайдено/хибні кліки/здався */
  function searchResult(found, wrong, gaveUp) {
    return { pts: Math.max(0, found - wrong), ok: !gaveUp && wrong <= 1 };
  }
  function privacyStart(task) {
    return task.sets.map(function (s) { return task.initial === "on" ? true : !s.safe; });
  }
  function privacyExposed(set, on) { return on !== set.safe; }
  function privacyResult(task, states) {
    var exposed = 0;
    task.sets.forEach(function (s, i) { if (privacyExposed(s, states[i])) exposed++; });
    var total = task.sets.length, right = total - exposed;
    return { right: right, total: total, exposed: exposed, all: right === total, pts: right, ok: right === total };
  }
  function memoryCards(task, rnd) {
    var cards = [];
    task.pairs.forEach(function (p, i) {
      cards.push({ pair: i, text: p.term, term: true });
      cards.push({ pair: i, text: p.meaning, term: false });
    });
    return shuffle(cards, rnd);
  }
  function memoryPoints(moves) {
    return moves <= MEMORY_STEPS[0] ? 3 : moves <= MEMORY_STEPS[1] ? 2 : moves <= MEMORY_STEPS[2] ? 1 : 0;
  }
  /* Початковий порядок для завдання «розстав»: майже ніколи не збігається з правильним */
  function orderStart(n, rnd) {
    rnd = rnd || Math.random;
    var id = [], ord, i;
    for (i = 0; i < n; i++) id.push(i);
    do { ord = shuffle(id, rnd); } while (ord.some(function (v, k) { return v === k; }) && rnd() < 0.85);
    if (ord.every(function (v, k) { return v === k; })) ord.reverse();
    return ord;
  }
  /* ord[pos] — номер кроку, який стоїть на місці pos; правильно, коли ord[pos] === pos */
  function orderResult(ord) {
    var n = ord.length, right = ord.filter(function (v, i) { return v === i; }).length;
    var pts = right === n ? 2 : right >= n / 2 ? 1 : 0;
    return { right: right, total: n, all: right === n, pts: pts, ok: right === n };
  }
  function wordCells(w) {
    var a = [];
    for (var k = 0; k < w.word.length; k++) a.push([w.row + (w.dir === "v" ? k : 0), w.col + (w.dir === "h" ? k : 0)]);
    return a;
  }
  function buildGrid(task, rnd) {
    rnd = rnd || Math.random;
    var N = task.size, g = [], r, c;
    for (r = 0; r < N; r++) {
      g.push([]);
      for (c = 0; c < N; c++) g[r].push(task.alphabet.charAt(Math.floor(rnd() * task.alphabet.length)));
    }
    task.words.forEach(function (w) { wordCells(w).forEach(function (p, k) { g[p[0]][p[1]] = w.word.charAt(k); }); });
    return g;
  }
  /* Індекс слова, яке починається в клітинці a і закінчується в b (або навпаки); -1, якщо такого немає */
  function findWord(task, a, b) {
    var hit = -1;
    task.words.forEach(function (w, k) {
      var cs = wordCells(w), s = cs[0], z = cs[cs.length - 1];
      if ((s[0] === a[0] && s[1] === a[1] && z[0] === b[0] && z[1] === b[1]) ||
          (z[0] === a[0] && z[1] === a[1] && s[0] === b[0] && s[1] === b[1])) hit = k;
    });
    return hit;
  }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  /* Шість умов надійного пароля, по порядку: довжина, малі, великі, цифри, символи, без простих слів. weak — підрядки з даних */
  function passwordChecks(p, weak) {
    p = String(p);
    var chars = p.split(""), re = null;
    if (weak && weak.length) re = new RegExp(weak.map(escRe).join("|"), "i");
    return [
      p.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "x").length >= PASSWORD_MIN,
      chars.some(function (c) { return c !== c.toUpperCase(); }),
      chars.some(function (c) { return c !== c.toLowerCase(); }),
      /[0-9]/.test(p),
      chars.some(function (c) { return c.toLowerCase() === c.toUpperCase() && !/[0-9\s]/.test(c); }),
      p.length > 0 && !(re && re.test(p))
    ];
  }
  /* Рівень захисту 0..6 (порожній пароль — 0) */
  function passwordLevel(checks, p) {
    if (!p) return 0;
    return checks.filter(Boolean).length;
  }

  /* ---------- підсумок ---------- */
  function rank(ratio) { return ratio >= 0.9 ? "senior" : ratio >= 0.7 ? "agent" : ratio >= 0.5 ? "junior" : "trainee"; }
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function fmtDate(d) {
    return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear();
  }

  /* ---------- стан ---------- */
  function freshState() {
    return { v: STATE_VERSION, name: "", cls: "", started: 0, finished: 0, done: [], scores: {}, screen: "start", cur: null, task: null, letters: null };
  }
  /* Ім’я і клас учня (персональні дані) ніколи не потрапляють у сховище */
  function publicState(S) {
    var o = {};
    Object.keys(S).forEach(function (k) { if (k !== "name" && k !== "cls") o[k] = S[k]; });
    return o;
  }
  function taskKey(missionId, taskId) { return missionId + "/" + taskId; }
  function missionIndex(missions, id) {
    for (var i = 0; i < missions.length; i++) if (missions[i].id === id) return i;
    return -1;
  }
  function taskIndex(mission, id) {
    for (var i = 0; i < mission.tasks.length; i++) if (mission.tasks[i].id === id) return i;
    return -1;
  }
  function isDone(S, id) { return S.done.indexOf(id) > -1; }
  /* Індекс першої незавершеної місії; -1, коли всі пройдено. Місії відкриваються строго по черзі */
  function nextOpen(missions, S) {
    for (var i = 0; i < missions.length; i++) if (!isDone(S, missions[i].id)) return i;
    return -1;
  }
  function score(S) {
    var s = 0;
    Object.keys(S.scores).forEach(function (k) { s += S.scores[k]; });
    return s;
  }
  function elapsed(S, now) {
    if (!S.started) return 0;
    return Math.max(0, Math.floor(((S.finished || now) - S.started) / 1000));
  }
  /* Бали завдання зараховуються лише з першого разу. Повертає записане значення */
  function recordScore(S, missionId, taskId, pts) {
    var k = taskKey(missionId, taskId);
    if (S.scores[k] === undefined) S.scores[k] = pts;
    return S.scores[k];
  }
  function missionScore(S, mission) {
    var got = 0;
    mission.tasks.forEach(function (t) { got += S.scores[taskKey(mission.id, t.id)] || 0; });
    return { got: got, max: missionMax(mission) };
  }
  /* Після завдання: наступне завдання місії або завершення місії. Змінює S, повертає "task" | "done" */
  function nextStep(S, mission) {
    var i = taskIndex(mission, S.task);
    if (i + 1 < mission.tasks.length) { S.task = mission.tasks[i + 1].id; return "task"; }
    if (!isDone(S, mission.id)) S.done.push(mission.id);
    return "done";
  }
  function startMission(S, missionId, missions) {
    var i = missionIndex(missions, missionId);
    S.cur = missionId;
    S.task = i < 0 ? null : missions[i].tasks[0].id;
  }

  /* ---------- маршрутизація ---------- */
  var MISSION_SCREENS = ["brief", "task", "done"];
  /* hash для екрана: #map, #<id місії>, #final, #cert; start і resume — без hash */
  function hashFor(screen, S) {
    if (screen === "map") return "map";
    if (MISSION_SCREENS.indexOf(screen) > -1) return S.cur || "";
    if (screen === "final") return "final";
    if (screen === "cert") return "cert";
    return "";
  }
  /* Старе #mission-N (номер з 1) → id місії за позицією; null, якщо це не старий формат */
  function legacyHash(h, missions) {
    var m = /^mission-(\d+)$/.exec(h);
    if (!m) return null;
    var mi = missions[+m[1] - 1];
    return mi ? mi.id : "map";
  }
  /* Куди веде hash. Замки місій і ім’я перед посвідченням обійти не можна: екран визначає стан квесту */
  function resolveHash(h, missions, S) {
    if (!S.started) return { screen: "start" };
    var i = missionIndex(missions, h);
    if (i >= 0) {
      if (S.cur === h && MISSION_SCREENS.indexOf(S.screen) > -1) return { screen: S.screen };
      if (i === nextOpen(missions, S)) return { screen: "brief", cur: h };
      return { screen: "map" };
    }
    if (h === "final" && nextOpen(missions, S) < 0) return { screen: S.finished ? "cert" : "final" };
    if (h === "cert") return { screen: S.finished ? "cert" : (nextOpen(missions, S) < 0 ? "final" : "map") };
    return { screen: "map" };
  }
  /* Куди повернути учня після «Продовжити» */
  function resumeTarget(S) {
    return (S.screen && S.screen !== "start" && S.screen !== "resume") ? S.screen : (S.finished ? "cert" : "map");
  }

  /* ---------- збережений стан: перевірка й міграція ---------- */
  function isObj(o) { return o && typeof o === "object" && !Array.isArray(o); }
  /* Приводить стан зі сховища до чинного вигляду; невідомі id відкидаються. Повертає null, якщо стану немає */
  function sanitize(raw, missions) {
    if (!isObj(raw) || raw.v !== STATE_VERSION) return null;
    var S = freshState();
    S.started = +raw.started || 0;
    S.finished = +raw.finished || 0;
    S.done = Array.isArray(raw.done) ? raw.done.filter(function (id, i, a) { return missionIndex(missions, id) >= 0 && a.indexOf(id) === i; }) : [];
    S.scores = {};
    if (isObj(raw.scores)) {
      Object.keys(raw.scores).forEach(function (k) {
        var p = k.split("/"), mi = missionIndex(missions, p[0]), v = +raw.scores[k];
        if (mi >= 0 && taskIndex(missions[mi], p[1]) >= 0 && isFinite(v) && v >= 0) S.scores[k] = v;
      });
    }
    if (isObj(raw.letters)) {
      /* Прогрес спільний для всіх мов, а слово в кожної мови своє: чужі літери (інша мова) відкидаємо, ключі розкладуться заново */
      var kept = {};
      missions.forEach(function (m) { if (typeof raw.letters[m.id] === "string") kept[m.id] = raw.letters[m.id]; });
      var have = missions.map(function (m) { return kept[m.id] || ""; }).sort().join("");
      var want = missions.map(function (m) { return m.letter; }).sort().join("");
      if (have === want) S.letters = kept;
    }
    var cur = typeof raw.cur === "string" && missionIndex(missions, raw.cur) >= 0 ? raw.cur : null;
    S.cur = cur;
    S.task = cur && taskIndex(missions[missionIndex(missions, cur)], raw.task) >= 0 ? raw.task : null;
    var screen = typeof raw.screen === "string" ? raw.screen : "start";
    if (["start", "resume", "map", "brief", "task", "done", "final", "cert"].indexOf(screen) < 0) screen = "map";
    if (MISSION_SCREENS.indexOf(screen) > -1 && !cur) screen = "map";
    if (screen === "task" && !S.task) S.task = missions[missionIndex(missions, cur)].tasks[0].id;
    S.screen = screen;
    return S;
  }
  /* agenty-kibershchytu:v3 (номери замість id): done:[0,1], scores:{"0-2":1}, cur:3, task:1, letters:["З",…] */
  function migrateV3(old, missions) {
    if (!isObj(old)) return null;
    var S = freshState();
    function mid(i) { return missions[i] ? missions[i].id : null; }
    S.started = +old.started || 0;
    S.finished = +old.finished || 0;
    S.done = (Array.isArray(old.done) ? old.done : []).map(function (i) { return mid(+i); }).filter(Boolean);
    S.done = S.done.filter(function (id, i, a) { return a.indexOf(id) === i; });
    if (isObj(old.scores)) {
      Object.keys(old.scores).forEach(function (k) {
        var m = /^(\d+)-(\d+)$/.exec(k), mi = m ? missions[+m[1]] : null, t = mi ? mi.tasks[+m[2]] : null, v = +old.scores[k];
        if (t && isFinite(v) && v >= 0) S.scores[taskKey(mi.id, t.id)] = v;
      });
    }
    if (Array.isArray(old.letters) && old.letters.length === missions.length) S.letters = lettersById(missions, old.letters);
    var cur = mid(+old.cur);
    S.cur = typeof old.cur === "number" || typeof old.cur === "string" ? cur : null;
    var cm = S.cur ? missions[missionIndex(missions, S.cur)] : null;
    S.task = cm && cm.tasks[+old.task] ? cm.tasks[+old.task].id : (cm ? cm.tasks[0].id : null);
    var screen = typeof old.screen === "string" ? old.screen : "start";
    if (["start", "resume", "map", "brief", "task", "done", "final", "cert"].indexOf(screen) < 0) screen = "map";
    if (MISSION_SCREENS.indexOf(screen) > -1 && !S.cur) screen = "map";
    S.screen = screen;
    return S;
  }

  return {
    TASK_TYPES: TASK_TYPES, CHAT_IMAGES: CHAT_IMAGES, RESERVED_IDS: RESERVED_IDS, STATE_VERSION: STATE_VERSION,
    PASSWORD_CHECKS: PASSWORD_CHECKS, PASSWORD_MIN: PASSWORD_MIN, MEMORY_STEPS: MEMORY_STEPS,
    shuffle: shuffle, makeLetters: makeLetters, lettersById: lettersById, letterOf: letterOf, secretWord: secretWord, wordMatches: wordMatches,
    countClues: countClues, chatAsks: chatAsks, maxPts: maxPts, missionMax: missionMax, totalPoints: totalPoints,
    choiceCorrect: choiceCorrect, multiCorrect: multiCorrect, classifyResult: classifyResult, searchResult: searchResult,
    privacyStart: privacyStart, privacyExposed: privacyExposed, privacyResult: privacyResult,
    memoryCards: memoryCards, memoryPoints: memoryPoints, orderStart: orderStart, orderResult: orderResult,
    wordCells: wordCells, buildGrid: buildGrid, findWord: findWord, passwordChecks: passwordChecks, passwordLevel: passwordLevel,
    rank: rank, fmtTime: fmtTime, fmtDate: fmtDate,
    freshState: freshState, publicState: publicState, taskKey: taskKey, missionIndex: missionIndex, taskIndex: taskIndex,
    isDone: isDone, nextOpen: nextOpen, score: score, elapsed: elapsed, recordScore: recordScore, missionScore: missionScore,
    nextStep: nextStep, startMission: startMission,
    hashFor: hashFor, legacyHash: legacyHash, resolveHash: resolveHash, resumeTarget: resumeTarget,
    sanitize: sanitize, migrateV3: migrateV3, has: has
  };
});
