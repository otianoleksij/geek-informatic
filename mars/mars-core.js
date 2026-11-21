/* «Марсохід у лабіринті»: логіка без DOM (генератор лабіринтів, інтерпретатор програми).
   Працює і в браузері (window.MarsCore), і в Node (tools/check-mars.js). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MarsCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Напрямки: 0=N, 1=E, 2=S, 3=W. Біти стін клітинки: N=1, E=2, S=4, W=8. */
  var DIRS = ["N", "E", "S", "W"];
  var BIT = [1, 2, 4, 8];
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var CONDS = ["notFinish", "wallAhead", "clearAhead"];

  function makeRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {            /* mulberry32 */
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Ідеальний лабіринт (recursive backtracker): без петель, усі клітинки досяжні. */
  function generate(seed, w, h) {
    w = w || 10; h = h || 10;
    var rng = makeRng(seed), walls = new Array(w * h), seen = new Array(w * h), i;
    for (i = 0; i < w * h; i++) { walls[i] = 15; seen[i] = false; }
    var stack = [0]; seen[0] = true;
    while (stack.length) {
      var cur = stack[stack.length - 1], cx = cur % w, cy = (cur - cx) / w, opts = [];
      for (var d = 0; d < 4; d++) {
        var nx = cx + DX[d], ny = cy + DY[d];
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx]) opts.push(d);
      }
      if (!opts.length) { stack.pop(); continue; }
      var dd = opts[Math.floor(rng() * opts.length)], nxt = (cy + DY[dd]) * w + (cx + DX[dd]);
      walls[cur] &= ~BIT[dd];
      walls[nxt] &= ~BIT[(dd + 2) % 4];
      seen[nxt] = true;
      stack.push(nxt);
    }
    return { w: w, h: h, seed: seed, walls: walls,
      start: { x: 0, y: 0, dir: 1 }, finish: { x: w - 1, y: h - 1 } };
  }

  function hasWall(maze, x, y, dir) { return (maze.walls[y * maze.w + x] & BIT[dir]) !== 0; }

  function conditionValue(maze, st, cond) {
    var wall = hasWall(maze, st.x, st.y, st.dir);
    if (cond === "notFinish") return !(st.x === maze.finish.x && st.y === maze.finish.y);
    if (cond === "wallAhead") return wall;
    if (cond === "clearAhead") return !wall;
    return false;
  }

  /* Ітератор подій. Типи: check, turn, move, bump, finish, limit, end.
     Кожна подія має path — рядок-адреса блока ("0", "1.b.0", "2.t.1", "2.e.0"). */
  function createRun(maze, program, opts) {
    opts = opts || {};
    var maxSteps = opts.maxSteps || 1500;
    var st = { x: maze.start.x, y: maze.start.y, dir: maze.start.dir,
      moves: 0, turns: 0, checks: 0, status: "running" };
    function steps() { return st.moves + st.turns; }
    /* У програмі немає лічильників (лише «поки» та «якщо»), тож стан повністю задано
       блоком, клітинкою й напрямком. Повтор такого стану = вічний цикл: зупиняємо одразу. */
    var seen = Object.create(null);
    function over(path) {
      if (steps() >= maxSteps || steps() + st.checks >= maxSteps * 8) return true;
      var key = path + "|" + st.x + "|" + st.y + "|" + st.dir;
      if (seen[key]) { st.loop = true; return true; }
      seen[key] = 1; return false;
    }

    function* list(items, prefix) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i], path = prefix + i;
        if (it === "F") {
          if (over(path)) { st.status = "limit"; yield { type: "limit", path: path, loop: !!st.loop }; return true; }
          if (hasWall(maze, st.x, st.y, st.dir)) {
            st.status = "bump"; yield { type: "bump", path: path, at: { x: st.x, y: st.y }, dir: st.dir }; return true;
          }
          var from = { x: st.x, y: st.y };
          st.x += DX[st.dir]; st.y += DY[st.dir]; st.moves++;
          yield { type: "move", path: path, from: from, to: { x: st.x, y: st.y }, dir: st.dir };
          if (st.x === maze.finish.x && st.y === maze.finish.y) {
            st.status = "finish"; yield { type: "finish", path: path }; return true;
          }
        } else if (it === "L" || it === "R") {
          if (over(path)) { st.status = "limit"; yield { type: "limit", path: path, loop: !!st.loop }; return true; }
          st.dir = (st.dir + (it === "L" ? 3 : 1)) % 4; st.turns++;
          yield { type: "turn", path: path, side: it, dir: st.dir };
        } else if (it && typeof it === "object" && it.while) {
          while (true) {
            if (over(path)) { st.status = "limit"; yield { type: "limit", path: path, loop: !!st.loop }; return true; }
            var v = conditionValue(maze, st, it.while); st.checks++;
            yield { type: "check", path: path, cond: it.while, result: v };
            if (!v) break;
            if (yield* list(it.body || [], path + ".b.")) return true;
          }
        } else if (it && typeof it === "object" && it.if) {
          if (over(path)) { st.status = "limit"; yield { type: "limit", path: path, loop: !!st.loop }; return true; }
          var r = conditionValue(maze, st, it.if); st.checks++;
          yield { type: "check", path: path, cond: it.if, result: r };
          if (yield* list(r ? (it.then || []) : (it.else || []), path + (r ? ".t." : ".e."))) return true;
        }
      }
      return false;
    }

    function* main() {
      var stopped = yield* list(program || [], "");
      if (!stopped) { st.status = "end"; yield { type: "end" }; }
    }
    var g = main();
    g.state = st;
    return g;
  }

  /* Миттєвий прогін: повертає статус і лічильники. */
  function runAll(maze, program, opts) {
    var g = createRun(maze, program, opts), r;
    do { r = g.next(); } while (!r.done);
    var s = g.state;
    return { status: s.status, steps: s.moves + s.turns, moves: s.moves, turns: s.turns, checks: s.checks, x: s.x, y: s.y, dir: s.dir };
  }

  return { DIRS: DIRS, BIT: BIT, DX: DX, DY: DY, CONDS: CONDS,
    makeRng: makeRng, generate: generate, hasWall: hasWall, conditionValue: conditionValue,
    createRun: createRun, runAll: runAll };
});
