#!/usr/bin/env node
/* Перевіряє JSON за схемами: node tools/check-schemas.js
   - кожен JSON у content/ (на будь-якій глибині) відповідає схемі з власного поля "$schema" і має "format": 1;
   - catalog.json перевіряється за schemas/catalog.schema.json, i18n/<lang>/*.json за schemas/i18n.schema.json;
   - у масивах об'єктів поле id унікальне.
   Валідатор мінімальний (без ajv): type, const, enum, pattern, required, properties, additionalProperties
   (false або схема), items, minItems/maxItems, minimum/maximum, oneOf, $ref на #/definitions/…. */
"use strict";
var fs = require("fs");
var path = require("path");
var ROOT = path.join(__dirname, "..");
var errors = [], checked = 0;

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
function isType(v, t) {
  var a = typeOf(v);
  if (t === "integer") return a === "number" && Math.floor(v) === v;
  return a === t;
}
function validate(v, schema, root, at, out) {
  if (schema.$ref) {
    var m = /^#\/definitions\/(\w+)$/.exec(schema.$ref), target = m && root.definitions && root.definitions[m[1]];
    if (!target) { out.push(at + ": невідомий $ref " + schema.$ref); return; }
    return validate(v, target, root, at, out);
  }
  if (schema.type && !isType(v, schema.type)) { out.push(at + ": очікується " + schema.type + ", а є " + typeOf(v)); return; }
  if ("const" in schema && v !== schema.const) out.push(at + ": має дорівнювати " + JSON.stringify(schema.const));
  if (schema.enum && schema.enum.indexOf(v) < 0) out.push(at + ": має бути одним із " + JSON.stringify(schema.enum) + ", а є " + JSON.stringify(v));
  if (typeof v === "string" && schema.pattern && !new RegExp(schema.pattern).test(v)) out.push(at + ": «" + v + "» не відповідає " + schema.pattern);
  if (typeof v === "number") {
    if ("minimum" in schema && v < schema.minimum) out.push(at + ": " + v + " < " + schema.minimum);
    if ("maximum" in schema && v > schema.maximum) out.push(at + ": " + v + " > " + schema.maximum);
  }
  if (Array.isArray(v)) {
    if ("minItems" in schema && v.length < schema.minItems) out.push(at + ": елементів менше " + schema.minItems);
    if ("maxItems" in schema && v.length > schema.maxItems) out.push(at + ": елементів більше " + schema.maxItems);
    if (schema.items) v.forEach(function (x, i) { validate(x, schema.items, root, at + "[" + i + "]", out); });
  }
  if (schema.oneOf) {
    var ok = schema.oneOf.filter(function (s) { var o = []; validate(v, s, root, at, o); return !o.length; }).length;
    if (ok !== 1) out.push(at + ": не відповідає жодному з варіантів (або кільком)" + (ok === 0 ? ": " + describeOneOf(v, schema.oneOf, root, at) : ""));
  }
  if (typeOf(v) === "object") {
    (schema.required || []).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(v, k)) out.push(at + ": немає поля " + k); });
    var props = schema.properties || {};
    Object.keys(v).forEach(function (k) {
      if (props[k]) validate(v[k], props[k], root, at + "." + k, out);
      else if (schema.additionalProperties === false) out.push(at + ": зайве поле " + k);
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") validate(v[k], schema.additionalProperties, root, at + "." + k, out);
    });
  }
}
/* Для oneOf показуємо помилки варіанта, що збігається за типом */
function describeOneOf(v, variants, root, at) {
  var pick = variants.filter(function (s) { return !s.type || isType(v, s.type); })[0] || variants[0];
  var o = []; validate(v, pick, root, at, o);
  return o.slice(0, 2).join("; ") || "невідома причина";
}

/* унікальність id у масивах об'єктів (на будь-якій глибині) */
function uniqueIds(v, at, out) {
  if (Array.isArray(v)) {
    var seen = {};
    v.forEach(function (x, i) {
      if (x && typeof x === "object" && !Array.isArray(x) && typeof x.id === "string") {
        if (seen[x.id]) out.push(at + "[" + i + "]: id «" + x.id + "» повторюється");
        seen[x.id] = true;
      }
      uniqueIds(x, at + "[" + i + "]", out);
    });
  } else if (v && typeof v === "object") {
    Object.keys(v).forEach(function (k) { uniqueIds(v[k], at + "." + k, out); });
  }
}

function walk(dir, ext, acc) {
  if (!fs.existsSync(dir)) return acc;
  fs.readdirSync(dir).forEach(function (n) {
    var p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, ext, acc);
    else if (n.slice(-ext.length) === ext) acc.push(p);
  });
  return acc;
}
function readJSON(file, label) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { errors.push(label + ": " + e.message); return undefined; }
}
function loadSchema(file, label) {
  if (!fs.existsSync(file)) { errors.push(label + ": немає схеми " + path.relative(ROOT, file)); return null; }
  return readJSON(file, path.relative(ROOT, file));
}
function check(file, schemaFile, needFormat) {
  var label = path.relative(ROOT, file);
  var data = readJSON(file, label);
  if (data === undefined) return;
  var schema = loadSchema(schemaFile, label);
  if (!schema) return;
  var out = [];
  if (needFormat && data.format !== 1) out.push("$: \"format\" має бути 1");
  validate(data, schema, schema, "$", out);
  uniqueIds(data, "$", out);
  out.forEach(function (m) { errors.push(label + " " + m); });
  checked++;
}

walk(path.join(ROOT, "content"), ".json", []).forEach(function (file) {
  var data = readJSON(file, path.relative(ROOT, file));
  if (data === undefined) return;
  if (typeof data.$schema !== "string") { errors.push(path.relative(ROOT, file) + ": немає поля \"$schema\""); return; }
  check(file, path.resolve(path.dirname(file), data.$schema), true);
});
check(path.join(ROOT, "catalog.json"), path.join(ROOT, "schemas", "catalog.schema.json"), true);
walk(path.join(ROOT, "i18n"), ".json", []).forEach(function (file) { check(file, path.join(ROOT, "schemas", "i18n.schema.json"), false); });

if (errors.length) { console.error(errors.join("\n")); console.error("\nПомилок: " + errors.length); process.exit(1); }
console.log("OK: " + checked + " файлів відповідають схемам");
