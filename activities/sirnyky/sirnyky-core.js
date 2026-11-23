/* Задачі з сірниками: модель сірників без DOM (UMD, ES5).
   Кожен символ виразу це клітинка. Цифра має 7 позицій a–g, знак має 4 позиції u, m, l, v.
   Хід: узяти один наявний сірник з будь-якої клітинки й покласти у вільну позицію будь-якої клітинки
   (можна в ту саму клітинку, але не на те саме місце). Після ходу кожна клітинка має бути коректним символом свого виду. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SirnykyCore = factory();
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var DIGIT_POS = "abcdefg";   // a верх, b верх-право, c низ-право, d низ, e низ-ліво, f верх-ліво, g середина
  var SIGN_POS = "ulmv";       // u верхня горизонталь, l нижня, m середня, v вертикаль
  var DIGITS = { "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg" };
  var SIGNS = { "+": "mv", "-": "m", "=": "ul" };

  function canon(segs, positions) {
    var out = "";
    for (var i = 0; i < positions.length; i++) if (segs.indexOf(positions[i]) >= 0) out += positions[i];
    return out;
  }
  var DIGIT_REV = {}, SIGN_REV = {};
  Object.keys(DIGITS).forEach(function (k) { DIGIT_REV[canon(DIGITS[k], DIGIT_POS)] = k; });
  Object.keys(SIGNS).forEach(function (k) { SIGN_REV[canon(SIGNS[k], SIGN_POS)] = k; });

  function kindOf(ch) {
    if (Object.prototype.hasOwnProperty.call(DIGITS, ch)) return "d";
    if (Object.prototype.hasOwnProperty.call(SIGNS, ch)) return "s";
    return null;
  }
  function positionsOf(kind) { return kind === "d" ? DIGIT_POS : SIGN_POS; }
  /* Сегменти символа у канонічному порядку позицій */
  function segsOf(ch) {
    var k = kindOf(ch);
    if (!k) throw new Error("unknown symbol: " + ch);
    return canon(k === "d" ? DIGITS[ch] : SIGNS[ch], positionsOf(k));
  }
  /* Символ клітинки за її сегментами або null */
  function decodeCell(cell) {
    var m = cell.k === "d" ? DIGIT_REV : SIGN_REV;
    return Object.prototype.hasOwnProperty.call(m, cell.s) ? m[cell.s] : null;
  }

  function toState(expr) {
    var st = [];
    for (var i = 0; i < expr.length; i++) st.push({ k: kindOf(expr.charAt(i)), s: segsOf(expr.charAt(i)) });
    return st;
  }
  function fromState(state) {
    var out = "";
    for (var i = 0; i < state.length; i++) {
      var ch = decodeCell(state[i]);
      if (ch === null) return null;
      out += ch;
    }
    return out;
  }
  function cloneState(state) { return state.map(function (c) { return { k: c.k, s: c.s }; }); }

  function hasSeg(state, cell, seg) { return state[cell].s.indexOf(seg) >= 0; }

  /* true, якщо хід from → to можливий: з наявного місця на вільне, не на те саме */
  function canMove(state, from, to) {
    if (!state[from.cell] || !state[to.cell]) return false;
    if (positionsOf(state[from.cell].k).indexOf(from.seg) < 0 || positionsOf(state[to.cell].k).indexOf(to.seg) < 0) return false;
    if (from.cell === to.cell && from.seg === to.seg) return false;
    if (!hasSeg(state, from.cell, from.seg)) return false;
    if (hasSeg(state, to.cell, to.seg)) return false;
    return true;
  }
  /* Новий стан після ходу (старий не змінюється) або null, якщо хід неможливий */
  function applyMove(state, from, to) {
    if (!canMove(state, from, to)) return null;
    var next = cloneState(state);
    var f = next[from.cell], t = next[to.cell];
    f.s = canon(f.s.replace(from.seg, ""), positionsOf(f.k));
    t.s = canon(t.s + to.seg, positionsOf(t.k));
    return next;
  }

  /* Усі можливі ходи: {from:{cell,seg}, to:{cell,seg}, result}; result = null, якщо вийшла недійсна фігура */
  function allMoves(expr) {
    var st = toState(expr), out = [];
    for (var i = 0; i < st.length; i++) {
      for (var a = 0; a < st[i].s.length; a++) {
        var from = { cell: i, seg: st[i].s.charAt(a) };
        for (var j = 0; j < st.length; j++) {
          var pos = positionsOf(st[j].k);
          for (var b = 0; b < pos.length; b++) {
            var to = { cell: j, seg: pos.charAt(b) };
            var next = applyMove(st, from, to);
            if (next) out.push({ from: from, to: to, result: fromState(next) });
          }
        }
      }
    }
    return out;
  }

  function numbersOk(e) {
    var parts = e.split(/[+\-=]/);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "" || (parts[i].length > 1 && parts[i].charAt(0) === "0")) return false;
    }
    return true;
  }
  /* Значення однієї частини рівності (зліва направо) або null */
  function evalSide(side) {
    var toks = side.match(/\d+|[+\-]/g);
    if (!toks || !/^\d+$/.test(toks[0])) return null;
    var v = parseInt(toks[0], 10);
    for (var i = 1; i < toks.length; i += 2) {
      if (i + 1 >= toks.length || !/^\d+$/.test(toks[i + 1])) return null;
      var n = parseInt(toks[i + 1], 10);
      v = toks[i] === "+" ? v + n : v - n;
    }
    return v;
  }
  function isTrueEquation(e) {
    if (e.split("=").length !== 2 || !numbersOk(e)) return false;
    var parts = e.split("="), l = evalSide(parts[0]), r = evalSide(parts[1]);
    return l !== null && r !== null && l === r;
  }
  /* Для "fix": рядок є правильною рівністю. Для "max"/"min": лише цифри без ведучого нуля
     (чи найбільше/найменше число, вирішує solve). */
  function isCorrect(result, goal) {
    if (typeof result !== "string") return false;
    if (goal === "fix") return isTrueEquation(result);
    return /^\d+$/.test(result) && numbersOk(result);
  }

  /* Усі правильні результати одного ходу, відсортовані як рядки */
  function solve(expr, goal) {
    var seen = {}, list = [];
    allMoves(expr).forEach(function (m) {
      if (m.result !== null && m.result !== expr && !seen[m.result]) { seen[m.result] = 1; list.push(m.result); }
    });
    if (goal === "fix") return list.filter(isTrueEquation).sort();
    list = list.filter(function (r) { return isCorrect(r, goal); });
    if (!list.length) return [];
    var best = null;
    list.forEach(function (r) {
      var v = parseInt(r, 10);
      if (best === null || (goal === "max" ? v > best : v < best)) best = v;
    });
    return list.filter(function (r) { return parseInt(r, 10) === best; }).sort();
  }

  /* Один хід, що дає цю відповідь (для підказки), або null */
  function moveFor(expr, answer) {
    var ms = allMoves(expr);
    for (var i = 0; i < ms.length; i++) if (ms[i].result === answer) return ms[i];
    return null;
  }

  /* Оцінка результату ходу: {ok, code}. code: ok | figure | equation | zero | notmax | notmin */
  function verdict(result, goal, answers) {
    if (result === null || result === undefined) return { ok: false, code: "figure" };
    if (answers.indexOf(result) >= 0) return { ok: true, code: "ok" };
    if (goal === "fix") return { ok: false, code: "equation" };
    if (!isCorrect(result, goal)) return { ok: false, code: "zero" };
    return { ok: false, code: goal === "max" ? "notmax" : "notmin" };
  }

  return {
    DIGIT_POS: DIGIT_POS, SIGN_POS: SIGN_POS,
    kindOf: kindOf, positionsOf: positionsOf, segsOf: segsOf, decodeCell: decodeCell,
    toState: toState, fromState: fromState, cloneState: cloneState, hasSeg: hasSeg,
    canMove: canMove, applyMove: applyMove, allMoves: allMoves,
    isTrueEquation: isTrueEquation, isCorrect: isCorrect, solve: solve, moveFor: moveFor, verdict: verdict
  };
});
