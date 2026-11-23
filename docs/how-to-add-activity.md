# Як додати активність

Посібник для розробника. Він описує **порядок дій** і пояснює кожне поле. Правила, за якими влаштовано шари, словники та шаблони, зафіксовані в [`architecture.md`](architecture.md) (це головна специфікація). Як додати лише завдання до наявної гри (рівень, ребус, місію): [`how-to-add-content.md`](how-to-add-content.md).

Порядок у цьому посібнику перевірено на пробній активності `probe` у копії репозиторію: після всіх кроків `check-schemas`, `check-i18n`, `check-catalog`, `check-probe` і `build-pages --check` пройшли, а сторінка `games/probe/` у браузері завантажила рівні, зберегла прогрес у `gi:probe:v1` і оновила підсумок на головній.

## 0. Що виходить в результаті

| Шар | Файли | Кроки |
|---|---|---|
| Рушій | `activities/<id>/page.html`, `<id>.css`, `<id>-core.js`, `app.js`, `card.svg` | 2 |
| Словники | `i18n/<lang>/<id>.json`, ключі картки в `home.json`, ключі в `teachers.json` | 3 |
| Контент і схема | `content/<id>/*.json`, `schemas/<id>-….schema.json` | 4 |
| Реєстр | запис в `catalog.json` | 1 |
| Валідатор | `tools/check-<id>.js` | 5 |
| Картинка для соцмереж | `assets/og/<slug>.png` (+ `assets/og/en/`) | 6 |
| Згенеровані сторінки | `games/<id>/index.html`, `en/…`, головна, sitemap | 7 (автоматично) |

## 1. Порядок роботи

1. **Придумайте `id`**: латиниця малими літерами через дефіс (`kebab-case`), наприклад `probe` або `binary-code`. Він стане назвою теки `activities/<id>/`, простору імен словника, ключа сховища та частиною картки на головній. Потім його не міняють.
2. **Запис у `catalog.json`** (розділ 2).
3. **Файли рушія** `activities/<id>/` (розділ 3).
4. **Словники** (розділ 4).
5. **Контент і схема** (розділ 5).
6. **Валідатор** (розділ 6).
7. **Картинка для соцмереж** (розділ 7).
8. `node tools/build-pages.js`, потім усі перевірки (розділ 11).

Підказка: `node tools/build-pages.js` після кожного кроку показує, чого бракує. Він повідомляє про відсутній файл чи ключ по одній помилці на сторінку, тож запускайте його кілька разів поспіль. У пробному запуску порядок повідомлень був такий: `немає activities/<id>/card.svg`, `немає ключа teachers.do.<id>`, `немає ключа home.card.<id>.f1`, `немає файлу i18n/uk/<id>.json`.

## 2. `catalog.json`: запис активності

Додайте об'єкт у масив `activities`. Опис формату: `schemas/catalog.schema.json`.

```json
{
  "id": "probe",
  "type": "game",
  "path": "games/probe/",
  "title": {"uk": "Проба", "en": "Probe"},
  "description": {"uk": "Тестова активність для перевірки інструкції.", "en": "A test activity for checking the guide."},
  "locales": ["uk", "en"],
  "scripts": ["probe-core.js", "app.js"],
  "grades": [5],
  "topics": ["algorithms"],
  "difficulty": 1,
  "duration": 5,
  "og": "assets/og/probe.png",
  "count": {"file": "content/probe/levels.json", "path": "levels"},
  "card": {"cover": 1, "facts": ["levels", "star"]}
}
```

Реальні приклади: активність `robot` (звичайна шапка), `mars` (`skin: space` і `vendorScripts`), `agenty-kibershchytu` (`skin: own`).

| Поле | Обов'язкове | Значення |
|---|---|---|
| `id` | так | kebab-case. Назва теки в `activities/`, `content/`, простір імен словника (якщо немає `namespace`), id в `GIStorage`, `data-id` картки. |
| `type` | так | Один зі `taxonomy.types`: `webquest`, `game`, `puzzle` (уже мають підписи) або `trainer`, `event`, `lab` (підписів ще немає). Визначає розділ головної. Для типу без підписів потрібні рядки `home.filter.type.<тип>`, `home.section.<тип>.title` і `home.section.<тип>.hint` в обох мовах: без них збірка скаже `немає ключа home.filter.type.trainer`. |
| `path` | так | Шлях сторінки, обов'язково із завершальним `/`: `games/<id>/`, `puzzles/<id>/`, `web-quests/<id>/`. Англійська версія автоматично лежить в `en/<path>`. Теку за `type` обирають за домовленістю. Адреси можна змінювати без редиректів (сайт на ранньому етапі), але sitemap і посилання всередині генеруються самі. |
| `title`, `description` | так | Об'єкти `{uk, en}`: заголовок сторінки й `<meta description>`. Для кожної мови зі `locales` обов'язково. |
| `locales` | так | Мови сторінки: `uk` (обов'язково, це основна мова й `x-default`) і за потреби `en`. Для мови, якої немає, на англійській головній картка веде на українську сторінку з позначкою «Ukrainian only». |
| `scripts` | так | Власні скрипти з `activities/<id>/`, у порядку підключення (ядро перед `app.js`). Збірка сама додає `assets/js/storage.js`, `i18n.js`, `data.js` **перед** ними, їх вказувати не треба. |
| `vendorScripts` | ні | Сторонні скрипти від кореня сайту, `{lang}` підставляється мовою сторінки (так підключено Blockly із `vendor/`). Якщо поле є, усі скрипти сторінки йдуть з `defer`. Зовнішніх CDN не можна: усе лежить у репозиторії. |
| `skin` | ні | Без поля: шаблон малює шапку, підвал і підключає `tokens.css` та `base.css`. `own`: власні шапка й підвал у `page.html`, без стилів шаблону (КіберЩит). `space`: те саме плюс темна космічна тема (Код Галактики, Марсохід). |
| `themeColor` | ні | `#RRGGBB` для `<meta name="theme-color">` (типово `#EEF3FA`). |
| `namespace` | ні | Назва словника, якщо відрізняється від `id` (файл `i18n/<lang>/<namespace>.json`). |
| `favicon` | ні | SVG-файл у `activities/<id>/`. Без поля використовується загальна іконка сайту. |
| `grades` | так | Класи 1–11, за зростанням, без повторів: `[3, 4]`. |
| `topics` | так | Теми з `taxonomy.topics` (зараз `safety`, `algorithms`, `loops`, `conditions`, `blocks`, `vocabulary`, `logic`). Нова тема потребує `home.filter.topic.<тема>` і `common.topic.<тема>` в обох мовах (їх бере JSON-LD). |
| `difficulty` | так | 1, 2 або 3 (складність у фільтрі). |
| `duration` | так | Орієнтовна тривалість у хвилинах (таблиця на сторінці «Для вчителів»). |
| `og` | так | `assets/og/<slug>.png` (українська картинка). Файл має існувати. Для англійської береться `assets/og/en/<slug>.png`, а якщо його немає, українська. |
| `count` | ні | Звідки брати кількість елементів, щоб не писати «10 рівнів» руками: `{"file": "content/robot/levels.json", "path": "levels"}`. `file` може містити `{lang}` (набір на мову: `content/rebusy/{lang}.json`; якщо файла мови немає, береться український), `path` це шлях через крапку до масиву. Далі в будь-якому рядку словника чи в `title`/`description` каталогу пишіть токени `{count.<id>}` (число) і `{count.<id>\|форма\|форма…}` (слово в потрібній формі множини), див. розділ 4. |
| `card` | так | Картка на головній: `cover` (1–5, колір обкладинки: клас `b<N>` у `pages/home/home.css`), `facts` (до 4 імен іконок із `templates/icons.json`: `list`, `stopwatch`, `shield`, `blocks`, `plus`, `nested`, `levels`, `loop`, `star`, `branch`, `maze`, `bulb`), `note: true` (якщо є дрібна підказка поруч із кнопкою). Картинка картки: `activities/<id>/card.svg`. |

Також у цьому файлі є поле `lastmod`: дату для `<lastmod>` у sitemap оновлюйте вручну, коли публікуєте суттєві зміни.

## 3. `activities/<id>/`

```
activities/probe/
  page.html        тіло сторінки з ключами {{probe.key}}; без <html>/<head>
  probe.css        стилі (ім'я файла = <id>.css, підключається автоматично)
  probe-core.js    логіка без DOM (UMD: працює в браузері й у Node)
  app.js           інтерфейс (ES5, без кириличних рядків)
  card.svg         малюнок картки 120x120 (inline SVG)
```

Зразки: `activities/rebusy/` (проста активність), `activities/robot/`.

### `page.html`

Лише вміст `<main>`: шапку, підвал, `<head>` і скрипти додає шаблон `templates/activity.html`. Усі тексти беруться як `{{<ns>.<ключ>}}` зі словника (екрануються), навіть в атрибутах (`aria-label="{{probe.board}}"`). Окремий рядок `{{<ns>.footer}}` обов'язковий: шаблон підставляє його в підвал. Кожен ключ має існувати в **усіх** мовах активності. Блок `#loadError` для помилки завантаження JSON уже є в шаблоні: `GIData.loadJSON` сам покаже в ньому `common.loadError`.

Для `skin: own` і `space` шаблон нічого не малює, тож у `page.html` потрібні власні шапка й підвал (див. `activities/mars/page.html`).

### `<id>-core.js`

Логіка без звернення до DOM, у такій обгортці (ES5):

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ProbeCore = factory();
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";
  function countDone(levels, doneIds) { /* … */ }
  return { countDone: countDone };
});
```

Це дає змогу `tools/check-<id>.js` підключити те саме ядро й перевірити контент тією ж логікою, що й браузер (так зроблено `robot-core.js`, `galaxy-core.js`, `rebus-core.js`, `quest-core.js`, `mars-core.js`). Діагностичні повідомлення помилок у ядрі можуть бути англійською.

### `app.js`

- **ES5**: `var`, `function`, без `=>`, `let/const`, шаблонних рядків. Код працює в старих браузерах шкільних комп'ютерів.
- **Жодних кириличних рядкових літералів у коді.** Усі тексти беруться через `t("<ns>.<ключ>")` і `t("<ns>.<ключ>", {count: n})`. Кириличні коментарі дозволені. `check-i18n.js` падає з повідомленням `activities/probe/app.js:4: кириличний рядок у коді: «Привіт» (винеси в i18n)`.
- Множину задають об'єктом форм у словнику (див. нижче), а не складанням фрази з частин.
- Контент завантажується так: `GIData.loadJSON(ROOT + "content/<id>/levels.json").then(…)`, де `var ROOT = document.documentElement.getAttribute("data-root") || ""`. Для текстів `{uk, en}` використовуйте `GIData.pick(obj)`. Мова сторінки: `GII18n.lang`.
- Динамічний текст вставляйте через `textContent`. Розмітку `**жирний**` в `innerHTML` не кладіть: є `GII18n.md(str)` (повертає `DocumentFragment`).
- **Жодних зовнішніх запитів**: ні CDN, ні шрифтів, ні аналітики, ні `fetch` на чужі адреси. Шрифти й Blockly лежать у `assets/fonts/` і `vendor/`.
- Доступність: кнопки з текстом чи `aria-label`, повне керування з клавіатури, повага до `prefers-reduced-motion`.

### Збереження прогресу (`GIStorage`)

`assets/js/storage.js` підключається автоматично. Ключі мають префікс `gi:`, ви його не вказуєте.

```js
var STORE_ID = "probe:v1", SLUG = "probe";
var saved = window.GIStorage ? GIStorage.load(STORE_ID) : null;   // null, якщо немає або localStorage недоступний
GIStorage.save(STORE_ID, {v: 1, done: ["first", "second"]});       // зберегти (JSON)
GIStorage.setSummary(SLUG, done, total);                           // смужка прогресу на картці головної
GIStorage.remove(STORE_ID);                                        // «Скинути прогрес»
```

Правила:

- **Зберігайте id, а не номери.** Прогрес `{done: ["first", "second"]}`, а не `{done: [0, 1]}`. Порядок завдань змінюють, id лишається.
- **Ключ сховища дорівнює id активності, а не мові**: `gi:robot:v2`. Виняток: контент, що відрізняється між мовами, як ребуси (`gi:rebusy:uk:v1`).
- **Версія в ключі** (`:v1`). Якщо формат даних змінюється несумісно, піднімайте версію й пишіть міграцію: прочитайте старий ключ, перенесіть дані в новий, видаліть старий. Зразки: `activities/robot/app.js` (`robot:v1` → `robot:v2`, номери рівнів → id), `activities/rebusy/app.js` (старий `geek-rebus-solved-v1`). Другий параметр `GIStorage.load(id, legacyKey)` переносить старий «сирий» ключ автоматично.
- Додавайте `{v: 1, …}` у вміст, щоб міграцію можна було робити всередині.
- **Ніколи не зберігайте імена, класи, e-mail та інші персональні дані учнів.** Приклад: КіберЩит просить ім'я та клас для посвідчення, але вони лише в пам'яті сторінки й виключаються під час збереження (`Core.publicState`).
- Усі звернення до сховища обгортайте в `try/catch` або перевіряйте `window.GIStorage` (приватний режим, заблоковане сховище): гра має працювати без збереження. `GIStorage` сам мовчки ігнорує помилки.
- Нові дані треба додати на сторінку «Приватність» (це **ручний** крок: `check-catalog` лише попереджає `УВАГА <id>: активність зберігає прогрес (GIStorage.save), але в i18n/uk/privacy.json не знайдено її назви`, якщо назви активності немає в `privacy.json`): у `pages/privacy/page.html` додайте рядок `<li>{{rich:ns.progress.N}}</li>`, а в `i18n/<lang>/privacy.json` ключ `progress.N` (що саме запам'ятовує активність). Також оновіть розділ «Приватність» у `README.md`.

### Прямі посилання (hash)

- Рівні, завдання, ребуси адресуються за `id`: `games/robot/#turn`, `puzzles/rebusy/#r017`. Не за номером.
- Старі адреси за номером (`#level-N`) підтримуються лише там, де вони існували; для нових активностей їх не додавайте.
- Читайте hash при завантаженні (після того, як JSON завантажено) і слухайте `hashchange`. Некоректний hash очищайте через `history.replaceState`, а не залишайте в адресі. Зразок: функції `parseRoute`, `route`, `navigate` в `activities/robot/app.js`.
- Посилання повинно відкривати рівень навіть тоді, коли попередні ще не пройдені (це використовують вчителі).
- Якщо в активності є лабіринт чи інший випадковий вміст, виносьте «зерно» в hash (як `#maze-<число>` у Марсоході).
- Додайте рядок про прямі посилання в `teachers.json` (`links.<id>`) і в `pages/teachers/page.html` (див. розділ 4).

### `<id>.css`

Файл підключається автоматично (`activities/<id>/<id>.css`). Для звичайної активності використовуйте змінні палітри з `assets/css/tokens.css` (`var(--…)`): тоді працюють світла й темна теми. Додаткові токени активності додавайте в `:root` у своєму CSS і переозначайте для темної теми під `@media (prefers-color-scheme: dark)` (`:root:not([data-theme="light"])`) і `:root[data-theme="dark"]` (зразок на початку `activities/robot/robot.css`).

### `card.svg`

Інлайн-SVG картки: `viewBox="0 0 120 120"`, `aria-hidden="true"`, без зовнішніх посилань. Зразок: `activities/robot/card.svg`. Збірка вставляє вміст у картку на головній сторінці.

## 4. Словники (`i18n/<lang>/`)

Правила повністю в [`architecture.md`](architecture.md), розділ 3.

1. **`i18n/<lang>/<id>.json`** для кожної мови зі `locales`. Ключі пласкі, без префікса простору імен всередині файлу. Обов'язковий ключ `footer` (текст підвалу, дрібними літерами), решта за вашим кодом і `page.html`:

   ```json
   {
     "eyebrow": "Тест · інструкція",
     "title": "Проба",
     "lead": "Тестова активність для перевірки інструкції.",
     "footer": "проба",
     "done": "Пройдено",
     "progress": "Пройдено: {count} з {total}"
   }
   ```

   Плейсхолдери `{name}` мають збігатися в усіх мовах. Множина: `{"one": "…", "few": "…", "many": "…", "other": "…"}` для української, `{"one", "other"}` для англійської. Фрази не склеюйте з кусків. HTML заборонений, дозволена лише `**жирна**` міні-розмітка.

2. **Картка на головній**: у `i18n/<lang>/home.json` ключі `card.<id>.subject`, `card.<id>.blurb`, `card.<id>.f1`…`fN` (N = кількість `card.facts`), `card.<id>.cta` і `card.<id>.note` (якщо `card.note: true`). Приклад: `card.robot.*`.

3. **Сторінка вчителів**: `check-catalog` перелічує одразу всі відсутні `card.<id>.*` і `do.<id>` (`немає ключа do.probe в i18n/en/teachers.json (таблиця «Для вчителів»)`). Рядки `links.<ключ>` і `<li>` з ними в `pages/teachers/page.html` та `progress.N` у `pages/privacy/page.html` написані по активностях вручну й автоматично не звіряються: пам'ятайте про них. Ключ `do.<id>` в `i18n/<lang>/teachers.json` описує, що роблять учні (таблиця активностей). Якщо активність має посилання на рівні, додайте `links.<id>` і рядок `<li>{{rich:ns.links.<id>}}</li>` у `pages/teachers/page.html`.

4. **Кількості в текстах.** Якщо активність має список елементів (рівні, ребуси, місії), оголосіть `count` у каталозі й пишіть у текстах не число, а токен. Для української це чотири форми в порядку `one|few|many|other`, для англійської дві `one|other`:

   ```json
   "card.probe.f1": "{count.probe} {count.probe|рівень|рівні|рівнів|рівня}"    // 1 рівень, 2 рівні, 5 рівнів, 21 рівень
   "card.probe.f1": "{count.probe} {count.probe|level|levels}"                 // en
   "do.probe": "…на {count.probe} {count.probe|рівні|рівнях|рівнях|рівнях}."    // «на 1 рівні», «на 5 рівнях»
   ```

   Те саме працює в `description` у `catalog.json`. Токени розгортає `build-pages` (помилка збірки, якщо `id` невідомий, немає `count`, або кількість форм не збігається з мовою). `check-i18n` перевіряє, що `{count.<id>}` однаково присутній в усіх мовах. Після зміни кількості елементів у контенті достатньо `node tools/build-pages.js`. Лише PNG для соцмереж (`tools/og/make.py`) містить числа в тексті на картинці: їх оновлюють вручну.

5. **Нова мова** (не нова активність): розділ «Як додати переклад» у `README.md`.

Інструмент `node tools/check-i18n.js` перевіряє: однакові ключі в усіх мовах, однакові плейсхолдери, повні форми множини, відсутність кириличних літералів у `activities/**/*.js`, `pages/**/*.js`, `catalog-filter.js`, і що кожен `t("…")` та `{{…}}` існує у словнику. Типові повідомлення:

```
activities/probe/app.js:4: кириличний рядок у коді: «Привіт» (винеси в i18n)
activities/probe/app.js:20: ключа probe.progres немає в i18n/uk/probe.json
i18n/en/probe.json: немає ключа «progress» (є в uk)
i18n/en/probe.json «progress»: плейсхолдери [{n} {total}] ≠ [{count} {total}] у uk
```

## 5. Контент і схема

Якщо активність має дані (рівні, ребуси), покладіть їх у `content/<id>/<файл>.json`:

```json
{
  "$schema": "../../schemas/probe-levels.schema.json",
  "format": 1,
  "levels": [
    {"id": "first", "title": {"uk": "Перший", "en": "First"}},
    {"id": "second", "title": {"uk": "Другий", "en": "Second"}}
  ]
}
```

- Перше поле `"$schema"`, друге `"format": 1`. `check-schemas.js` бере схему саме з `$schema` і перевіряє `format`.
- Кожен елемент має стабільний `id` (kebab-case). Порядок у масиві задає порядок показу, id задає прогрес і посилання.
- Тексти, прив'язані до рівня, `{"uk": …, "en": …}`; контент, що залежить від мови (ребуси, фішинг у КіберЩиті), робіть окремим набором на мову (`content/<id>/uk.json`, `en.json`).
- Без HTML та коду. Виділення лише `**…**`.

**Схема** `schemas/<id>-….schema.json` (JSON Schema draft-07). Валідатор у `tools/check-schemas.js` власний і мінімальний, підтримує: `type`, `const`, `enum`, `pattern`, `required`, `properties`, `additionalProperties` (`false` чи схема), `items`, `minItems`, `maxItems`, `minimum`, `maximum`, `oneOf` і `$ref` лише на `#/definitions/<ім'я>`. Інші ключові слова (`allOf` тощо) ігноруються. Повний зразок: `schemas/robot-levels.schema.json`; `id` перевіряйте патерном `^[a-z0-9]+(-[a-z0-9]+)*$`. У масивах об'єктів поле `id` має бути унікальним (перевіряється автоматично).

## 6. Валідатор `tools/check-<id>.js`

Файл за маскою `check-*.js` CI підхоплює **автоматично**, нічого реєструвати не треба. Вимоги: Node без залежностей, шлях через `path.join(__dirname, "..", …)`, `require` ядра, `process.exit(1)` при помилках, останній рядок `OK…` при успіху. Шаблон: `tools/check-robot.js` (короткий) і `tools/check-rebuses.js`. Перевіряйте не лише схему, а й правила гри: розв'язність рівнів, унікальність id, відповідність відповіді даним, кількість, наявність текстів на всіх мовах.

Мінімальний приклад (`tools/check-probe.js`):

```js
#!/usr/bin/env node
"use strict";
var fs = require("fs");
var path = require("path");
var Core = require(path.join(__dirname, "..", "activities", "probe", "probe-core.js"));
var doc = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "probe", "levels.json"), "utf8"));
var errors = [], seen = {};
doc.levels.forEach(function (lv, i) {
  var n = (lv.id || "#" + (i + 1)) + " (" + (i + 1) + ")";
  if (seen[lv.id]) errors.push("рівень " + n + ": id не унікальний");
  seen[lv.id] = true;
  ["uk", "en"].forEach(function (l) { if (!lv.title || !lv.title[l]) errors.push("рівень " + n + ": немає title." + l); });
});
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("OK: " + doc.levels.length + " рівнів");
```

## 7. Картинка для соцмереж

1. У `tools/og/make.py` додайте запис у словник `PAGES`: `"<slug>": (колір1, колір2, іконка, {"uk": (заголовок, підзаголовок, бейдж), "en": (…)})`. Іконка це SVG-фрагмент змінної на кшталт `robot`, `planet` у верхній частині файлу.
2. Запустіть `python3 tools/og/make.py <slug>` (або `--lang en`). Потрібні macOS і Google Chrome (headless). Файли лягають у `assets/og/<slug>.png` і `assets/og/en/<slug>.png` (1200×630, до 200 КБ).
3. Шлях має збігатися з полем `og` у каталозі. Без файлу `check-catalog.js` скаже `probe: немає og-файлу assets/og/probe.png`.
4. Англійська картинка необов'язкова: без неї англійська сторінка бере українську.

## 8. Мови

- Українська обов'язкова; англійська за бажанням. Переклад сторінки означає: `en` у `locales`, `title.en` і `description.en` у каталозі, `i18n/en/<id>.json`, `card.<id>.*` та `do.<id>` в `i18n/en/home.json` і `teachers.json`, англійські тексти в контенті.
- Без перекладу активність лишається доступною українською, а на англійській головній показується з позначкою «Ukrainian only».
- Картки на головній з'являються для обох мов і для активностей без перекладу, тому ключі `card.<id>.*` та `do.<id>` потрібні **в усіх мовах сайту** (не лише в мовах активності). Перевірено на активності лише з `uk`: без англійських ключів збірка повідомляє `home/en: немає ключа home.card.<id>.f1` і `teachers/en: немає ключа teachers.do.<id>`, а `check-i18n` скаржиться на кожен ключ.

## 9. Генерація, перевірки, перегляд

```
node tools/build-pages.js            # записати games/<id>/index.html, en/…, головну, 404, sitemap
node tools/build-pages.js --check    # нічого не пише; код 1, якщо закомічене застаріло
python3 -m http.server               # http://localhost:8000/games/<id>/
```

- Згенеровані файли **комітяться** (GitHub Pages збірку не запускає) і вручну не правляться.
- Після будь-якої правки `page.html`, словників, `catalog.json`, `templates/`, `card.svg` запустіть `build-pages`. Зміни лише в `content/*.json` збірки не потребують.
- Типове повідомлення, коли забули: `Застарілі сторінки (запусти node tools/build-pages.js):` і список файлів.
- Сторінка має працювати з `http://localhost:8000/…`, а не з `file://`.

### Content-Security-Policy

Усі сторінки мають `<meta http-equiv="Content-Security-Policy">` (`cspFor()` у `tools/build-pages.js`, деталі в `architecture.md`, §8a): лише `'self'`, без inline-скриптів і без `<style>`. Тому: код і стилі тільки у файлах; жодних `onclick=`/`<script>…</script>`; зовнішні шрифти й CDN не підключати. Якщо активність таки потребує зовнішнього ресурсу, додайте origin у `cspFor()` і обґрунтуйте в PR. Перед здачею відкрийте сторінку в браузері й переконайтеся, що в консолі немає «Refused to …».

## 10. Чек-лист

- [ ] `id` у kebab-case, збігається в `catalog.json`, `activities/<id>/`, `content/<id>/`, словниках.
- [ ] Запис у `catalog.json` повний; `path` закінчується на `/`; `locales` містить `uk`; `title` і `description` на кожну мову; `grades` за зростанням; `type`, `topics`, `difficulty` з `taxonomy`.
- [ ] `activities/<id>/`: `page.html`, `<id>.css`, ядро, `app.js`, `card.svg`; усі файли зі `scripts` існують.
- [ ] У `app.js` і ядрі немає кириличних рядкових літералів, `=>`, `let`/`const`.
- [ ] Словник `<id>.json` для кожної мови, є `footer`; `card.<id>.*` та `do.<id>` в обох мовах; (за потреби) `links.<id>`.
- [ ] Нові тип або тема мають підписи в `home.json` (та `common.topic.*`).
- [ ] Прогрес зберігається через `GIStorage` за id, з версією в ключі; імена учнів не зберігаються; `setSummary` викликається; рядок додано на сторінку «Приватність».
- [ ] Немає запитів на зовнішні сервери, CDN, шрифтів, трекерів.
- [ ] Контент: `$schema`, `format: 1`, унікальні kebab-case `id`; схема в `schemas/`.
- [ ] `tools/check-<id>.js` написано й запущено.
- [ ] Картинка `assets/og/<slug>.png` (і за потреби `assets/og/en/`) створена, `PAGES` у `tools/og/make.py` оновлено.
- [ ] `node tools/build-pages.js`, потім `for f in tools/check-*.js; do node $f; done && node tools/build-pages.js --check`. Усе `OK` (перевірка Галактики займає близько 2 хвилин).
- [ ] Гра відкривається на `http://localhost:8000/games/<id>/`, англійська на `…/en/games/<id>/`; перемикач мови працює; прямі посилання `#id` відкривають потрібний елемент; прогрес переживає перезавантаження; без JS видно текст і `<noscript>`.
- [ ] `README.md` (таблиця активностей) і, за потреби, `docs/architecture.md` оновлено.
- [ ] Закомічено разом із згенерованими файлами: `games/<id>/`, `en/…`, `index.html`, `sitemap.xml`, `teachers/`, `404.html` (усе, що змінила збірка).

## 11. Повний прохід перевірок

```
node tools/build-pages.js
for f in tools/check-*.js; do echo "== $f"; node $f || break; done
node tools/build-pages.js --check
```

CI (`.github/workflows/check.yml`) робить те саме на кожен push і pull request: усі `tools/check-*.js`, потім `build-pages --check`.
