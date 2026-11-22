#!/usr/bin/env node
/* Перевірка реєстру активностей: node tools/check-catalog.js [корінь-сайту] */
"use strict";
var fs = require("fs");
var path = require("path");
var root = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, "..");
var BASE = "https://otianoleksij.github.io/geek-informatic/";
var errors = [];
function err(id, msg) { errors.push(id + ": " + msg); }
function read(rel) { try { return fs.readFileSync(path.join(root, rel), "utf8"); } catch (e) { return null; } }
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

var cat;
try { cat = JSON.parse(read("catalog.json")); } catch (e) { console.error("catalog.json: " + e.message); process.exit(1); }
var tax = cat.taxonomy || {};
var acts = cat.activities || [];
var sitemap = read("sitemap.xml") || "";
var home = read("index.html") || "";
if (!read("sitemap.xml")) err("sitemap.xml", "немає файлу");
if (!home) err("index.html", "немає файлу");
if (cat.format !== 1) err("catalog", "format має бути 1");

/* картки головної: data-id -> атрибути */
function attrs(tag) {
  var o = {}, re = /([a-z-]+)="([^"]*)"/g, m;
  while ((m = re.exec(tag))) o[m[1]] = m[2];
  return o;
}
var cards = {}, cardRe = /<article\b[^>]*\bdata-id="[^"]*"[^>]*>[\s\S]*?<\/article>/g, cm;
var cardList = [];
while ((cm = cardRe.exec(home))) {
  var tag = cm[0].slice(0, cm[0].indexOf(">") + 1);
  var a = attrs(tag);
  var link = /<a\b[^>]*class="[^"]*book-link[^"]*"[^>]*>/.exec(cm[0]);
  var linkAttrs = link ? attrs(link[0]) : null;
  cardList.push({ id: a["data-id"], a: a, href: linkAttrs ? linkAttrs.href : null });
}

var ids = {};
acts.forEach(function (x, i) {
  var id = x.id || ("#" + i);
  if (!x.id || !/^[a-z0-9-]+$/.test(x.id)) err(id, "некоректний id");
  if (ids[x.id]) err(id, "id не унікальний");
  ids[x.id] = true;
  if (!has(tax.types || {}, x.type)) err(id, "невідомий type «" + x.type + "»");
  (Array.isArray(x.topics) && x.topics.length ? x.topics : (err(id, "topics має бути непорожнім масивом"), [])).forEach(function (t) {
    if (!has(tax.topics || {}, t)) err(id, "невідома тема «" + t + "»");
  });
  if (!has(tax.difficulty || {}, String(x.difficulty))) err(id, "невідома складність «" + x.difficulty + "»");
  var g = x.grades;
  if (!Array.isArray(g) || !g.length) err(id, "grades має бути непорожнім масивом");
  else {
    g.forEach(function (n, k) {
      if (n !== Math.floor(n) || typeof n !== "number" || n < 1 || n > 11) err(id, "клас " + n + " поза 1..11");
      if (k && g[k - 1] >= n) err(id, "grades мають бути відсортовані й унікальні");
    });
  }
  if (typeof x.duration !== "number" || x.duration <= 0) err(id, "duration має бути додатним числом");
  if (!x.title || !x.title.uk) err(id, "немає title.uk");
  if (!x.description || !x.description.uk) err(id, "немає description.uk");
  if (!Array.isArray(x.locales) || !x.locales.length) err(id, "немає locales");
  if (typeof x.path !== "string" || !/\/$/.test(x.path)) { err(id, "path має закінчуватись на «/»"); return; }

  var page = read(x.path + "index.html");
  var canon = BASE + x.path;
  if (page === null) err(id, "немає " + x.path + "index.html");
  else {
    if (!/<title>[^<]+<\/title>/.test(page)) err(id, "сторінка без <title>");
    if (!/<meta\s+name="description"\s+content="[^"]+"/.test(page)) err(id, "сторінка без meta description");
    var cn = /<link\s+rel="canonical"\s+href="([^"]*)"/.exec(page);
    if (!cn) err(id, "сторінка без canonical");
    else if (cn[1] !== canon) err(id, "canonical " + cn[1] + " ≠ " + canon);
    var depth = x.path.split("/").filter(Boolean).length, up = "";
    for (var d = 0; d < depth; d++) up += "../";
    var back = false, hre = /<a\b[^>]*\bhref="([^"]*)"/g, hm;
    while ((hm = hre.exec(page))) { if (hm[1] === up || hm[1] === BASE) back = true; }
    if (!back) err(id, "немає посилання на головну (href=\"" + up + "\")");
  }
  if (!x.og || !fs.existsSync(path.join(root, x.og))) err(id, "немає og-файлу " + x.og);
  if (sitemap.indexOf("<loc>" + canon + "</loc>") < 0) err(id, "sitemap.xml не містить " + canon);

  var mine = cardList.filter(function (c) { return c.id === x.id; });
  if (mine.length !== 1) err(id, "на головній має бути рівно 1 картка data-id, а є " + mine.length);
  else {
    var c = mine[0], ca = c.a;
    if (ca["data-type"] !== x.type) err(id, "data-type=" + ca["data-type"] + ", у каталозі " + x.type);
    if (ca["data-grades"] !== (x.grades || []).join(" ")) err(id, "data-grades=\"" + ca["data-grades"] + "\", у каталозі \"" + (x.grades || []).join(" ") + "\"");
    if (ca["data-topics"] !== (x.topics || []).join(" ")) err(id, "data-topics=\"" + ca["data-topics"] + "\", у каталозі \"" + (x.topics || []).join(" ") + "\"");
    if (ca["data-difficulty"] !== String(x.difficulty)) err(id, "data-difficulty=" + ca["data-difficulty"] + ", у каталозі " + x.difficulty);
    if (c.href !== x.path) err(id, "href картки «" + c.href + "» ≠ path «" + x.path + "»");
  }
});
cardList.forEach(function (c) { if (!ids[c.id]) err(c.id, "картка на головній відсутня в catalog.json"); });

/* кожна адреса з sitemap.xml має вести на наявний index.html */
var locRe = /<loc>([^<]+)<\/loc>/g, lm;
while ((lm = locRe.exec(sitemap))) {
  var u = lm[1];
  if (u.indexOf(BASE) !== 0) { err("sitemap.xml", "адреса поза " + BASE + ": " + u); continue; }
  if (!/\/$/.test(u)) { err("sitemap.xml", "адреса без кінцевого «/»: " + u); continue; }
  if (read(u.slice(BASE.length) + "index.html") === null) err("sitemap.xml", "немає " + u.slice(BASE.length) + "index.html для " + u);
}

if (errors.length) { console.error(errors.join("\n")); console.error("\nПомилок: " + errors.length); process.exit(1); }
console.log("OK: " + acts.length + " активностей");
