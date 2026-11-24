/* «Космічний клавіатурний тренажер»: логіка без DOM.
   Розкладки й пальці, генерація тексту із зерна, оцінка натискань, стан гри (комбо, шкода,
   відстань астероїда, перемога/поразка), зірки. Працює і в браузері (window.KlaviaturaCore),
   і в Node (tools/check-klaviatura.js).
   Кириличні літери в розкладці записані через \uXXXX (правило сайту: без кирилиці в рядках коду);
   нижче у коментарях видно, що це за літери. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KlaviaturaCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- пальці ----------
     lp/lr/lm/li: лівий мізинець, безіменний, середній, вказівний; ri/rm/rr/rp: правий вказівний ... мізинець;
     th: великі пальці (пробіл). */
  var FINGERS = ["lp", "lr", "lm", "li", "th", "ri", "rm", "rr", "rp"];

  /* Фізичні клавіші (KeyboardEvent.code) по рядках і пальці, що їх натискають (стандартна схема сліпого друку). */
  var CODES = [
    ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"],
    ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Backslash"],
    ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"],
    ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"]
  ];
  var FINGER_ROWS = [
    ["lp", "lp", "lr", "lm", "li", "li", "ri", "ri", "rm", "rr", "rp", "rp", "rp"],
    ["lp", "lr", "lm", "li", "li", "ri", "ri", "rm", "rr", "rp", "rp", "rp", "rp"],
    ["lp", "lr", "lm", "li", "li", "ri", "ri", "rm", "rr", "rp", "rp"],
    ["lp", "lr", "lm", "li", "li", "ri", "ri", "rm", "rr", "rp"]
  ];
  var FINGER_OF = { Space: "th" };
  (function () {
    for (var r = 0; r < CODES.length; r++) for (var c = 0; c < CODES[r].length; c++) FINGER_OF[CODES[r][c]] = FINGER_ROWS[r][c];
  })();

  /* Символи без Shift (base) і з Shift (shift) у тому ж порядку, що й CODES. */
  var CHARS = {
    /* США (QWERTY) */
    en: {
      base: ["`1234567890-=", "qwertyuiop[]\\", "asdfghjkl;'", "zxcvbnm,./"],
      shift: ["~!@#$%^&*()_+", "QWERTYUIOP{}|", "ASDFGHJKL:\"", "ZXCVBNM<>?"]
    },
    /* Українська (ЙЦУКЕН, розкладка Windows): апостроф на місці «ё», ґ на місці зворотної косої, є на місці «'» */
    uk: {
      base: [
        "'1234567890-=",
        "\u0439\u0446\u0443\u043a\u0435\u043d\u0433\u0448\u0449\u0437\u0445\u0457\u0491", // йцукенгшщзхїґ
        "\u0444\u0456\u0432\u0430\u043f\u0440\u043e\u043b\u0434\u0436\u0454", // фівапролджє
        "\u044f\u0447\u0441\u043c\u0438\u0442\u044c\u0431\u044e." // ячсмитьбю.
      ],
      shift: [
        "\u20b4!\"\u2116;%:?*()_+", // ₴!"№;%:?*()_+
        "\u0419\u0426\u0423\u041a\u0415\u041d\u0413\u0428\u0429\u0417\u0425\u0407\u0490", // ЙЦУКЕНГШЩЗХЇҐ
        "\u0424\u0406\u0412\u0410\u041f\u0420\u041e\u041b\u0414\u0416\u0404", // ФІВАПРОЛДЖЄ
        "\u042f\u0427\u0421\u041c\u0418\u0422\u042c\u0411\u042e," // ЯЧСМИТЬБЮ,
      ]
    }
  };
  var SCRIPT = { en: "lat", uk: "cyr" };

  var layoutCache = {}, indexCache = {};
  /* getLayout("uk") -> рядки [{code, base, shift, finger}] */
  function getLayout(lang) {
    if (layoutCache[lang]) return layoutCache[lang];
    var ch = CHARS[lang];
    if (!ch) throw new Error("\u043d\u0435\u0432\u0456\u0434\u043e\u043c\u0430 \u0440\u043e\u0437\u043a\u043b\u0430\u0434\u043a\u0430: " + lang);
    var rows = [];
    for (var r = 0; r < CODES.length; r++) {
      var row = [];
      for (var c = 0; c < CODES[r].length; c++) {
        row.push({ code: CODES[r][c], base: ch.base[r].charAt(c), shift: ch.shift[r].charAt(c), finger: FINGER_ROWS[r][c] });
      }
      rows.push(row);
    }
    layoutCache[lang] = rows;
    return rows;
  }
  function index(lang) {
    if (indexCache[lang]) return indexCache[lang];
    var map = {}, rows = getLayout(lang);
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < rows[r].length; c++) {
      var k = rows[r][c];
      if (!map.hasOwnProperty(k.base)) map[k.base] = { code: k.code, shift: false, finger: k.finger };
      if (!map.hasOwnProperty(k.shift)) map[k.shift] = { code: k.code, shift: true, finger: k.finger };
    }
    map[" "] = { code: "Space", shift: false, finger: "th" };
    indexCache[lang] = map;
    return map;
  }

  /* Різні апострофи приводимо до звичайного. */
  function norm(ch) {
    return ch === "\u2019" || ch === "\u02bc" || ch === "\u2018" ? "'" : ch;
  }

  function handOf(finger) { return finger === "th" ? "t" : finger.charAt(0); }

  /* Де натискати символ: {code, shift, finger, hand, shiftCode, shiftFinger} або null, якщо його немає в розкладці. */
  function locate(lang, ch) {
    var m = index(lang)[norm(ch)];
    if (!m) return null;
    var res = { code: m.code, shift: m.shift, finger: m.finger, hand: handOf(m.finger), shiftCode: null, shiftFinger: null };
    if (m.shift) {
      /* Shift тримає мізинець протилежної руки */
      res.shiftCode = res.hand === "l" ? "ShiftRight" : "ShiftLeft";
      res.shiftFinger = res.hand === "l" ? "rp" : "lp";
    }
    return res;
  }

  function scriptOf(ch) {
    if (/[\u0400-\u04ff]/.test(ch)) return "cyr";
    if (/[A-Za-z]/.test(ch)) return "lat";
    return "other";
  }

  var MODIFIERS = { Shift: 1, Control: 1, Alt: 1, AltGraph: 1, Meta: 1, OS: 1, CapsLock: 1, NumLock: 1, ScrollLock: 1, Fn: 1, FnLock: 1, Hyper: 1, Super: 1, Symbol: 1, SymbolLock: 1 };
  function isModifierKey(key) { return MODIFIERS.hasOwnProperty(key); }

  /* Оцінка натискання: "ignore" (модифікатор, службова клавіша, мертва клавіша),
     "ok", "error" \u0430\u0431\u043e "layout" (\u0444\u0456\u0437\u0438\u0447\u043d\u0430 \u043a\u043b\u0430\u0432\u0456\u0448\u0430 \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u0430, \u0430\u043b\u0435 \u0440\u043e\u0437\u043a\u043b\u0430\u0434\u043a\u0430 \u0456\u043d\u0448\u0430: \u043b\u0430\u0442\u0438\u043d\u0441\u044c\u043a\u0430 \u0437\u0430\u043c\u0456\u0441\u0442\u044c \u043a\u0438\u0440\u0438\u043b\u0438\u0446\u0456 \u0439 \u043d\u0430\u0432\u043f\u0430\u043a\u0438).
     ev: {key, code}. */
  function classify(lang, expected, ev) {
    var key = ev.key;
    if (key === "Spacebar") key = " ";
    if (typeof key !== "string" || key === "" || key === "Dead" || key === "Unidentified" || key === "Process" || key === "Compose") return "ignore";
    if (isModifierKey(key)) return "ignore";
    if (key.length !== 1) return "ignore";            /* Enter, Tab, Backspace, \u0441\u0442\u0440\u0456\u043b\u043a\u0438, F1... */
    if (norm(key) === norm(expected)) return "ok";
    var loc = locate(lang, expected);
    if (loc && ev.code && ev.code === loc.code) {
      var ks = scriptOf(key);
      if ((ks === "lat" || ks === "cyr") && ks !== SCRIPT[lang]) return "layout";
      /* очікували літеру, а та сама клавіша дала розділовий знак (Б і Ж на латиниці: «,» «;» «<» «:») */
      if (scriptOf(expected) === SCRIPT[lang] && ks !== SCRIPT[lang]) return "layout";
    }
    return "error";
  }

  /* Чи символ можна ввести на цій розкладці. */
  function typeable(lang, ch) { return locate(lang, ch) !== null; }

  /* ---------- генератор із зерна ---------- */
  function createRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {            /* mulberry32 */
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

  function isTriple(prev, ch) {
    return prev.length >= 2 && prev.charAt(prev.length - 1) === ch && prev.charAt(prev.length - 2) === ch;
  }
  /* Символ так, щоб один і той самий не повторювався 3 рази поспіль.
     Якщо задано nk (нові клавіші) і bias, то з імовірністю bias символ береться з nk, інакше з old (решта алфавіту). */
  function pickChar(rng, alpha, prev, nk, old, bias) {
    var n = alpha.length, ch = "", tries = 0, pool, i;
    do {
      if (nk) {
        pool = (!old || rng() < bias) ? nk : old;
        ch = pool.charAt(Math.floor(rng() * pool.length));
      } else ch = alpha.charAt(Math.floor(rng() * n));
      tries++;
    } while (n > 1 && isTriple(prev, ch) && tries < 50);
    if (n > 1 && isTriple(prev, ch)) {
      var start = Math.floor(rng() * n);
      for (i = 0; i < n; i++) { ch = alpha.charAt((start + i) % n); if (!isTriple(prev, ch)) break; }
    }
    return ch;
  }

  /* spec: {keys, newKeys?, gen:{kind:"groups", groups, min, max, alphabet?, bias?, focus?} | gen:{kind:"words", count, words} | texts:[...]}.
     groups: minLen (необов'язково) дописує групи, доки текст коротший за minLen; alphabet (типово keys без пробілів) задає символи груп; bias (0..1) каже, яка частка символів
     береться з spec.newKeys (нові клавіші рівня), решта з інших символів алфавіту.
     Той самий spec і те саме зерно завжди дають той самий текст. */
  function generate(spec, seed) {
    var rng = createRng(seed), i, j;
    if (spec.texts && spec.texts.length) return spec.texts[Math.floor(rng() * spec.texts.length)];
    var g = spec.gen;
    if (!g) throw new Error("\u0443 \u043d\u0430\u0431\u043e\u0440\u0456 \u043d\u0435\u043c\u0430\u0454 \u043d\u0456 gen, \u043d\u0456 texts");
    if (g.kind === "words") {
      var out = [], last = -1, w = g.words, k;
      i = 0;
      /* count слів, і ще, поки текст коротший за minLen (якщо задано) */
      while (i < g.count || (g.minLen && out.join(" ").length < g.minLen)) {
        do { k = Math.floor(rng() * w.length); } while (w.length > 1 && k === last);
        out.push(w[k]); last = k; i++;
      }
      return out.join(" ");
    }
    var alpha = (g.alphabet || spec.keys).replace(/ /g, ""), focus = g.focus || "", groups = [];
    var nk = "", old = "";
    if (g.bias && spec.newKeys) {
      for (i = 0; i < alpha.length; i++) {
        if (spec.newKeys.indexOf(alpha.charAt(i)) >= 0) nk += alpha.charAt(i); else old += alpha.charAt(i);
      }
    }
    i = 0;
    /* groups груп, і ще, поки текст коротший за minLen (якщо задано) */
    while (i < g.groups || (g.minLen && groups.join(" ").length < g.minLen)) {
      var len = randInt(rng, g.min, g.max), s = "", fpos = focus ? Math.floor(rng() * len) : -1;
      for (j = 0; j < len; j++) {
        s += j === fpos ? pickChar(rng, focus, s) : pickChar(rng, alpha, s, nk, old, g.bias);
      }
      groups.push(s); i++;
    }
    return groups.join(" ");
  }

  /* ---------- стан гри ---------- */
  var IDLE_CAP_MS = 2500;
  var DEFAULTS = {
    errorBudgetRatio: 0.2,
    asteroidHp: 12,
    combo: [{ at: 5, mult: 2 }, { at: 10, mult: 3 }, { at: 20, mult: 4 }],
    stars: { two: 90, three: 95 }
  };

  function errorBudget(len, ratio) {
    var r = ratio === undefined || ratio === null ? DEFAULTS.errorBudgetRatio : ratio;
    /* ceil з поправкою на похибку дробових чисел (0.2 * 35 = 7.000000000000001) */
    return Math.max(1, Math.ceil(len * r - 1e-9));
  }

  function comboMultiplier(combo, tiers) {
    var t = tiers || DEFAULTS.combo, m = 1;
    for (var i = 0; i < t.length; i++) if (combo >= t[i].at && t[i].mult > m) m = t[i].mult;
    return m;
  }

  /* opts: {errorBudgetRatio, asteroidHp, combo (щаблі), stars} */
  function newGame(text, opts) {
    opts = opts || {};
    var len = text.length, marks = [], i;
    for (i = 0; i < len; i++) marks.push("");     /* "", "ok", "fixed" (\u0431\u0443\u043b\u0430 \u043f\u043e\u043c\u0438\u043b\u043a\u0430), "err" (\u043f\u043e\u043c\u0438\u043b\u043a\u0430 \u043d\u0430 \u043f\u043e\u0442\u043e\u0447\u043d\u043e\u043c\u0443 \u0441\u0438\u043c\u0432\u043e\u043b\u0456) */
    return {
      text: text,
      length: len,
      pos: 0,
      status: "playing",            /* playing | won | lost */
      budget: errorBudget(len, opts.errorBudgetRatio),
      errors: 0,
      correct: 0,
      keystrokes: 0,
      combo: 0,
      maxCombo: 0,
      mult: 1,
      damage: 0,
      destroyed: 0,
      hpMax: opts.asteroidHp || DEFAULTS.asteroidHp,
      hp: opts.asteroidHp || DEFAULTS.asteroidHp,
      tiers: opts.combo || DEFAULTS.combo,
      starRule: opts.stars || DEFAULTS.stars,
      marks: marks,
      startedAt: null,
      lastAt: null,
      activeMs: 0,          /* час, коли учень справді друкував (паузи довші за IDLE_CAP_MS не рахуються) */
      finishedAt: null
    };
  }

  /* 0 — астероїд врізається, 1 — на початку. Кожна помилка наближає його на 1/budget. */
  function distance(game) { return Math.max(0, 1 - game.errors / game.budget); }

  /* Застосувати натискання. ok: true/false (результат classify; "ignore" і "layout" сюди не передають).
     now: час у мс (для швидкості). Повертає подію для інтерфейсу. */
  function press(game, ok, now) {
    if (game.status !== "playing") return { type: "none" };
    if (game.startedAt === null) game.startedAt = now || 0;
    if (game.lastAt !== null) game.activeMs += Math.min(Math.max(0, (now || 0) - game.lastAt), IDLE_CAP_MS);
    game.lastAt = now || 0;
    game.keystrokes++;
    var ev;
    if (ok) {
      var prevMult = game.mult;
      game.correct++;
      game.marks[game.pos] = game.marks[game.pos] === "err" ? "fixed" : "ok";
      game.pos++;
      game.combo++;
      if (game.combo > game.maxCombo) game.maxCombo = game.combo;
      game.mult = comboMultiplier(game.combo, game.tiers);
      var dmg = game.mult, destroyed = false;
      game.damage += dmg;
      game.hp -= dmg;
      if (game.hp <= 0) { game.destroyed++; game.hp = game.hpMax; destroyed = true; }
      ev = { type: "hit", mult: game.mult, damage: dmg, combo: game.combo, destroyed: destroyed, tierUp: game.mult > prevMult, won: false };
      if (game.pos >= game.length) { game.status = "won"; game.finishedAt = now || 0; ev.won = true; }
    } else {
      var hadCombo = game.combo;
      game.errors++;
      game.marks[game.pos] = "err";
      game.combo = 0;
      game.mult = 1;
      ev = { type: "miss", errors: game.errors, lostCombo: hadCombo, lost: false };
      if (game.errors >= game.budget) { game.status = "lost"; game.finishedAt = now || 0; ev.lost = true; }
    }
    return ev;
  }

  function accuracy(game) {
    return game.keystrokes ? game.correct / game.keystrokes * 100 : 100;
  }
  /* Знаків за хвилину: проміжки між правильними символами / активний час (перша клавіша лише запускає годинник). */
  function cpm(game) {
    if (!(game.activeMs > 0) || game.correct < 2) return 0;
    return (game.correct - 1) / (game.activeMs / 60000);
  }
  function starsFor(acc, rule) {
    var r = rule || DEFAULTS.stars;
    return acc >= r.three ? 3 : acc >= r.two ? 2 : 1;
  }
  function score(game) { return game.destroyed * 100 + game.damage; }

  /* Підсумок гри для екрана результату й збереження. */
  function summary(game) {
    var acc = accuracy(game);
    return {
      accuracy: Math.round(acc * 10) / 10,
      cpm: Math.round(cpm(game)),
      maxCombo: game.maxCombo,
      destroyed: game.destroyed,
      damage: game.damage,
      score: score(game),
      errors: game.errors,
      stars: game.status === "won" ? starsFor(acc, game.starRule) : 0
    };
  }

  return {
    FINGERS: FINGERS,
    DEFAULTS: DEFAULTS,
    getLayout: getLayout,
    locate: locate,
    typeable: typeable,
    scriptOf: scriptOf,
    isModifierKey: isModifierKey,
    classify: classify,
    createRng: createRng,
    generate: generate,
    errorBudget: errorBudget,
    comboMultiplier: comboMultiplier,
    newGame: newGame,
    distance: distance,
    press: press,
    accuracy: accuracy,
    cpm: cpm,
    starsFor: starsFor,
    score: score,
    summary: summary
  };
});
