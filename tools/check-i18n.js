#!/usr/bin/env node
/* Перевірка локалізації: node tools/check-i18n.js
   Правила: docs/architecture.md, розділи 3 і 9. */
"use strict";
var fs = require("fs");
var path = require("path");
var ROOT = path.join(__dirname, "..");
var build = require("./build-pages.js");
var errors = [];
function err(msg) { errors.push(msg); }
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function rel(p) { return path.relative(ROOT, p); }

var PLURAL_FORMS = { uk: ["one", "few", "many", "other"], en: ["one", "other"] };
var CYR = /[Ѐ-ӿ]/;

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { err(rel(file) + ": " + e.message); return null; }
}
function walk(dir, ext, acc) {
  if (!fs.existsSync(dir)) return acc;
  fs.readdirSync(dir).forEach(function (n) {
    var p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, ext, acc);
    else if (ext.indexOf(path.extname(n)) >= 0) acc.push(p);
  });
  return acc;
}
function placeholders(v) {
  var set = {}, forms = typeof v === "string" ? [v] : Object.keys(v).map(function (k) { return v[k]; });
  /* {name} і токени кількості з контенту {count.<id>} / {count.<id>|форма|…} (форми різні за мовою, тож порівнюємо лише {count.<id>}) */
  forms.forEach(function (s) {
    (String(s).match(/\{\w+\}/g) || []).forEach(function (m) { set[m] = true; });
    (String(s).match(/\{count\.[a-z0-9-]+(?=[|}])/g) || []).forEach(function (m) { set[m + "}"] = true; });
  });
  return Object.keys(set).sort().join(" ");
}

/* ---------- каталог і словники ---------- */
var cat = readJSON(path.join(ROOT, "catalog.json")) || { activities: [] };
var langs = fs.existsSync(path.join(ROOT, "i18n")) ? fs.readdirSync(path.join(ROOT, "i18n")).filter(function (n) {
  return fs.statSync(path.join(ROOT, "i18n", n)).isDirectory();
}).sort() : [];
if (langs.indexOf("uk") < 0) err("i18n/uk/ відсутня (основна мова)");
var dicts = {};   // dicts[lang][ns]
function dict(lang, ns) {
  dicts[lang] = dicts[lang] || {};
  if (!(ns in dicts[lang])) {
    var f = path.join(ROOT, "i18n", lang, ns + ".json");
    dicts[lang][ns] = fs.existsSync(f) ? readJSON(f) : null;
  }
  return dicts[lang][ns];
}

/* простори імен, які мають бути в кожній мові: common для всіх, <ns> — для мов зі списку locales */
var nsLangs = { common: langs.slice() };
nsLangs[build.NOTFOUND_NS] = langs.slice();   // 404.html: обидві мови в одному файлі
var templated = [];     // активності й сайтові сторінки: { id, ns, dir } — dir відносно кореня, де лежить page.html
cat.activities.forEach(function (a) {
  if (!fs.existsSync(path.join(ROOT, "activities", a.id, "page.html"))) return;
  var ns = a.namespace || a.id;
  templated.push({ id: a.id, ns: ns, dir: "activities/" + a.id });
  nsLangs[ns] = (a.locales || []).slice();
});
(cat.pages || []).forEach(function (p) {
  var ns = p.namespace || p.id;
  templated.push({ id: p.id, ns: ns, dir: "pages/" + p.id });
  nsLangs[ns] = (p.locales || []).slice();
});

function checkDictShape(lang, ns, d) {
  Object.keys(d).forEach(function (k) {
    var v = d[k], where = "i18n/" + lang + "/" + ns + ".json «" + k + "»";
    if (!/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(k)) err(where + ": ключ має бути з латиниці, цифр і крапок");
    var forms = typeof v === "string" ? [v] : null;
    if (typeof v === "object" && v !== null) {
      var need = PLURAL_FORMS[lang];
      if (need) {
        need.forEach(function (f) { if (!has(v, f)) err(where + ": немає форми множини " + f); });
        Object.keys(v).forEach(function (f) { if (need.indexOf(f) < 0) err(where + ": зайва форма множини " + f + " для " + lang); });
      }
      forms = Object.keys(v).map(function (f) { return v[f]; });
      if (!forms.every(function (s) { return typeof s === "string"; })) { err(where + ": форми множини мають бути рядками"); return; }
      var ph = forms.map(function (s) { return placeholders(s); });
      if (ph.some(function (p) { return p.indexOf("{count}") < 0; })) err(where + ": кожна форма множини має містити {count}");
    } else if (typeof v !== "string") { err(where + ": значення має бути рядком або об'єктом множини"); return; }
    forms.forEach(function (s) { if (/<\/?[a-z][^>]*>/i.test(s)) err(where + ": HTML у словнику заборонений"); });
  });
}

Object.keys(nsLangs).forEach(function (ns) {
  var ls = nsLangs[ns];
  ls.forEach(function (lang) {
    if (!dict(lang, ns)) { if (!fs.existsSync(path.join(ROOT, "i18n", lang, ns + ".json"))) err("немає i18n/" + lang + "/" + ns + ".json"); return; }
    checkDictShape(lang, ns, dict(lang, ns));
  });
  var ref = ls.indexOf("uk") >= 0 ? "uk" : ls[0], refD = ref && dict(ref, ns);
  if (!refD) return;
  ls.forEach(function (lang) {
    var d = dict(lang, ns);
    if (lang === ref || !d) return;
    var where = "i18n/" + lang + "/" + ns + ".json";
    Object.keys(refD).forEach(function (k) {
      if (!has(d, k)) { err(where + ": немає ключа «" + k + "» (є в " + ref + ")"); return; }
      if (placeholders(refD[k]) !== placeholders(d[k])) err(where + " «" + k + "»: плейсхолдери [" + placeholders(d[k]) + "] ≠ [" + placeholders(refD[k]) + "] у " + ref);
      if ((typeof refD[k] === "object") !== (typeof d[k] === "object")) err(where + " «" + k + "»: множина в одній мові, а в іншій ні");
    });
    Object.keys(d).forEach(function (k) { if (!has(refD, k)) err(where + ": зайвий ключ «" + k + "» (немає в " + ref + ")"); });
  });
});

/* ---------- ключі в коді й шаблонах ---------- */
function keyExists(fullKey, scope, where) {
  var i = fullKey.indexOf("."), kns = fullKey.slice(0, i), key = fullKey.slice(i + 1);
  var targets = [];
  if (kns === "ns") { // {{ns.x}}: ключ має бути в словнику кожного простору імен зі scope (шаблон оболонки — усі активності/сторінки, page.html — свій)
    (scope || []).forEach(function (n) { targets.push(n); });
  } else targets.push(kns);
  targets.forEach(function (n) {
    if (!nsLangs[n]) { err(where + ": невідомий простір імен «" + n + "» у ключі " + fullKey); return; }
    nsLangs[n].forEach(function (lang) {
      var d = dict(lang, n);
      if (d && !has(d, key)) err(where + ": ключа " + fullKey + " немає в i18n/" + lang + "/" + n + ".json");
    });
  });
}

/* Лексер: повертає рядкові літерали JS без коментарів і регулярних виразів */
function stringLiterals(src) {
  var out = [], i = 0, n = src.length, prev = "";
  while (i < n) {
    var c = src[i], c2 = src[i + 1];
    if (c === "/" && c2 === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && c2 === "*") { i = src.indexOf("*/", i + 2); i = i < 0 ? n : i + 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      var q = c, start = ++i, line = src.slice(0, i).split("\n").length;
      while (i < n && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      out.push({ s: src.slice(start, i), line: line });
      i++; prev = '"'; continue;
    }
    if (c === "/") {
      if (prev === "" || "(,=:[!&|?{};+-*%<>~^".indexOf(prev) >= 0 || /return|typeof$/.test(src.slice(Math.max(0, i - 8), i).replace(/\s+$/, ""))) {
        i++; var inClass = false;
        while (i < n && (src[i] !== "/" || inClass)) {
          if (src[i] === "\\") i++; else if (src[i] === "[") inClass = true; else if (src[i] === "]") inClass = false;
          i++;
        }
        i++; prev = "/"; continue;
      }
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

/* Код без кириличних рядків: активності, сайтові сторінки й спільні скрипти, що показують текст (catalog-filter, site) */
var jsFiles = walk(path.join(ROOT, "activities"), [".js"], []).concat(walk(path.join(ROOT, "pages"), [".js"], []));
["catalog-filter.js", "site.js"].forEach(function (n) { jsFiles.push(path.join(ROOT, "assets", "js", n)); });
jsFiles.forEach(function (file) {
  var src = fs.readFileSync(file, "utf8"), r = rel(file);
  stringLiterals(src).forEach(function (lit) {
    if (CYR.test(lit.s)) err(r + ":" + lit.line + ": кириличний рядок у коді: «" + lit.s.slice(0, 40) + "» (винеси в i18n)");
    /* будь-який літерал виду robot.run чи common.home вважаємо ключем словника */
    var m = /^([a-z][a-z0-9-]*)\.([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)$/.exec(lit.s);
    if (m && nsLangs[m[1]]) keyExists(lit.s, null, r + ":" + lit.line);
  });
  /* t("…") з невідомим простором імен */
  var re = /\bt\(\s*["']([^"']+)["']/g, mm;
  while ((mm = re.exec(src))) {
    var kns = mm[1].split(".")[0];
    if (mm[1].indexOf(".") < 0 || !nsLangs[kns]) err(r + ": t(\"" + mm[1] + "\") — невідомий простір імен");
  }
});

var PAGE_VARS = build.PAGE_VARS;
var tplFiles = walk(path.join(ROOT, "templates"), [".html"], []);
walk(path.join(ROOT, "activities"), [".html"], []).concat(walk(path.join(ROOT, "pages"), [".html"], [])).forEach(function (f) { tplFiles.push(f); });
tplFiles.forEach(function (file) {
  var src = fs.readFileSync(file, "utf8"), r = rel(file);
  var top = rel(file).split(path.sep);
  var scope = [];
  if (top[0] === "templates") {
    scope = top[1] === "activity.html" ? templated.filter(function (t) { return /^activities\//.test(t.dir); }).map(function (t) { return t.ns; })
      : top[1] === "page.html" ? templated.filter(function (t) { return /^pages\//.test(t.dir); }).map(function (t) { return t.ns; })
      : [build.NOTFOUND_NS];
  } else scope = templated.filter(function (t) { return t.dir === top[0] + "/" + top[1]; }).map(function (t) { return t.ns; });
  var actDir = top[0] === "activities" || top[0] === "pages" ? top[1] : null;
  var re = /\{\{\{?\s*([#/]?(?:(?:rich|en):)?[\w.-]+(?:\s+\w+)?)\s*\}?\}\}/g, m;
  while ((m = re.exec(src))) {
    var tok = m[1], line = src.slice(0, m.index).split("\n").length, where = r + ":" + line;
    if (/^#if\s+(\w+)$/.test(tok)) { if (PAGE_VARS.indexOf(tok.split(/\s+/)[1]) < 0) err(where + ": невідома змінна в {{" + tok + "}}"); continue; }
    if (tok === "/if") continue;
    if (/^en:/.test(tok)) { tok = tok.slice(3); if (tok.indexOf(".") < 0) { err(where + ": {{en:…}} очікує ключ ns.key"); continue; } keyExists(tok, scope, where); continue; }
    if (/^rich:/.test(tok)) tok = tok.slice(5);
    if (tok.indexOf(".") < 0) { if (PAGE_VARS.indexOf(tok) < 0) err(where + ": невідома змінна {{" + tok + "}}"); continue; }
    var kns = tok.split(".")[0];
    if (actDir && kns !== "common" && kns !== "ns") {
      var a = templated.filter(function (t) { return t.dir === top[0] + "/" + actDir; })[0];
      if (a && kns !== a.ns) { err(where + ": у шаблоні «" + actDir + "» дозволені лише common.* та " + a.ns + ".*, а є " + tok); continue; }
    }
    keyExists(tok, scope, where);
  }
});

if (errors.length) { console.error(errors.join("\n")); console.error("\nПомилок: " + errors.length); process.exit(1); }
var total = Object.keys(nsLangs).reduce(function (s, ns) { return s + (dict(nsLangs[ns][0], ns) ? Object.keys(dict(nsLangs[ns][0], ns)).length : 0); }, 0);
console.log("OK: " + Object.keys(nsLangs).length + " просторів імен, " + total + " ключів, мови: " + langs.join(", "));
