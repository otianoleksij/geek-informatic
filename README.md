# Geek Informatic

Інтерактивні вебквести, ігри та ребуси з інформатики для уроків (1–11 класи), українською й англійською. Статичний сайт для GitHub Pages: без npm і бекенду, лише HTML, CSS і JavaScript (ES5). Node.js потрібен тільки для інструментів у `tools/`.

Живий сайт: https://otianoleksij.github.io/geek-informatic/

Правила побудови (шари, словники, шаблони, hreflang, sitemap): [`docs/architecture.md`](docs/architecture.md). Читай перед новою активністю чи мовою.

## Активності

| Назва | Тип | Класи | Мови | Сторінка | Код і дані |
|---|---|---|---|---|---|
| Агенти КіберЩиту | вебквест, 8 місій | 6 | uk, en | `web-quests/agenty-kibershchytu/` | `activities/agenty-kibershchytu/`, місії `content/agenty-kibershchytu/<мова>.json` |
| Код Галактики | гра, блоки Blockly, 15 рівнів | 7 | uk, en | `games/kod-galaktyky/` | `activities/kod-galaktyky/`, рівні `content/kod-galaktyky/levels.json` |
| Я керую роботом! | гра, стрілки й повтори, 10 рівнів | 3–4 | uk, en | `games/robot/` | `activities/robot/`, рівні `content/robot/levels.json` |
| Марсохід у лабіринті | гра, алгоритм правої руки | 6–7 | uk, en | `games/mars/` | `activities/mars/`; лабіринт генерується із зерна |
| 100 ребусів з інформатики | ребуси | 1–11 | uk | `puzzles/rebusy/` | `activities/rebusy/`, ребуси `content/rebusy/uk.json` |

Англійські сторінки лежать під `en/` з тим самим шляхом (`en/games/robot/`). Ядро (`*-core.js`) не залежить від DOM і працює і в браузері, і в Node, тому його використовують валідатори з `tools/`.

## Структура репозиторію

```
catalog.json                       реєстр: taxonomy, pages (сайтові сторінки), activities, lastmod для sitemap
index.html, en/index.html          ЗГЕНЕРОВАНО: головна (картки й фільтри з catalog.json)
privacy/, teachers/, en/…          ЗГЕНЕРОВАНО: сторінки «Приватність» і «Для вчителів»
games/, puzzles/, web-quests/, en/ ЗГЕНЕРОВАНО: сторінки активностей (index.html)
404.html, sitemap.xml              ЗГЕНЕРОВАНО (build-pages)
templates/
  activity.html                    оболонка сторінки активності (head, шапка, підвал, скрипти)
  page.html                        оболонка сайтових сторінок
  404.html                         шаблон 404 (обидві мови в одному файлі)
  icons.json                       іконки для фактів на картках (внутрішність SVG 24x24)
activities/<id>/                   page.html (тіло з {{ключами}}), <id>.css, *-core.js, app.js,
                                   card.svg (малюнок картки), favicon.svg (необов'язково)
pages/<id>/                        page.html, <id>.css, <id>.js сайтових сторінок (home, privacy, teachers)
content/<id>/*.json                контент: рівні, ребуси, місії ("$schema" + "format": 1)
i18n/<uk|en>/<namespace>.json      рядки: common, home, privacy, teachers, notfound і по одному на активність
schemas/                           JSON Schema для content/, catalog.json, i18n/
assets/
  css/                             tokens.css (палітра, світла й темна теми), base.css, doc.css (текстові сторінки)
  js/                              storage.js, i18n.js, data.js, catalog-filter.js (фільтри й прогрес), site.js (рік у підвалі)
  fonts/                           fonts.css і woff2 (кирилиця й латиниця), OFL.txt
  og/ , og/en/                     PNG 1200x630 для соцмереж (uk і en)
vendor/                            Blockly та плагін клавіатури, див. vendor/README.md
tools/                             build-pages.js, check-*.js, og/make.py
.github/workflows/check.yml        CI: усі валідатори й build-pages --check
```

Згенеровані файли **комітяться** (GitHub Pages збірку не запускає) і не правляться вручну.

## Генерація сторінок

```
node tools/build-pages.js           записати всі сторінки, 404.html і sitemap.xml
node tools/build-pages.js --check   нічого не писати; код 1, якщо закомічене застаріло
```

Після будь-якої правки шаблонів, `page.html`, словників, `catalog.json` чи малюнків карток: `build-pages`, потім `build-pages --check`. Зміни лише в `content/*.json` збірки не потребують: рушій читає їх через `fetch()`.

## Запуск локально

У корені репозиторію: `python3 -m http.server`, далі http://localhost:8000/. Сторінки з `fetch()` (усі активності) не працюють з `file://`.

## Перевірка

CI (`.github/workflows/check.yml`) на кожен push і pull request запускає все нижче. Локально: `for f in tools/check-*.js; do node $f; done && node tools/build-pages.js --check`.

| Команда | Що перевіряє |
|---|---|
| `node tools/build-pages.js --check` | закомічені сторінки, `404.html` і `sitemap.xml` збігаються з тим, що згенерували б шаблони, словники й каталог |
| `node tools/check-i18n.js` | однакові ключі, плейсхолдери й форми множини в `i18n/uk` і `i18n/en`; немає кириличних рядків у `activities/**/*.js`, `pages/**/*.js`, `catalog-filter.js`; кожен `t("…")` і `{{…}}` існує у словнику |
| `node tools/check-schemas.js` | `content/**/*.json`, `catalog.json` і `i18n/**/*.json` відповідають схемам; унікальні `id` |
| `node tools/check-catalog.js` | каталог (типи, теми, класи, `locales`, `scripts`, `card`), помилки збірки, картки на головній обох мов (`data-*`, `href`, `hreflang="uk"` для сторінок без перекладу), кожна сторінка кожної мови (`lang`, `canonical`, `hreflang`, `og:locale`, один `h1`, `main`, перемикач мови), sitemap, наявність `og`-файлів, відсутність битих внутрішніх посилань |
| `node tools/check-robot.js` | 10 рівнів робота: унікальні `id`, тексти uk і en, один старт, є кристали, розв'язок виграє, `par` і `maxBlocks` |
| `node tools/check-galaxy.js` | 15 рівнів «Коду Галактики»: карта, `allowed`/`limits`, розв'язок виграє, `par`, `maxBlocks`, мінімальна вартість програми |
| `node tools/check-rebuses.js` | 100 ребусів (по 25 у групах): унікальні `id` і відповіді, відповідь збігається з `parts`, підказка не містить кореня відповіді |
| `node tools/check-mars.js` | генератор лабіринтів (500 зерен): симетрія, досяжність, детермінованість, правило правої й лівої руки проходить усі, наївна програма ні |
| `node tools/check-kiber.js` | 8 місій «КіберЩиту» (`content/agenty-kibershchytu/`): структура, завдання, бали, секретне слово |

Кожна команда завершується кодом 0 і рядком `OK`, або виводить помилки й завершується з кодом 1.

## Як додати рівень, ребус, місію

Це лише правка JSON: `$schema` першим полем, `"format": 1` другим, стабільний `id` (за ним зберігається прогрес і будується `#id`), тексти `{"uk": "…", "en": "…"}`. Порядок задає позиція в масиві. Після правки: `node tools/check-schemas.js` і `node tools/check-<id>.js`.

- **Робот** (`content/robot/levels.json`): `id`, `title`, `tip`, `map` (`S` старт, `G` кристал, `#` камінь, `.` порожньо), `maxBlocks`, `par`, `loops`, `solution` (`"R"`, `"L"`, `"U"`, `"D"` і повтори `{rep:N, body:[…]}`, N від 2 до 5).
- **Код Галактики** (`content/kod-galaktyky/levels.json`): `id`, `title`, `story`, `tip`, `size` (6..9), `map` (`S`, `*` кристал, `#` астероїд, `.`), `start.dir`, `maxBlocks`, `par`, `allowed`, `limits`, `solution`.
- **Ребуси** (`content/rebusy/uk.json`): `id` (`r001`…), група `"1-4"`…`"10-11"`, `answer`, `hint`, `parts` (2–4 частини: `{t}`, `{pic, w}` або `{num, w}` з операціями `rev`, `keep`, `rep`, `l`, `r`). Відповіді не повторюються.
- **Місії КіберЩиту** (`content/agenty-kibershchytu/<мова>.json` і `scenes/<мова>/`; секретне слово й приклади адаптовано окремо для кожної мови): структура описана в `schemas/quest.schema.json`; `node tools/check-kiber.js`.
- **Марсохід**: рівнів немає, лабіринт щоразу генерується із зерна (`MarsCore.generate`).

Кількість рівнів і ребусів жорстко задана валідаторами (10, 15, 100): змінюєш кількість, то онови перевірку й тексти (`card.<id>.f*` у `i18n/*/home.json`, `description` у `catalog.json`).

## Як додати переклад

1. Мова має бути в `LANGS` (`tools/build-pages.js`) і в `enum` поля `locales` у `schemas/catalog.schema.json`. Для нової мови додай `OG_LOCALE` і вибір шрифта (`fontFile`) у `build-pages.js`, форми множини в `check-i18n.js`.
2. Скопіюй `i18n/uk/<namespace>.json` у `i18n/<мова>/` для `common`, `home`, `privacy`, `teachers`, `notfound` і для кожної активності, яку перекладаєш; переклади ключі, а `{плейсхолдери}` лиши. Множина: об'єкт із формами `Intl.PluralRules` цієї мови.
3. У `catalog.json` додай мову в `locales` активності (з `title.<мова>` і `description.<мова>`) і сайтових сторінок (`pages`). Для контенту з текстами `{uk, en}` додай переклад у `content/<id>/*.json`.
4. Картинки для соцмереж: додай тексти в `PAGES` у `tools/og/make.py` і запусти `python3 tools/og/make.py --lang <мова>` (вони лягають у `assets/og/<мова>/`; без файлу сторінка бере українську).
5. `node tools/build-pages.js`, потім усі `check-*.js`.

Без перекладу активність лишається доступною українською: на англійській головній її картка веде на українську сторінку з позначкою «Ukrainian only», а перемикач мови на ній веде на головну англійською.

## Як додати нову активність

1. `catalog.json`: запис в `activities` (`id`, `type`, `path`, `title`, `description` для кожної мови з `locales`, `locales`, `grades`, `topics`, `difficulty`, `duration`, `og`, `scripts`, `card`; необов'язково `skin`, `themeColor`, `vendorScripts`, `favicon`, `namespace`). Поля описані в `schemas/catalog.schema.json`.
2. `activities/<id>/`: `page.html`, `<id>.css`, код, `card.svg` (малюнок картки 120x120), за потреби `favicon.svg`.
3. Словники: `i18n/<мова>/<id>.json` для кожної мови зі `locales` і ключі картки в `i18n/<мова>/home.json`: `card.<id>.subject`, `blurb`, `f1`…`fN` (за числом `card.facts`), `cta`, `note` (якщо `card.note`), а також `do.<id>` в `i18n/<мова>/teachers.json`.
4. Контент у `content/<id>/` і схема в `schemas/`, валідатор `tools/check-<id>.js` (додається до CI автоматично за маскою `check-*.js`).
5. Картинка для соцмереж: рядок у `PAGES` у `tools/og/make.py`, `python3 tools/og/make.py <id>`.
6. `node tools/build-pages.js` і усі перевірки. Головна, `404.html`, `sitemap.xml` і таблиця на сторінці вчителів оновляться самі.

Прогрес зберігай через `GIStorage` (`GIStorage.load(id)` / `save(id, дані)` / `remove(id)`), а після змін викликай `GIStorage.setSummary(id, пройдено, усього)`, щоб на картці з'явилася смужка прогресу.

## Приватність

- Прогрес зберігається лише в `localStorage` браузера учня через `GIStorage`. Ключі мають вигляд `gi:<id>`, де `id` дорівнює id активності (`agenty-kibershchytu`, `kod-galaktyky`, `robot:v2`, `mars`, `rebusy`); у «Робота» прогрес зберігається за id рівня, старий `robot:v1` переноситься автоматично. Старі ключі (`kiberquest-v3`, `geek-galaxy-v2`, `geek-robot-v1`, `geek-mars-v1`, `geek-rebus-solved-v1`) під час першого читання переносяться в нові й видаляються. Ключ `gi:progress` містить короткий підсумок «пройдено / усього» для головної. Сервера й облікових записів немає.
- На сторінці `privacy/` є кнопка «Очистити мої дані на цьому пристрої»: після `confirm()` вона викликає `GIStorage.clearAll()` (видаляє всі ключі `gi:*` і старі ключі) та показує, скільки записів видалено. Без JS кнопка прихована, а текст пояснює, як очистити дані сайту в налаштуваннях браузера.
- «Агенти КіберЩиту» просять ім'я та клас для посвідчення, але вони живуть лише в пам'яті сторінки, у `localStorage` не записуються (під час збереження поля `name` і `cls` виключаються) і нікуди не надсилаються. Після перезавантаження їх треба ввести знову.
- Аналітики й трекерів у коді немає. Сайт не робить запитів на сторонні сервери: Blockly лежить у `vendor/`, шрифти (Nunito, Unbounded, Caveat, JetBrains Mono, ліцензія SIL OFL) у `assets/fonts/`.

## Каталог і фільтри

Картки на головній **генеруються** з `catalog.json` (`activities[].card`, тексти в `i18n/<мова>/home.json`, малюнок `activities/<id>/card.svg`). `assets/js/catalog-filter.js` будує фільтри за атрибутами `data-id`, `data-type`, `data-grades`, `data-topics`, `data-difficulty` і малює прогрес із `GIStorage`; його рядки беруться з `t("home.*")`. Підписи фільтрів лежать у `i18n/<мова>/home.json` (`filter.type.*`, `filter.topic.*`, `filter.level.*`). Стан фільтрів в адресі: `?grade=7&type=game&topic=loops&level=2` (`level` — складність 1–3).

## Прямі посилання

- Робот: `games/robot/#<id рівня>` (наприклад `#loop-magic`); `#level-N` теж працює. Код Галактики: `games/kod-galaktyky/#<id>` (`#perimeter`), `#level-N` теж.
- Ребуси: `puzzles/rebusy/#r017`.
- Марсохід: `games/mars/#maze-<число>` — лабіринт із цим зерном.
- КіберЩит: місії відкриваються лише по черзі.
- Головна: `?grade=7`. Для англійської додай `en/` після `geek-informatic/`.
- Усе це описано для вчителів на сторінці `teachers/`.

## SEO

- Кожна сторінка має `<title>`, `description`, `canonical` (абсолютний, з кінцевим `/`), `hreflang` для мов зі `locales` і `x-default` → uk, Open Graph (`og:image` — `assets/og/<slug>.png` або `assets/og/en/<slug>.png` для англійської, 1200x630, до 200 КБ), `twitter:card` і JSON-LD (`WebSite` + `ItemList` на головній, `WebPage` на сайтових сторінках, `LearningResource` на активностях).
- `sitemap.xml` генерується `build-pages` з каталогу: адреса кожної сторінки кожної мови, `xhtml:link` для мов, `lastmod` береться з `catalog.json` (`lastmod`; змінюй його вручну, коли публікуєш суттєві зміни).
- Картинки для соцмереж генерує `tools/og/make.py` із `tools/og/tpl.html` через Chrome headless (macOS): `python3 tools/og/make.py [--lang en] [slug…]`.
- `robots.txt` не створюється: для project page пошукові системи читають його лише з кореня домену. Sitemap подай у Google Search Console вручну (`sitemap.xml`).
- `404.html` віддається GitHub Pages для будь-якого неіснуючого шляху, тому всі шляхи в ньому абсолютні (`/geek-informatic/…`). Це один файл: текст українською, а невеликий скрипт для адрес під `/geek-informatic/en/` перемикає тексти, посилання й `lang` на англійську.

## Публікація на GitHub Pages

1. Запуш репозиторій `geek-informatic` на GitHub.
2. Settings -> Pages -> Source: **Deploy from a branch**, гілка `main`, папка `/ (root)`.
3. Сайт буде за адресою `https://<логін>.github.io/geek-informatic/`.
