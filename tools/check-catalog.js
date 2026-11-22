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
var pages = cat.pages || [];
var sitemap = read("sitemap.xml") || "";
var pfx = function (l) { return l === "uk" ? "" : l + "/"; };
if (!read("sitemap.xml")) err("sitemap.xml", "немає файлу");
if (cat.format !== 1) err("catalog", "format має бути 1");
if (!/^\d{4}-\d{2}-\d{2}$/.test(cat.lastmod || "")) err("catalog", "немає lastmod (РРРР-ММ-ДД)");
/* помилки самої збірки (відсутні ключі словника, іконки, card.svg …) */
require("./build-pages.js").buildAll().errors.forEach(function (m) { err("build-pages", m); });
var homePage = pages.filter(function (p) { return p.id === "home"; })[0];
if (!homePage) err("catalog", "у pages немає home");

/* картки головної: data-id -> атрибути */
function attrs(tag) {
  var o = {}, re = /([a-z-]+)="([^"]*)"/g, m;
  while ((m = re.exec(tag))) o[m[1]] = m[2];
  return o;
}
var cardRe = /<article\b[^>]*\bdata-id="[^"]*"[^>]*>[\s\S]*?<\/article>/g;
/* картки головної кожної мови: lang -> [{id, a, href, hreflang}] */
function parseCards(home) {
  var list = [], cm;
  cardRe.lastIndex = 0;
  while ((cm = cardRe.exec(home))) {
    var tag = cm[0].slice(0, cm[0].indexOf(">") + 1);
    var a = attrs(tag);
    var link = /<a\b[^>]*class="[^"]*book-link[^"]*"[^>]*>/.exec(cm[0]);
    var linkAttrs = link ? attrs(link[0]) : null;
    list.push({ id: a["data-id"], a: a, href: linkAttrs ? linkAttrs.href : null, hreflang: linkAttrs ? linkAttrs.hreflang : null });
  }
  return list;
}
var homeLangs = homePage ? homePage.locales : [];
var cardLists = {};
homeLangs.forEach(function (l) {
  var h = read(pfx(l) + "index.html");
  if (h === null) { err("home [" + l + "]", "немає " + pfx(l) + "index.html"); cardLists[l] = []; return; }
  cardLists[l] = parseCards(h);
});

var ids = {};
acts.forEach(function (x, i) {
  var id = x.id || ("#" + i);
  if (!x.id || !/^[a-z0-9-]+$/.test(x.id)) err(id, "некоректний id");
  if (ids[x.id]) err(id, "id не унікальний");
  ids[x.id] = true;
  if ((tax.types || []).indexOf(x.type) < 0) err(id, "невідомий type «" + x.type + "»");
  (Array.isArray(x.topics) && x.topics.length ? x.topics : (err(id, "topics має бути непорожнім масивом"), [])).forEach(function (t) {
    if ((tax.topics || []).indexOf(t) < 0) err(id, "невідома тема «" + t + "»");
  });
  if ((tax.difficulty || []).indexOf(String(x.difficulty)) < 0) err(id, "невідома складність «" + x.difficulty + "»");
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
  var locales = Array.isArray(x.locales) ? x.locales : [];
  if (!locales.length) err(id, "немає locales");
  else if (locales.indexOf("uk") < 0) err(id, "locales має містити «uk» (основна мова й x-default)");
  locales.forEach(function (l) {
    if (l !== "uk" && l !== "en") err(id, "невідома мова «" + l + "» у locales");
    if (!x.title || !x.title[l]) err(id, "немає title." + l);
    if (!x.description || !x.description[l]) err(id, "немає description." + l);
  });
  if (typeof x.path !== "string" || !/\/$/.test(x.path)) { err(id, "path має закінчуватись на «/»"); return; }
  if (has(x, "scripts")) {
    if (!Array.isArray(x.scripts) || !x.scripts.length) err(id, "scripts має бути непорожнім масивом");
    else x.scripts.forEach(function (sc) { if (read("activities/" + id + "/" + sc) === null) err(id, "немає activities/" + id + "/" + sc + " (scripts)"); });
  }
  var templated = read("activities/" + id + "/page.html") !== null;
  if (templated && !has(x, "scripts")) err(id, "є activities/" + id + "/page.html, але в каталозі немає scripts");

  locales.forEach(function (l) {
    var lid = id + " [" + l + "]";
    var pagePath = pfx(l) + x.path;
    var page = read(pagePath + "index.html");
    var canon = BASE + pagePath;
    if (page === null) { err(lid, "немає " + pagePath + "index.html"); return; }
    var hl = /<html\b[^>]*\blang="([^"]*)"/.exec(page);
    if (!hl) err(lid, "<html> без lang");
    else if (hl[1] !== l) err(lid, "<html lang=\"" + hl[1] + "\"), а має бути \"" + l + "\"");
    if (!/<title>[^<]+<\/title>/.test(page)) err(lid, "сторінка без <title>");
    if (!/<meta\s+name="description"\s+content="[^"]+"/.test(page)) err(lid, "сторінка без meta description");
    var cn = /<link\s+rel="canonical"\s+href="([^"]*)"/.exec(page);
    if (!cn) err(lid, "сторінка без canonical");
    else if (cn[1] !== canon) err(lid, "canonical " + cn[1] + " ≠ " + canon);
    /* hreflang і og:locale: обов'язкові на сторінках, згенерованих build-pages (старі сторінки ще без них) */
    if (templated) {
    var alts = {}, are = /<link\s+rel="alternate"\s+hreflang="([^"]*)"\s+href="([^"]*)"/g, am;
    while ((am = are.exec(page))) alts[am[1]] = am[2];
    locales.forEach(function (m) { if (alts[m] !== BASE + pfx(m) + x.path) err(lid, "hreflang=\"" + m + "\": " + alts[m] + " ≠ " + BASE + pfx(m) + x.path); });
    if (alts["x-default"] !== BASE + x.path) err(lid, "hreflang=\"x-default\": " + alts["x-default"] + " ≠ " + BASE + x.path);
    Object.keys(alts).forEach(function (k) { if (k !== "x-default" && locales.indexOf(k) < 0) err(lid, "зайвий hreflang=\"" + k + "\""); });
    var ol = /<meta\s+property="og:locale"\s+content="([^"]*)"/.exec(page);
    var wantOl = l === "uk" ? "uk_UA" : "en_US";
    if (!ol || ol[1] !== wantOl) err(lid, "og:locale має бути " + wantOl);
    }
    var depth = (pfx(l) + x.path).split("/").filter(Boolean).length, up = "";
    for (var d = 0; d < depth; d++) up += "../";
    var back = false, hre = /<a\b[^>]*\bhref="([^"]*)"/g, hm;
    while ((hm = hre.exec(page))) { if (hm[1] === up || hm[1] === up + pfx(l) || hm[1] === BASE) back = true; }
    if (!back) err(lid, "немає посилання на головну (href=\"" + up + "\")");
    if (sitemap.indexOf("<loc>" + canon + "</loc>") < 0) err(lid, "sitemap.xml не містить " + canon);
    if (locales.length > 1) {
      locales.forEach(function (m) {
        if (sitemap.indexOf('hreflang="' + m + '" href="' + BASE + pfx(m) + x.path + '"') < 0) err(lid, "sitemap.xml: немає xhtml:link hreflang=\"" + m + "\"");
      });
    }
  });
  if (!x.og || !fs.existsSync(path.join(root, x.og))) err(id, "немає og-файлу " + x.og);

  homeLangs.forEach(function (hl) {
    var list = cardLists[hl];
    var mine = list.filter(function (c) { return c.id === x.id; });
    var cid = id + " (головна " + hl + ")";
    if (mine.length !== 1) { err(cid, "на головній має бути рівно 1 картка data-id, а є " + mine.length); return; }
    var c = mine[0], ca = c.a;
    if (ca["data-type"] !== x.type) err(cid, "data-type=" + ca["data-type"] + ", у каталозі " + x.type);
    if (ca["data-grades"] !== (x.grades || []).join(" ")) err(cid, "data-grades=\"" + ca["data-grades"] + "\", у каталозі \"" + (x.grades || []).join(" ") + "\"");
    if (ca["data-topics"] !== (x.topics || []).join(" ")) err(cid, "data-topics=\"" + ca["data-topics"] + "\", у каталозі \"" + (x.topics || []).join(" ") + "\"");
    if (ca["data-difficulty"] !== String(x.difficulty)) err(cid, "data-difficulty=" + ca["data-difficulty"] + ", у каталозі " + x.difficulty);
    /* посилання відносно головної: на сторінку цієї мови, а коли її немає, на українську (з hreflang="uk") */
    var has = locales.indexOf(hl) >= 0;
    var want = has || hl === "uk" ? x.path : "../" + x.path;
    if (c.href !== want) err(cid, "href картки «" + c.href + "» ≠ «" + want + "»");
    if (!has && hl !== "uk" && c.hreflang !== "uk") err(cid, "картка на сторінку без перекладу має hreflang=\"uk\"");
  });
});
homeLangs.forEach(function (hl) {
  cardLists[hl].forEach(function (c) { if (!ids[c.id]) err(c.id, "картка на головній (" + hl + ") відсутня в catalog.json"); });
});

/* кожна адреса з sitemap.xml має вести на наявний index.html */
var locRe = /<loc>([^<]+)<\/loc>/g, lm;
while ((lm = locRe.exec(sitemap))) {
  var u = lm[1];
  if (u.indexOf(BASE) !== 0) { err("sitemap.xml", "адреса поза " + BASE + ": " + u); continue; }
  if (!/\/$/.test(u)) { err("sitemap.xml", "адреса без кінцевого «/»: " + u); continue; }
  if (read(u.slice(BASE.length) + "index.html") === null) err("sitemap.xml", "немає " + u.slice(BASE.length) + "index.html для " + u);
}

/* сайтові сторінки (pages у catalog.json) */
var pageIds = {};
pages.forEach(function (pg) {
  var id = "page " + pg.id;
  if (pageIds[pg.id]) err(id, "id не унікальний");
  pageIds[pg.id] = true;
  if (read("pages/" + pg.id + "/page.html") === null) err(id, "немає pages/" + pg.id + "/page.html");
  if (pg.locales.indexOf("uk") < 0) err(id, "locales має містити «uk»");
  if (!pg.og || !fs.existsSync(path.join(root, pg.og))) err(id, "немає og-файлу " + pg.og);
  (pg.scripts || []).forEach(function (sc) { if (read(sc) === null) err(id, "немає " + sc + " (scripts)"); });
  (pg.css || []).forEach(function (c) { if (read(c) === null) err(id, "немає " + c + " (css)"); });
  pg.locales.forEach(function (l) {
    var lid = id + " [" + l + "]", file = pfx(l) + pg.path + "index.html", page = read(file);
    if (page === null) { err(lid, "немає " + file); return; }
    var hl = /<html\b[^>]*\blang="([^"]*)"/.exec(page);
    if (!hl || hl[1] !== l) err(lid, "<html lang> має бути \"" + l + "\"");
    var canon = BASE + pfx(l) + pg.path, cn = /<link\s+rel="canonical"\s+href="([^"]*)"/.exec(page);
    if (!cn || cn[1] !== canon) err(lid, "canonical ≠ " + canon);
    var alts = {}, are = /<link\s+rel="alternate"\s+hreflang="([^"]*)"\s+href="([^"]*)"/g, am;
    while ((am = are.exec(page))) alts[am[1]] = am[2];
    pg.locales.forEach(function (m) { if (alts[m] !== BASE + pfx(m) + pg.path) err(lid, "hreflang=\"" + m + "\": " + alts[m]); });
    if (alts["x-default"] !== BASE + pg.path) err(lid, "hreflang=\"x-default\" ≠ " + BASE + pg.path);
    var ol = /<meta\s+property="og:locale"\s+content="([^"]*)"/.exec(page);
    if (!ol || ol[1] !== (l === "uk" ? "uk_UA" : "en_US")) err(lid, "og:locale");
    if ((page.match(/<h1[\s>]/g) || []).length !== 1) err(lid, "має бути рівно один <h1>");
    if (!/<main[\s>]/.test(page)) err(lid, "немає <main>");
    if (!/<a\b[^>]*class="lang-switch"/.test(page)) err(lid, "немає перемикача мови в шапці");
    if (sitemap.indexOf("<loc>" + canon + "</loc>") < 0) err(lid, "sitemap.xml не містить " + canon);
  });
});
["404.html"].forEach(function (f) { if (read(f) === null) err(f, "немає файлу"); });

/* внутрішні посилання й ресурси всіх згенерованих сторінок мають вести на наявні файли */
function walkHtml(dir, acc) {
  fs.readdirSync(path.join(root, dir)).forEach(function (n) {
    var rel = dir ? dir + "/" + n : n;
    if (n === "vendor" || n === "node_modules" || n === ".git" || n === "templates" || n === "pages" || n === "activities" || n === "docs") return;
    if (fs.statSync(path.join(root, rel)).isDirectory()) walkHtml(rel, acc);
    else if (n === "index.html") acc.push(rel);
  });
  return acc;
}
walkHtml("", []).forEach(function (file) {
  var html = read(file), dir = path.posix.dirname(file);
  var re = /\b(?:href|src)="([^"]*)"/g, m;
  while ((m = re.exec(html))) {
    var u = m[1];
    if (!u || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(u)) continue;
    var target = path.posix.normalize(path.posix.join(dir === "." ? "" : dir, u.split("#")[0].split("?")[0]));
    if (!target || target === ".") target = "";
    var full = path.join(root, target);
    var ok = fs.existsSync(full) && (!fs.statSync(full).isDirectory() || fs.existsSync(path.join(full, "index.html")));
    if (!ok) err(file, "бите посилання: " + u);
  }
});

if (errors.length) { console.error(errors.join("\n")); console.error("\nПомилок: " + errors.length); process.exit(1); }
console.log("OK: " + acts.length + " активностей, " + pages.length + " сайтових сторінок");
