/* Ядро гри «Я керую роботом!»: без DOM, працює в браузері (window.RobotCore) і в Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RobotCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var VEC = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

  /* Розбір карти: S старт, G кристал, # камінь, . порожньо */
  function parseMap(level) {
    var rows = level.map, h = rows.length, w = h ? rows[0].length : 0;
    var stones = {}, gems = [], start = null;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        var c = rows[y].charAt(x);
        if (c === "#") stones[x + "," + y] = true;
        else if (c === "G") gems.push({ x: x, y: y });
        else if (c === "S") start = { x: x, y: y };
      }
    }
    return { w: w, h: h, stones: stones, gems: gems, start: start };
  }

  /* Розгортає програму (з повторами) у плаский список ходів. */
  function expand(program) {
    var out = [];
    (program || []).forEach(function (it, i) {
      if (typeof it === "string") {
        out.push({ dir: it, i: i, j: -1, iter: 0, reps: 1 });
      } else if (it && it.body) {
        for (var k = 1; k <= it.rep; k++) {
          it.body.forEach(function (d, j) { out.push({ dir: d, i: i, j: j, iter: k, reps: it.rep }); });
        }
      }
    });
    return out;
  }

  /* Блоки: стрілка = 1, повтор = 1 + вміст. */
  function countBlocks(program) {
    var n = 0;
    (program || []).forEach(function (it) {
      n += typeof it === "string" ? 1 : 1 + (it.body ? it.body.length : 0);
    });
    return n;
  }

  /* Симуляція. Події: move | crash | edge | gem | win | end. */
  function run(level, program) {
    var m = parseMap(level), steps = expand(program);
    var x = m.start.x, y = m.start.y, left = m.gems.length;
    var got = {}, events = [], collected = 0, win = false, crashedAt = null, moves = 0;
    for (var s = 0; s < steps.length; s++) {
      var st = steps[s], v = VEC[st.dir], nx = x + v[0], ny = y + v[1], n = s + 1;
      var meta = { step: n, dir: st.dir, i: st.i, j: st.j, iter: st.iter, reps: st.reps };
      var ev;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) {
        ev = { type: "edge", x: x, y: y, tx: nx, ty: ny }; copy(ev, meta); events.push(ev);
        crashedAt = n; break;
      }
      if (m.stones[nx + "," + ny]) {
        ev = { type: "crash", x: x, y: y, tx: nx, ty: ny }; copy(ev, meta); events.push(ev);
        crashedAt = n; break;
      }
      x = nx; y = ny; moves = n;
      ev = { type: "move", x: x, y: y }; copy(ev, meta); events.push(ev);
      for (var g = 0; g < m.gems.length; g++) {
        if (m.gems[g].x === x && m.gems[g].y === y && !got[g]) {
          got[g] = true; collected++; left--;
          ev = { type: "gem", x: x, y: y, gem: g, left: left }; copy(ev, meta); events.push(ev);
        }
      }
      if (left === 0) {
        win = true;
        ev = { type: "win", x: x, y: y }; copy(ev, meta); events.push(ev);
        break;
      }
    }
    if (!win && crashedAt === null) events.push({ type: "end", x: x, y: y, step: steps.length + 1 });
    return { events: events, win: win, crashedAt: crashedAt, gemsCollected: collected, moves: moves, total: m.gems.length };
  }
  function copy(to, from) { for (var k in from) to[k] = from[k]; }

  /* BFS по (позиція, маска кристалів): мінімум ходів, щоб зібрати ВСІ кристали; -1 якщо недосяжно. */
  function shortestPath(level) {
    var m = parseMap(level), full = (1 << m.gems.length) - 1;
    function gemAt(x, y) { for (var g = 0; g < m.gems.length; g++) if (m.gems[g].x === x && m.gems[g].y === y) return g; return -1; }
    var key = function (x, y, k) { return (k * m.h + y) * m.w + x; };
    var seen = {}, q = [[m.start.x, m.start.y, 0, 0]], qi = 0;
    seen[key(m.start.x, m.start.y, 0)] = true;
    if (full === 0) return 0;
    while (qi < q.length) {
      var cur = q[qi++];
      for (var d in VEC) {
        var nx = cur[0] + VEC[d][0], ny = cur[1] + VEC[d][1];
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || m.stones[nx + "," + ny]) continue;
        var mask = cur[2], gi = gemAt(nx, ny);
        if (gi >= 0) mask |= 1 << gi;
        if (mask === full) return cur[3] + 1;
        var kk = key(nx, ny, mask);
        if (seen[kk]) continue;
        seen[kk] = true; q.push([nx, ny, mask, cur[3] + 1]);
      }
    }
    return -1;
  }

  return { VEC: VEC, parseMap: parseMap, expand: expand, countBlocks: countBlocks, run: run, shortestPath: shortestPath };
});
