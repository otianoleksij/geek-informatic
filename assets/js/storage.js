/* Geek Informatic — спільна обгортка над localStorage (ES5, без залежностей).
   Усі ключі мають префікс "gi:". Будь-яка помилка доступу (приватний режим,
   заблоковані куки, відсутній localStorage) мовчки ігнорується. */
(function (root) {
  "use strict";
  var PREFIX = "gi:";
  var PROGRESS_KEY = "gi:progress";
  var LEGACY = ["kiberquest-v3", "geek-galaxy-v2", "geek-robot-v1", "geek-mars-v1", "geek-rebus-solved-v1"];

  function ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function get(k) { try { var s = ls(); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { try { var s = ls(); if (!s) return false; s.setItem(k, v); return true; } catch (e) { return false; } }
  function del(k) { try { var s = ls(); if (!s) return false; s.removeItem(k); return true; } catch (e) { return false; } }
  function parse(raw) {
    if (raw === null || raw === undefined) return null;
    try { var v = JSON.parse(raw); return v === undefined ? null : v; } catch (e) { return null; }
  }

  function load(id, legacyKey) {
    var raw = get(PREFIX + id);
    if (raw !== null) return parse(raw);
    if (legacyKey) {
      var old = get(legacyKey);
      if (old !== null) {
        var val = parse(old);
        if (val !== null) {
          if (set(PREFIX + id, JSON.stringify(val))) del(legacyKey);
        }
        return val;
      }
    }
    return null;
  }

  function save(id, data) {
    try { return set(PREFIX + id, JSON.stringify(data)); } catch (e) { return false; }
  }

  function remove(id) { del(PREFIX + id); }

  function getSummary() {
    var o = parse(get(PROGRESS_KEY));
    return o && typeof o === "object" && !(o instanceof Array) ? o : {};
  }

  function int(n) { n = Math.floor(+n); return isFinite(n) ? n : 0; }

  function setSummary(activityId, done, total) {
    total = Math.max(0, int(total));
    done = Math.max(0, Math.min(total, int(done)));
    var o = getSummary();
    o[activityId] = { done: done, total: total };
    return set(PROGRESS_KEY, JSON.stringify(o));
  }

  function clearAll() {
    var keys = [], n = 0, i;
    try {
      var s = ls();
      if (s) for (i = 0; i < s.length; i++) { var k = s.key(i); if (k && k.indexOf(PREFIX) === 0) keys.push(k); }
    } catch (e) {}
    for (i = 0; i < LEGACY.length; i++) { if (keys.indexOf(LEGACY[i]) < 0) keys.push(LEGACY[i]); }
    for (i = 0; i < keys.length; i++) {
      var existed = get(keys[i]) !== null;
      if (del(keys[i]) && existed) n++;
    }
    return n;
  }

  root.GIStorage = { load: load, save: save, remove: remove, setSummary: setSummary, getSummary: getSummary, clearAll: clearAll };
})(typeof window !== "undefined" ? window : this);
