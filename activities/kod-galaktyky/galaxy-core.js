/* Ядро гри «Код Галактики»: без DOM. Браузер: window.GalaxyCore, Node: module.exports.
   Програма — масив вузлів: "F" вперед, "L" ліворуч, "R" праворуч, "C" зібрати кристал,
   {rep:N, body:[...]} — повтор (N від 2 до 9, вкладення до 3 рівнів).
   Шлях вузла (path) — масив індексів: [2] = третій вузол, [2,0] = перший вузол у тілі повтору №3. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GalaxyCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VEC = { E: [1, 0], N: [0, -1], W: [-1, 0], S: [0, 1] };
  var LEFT = { E: "N", N: "W", W: "S", S: "E" };
  var RIGHT = { E: "S", S: "W", W: "N", N: "E" };
  var DIR_LIST = ["E", "N", "W", "S"];
  var CMDS = { F: 1, L: 1, R: 1, C: 1 };
  var MAX_DEPTH = 3, MIN_REP = 2, MAX_REP = 9, STEP_CAP = 20000;

  /* ---------- карта ---------- */
  function parseMap(level) {
    var rows = level.map, h = rows.length, w = h ? rows[0].length : 0;
    var rocks = {}, crystals = [], crystalAt = {}, start = null;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        var c = rows[y].charAt(x);
        if (c === "#") rocks[x + "," + y] = true;
        else if (c === "*") { crystalAt[x + "," + y] = crystals.length; crystals.push({ x: x, y: y }); }
        else if (c === "S") start = { x: x, y: y };
      }
    }
    return { w: w, h: h, rocks: rocks, crystals: crystals, crystalAt: crystalAt, start: start,
      dir: (level.start && level.start.dir) || "E" };
  }

  /* ---------- обхід програми ---------- */
  /* Прямий обхід: cb(node, path, depth, ordinal). depth рахується з 1 для верхнього рівня. */
  function walk(program, cb) {
    var ord = 0;
    (function rec(list, base, depth) {
      for (var i = 0; i < list.length; i++) {
        var node = list[i], path = base.concat(i);
        cb(node, path, depth, ++ord);
        if (node && typeof node === "object" && node.body) rec(node.body, path, depth + 1);
      }
    })(program || [], [], 1);
  }
  function isRep(n) { return n && typeof n === "object" && Array.isArray(n.body); }
  function countBlocks(program) { var n = 0; walk(program, function () { n++; }); return n; }
  function countByType(program) {
    var r = { F: 0, L: 0, R: 0, C: 0, rep: 0 };
    walk(program, function (node) { if (isRep(node)) r.rep++; else if (r.hasOwnProperty(node)) r[node]++; });
    return r;
  }
  function maxDepth(program) { var d = 0; walk(program, function (n, p, depth) { if (depth > d) d = depth; }); return d; }
  /* Є повтор, вкладений у інший повтор? */
  function hasNested(program) {
    var found = false;
    walk(program, function (n, p, depth) { if (isRep(n) && depth > 1) found = true; });
    return found;
  }
  function ordinalOf(program, path) {
    var key = path.join("."), res = 0;
    walk(program, function (n, p, d, o) { if (p.join(".") === key) res = o; });
    return res;
  }

  /* ---------- виконання ---------- */
  /* Події: start, rep, move, turn, collect, crash{reason:rock|edge}, nocrystal, win.
     Підсумок status: win | crash | nocrystal | incomplete | toolong. */
  function run(level, program) {
    var m = parseMap(level);
    var x = m.start.x, y = m.start.y, dir = m.dir;
    var taken = {}, left = m.crystals.length, collected = 0, steps = 0;
    var events = [{ t: "start", x: x, y: y, dir: dir }];
    var status = null, failPath = null;

    function stop(st, path) { status = st; failPath = path || null; return false; }

    function step(cmd, path) {
      if (++steps > STEP_CAP) return stop("toolong", path);
      if (cmd === "F") {
        var nx = x + VEC[dir][0], ny = y + VEC[dir][1];
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) {
          events.push({ t: "crash", reason: "edge", path: path, x: x, y: y, tx: nx, ty: ny, dir: dir });
          return stop("crash", path);
        }
        if (m.rocks[nx + "," + ny]) {
          events.push({ t: "crash", reason: "rock", path: path, x: x, y: y, tx: nx, ty: ny, dir: dir });
          return stop("crash", path);
        }
        events.push({ t: "move", path: path, fx: x, fy: y, x: nx, y: ny, dir: dir });
        x = nx; y = ny;
      } else if (cmd === "L" || cmd === "R") {
        dir = cmd === "L" ? LEFT[dir] : RIGHT[dir];
        events.push({ t: "turn", path: path, side: cmd, x: x, y: y, dir: dir });
      } else if (cmd === "C") {
        var k = x + "," + y;
        if (m.crystalAt.hasOwnProperty(k) && !taken[k]) {
          taken[k] = true; collected++; left--;
          events.push({ t: "collect", path: path, x: x, y: y, index: m.crystalAt[k], left: left, collected: collected });
          if (left === 0) { events.push({ t: "win", path: path, x: x, y: y }); return stop("win", path); }
        } else {
          events.push({ t: "nocrystal", path: path, x: x, y: y });
          return stop("nocrystal", path);
        }
      }
      return true;
    }

    function exec(list, base) {
      for (var i = 0; i < list.length; i++) {
        var node = list[i], path = base.concat(i);
        if (typeof node === "string") {
          if (!CMDS[node]) continue;
          if (!step(node, path)) return false;
        } else if (isRep(node)) {
          var n = node.rep | 0;
          for (var k = 1; k <= n; k++) {
            events.push({ t: "rep", path: path, iter: k, of: n });
            if (!exec(node.body, path)) return false;
          }
        }
      }
      return true;
    }

    var finished = exec(program || [], []);
    if (finished) status = left === 0 ? "win" : "incomplete";
    return { events: events, status: status, win: status === "win", collected: collected, total: m.crystals.length,
      steps: steps, failPath: failPath, x: x, y: y, dir: dir };
  }

  /* ---------- обмеження рівня ----------
   Повертає {ok, problems: [{kind: allowed|limit|max|depth|repn, cmd?, count?, limit?, max?, min?, paths}], total, counts}. */
  function validate(level, program) {
    var problems = [];
    var allowed = level.allowed || ["F", "L", "R", "C", "rep"], limits = level.limits || {};
    var counts = { F: 0, L: 0, R: 0, C: 0, rep: 0 }, over = { F: [], L: [], R: [], C: [], rep: [] };
    var total = 0, overMax = [], deep = [], badRep = [], notAllowed = {};
    walk(program, function (node, path, depth) {
      var type = isRep(node) ? "rep" : node;
      total++;
      if (level.maxBlocks != null && total > level.maxBlocks) overMax.push(path);
      if (!counts.hasOwnProperty(type)) return;
      counts[type]++;
      if (allowed.indexOf(type) < 0) { (notAllowed[type] = notAllowed[type] || []).push(path); }
      if (limits[type] != null && counts[type] > limits[type]) over[type].push(path);
      if (type === "rep") {
        if (depth > MAX_DEPTH) deep.push(path);
        if (!(node.rep >= MIN_REP && node.rep <= MAX_REP)) badRep.push(path);
      }
    });
    /* Проблеми повертаються кодами (без тексту): інтерфейс сам формує повідомлення зі словника */
    Object.keys(notAllowed).forEach(function (t) {
      problems.push({ kind: "allowed", cmd: t, paths: notAllowed[t] });
    });
    ["F", "L", "R", "C", "rep"].forEach(function (t) {
      if (!over[t].length) return;
      problems.push({ kind: "limit", cmd: t, count: counts[t], limit: limits[t], paths: over[t] });
    });
    if (overMax.length) problems.push({ kind: "max", count: total, max: level.maxBlocks, paths: overMax });
    if (deep.length) problems.push({ kind: "depth", max: MAX_DEPTH, paths: deep });
    if (badRep.length) problems.push({ kind: "repn", min: MIN_REP, max: MAX_REP, paths: badRep });
    return { ok: problems.length === 0, problems: problems, total: total, counts: counts };
  }

  function starsFor(level, blocks) {
    return blocks <= level.par ? 3 : blocks <= level.par + 2 ? 2 : 1;
  }

  /* ---------- мінімум ходів без повторів (BFS) ----------
     Ходи: F, L, R, C. Повертає {value, exact}: для великих карт (забагато станів) — нижня межа 2·кристалів. */
  function minMovesNoRepeat(level) {
    var m = parseMap(level), k = m.crystals.length, full = (1 << k) - 1;
    var states = m.w * m.h * 4 * Math.pow(2, k);
    if (k === 0) return { value: 0, exact: true };
    if (k > 16 || states > 3.2e7) return { value: 2 * k, exact: false };
    var dIdx = { E: 0, N: 1, W: 2, S: 3 };
    var seen = new Uint8Array(states);
    function key(x, y, d, mask) { return (((mask * m.h + y) * m.w + x) * 4) + d; }
    var q = [[m.start.x, m.start.y, dIdx[m.dir], 0, 0]], qi = 0;
    seen[key(m.start.x, m.start.y, dIdx[m.dir], 0)] = 1;
    while (qi < q.length) {
      var cur = q[qi++], cx = cur[0], cy = cur[1], cd = cur[2], mask = cur[3], dist = cur[4] + 1;
      var nxt = [];
      var v = VEC[DIR_LIST[cd]], nx = cx + v[0], ny = cy + v[1];
      if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && !m.rocks[nx + "," + ny]) nxt.push([nx, ny, cd, mask]);
      nxt.push([cx, cy, (cd + 1) % 4, mask]);
      nxt.push([cx, cy, (cd + 3) % 4, mask]);
      var ci = m.crystalAt[cx + "," + cy];
      if (ci !== undefined && !(mask & (1 << ci))) {
        var nm = mask | (1 << ci);
        if (nm === full) return { value: dist, exact: true };
        nxt.push([cx, cy, cd, nm]);
      }
      for (var j = 0; j < nxt.length; j++) {
        var s = nxt[j], kk = key(s[0], s[1], s[2], s[3]);
        if (seen[kk]) continue;
        seen[kk] = 1; q.push([s[0], s[1], s[2], s[3], dist]);
      }
    }
    return { value: -1, exact: true };
  }

  return {
    VEC: VEC, LEFT: LEFT, RIGHT: RIGHT, MAX_DEPTH: MAX_DEPTH, MIN_REP: MIN_REP, MAX_REP: MAX_REP,
    parseMap: parseMap, walk: walk, isRep: isRep, countBlocks: countBlocks, countByType: countByType,
    maxDepth: maxDepth, hasNested: hasNested, ordinalOf: ordinalOf, run: run, validate: validate,
    starsFor: starsFor, minMovesNoRepeat: minMovesNoRepeat
  };
});
