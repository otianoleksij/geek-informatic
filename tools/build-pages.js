#!/usr/bin/env node
/* Генерує сторінки сайту:
     - активності: templates/activity.html + activities/<id>/page.html + словники;
     - сайтові сторінки (головна, вчителям, приватність): templates/page.html + pages/<id>/page.html + словники;
     - 404.html (templates/404.html) і sitemap.xml.
   node tools/build-pages.js            записати сторінки
   node tools/build-pages.js --check    нічого не писати; код 1, якщо закомічені сторінки застаріли
   Правила: docs/architecture.md. */
"use strict";
var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var BASE = "https://otianoleksij.github.io/geek-informatic/";
var LANGS = ["uk", "en"];
var OG_LOCALE = { uk: "uk_UA", en: "en_US" };
/* Основна мова лежить без префікса, решта під <lang>/ */
function prefix(lang) { return lang === "uk" ? "" : lang + "/"; }

/* Змінні сторінки: {{name}} (з екрануванням) і {{{name}}} (сирий HTML, лише для змінних нижче). */
var RAW_VARS = ["hreflang", "jsonld", "i18nData", "scripts", "body", "styles", "nav", "links",
  "filterGrade", "filterType", "filterTopic", "filterLevel", "sections", "activityRows"];
var PAGE_VARS = ["lang", "root", "prefix", "basePath", "id", "canonical", "title", "pageTitle", "description", "ogDescription",
  "ogLocale", "ogImage", "ogAlt", "fontFile", "homeHref", "altHref", "altLang", "altName", "activityCss", "themeColor",
  "baseCss", "chrome", "ownPage", "favicon", "defaultFavicon"].concat(RAW_VARS);
/* Простори імен 404.html (немає в catalog.json) */
var NOTFOUND_NS = "notfound";

function BuildError(msg) { this.message = msg; }
BuildError.prototype = Object.create(Error.prototype);
function fail(msg) { throw new BuildError(msg); }

function rel(p) { return path.relative(ROOT, p); }
function exists(relPath) { return fs.existsSync(path.join(ROOT, relPath)); }
function readText(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), "utf8"); } catch (e) { fail("немає файлу " + relPath); }
}
function readJSON(relPath) {
  try { return JSON.parse(readText(relPath)); } catch (e) { if (e instanceof BuildError) throw e; fail(relPath + ": " + e.message); }
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
}
/* JSON, безпечний всередині <script>: не містить «<» і роздільників рядків */
function safeJSON(v) {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, function (c) { return "\\u" + c.charCodeAt(0).toString(16); });
}
function fmt(s, params) { return s.replace(/\{(\w+)\}/g, function (m, k) { return params && params[k] !== undefined ? params[k] : m; }); }

/* ---------- кількості з контенту ----------
   Запис в catalog.json: "count": {"file": "content/robot/levels.json", "path": "levels"} (у file можна {lang}).
   У рядках словників і в title/description каталогу:
     {count.<id>}                          число (кількість елементів масиву path у file активності <id>)
     {count.<id>|форма1|форма2|…}          слово в потрібній формі множини; форми йдуть у порядку PLURAL_CATS мови
   Рядки з такими токенами розгортаються під час збирання, тож «10 рівнів» ніколи не пишуть руками. */
var PLURAL_CATS = { uk: ["one", "few", "many", "other"], en: ["one", "other"] };
var RE_COUNT = /\{count\.([a-z0-9-]+)((?:\|[^|{}]*)*)\}/g;
var catalogCache = null, dictCache = {}, countCache = {};
function catalogRaw() { if (!catalogCache) catalogCache = readJSON("catalog.json"); return catalogCache; }
function countOf(id, lang, label) {
  var act = (catalogRaw().activities || []).filter(function (a) { return a.id === id; })[0];
  if (!act) fail(label + ": {count." + id + "}: в catalog.json немає активності «" + id + "»");
  if (!act.count) fail(label + ": {count." + id + "}: в activities[" + id + "] немає поля count");
  var file = act.count.file.replace(/\{lang\}/g, lang);
  if (!exists(file)) file = act.count.file.replace(/\{lang\}/g, "uk");   // немає набору цієї мови: беремо український
  var v = readJSON(file);
  act.count.path.split(".").forEach(function (k) { v = v && v[k]; });
  if (!Array.isArray(v)) fail(label + ": count.path «" + act.count.path + "» у " + file + " не веде до масиву (активність " + id + ")");
  return v.length;
}
function resolveCounts(str, lang, label) {
  if (str.indexOf("{count.") < 0) return str;
  return str.replace(RE_COUNT, function (m, id, forms) {
    var n = countOf(id, lang, label);
    if (!forms) return String(n);
    var list = forms.slice(1).split("|"), cats = PLURAL_CATS[lang];
    if (!cats) fail(label + ": немає правил множини для мови " + lang);
    if (list.length !== cats.length) fail(label + ": " + m + ": для мови " + lang + " потрібно " + cats.length + " форм (" + cats.join("|") + "), а є " + list.length);
    return list[cats.indexOf(new Intl.PluralRules(lang).select(n))];
  });
}
function resolveDeep(v, lang, label) {
  if (typeof v === "string") return resolveCounts(v, lang, label);
  if (v && typeof v === "object") { var o = {}; Object.keys(v).forEach(function (k) { o[k] = resolveDeep(v[k], lang, label); }); return o; }
  return v;
}

/* ---------- словники ---------- */
function loadDict(lang, ns) {
  var k = lang + "/" + ns;
  if (!dictCache[k]) {
    var rel = "i18n/" + lang + "/" + ns + ".json";
    dictCache[k] = resolveDeep(readJSON(rel), lang, rel);
  }
  return dictCache[k];
}
function dictString(dicts, ns, key, label) {
  var d = dicts[ns];
  if (!d) fail(label + ": простір імен «" + ns + "» не завантажено (доступні common і " + dicts.$ns + ")");
  if (!Object.prototype.hasOwnProperty.call(d, key)) fail(label + ": немає ключа " + ns + "." + key);
  return d[key];
}
function sub(dicts, fullKey, label) {
  if (!dicts) fail(label + ": словники недоступні для " + fullKey);
  var i = fullKey.indexOf(".");
  var ns = fullKey.slice(0, i), key = fullKey.slice(i + 1);
  if (ns === "ns") ns = dicts.$ns;
  var v = dictString(dicts, ns, key, label);
  if (typeof v !== "string") fail(label + ": " + fullKey + " — не рядок (множину в {{}} вставляти не можна)");
  if (/\{\w+\}/.test(v)) fail(label + ": " + fullKey + " містить плейсхолдери, а {{}} параметрів не приймає");
  return v;
}

/* ---------- підстановка ---------- */
/* {{#if x}}…{{/if}}: допускається вкладення; обробляємо від найглибшого (внутрішній блок не містить «{{#if») */
var RE_IF = /\{\{#if\s+(\w+)\s*\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;
/* {{{raw}}} · {{ns.key}} · {{name}} · {{rich:ns.key}} (міні-розмітка) · {{en:ns.key}} (англійський словник, лише для 404) */
var RE_TOKEN = /\{\{\{\s*(\w+)\s*\}\}\}|\{\{\s*(?:(rich|en):)?([\w.-]+)\s*\}\}/g;

function expandIfs(src, ctx, label, dry) {
  var prev;
  do {
    prev = src;
    src = src.replace(RE_IF, function (m, name, inner) {
      if (PAGE_VARS.indexOf(name) < 0) fail(label + ": невідома змінна у {{#if " + name + "}}");
      return dry || ctx.vars[name] ? inner : "";
    });
  } while (src !== prev);
  return src;
}

/* Міні-розмітка словників сайтових сторінок: **жирний**, `код`, [текст](https://…) або [текст](@шлях) —
   @ це корінь сайту в мові сторінки (кожна сайтова сторінка є в обох мовах). Решта екранується. */
function richText(str, ctx, label) {
  var h = esc(str);
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, text, url) {
    var m2 = /^@([a-z0-9\/.-]*)$/.exec(url);
    if (m2) return '<a href="' + ctx.vars.root + prefix(ctx.vars.lang) + m2[1] + '">' + text + "</a>";
    if (/^https:\/\/[^\s"'<>]+$/.test(url)) return '<a href="' + url + '" rel="noopener">' + text + "</a>";
    fail(label + ": недозволене посилання «" + url + "» (дозволені https://… і @шлях)");
  });
  return h.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
}

function render(src, ctx, label) {
  var rest = expandIfs(src, ctx, label, true).replace(RE_TOKEN, "");
  if (rest.indexOf("{{") >= 0) fail(label + ": некоректна конструкція {{ … }} поруч із «" + rest.slice(rest.indexOf("{{"), rest.indexOf("{{") + 30).replace(/\n/g, " ") + "»");
  var out = expandIfs(src, ctx, label, false);
  return out.replace(RE_TOKEN, function (m, raw, mode, key) {
    if (raw) {
      if (RAW_VARS.indexOf(raw) < 0) fail(label + ": {{{" + raw + "}}} — сирий HTML дозволений лише для " + RAW_VARS.join(", "));
      return ctx.vars[raw];
    }
    if (mode === "en") return esc(sub(ctx.dictsEn, key, label));
    if (mode === "rich") return richText(sub(ctx.dicts, key, label), ctx, label);
    if (key.indexOf(".") < 0) {
      if (PAGE_VARS.indexOf(key) < 0) fail(label + ": невідома змінна {{" + key + "}}");
      if (RAW_VARS.indexOf(key) >= 0) fail(label + ": {{" + key + "}} — це сирий HTML, пиши {{{" + key + "}}}");
      return esc(ctx.vars[key]);
    }
    return esc(sub(ctx.dicts, key, label));
  });
}

/* ---------- спільне ---------- */
function gradeRange(grades) {
  var g = grades.slice().sort(function (a, b) { return a - b; });
  if (g.length === 1) return String(g[0]);
  var contiguous = g.every(function (n, i) { return i === 0 || n === g[i - 1] + 1; });
  return contiguous ? g[0] + "–" + g[g.length - 1] : g.join(", ");
}
function upTo(relDir) { var d = relDir.split("/").filter(Boolean).length, r = ""; for (var i = 0; i < d; i++) r += "../"; return r; }
function otherLang(lang) { return LANGS.filter(function (l) { return l !== lang; })[0]; }
function basename(p) { return p.slice(p.lastIndexOf("/") + 1); }
/* Картинка для соцмереж: для не-основної мови assets/og/<lang>/<ім'я>, а якщо її немає, основна */
function ogFor(og, lang) {
  if (lang !== "uk" && exists("assets/og/" + lang + "/" + basename(og))) return "assets/og/" + lang + "/" + basename(og);
  return og;
}
function titleOf(act, lang) { return act.title[lang] || act.title.uk; }
function homeLocales(cat) {
  var h = (cat.pages || []).filter(function (p) { return p.id === "home"; })[0];
  return h ? h.locales : ["uk"];
}
function hreflangLinks(locales, pathStr) {
  var urlOf = function (l) { return BASE + prefix(l) + pathStr; };
  var hl = locales.map(function (l) { return '<link rel="alternate" hreflang="' + l + '" href="' + esc(urlOf(l)) + '">'; });
  hl.push('<link rel="alternate" hreflang="x-default" href="' + esc(urlOf(locales.indexOf("uk") >= 0 ? "uk" : locales[0])) + '">');
  return hl.join("\n");
}
function pageJsonLd(cs, lang, name, description, canonical) {
  return { "@context": "https://schema.org", "@type": "WebPage", name: name, url: canonical, inLanguage: lang, description: description,
    isPartOf: { "@type": "WebSite", name: cs("siteName"), url: BASE } };
}

/* ---------- сторінка активності ---------- */
function buildActivity(cat, act, lang, template, label) {
  var id = act.id, ns = act.namespace || id;
  var title = act.title && act.title[lang], description = act.description && act.description[lang];
  if (!title) fail(label + ": немає title." + lang + " у catalog.json");
  if (!description) fail(label + ": немає description." + lang + " у catalog.json");
  if (!/\/$/.test(act.path)) fail(label + ": path має закінчуватись на «/»");
  var root = upTo(prefix(lang) + act.path);

  var dicts = { common: loadDict(lang, "common"), $ns: ns };
  dicts[ns] = loadDict(lang, ns);
  var common = dicts.common;
  function cs(key) { return dictString(dicts, "common", key, label); }

  var canonical = BASE + prefix(lang) + act.path;

  /* перемикач мови: та сама активність іншою мовою, а якщо перекладу немає, головна цієї мови (якщо вона є) */
  var altLang = otherLang(lang), altHref = "", hl = homeLocales(cat);
  if (act.locales.indexOf(altLang) >= 0) altHref = root + prefix(altLang) + act.path;
  else if (hl.indexOf(altLang) >= 0) altHref = root + prefix(altLang);
  var homeHref = hl.indexOf(lang) >= 0 ? root + prefix(lang) : root;

  var level = (act.grades || []).length
    ? fmt(cs(act.grades.length > 1 ? "grade.range" : "grade.single"), { range: gradeRange(act.grades) }) : undefined;
  var ld = {
    "@context": "https://schema.org", "@type": "LearningResource", name: title, description: description, url: canonical,
    inLanguage: lang, isAccessibleForFree: true, learningResourceType: act.type
  };
  if (level) ld.educationalLevel = level;
  if (act.topics && act.topics.length) ld.teaches = act.topics.map(function (t) { return cs("topic." + t); });
  var org = { "@type": "Organization", name: cs("siteName"), url: BASE };
  ld.provider = org; ld.publisher = org;

  var cssRel = "activities/" + id + "/" + id + ".css";
  var vendor = (act.vendorScripts || []).map(function (s) {
    var p = s.replace(/\{lang\}/g, lang);
    if (!exists(p)) fail(label + ": немає " + p + " (vendorScripts у catalog.json)");
    return p;
  });
  var scripts = vendor.concat(["assets/js/storage.js", "assets/js/i18n.js", "assets/js/data.js"]).concat(
    (act.scripts || []).map(function (s) {
      if (!exists("activities/" + id + "/" + s)) fail(label + ": немає activities/" + id + "/" + s + " (поле scripts у catalog.json)");
      return "activities/" + id + "/" + s;
    }));
  /* Сторінки з vendor-скриптами (Blockly): усі скрипти defer, порядок збережено — vendor, словники/дані, код активності */
  var deferAttr = vendor.length ? " defer" : "";
  /* skin: space і own — власна шапка/підвал у page.html, без base.css; space додатково означає темну космічну тему */
  if (act.skin && ["space", "own"].indexOf(act.skin) < 0) fail(label + ": невідомий skin «" + act.skin + "»");
  var ownPage = act.skin === "space" || act.skin === "own";
  var favicon = "";
  if (act.favicon) {
    if (!exists("activities/" + id + "/" + act.favicon)) fail(label + ": немає activities/" + id + "/" + act.favicon + " (поле favicon)");
    favicon = root + "activities/" + id + "/" + act.favicon;
  }
  var i18nData = {}; i18nData.common = common; i18nData[ns] = dicts[ns];

  var ctx = {
    dicts: dicts,
    vars: {
      lang: lang, root: root, id: id, canonical: canonical, title: title, description: description,
      pageTitle: title + " — " + cs("siteName"), ogLocale: OG_LOCALE[lang],
      ogImage: BASE + ogFor(act.og, lang), ogAlt: title + " — " + cs("siteName"),
      fontFile: lang === "uk" ? "nunito-cyrillic.woff2" : "nunito-latin.woff2",
      homeHref: homeHref, altHref: altHref, altLang: altLang, altName: cs("lang." + altLang),
      activityCss: exists(cssRel) ? root + cssRel : "",
      themeColor: act.themeColor || "#EEF3FA", baseCss: ownPage ? "" : "1", chrome: ownPage ? "" : "1", ownPage: ownPage ? "1" : "",
      favicon: favicon, defaultFavicon: favicon ? "" : "1",
      hreflang: hreflangLinks(act.locales, act.path), jsonld: safeJSON(ld), i18nData: safeJSON(i18nData),
      scripts: scripts.map(function (s) { return "<script" + deferAttr + ' src="' + root + s + '"></script>'; }).join("\n")
    }
  };
  ctx.vars.body = render(readText("activities/" + id + "/page.html").replace(/\s+$/, ""), ctx, label + " (page.html)");
  return render(template, ctx, label + " (templates/activity.html)");
}

/* ---------- головна: фільтри й картки ---------- */
var SVG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
var SVG_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
var SECTION_IDS = { webquest: "quests", game: "games", puzzle: "rebuses" };
var iconsCache;

function usedValues(cat, order, pick) {
  var seen = {};
  cat.activities.forEach(function (a) { [].concat(pick(a)).forEach(function (v) { seen[String(v)] = true; }); });
  return order.filter(function (v) { return seen[String(v)]; });
}

function homeParts(cat, lang, dicts, label) {
  var home = dicts[dicts.$ns];
  function hs(key) { return dictString(dicts, dicts.$ns, key, label); }
  function cs(key) { return dictString(dicts, "common", key, label); }
  if (!iconsCache) iconsCache = readJSON("templates/icons.json");
  var tax = cat.taxonomy;
  var opt = function (v, text) { return '<option value="' + esc(v) + '">' + esc(text) + "</option>"; };
  var grades = []; for (var g = 1; g <= 11; g++) grades.push(g);
  var types = usedValues(cat, tax.types, function (a) { return a.type; });
  var topics = usedValues(cat, tax.topics, function (a) { return a.topics; });
  var levels = usedValues(cat, tax.difficulty, function (a) { return a.difficulty; });
  var parts = {
    filterGrade: grades.map(function (n) { return opt(n, fmt(cs("grade.single"), { range: n })); }).join(""),
    filterType: types.map(function (v) { return opt(v, hs("filter.type." + v)); }).join(""),
    filterTopic: topics.map(function (v) { return opt(v, hs("filter.topic." + v)); }).join(""),
    filterLevel: levels.map(function (v) { return opt(v, hs("filter.level." + v)); }).join("")
  };
  var up = lang === "uk" ? "" : "../";   // головна цієї мови лежить на рівень глибше

  function card(act, n) {
    var id = act.id, c = act.card;
    if (!c) fail(label + ": немає card у catalog.json для " + id);
    var art = "activities/" + id + "/card.svg";
    if (!exists(art)) fail(label + ": немає " + art);
    var hasLang = act.locales.indexOf(lang) >= 0;
    var href = (hasLang ? "" : up) + act.path;
    var key = function (k) { return "card." + id + "." + k; };
    var tid = "t-" + id;
    var linkAttrs = hasLang ? "" : ' hreflang="uk" lang="uk"';
    var gradeLabel = fmt(cs(act.grades.length > 1 ? "grade.range" : "grade.single"), { range: gradeRange(act.grades) });
    var facts = c.facts.map(function (name, i) {
      if (!iconsCache[name]) fail(label + ": card.facts: немає іконки «" + name + "» у templates/icons.json");
      return "            <li>" + SVG_ICON + iconsCache[name] + "</svg>" + esc(hs(key("f" + (i + 1)))) + "</li>";
    }).join("\n");
    var svg = readText(art).replace(/\s+$/, "").replace(/\n/g, "\n          ");
    var note = c.note ? "<small>" + esc(hs(key("note"))) + "</small>" : "";
    return [
      '      <article class="book b' + c.cover + '" data-id="' + id + '" data-type="' + act.type + '" data-grades="' + act.grades.join(" ") +
        '" data-topics="' + act.topics.join(" ") + '" data-difficulty="' + act.difficulty + '" aria-labelledby="' + tid + '">',
      '        <div class="cover">',
      '          <span class="grade">' + esc(gradeLabel) + "</span>",
      "          " + svg,
      "        </div>",
      '        <div class="label">',
      '          <span class="subj">' + esc(hs(key("subject"))) + "</span>",
      '          <h3 id="' + tid + '"><a href="' + esc(href) + '" class="book-link"' + linkAttrs + ">" + esc(titleOf(act, lang)) + "</a></h3>",
      "          <p>" + esc(hs(key("blurb"))) + "</p>",
      '          <ul class="facts">',
      facts,
      "          </ul>"
    ].concat(hasLang ? [] : ['          <p class="lang-note">' + esc(cs("ukOnly")) + "</p>"]).concat([
      '          <div class="go"><span class="btn" aria-hidden="true">' + esc(hs(key("cta"))) + SVG_ARROW + "</span>" + note + "</div>",
      "        </div>",
      "      </article>"
    ]).join("\n");
  }

  parts.sections = types.map(function (t) {
    var sid = SECTION_IDS[t] || t, hid = "sh-" + t;
    var cards = cat.activities.filter(function (a) { return a.type === t; }).map(card).join("\n\n");
    return '  <section class="wrap quests" id="' + sid + '" data-type="' + t + '" aria-labelledby="' + hid + '">\n' +
      '    <div class="sec-head"><h2 id="' + hid + '">' + esc(hs("section." + t + ".title")) + "</h2><p>" + esc(hs("section." + t + ".hint")) + "</p></div>\n" +
      '    <div class="grid">\n\n' + cards + "\n\n    </div>\n  </section>";
  }).join("\n\n");
  parts.nav = types.map(function (t) { return '<a href="#' + (SECTION_IDS[t] || t) + '">' + esc(hs("section." + t + ".title")) + "</a>"; }).join(" ") + " ";
  parts.itemList = cat.activities.map(function (a, i) {
    var hasLang = a.locales.indexOf(lang) >= 0;
    return { "@type": "ListItem", position: i + 1, name: titleOf(a, lang), url: BASE + (hasLang ? prefix(lang) : "") + a.path };
  });
  return parts;
}

/* Таблиця активностей для сторінки вчителів */
function teacherRows(cat, lang, dicts, label) {
  var ts = function (k) { return dictString(dicts, dicts.$ns, k, label); };
  var cs = function (k) { return dictString(dicts, "common", k, label); };
  var home = loadDict(lang, "home");
  var root = upTo(prefix(lang) + "teachers/");
  return cat.activities.map(function (a) {
    var hasLang = a.locales.indexOf(lang) >= 0;
    var href = root + (hasLang ? prefix(lang) : "") + a.path;
    var topics = a.topics.map(function (t) {
      if (!Object.prototype.hasOwnProperty.call(home, "filter.topic." + t)) fail(label + ": немає home.filter.topic." + t);
      return home["filter.topic." + t];
    }).join(", ");
    return '        <tr><th scope="row"><a href="' + esc(href) + '"' + (hasLang ? "" : ' hreflang="uk" lang="uk"') + ">" + esc(titleOf(a, lang)) + "</a>" +
      (hasLang ? "" : " <small>· " + esc(cs("ukOnly")) + "</small>") + "</th><td>" + gradeRange(a.grades) + "</td><td>" + esc(topics) +
      "</td><td>" + esc(fmt(ts("act.minutes"), { n: a.duration })) + "</td><td>" + esc(ts("do." + a.id)) + "</td></tr>";
  }).join("\n");
}

/* ---------- сайтова сторінка ---------- */
function buildSitePage(cat, page, lang, template, label) {
  var id = page.id, ns = page.namespace || id;
  if (page.path !== "" && !/\/$/.test(page.path)) fail(label + ": path має бути порожнім або закінчуватись на «/»");
  var rootDir = prefix(lang) + page.path;
  var root = upTo(rootDir);
  var dicts = { common: loadDict(lang, "common"), $ns: ns };
  dicts[ns] = loadDict(lang, ns);
  var cs = function (k) { return dictString(dicts, "common", k, label); };
  var ds = function (k) { return dictString(dicts, ns, k, label); };

  var canonical = BASE + rootDir;
  var altLang = otherLang(lang), hl = homeLocales(cat);
  var altHref = root + prefix(altLang) + (page.locales.indexOf(altLang) >= 0 ? page.path : "");
  var homeHref = page.path === "" ? "./" : root + prefix(lang);

  var scripts = page.scripts || [];
  scripts.forEach(function (sc) { if (!exists(sc)) fail(label + ": немає " + sc + " (scripts у catalog.json)"); });
  var css = (page.css || []).concat(exists("pages/" + id + "/" + id + ".css") ? ["pages/" + id + "/" + id + ".css"] : []);
  css.forEach(function (c) { if (!exists(c)) fail(label + ": немає " + c + " (css у catalog.json)"); });
  var i18nData = scripts.indexOf("assets/js/i18n.js") >= 0 ? safeJSON((function () { var o = { common: dicts.common }; o[ns] = dicts[ns]; return o; })()) : "";

  var title = ds("title"), description = ds("description");
  var vars = {
    lang: lang, root: root, prefix: prefix(lang), id: id, canonical: canonical, title: title, description: description,
    ogDescription: ds("ogDescription"), ogLocale: OG_LOCALE[lang], ogImage: BASE + ogFor(page.og, lang), ogAlt: cs("ogAlt"),
    fontFile: lang === "uk" ? "nunito-cyrillic.woff2" : "nunito-latin.woff2",
    homeHref: homeHref, altHref: altHref, altLang: altLang, altName: cs("lang." + altLang),
    themeColor: "#EEF3FA", hreflang: hreflangLinks(page.locales, page.path), i18nData: i18nData,
    styles: css.map(function (c) { return '<link rel="stylesheet" href="' + root + c + '">\n'; }).join(""),
    scripts: scripts.map(function (sc) { return '<script src="' + root + sc + '" defer></script>'; }).join("\n"),
    nav: '<a href="' + homeHref + '">' + esc(cs("home")) + "</a>"
  };
  var ctx = { dicts: dicts, vars: vars };
  if (id === "home") {
    var hp = homeParts(cat, lang, dicts, label);
    ["filterGrade", "filterType", "filterTopic", "filterLevel", "sections", "nav"].forEach(function (k) { vars[k] = hp[k]; });
    var site = { "@context": "https://schema.org", "@type": "WebSite", name: cs("siteName"), url: canonical, inLanguage: lang, description: description };
    var list = { "@context": "https://schema.org", "@type": "ItemList", name: ds("listName"), itemListElement: hp.itemList };
    vars.jsonld = safeJSON(site) + '</script>\n<script type="application/ld+json">' + safeJSON(list);
  } else {
    vars.jsonld = safeJSON(pageJsonLd(cs, lang, ds("name"), description, canonical));
  }
  if (id === "teachers") vars.activityRows = teacherRows(cat, lang, dicts, label);
  vars.body = render(readText("pages/" + id + "/page.html").replace(/\s+$/, ""), ctx, label + " (page.html)");
  return render(template, ctx, label + " (templates/page.html)");
}

/* ---------- 404.html ---------- */
function build404(cat, template) {
  var label = "404";
  var basePath = new (require("url").URL)(BASE).pathname;
  var dicts = { common: loadDict("uk", "common"), $ns: NOTFOUND_NS }, dictsEn = { common: loadDict("en", "common"), $ns: NOTFOUND_NS };
  dicts[NOTFOUND_NS] = loadDict("uk", NOTFOUND_NS); dictsEn[NOTFOUND_NS] = loadDict("en", NOTFOUND_NS);
  var links = cat.activities.map(function (a) {
    var en = a.locales.indexOf("en") >= 0;
    return '      <li><a href="' + esc(basePath + a.path) + '"' + (en ? ' data-en-href="' + esc(basePath + "en/" + a.path) + '" data-en="' + esc(a.title.en) + '"' : "") + ">" +
      esc(a.title.uk) + "</a></li>";
  }).join("\n");
  var ctx = { dicts: dicts, dictsEn: dictsEn, vars: { basePath: basePath, links: links } };
  return render(template, ctx, "404 (templates/404.html)");
}

/* ---------- sitemap.xml ---------- */
function buildSitemap(cat) {
  var lastmod = cat.lastmod;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod || "")) fail("sitemap: у catalog.json немає lastmod (РРРР-ММ-ДД)");
  var entries = [];
  (cat.pages || []).filter(function (p) { return p.id === "home"; }).forEach(function (p) { entries.push(p); });
  cat.activities.forEach(function (a) { entries.push(a); });
  (cat.pages || []).filter(function (p) { return p.id !== "home"; }).forEach(function (p) { entries.push(p); });
  var out = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  entries.forEach(function (e) {
    var url = function (l) { return BASE + prefix(l) + e.path; };
    e.locales.forEach(function (l) {
      if (e.locales.length < 2) { out.push("  <url><loc>" + esc(url(l)) + "</loc><lastmod>" + lastmod + "</lastmod></url>"); return; }
      out.push("  <url>", "    <loc>" + esc(url(l)) + "</loc>", "    <lastmod>" + lastmod + "</lastmod>");
      e.locales.forEach(function (m) { out.push('    <xhtml:link rel="alternate" hreflang="' + m + '" href="' + esc(url(m)) + '"/>'); });
      out.push('    <xhtml:link rel="alternate" hreflang="x-default" href="' + esc(url(e.locales.indexOf("uk") >= 0 ? "uk" : e.locales[0])) + '"/>', "  </url>");
    });
  });
  out.push("</urlset>", "");
  return out.join("\n");
}

/* Повертає { files: {відносний шлях: вміст}, errors: [рядки] } */
function buildAll() {
  var files = {}, errors = [];
  var cat, tplActivity, tplPage, tpl404;
  try {
    cat = readJSON("catalog.json"); tplActivity = readText("templates/activity.html");
    tplPage = readText("templates/page.html"); tpl404 = readText("templates/404.html");
  } catch (e) { return { files: files, errors: [e.message] }; }
  function guard(out, fn) {
    try { files[out] = fn(); } catch (e) { if (e instanceof BuildError) errors.push(e.message); else throw e; }
  }
  iconsCache = null; dictCache = {}; catalogCache = cat;
  try {
    (cat.activities || []).forEach(function (a) {
      ["title", "description"].forEach(function (f) {
        Object.keys(a[f] || {}).forEach(function (l) { a[f][l] = resolveCounts(a[f][l], l, "catalog.json " + a.id + "." + f + "." + l); });
      });
    });
  } catch (e) { if (e instanceof BuildError) return { files: files, errors: [e.message] }; throw e; }
  (cat.pages || []).forEach(function (page) {
    page.locales.forEach(function (lang) {
      guard(prefix(lang) + page.path + "index.html", function () { return buildSitePage(cat, page, lang, tplPage, page.id + "/" + lang); });
    });
  });
  (cat.activities || []).forEach(function (act) {
    if (!exists("activities/" + act.id + "/page.html")) return;
    (act.locales || []).forEach(function (lang) {
      guard(prefix(lang) + act.path + "index.html", function () { return buildActivity(cat, act, lang, tplActivity, act.id + "/" + lang); });
    });
  });
  guard("404.html", function () { return build404(cat, tpl404); });
  guard("sitemap.xml", function () { return buildSitemap(cat); });
  return { files: files, errors: errors };
}

function main() {
  var checkOnly = process.argv.indexOf("--check") >= 0;
  var res = buildAll();
  if (res.errors.length) { console.error(res.errors.join("\n")); console.error("\nПомилок: " + res.errors.length); process.exit(1); }
  var names = Object.keys(res.files).sort();
  if (checkOnly) {
    var stale = names.filter(function (n) {
      var p = path.join(ROOT, n);
      return !fs.existsSync(p) || fs.readFileSync(p, "utf8") !== res.files[n];
    });
    if (stale.length) {
      console.error("Застарілі сторінки (запусти node tools/build-pages.js):\n  " + stale.join("\n  "));
      process.exit(1);
    }
    console.log("OK: " + names.length + " файлів актуальні");
    return;
  }
  names.forEach(function (n) {
    var p = path.join(ROOT, n);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, res.files[n]);
    console.log("записано " + n);
  });
}

module.exports = { PAGE_VARS: PAGE_VARS, RAW_VARS: RAW_VARS, LANGS: LANGS, BASE: BASE, NOTFOUND_NS: NOTFOUND_NS, prefix: prefix, buildAll: buildAll };
if (require.main === module) main();
