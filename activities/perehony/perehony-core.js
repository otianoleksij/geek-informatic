/* «Перегони слів»: логіка без DOM.
   Складність і ліміти часу, добір слів із зерна (генератор бере з klaviatura-core: createRng), стан перегонів
   (позиції, обгони, пропущені слова, фініш), кубки, швидкість (знаків за хвилину) і точність.
   Працює і в браузері (window.PerehonyCore), і в Node (tools/check-perehony.js).
   Розкладки й оцінка натискань (classify) живуть у activities/klaviatura/klaviatura-core.js і підключаються поруч
   (catalog.json: sharedScripts); це ядро від них не залежить. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PerehonyCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PLAYER = "p";            /* суперників стільки, скільки слів у перегонах: гравець + n машин */
  var BETWEEN_MS = 450;        /* пауза між словами (не входить у час слова) */

  /* ---------- складність і ліміти ---------- */
  /* Ліміт часу на слово, секунд: реакція + літери * секунд на літеру. */
  function limitSeconds(diff, word) {
    return diff.reaction + String(word).length * diff.perLetter;
  }
  function limitMs(diff, word) { return Math.round(limitSeconds(diff, word) * 1000); }
  /* Знаків за хвилину, якого вистачає, щоб устигнути слово з n літер (для довідки в документах). */
  function requiredCpm(diff, n) { return n / (diff.reaction + n * diff.perLetter) * 60; }

  function listOf(tiers, tier) {
    for (var i = 0; i < tiers.length; i++) if (tiers[i].tier === tier) return tiers[i].list;
    return [];
  }
  function lengthRange(diff, tiers) {
    var min = 1e9, max = 0;
    for (var k = 0; k < 2; k++) {
      var l = listOf(tiers, diff.tiers[k]);
      for (var i = 0; i < l.length; i++) { if (l[i].length < min) min = l[i].length; if (l[i].length > max) max = l[i].length; }
    }
    return { min: min === 1e9 ? 0 : min, max: max };
  }
  /* Середній ліміт (с) за словами обох рівнів складності: це «≈ N с на слово» на картці. */
  function avgLimitSeconds(diff, tiers) {
    var sum = 0, n = 0;
    for (var k = 0; k < 2; k++) {
      var l = listOf(tiers, diff.tiers[k]);
      for (var i = 0; i < l.length; i++) { sum += limitSeconds(diff, l[i]); n++; }
    }
    return n ? sum / n : 0;
  }

  /* ---------- добір слів ---------- */
  function shuffleTake(list, count, rng) {
    var a = list.slice(), out = [], i, j, t;
    for (i = 0; i < count && i < a.length; i++) {
      j = i + Math.floor(rng() * (a.length - i));
      t = a[i]; a[i] = a[j]; a[j] = t;
      out.push(a[i]);
    }
    return out;
  }
  /* Перша половина слів з нижнього рівня, друга з верхнього; без повторів; у кожній половині від коротших до довших.
     rng: функція () => [0,1) (klaviatura-core.createRng(seed)). Те саме зерно дає ті самі слова. */
  function pickWords(tiers, diff, count, rng) {
    var nLow = Math.floor(count / 2), nHigh = count - nLow;
    var low = shuffleTake(listOf(tiers, diff.tiers[0]), nLow, rng);
    var taken = {}, i;
    for (i = 0; i < low.length; i++) taken[low[i]] = true;
    var pool = listOf(tiers, diff.tiers[1]).filter(function (w) { return !taken[w]; });
    var high = shuffleTake(pool, nHigh, rng);
    function byLen(arr) {
      /* стабільне сортування за довжиною: порядок із тасування лишається всередині однакових довжин */
      return arr.map(function (w, idx) { return { w: w, i: idx }; })
        .sort(function (a, b) { return a.w.length - b.w.length || a.i - b.i; })
        .map(function (o) { return o.w; });
    }
    return byLen(low).concat(byLen(high));
  }

  /* ---------- перегони ---------- */
  /* id суперників: c1..cn. */
  function opponentIds(n) {
    var out = [], i;
    for (i = 1; i <= n; i++) out.push("c" + i);
    return out;
  }
  /* Машини від першого місця до останнього: масив id. Спочатку суперники попереду, гравець останній. */
  function startOrder(n) { return opponentIds(n).concat([PLAYER]); }

  function newRace(words, diff) {
    var limits = [], i;
    for (i = 0; i < words.length; i++) limits.push(limitMs(diff, words[i]));
    return {
      diffId: diff.id,
      words: words,
      limits: limits,
      total: words.length,
      cars: words.length + 1,    /* гравець і по одному суперникові на слово */
      index: -1,                 /* номер поточного слова (0-базований), -1 до першого */
      status: "ready",           /* ready | word | between | finished */
      order: startOrder(words.length),
      wordPos: 0,
      wordElapsed: 0,
      typingMs: 0,               /* сумарний час, коли слова були на екрані (без пауз між словами) */
      keystrokes: 0,
      correctKeys: 0,
      errors: 0,
      inTime: 0,
      missed: 0,
      fast: 0,
      results: []                /* {word, ok, fast, ms} */
    };
  }
  function place(race) { return race.order.indexOf(PLAYER) + 1; }
  function currentWord(race) { return race.status === "word" ? race.words[race.index] : ""; }
  function currentLimit(race) { return race.status === "word" ? race.limits[race.index] : 0; }
  function currentChar(race) { return race.status === "word" ? race.words[race.index].charAt(race.wordPos) : ""; }
  function remainingMs(race) { return race.status === "word" ? Math.max(0, race.limits[race.index] - race.wordElapsed) : 0; }

  /* Показати наступне слово. Повертає слово або null, якщо слова скінчилися (status стає finished). */
  function startWord(race) {
    if (race.status === "finished") return null;
    if (race.index + 1 >= race.total) { race.status = "finished"; return null; }
    race.index++;
    race.wordPos = 0;
    race.wordElapsed = 0;
    race.status = "word";
    return race.words[race.index];
  }

  /* Гравець обганяє машину безпосередньо попереду (міняються місцями).
     Повертає подію або null, якщо вже перше місце. Назад гравець не рухається ніколи. */
  function overtake(race) {
    var from = race.order.indexOf(PLAYER), to = from - 1;
    if (to < 0) return null;
    var other = race.order[to];
    race.order[to] = PLAYER;
    race.order[from] = other;
    return { from: from + 1, to: to + 1, other: other };
  }

  /* Слово набране вчасно: обгін на одну позицію. Час вийшов: слово пропущено, місце те саме. */
  function finishWord(race, ok, fast, ms) {
    var ev, sw;
    race.results.push({ word: race.words[race.index], ok: ok, fast: fast, ms: ms });
    if (ok) {
      race.inTime++;
      if (fast) race.fast++;
      sw = overtake(race);
      ev = sw
        ? { type: "overtake", passed: sw.other, from: sw.from, to: sw.to, fast: fast, moved: true }
        : { type: "overtake", passed: null, from: 1, to: 1, fast: fast, moved: false };
    } else {
      race.missed++;
      ev = { type: "timeout", passed: null, from: place(race), to: place(race), fast: false, moved: false };
    }
    ev.index = race.index;
    ev.last = race.index + 1 >= race.total;
    ev.place = place(race);
    race.status = "between";
    return ev;
  }

  /* Час іде: dtMs мілісекунд активного часу слова (паузи не передавати). Повертає подію timeout або null. */
  function tick(race, dtMs) {
    if (race.status !== "word" || !(dtMs > 0)) return null;
    var lim = race.limits[race.index];
    var step = Math.min(dtMs, Math.max(0, lim - race.wordElapsed));
    race.wordElapsed += step;
    race.typingMs += step;
    if (race.wordElapsed >= lim) return finishWord(race, false, false, lim);
    return null;
  }

  /* Натискання: ok = результат classify (true / false); "ignore" і "layout" сюди не передають.
     Повертає {type:"ok"|"error"} або, коли слово набрано, подію overtake. */
  function key(race, ok) {
    if (race.status !== "word") return null;
    race.keystrokes++;
    if (!ok) { race.errors++; return { type: "error", pos: race.wordPos }; }
    race.correctKeys++;
    race.wordPos++;
    if (race.wordPos >= race.words[race.index].length) {
      var lim = race.limits[race.index];
      var fast = race.wordElapsed < lim / 2;
      return finishWord(race, true, fast, Math.round(race.wordElapsed));
    }
    return { type: "ok", pos: race.wordPos };
  }

  /* ---------- підсумок ---------- */
  function cupsFor(p) { return p === 1 ? 3 : p === 2 ? 2 : p === 3 ? 1 : 0; }
  function accuracy(race) {
    return race.keystrokes ? race.correctKeys / race.keystrokes * 100 : 100;
  }
  /* Знаків за хвилину: правильні символи / час, коли слова були на екрані. */
  function cpm(race) {
    return race.typingMs > 0 ? race.correctKeys / (race.typingMs / 60000) : 0;
  }
  /* Тон підсумкового тексту: win (1), podium (2-3), good (до половини машин), keep (решта). */
  function resultKind(p, cars) {
    return p === 1 ? "win" : p <= 3 ? "podium" : p <= Math.ceil(cars / 2) ? "good" : "keep";
  }
  function summary(race) {
    var p = place(race);
    return {
      place: p,
      cars: race.cars,
      kind: resultKind(p, race.cars),
      win: p === 1,
      cups: cupsFor(p),
      inTime: race.inTime,
      total: race.total,
      fast: race.fast,
      cpm: Math.round(cpm(race)),
      accuracy: Math.round(accuracy(race) * 10) / 10,
      errors: race.errors
    };
  }
  /* Чи a кращий за b (менше місце, а за рівного місця більша швидкість). b може бути порожнім. */
  function isBetter(a, b) {
    if (!b || typeof b.place !== "number") return true;
    if (a.place !== b.place) return a.place < b.place;
    return a.cpm > b.cpm;
  }

  return {
    PLAYER: PLAYER,
    BETWEEN_MS: BETWEEN_MS,
    limitSeconds: limitSeconds,
    limitMs: limitMs,
    requiredCpm: requiredCpm,
    lengthRange: lengthRange,
    avgLimitSeconds: avgLimitSeconds,
    listOf: listOf,
    pickWords: pickWords,
    opponentIds: opponentIds,
    startOrder: startOrder,
    newRace: newRace,
    place: place,
    currentWord: currentWord,
    currentLimit: currentLimit,
    currentChar: currentChar,
    remainingMs: remainingMs,
    startWord: startWord,
    tick: tick,
    key: key,
    cupsFor: cupsFor,
    resultKind: resultKind,
    accuracy: accuracy,
    cpm: cpm,
    summary: summary,
    isBetter: isBetter
  };
});
