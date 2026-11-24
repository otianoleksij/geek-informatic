# Geek Informatic

Інтерактивні вебквести, ігри та ребуси з інформатики для уроків (1–11 класи), українською й англійською. Статичний сайт для GitHub Pages: без npm і бекенду, лише HTML, CSS і JavaScript (ES5). Node.js потрібен тільки для інструментів у `tools/`.

Живий сайт: https://otianoleksij.github.io/geek-informatic/

Правила побудови (шари, словники, шаблони, hreflang, sitemap): [`docs/architecture.md`](docs/architecture.md). Читай перед новою активністю чи мовою. Як додати завдання: [`docs/how-to-add-content.md`](docs/how-to-add-content.md); як додати активність: [`docs/how-to-add-activity.md`](docs/how-to-add-activity.md).

## Активності

| Назва | Тип | Класи | Мови | Сторінка | Код і дані |
|---|---|---|---|---|---|
| Агенти КіберЩиту | вебквест, 8 місій | 6 | uk, en | `web-quests/agenty-kibershchytu/` | `activities/agenty-kibershchytu/`, місії `content/agenty-kibershchytu/<мова>.json` |
| Код Галактики | гра, блоки Blockly, 15 рівнів | 7 | uk, en | `games/kod-galaktyky/` | `activities/kod-galaktyky/`, рівні `content/kod-galaktyky/levels.json` |
| Я керую роботом! | гра, стрілки й повтори, 10 рівнів | 3–4 | uk, en | `games/robot/` | `activities/robot/`, рівні `content/robot/levels.json` |
| Марсохід у лабіринті | гра, алгоритм правої руки | 6–7 | uk, en | `games/mars/` | `activities/mars/`; лабіринт генерується із зерна |
| Космічний клавіатурний тренажер | гра, друк наосліп, 37 рівнів у 5 етапах | 2–7 | uk, en | `games/klaviatura/` | `activities/klaviatura/`, рівні `content/klaviatura/levels.json` (набори на обидві розкладки), валідатор `tools/check-klaviatura.js` |
| Перегони слів | гра, швидкий друк слів, 3 складності, 14 слів у заїзді | 3–7 | uk, en | `games/perehony/` | `activities/perehony/` (ядро `perehony-core.js`, розкладки з `activities/klaviatura/klaviatura-core.js` через `sharedScripts`), слова й ліміти часу `content/perehony/words.json`, валідатор `tools/check-perehony.js` |
| 100 ребусів з інформатики | ребуси | 1–11 | uk | `puzzles/rebusy/` | `activities/rebusy/`, ребуси `content/rebusy/uk.json` |
| Задачі з сірниками | головоломки, 50 задач | 3–11 | uk, en | `puzzles/sirnyky/` | `activities/sirnyky/`, задачі `content/sirnyky/puzzles.json` |

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
| `node tools/check-robot.js` | усі рівні робота: унікальні `id`, тексти uk і en, один старт, є кристали, розв'язок виграє, `par` і `maxBlocks` |
| `node tools/check-galaxy.js` | усі рівні «Коду Галактики» (повільно, близько 2 хв; вимоги залежать від номера рівня): карта, `allowed`/`limits`, розв'язок виграє, `par`, `maxBlocks`, мінімальна вартість програми |
| `node tools/check-rebuses.js` | усі ребуси (кожна група непорожня; емодзі зі списку для старих Windows і Android): унікальні `id` і відповіді, відповідь збігається з `parts`, підказка не містить кореня відповіді |
| `node tools/check-mars.js` | генератор лабіринтів (500 зерен): симетрія, досяжність, детермінованість, правило правої й лівої руки проходить усі, наївна програма ні |
| `node tools/check-klaviatura.js` | рівні тренажера: прогресія клавіш (рівень 1 рівно `а о в` / `f j d`, далі не більше однієї нової речі на рівень: символ або Shift; `keys` рівня дорівнює всьому вивченому, кожен символ текстів і генератора вже вивчений, кожна нова клавіша вводиться на розкладці мови: укр. ЙЦУКЕН, англ. QWERTY; Shift потрібен лише з рівня, що його вводить, окрім розділового знака, який сам вимагає Shift, як-от українська кома), `stage` рівнів і його тексти в `i18n`, жодних цифр і знаків `- ! ? : ; ( ) "`, кожен текст щонайменше 50 символів (генератори на 300 зернах), частка нової клавіші у вправах 30–50%, генератор із зерна детермінований, слова придатні, бюджет помилок розумний; перевірки ядра: щаблі комбо, поразка рівно на бюджеті помилок, перемога в кінці тексту, класифікація клавіш |
| `node tools/check-perehony.js` | слова «Перегонів слів»: довжини за рівнями, не менше 40 слів на рівень і мову, без повторів, лише літери розкладки мови; ліміти часу; ядро: обгін вчасно, втрата місця за таймаутом, межі 1..6, кубки за місцем |
| `node tools/check-kiber.js` | рівно 8 місій «КіберЩиту» (`content/agenty-kibershchytu/`): структура, завдання, бали, секретне слово, однакові `id` місій і завдань в усіх мовах |

Кожна команда завершується кодом 0 і рядком `OK`, або виводить помилки й завершується з кодом 1.

## Як додати рівень, ребус, місію

Покроковий посібник для вчителя (без програмування, лише JSON, з прикладами, повідомленнями валідаторів і правкою через github.com): [`docs/how-to-add-content.md`](docs/how-to-add-content.md).

Коротко: це лише правка `content/<id>/*.json` зі стабільним `id` (за ним зберігається прогрес і будується `#id`). Після правки `node tools/check-schemas.js`, `node tools/check-<id>.js` і `node tools/build-pages.js`: кількості («10 рівнів», «100 ребусів», «8 місій») беруться з контенту (поле `count` у `catalog.json`), тож згенеровані сторінки мають оновитися, інакше CI впаде на `build-pages --check`. Марсохід контенту не має: лабіринт генерується із зерна.

## Як додати переклад

1. Мова має бути в `LANGS` (`tools/build-pages.js`) і в `enum` поля `locales` у `schemas/catalog.schema.json`. Для нової мови додай `OG_LOCALE` і вибір шрифта (`fontFile`) у `build-pages.js`, форми множини в `check-i18n.js`.
2. Скопіюй `i18n/uk/<namespace>.json` у `i18n/<мова>/` для `common`, `home`, `privacy`, `teachers`, `notfound` і для кожної активності, яку перекладаєш; переклади ключі, а `{плейсхолдери}` лиши. Множина: об'єкт із формами `Intl.PluralRules` цієї мови.
3. У `catalog.json` додай мову в `locales` активності (з `title.<мова>` і `description.<мова>`) і сайтових сторінок (`pages`). Для контенту з текстами `{uk, en}` додай переклад у `content/<id>/*.json`.
4. Картинки для соцмереж: додай тексти в `PAGES` у `tools/og/make.py` і запусти `python3 tools/og/make.py --lang <мова>` (вони лягають у `assets/og/<мова>/`; без файлу сторінка бере українську).
5. `node tools/build-pages.js`, потім усі `check-*.js`.

Без перекладу активність лишається доступною українською: на англійській головній її картка веде на українську сторінку з позначкою «Ukrainian only», а перемикач мови на ній веде на головну англійською.

## Як додати нову активність

Посібник для розробника (порядок кроків, усі поля `catalog.json`, словники, `GIStorage`, hash, чек-лист): [`docs/how-to-add-activity.md`](docs/how-to-add-activity.md). Правила, за якими це влаштовано: [`docs/architecture.md`](docs/architecture.md).

Коротко: запис у `catalog.json`, `activities/<id>/`, словники `i18n/<мова>/<id>.json` (+ ключі картки в `home.json` і `do.<id>` у `teachers.json`), контент і схема, `tools/check-<id>.js` (CI підхоплює за маскою `check-*.js`), картинка `tools/og/make.py`, потім `node tools/build-pages.js` і всі перевірки.

## Приватність

- Прогрес зберігається лише в `localStorage` браузера учня через `GIStorage`. Ключі мають вигляд `gi:<id>`, де `id` дорівнює id активності (`agenty-kibershchytu`, `kod-galaktyky`, `robot:v2`, `mars`, `rebusy`, `sirnyky:v1`); у «Робота» прогрес зберігається за id рівня, старий `robot:v1` переноситься автоматично. Старі ключі (`kiberquest-v3`, `geek-galaxy-v2`, `geek-robot-v1`, `geek-mars-v1`, `geek-rebus-solved-v1`) під час першого читання переносяться в нові й видаляються. Ключ `gi:progress` містить короткий підсумок «пройдено / усього» для головної. Сервера й облікових записів немає.
- На сторінці `privacy/` є кнопка «Очистити мої дані на цьому пристрої»: після `confirm()` вона викликає `GIStorage.clearAll()` (видаляє всі ключі `gi:*` і старі ключі) та показує, скільки записів видалено. Без JS кнопка прихована, а текст пояснює, як очистити дані сайту в налаштуваннях браузера.
- «Агенти КіберЩиту» просять ім'я та клас для посвідчення, але вони живуть лише в пам'яті сторінки, у `localStorage` не записуються (під час збереження поля `name` і `cls` виключаються) і нікуди не надсилаються. Після перезавантаження їх треба ввести знову.
- Аналітики й трекерів у коді немає. Сайт не робить запитів на сторонні сервери: Blockly лежить у `vendor/`, шрифти (Nunito, Unbounded, Caveat, JetBrains Mono, ліцензія SIL OFL) у `assets/fonts/`.

## Каталог і фільтри

Картки на головній **генеруються** з `catalog.json` (`activities[].card`, тексти в `i18n/<мова>/home.json`, малюнок `activities/<id>/card.svg`). `assets/js/catalog-filter.js` будує фільтри за атрибутами `data-id`, `data-type`, `data-grades`, `data-topics`, `data-difficulty` і малює прогрес із `GIStorage`; його рядки беруться з `t("home.*")`. Підписи фільтрів лежать у `i18n/<мова>/home.json` (`filter.type.*`, `filter.topic.*`, `filter.level.*`). Стан фільтрів в адресі: `?grade=7&type=game&topic=loops&level=2` (`level` — складність 1–3).

## Прямі посилання

- Робот: `games/robot/#<id рівня>` (наприклад `#loop-magic`); `#level-N` теж працює. Код Галактики: `games/kod-galaktyky/#<id>` (`#perimeter`), `#level-N` теж.
- Ребуси: `puzzles/rebusy/#r017`. Задачі з сірниками: `puzzles/sirnyky/#m07`.
- Марсохід: `games/mars/#maze-<число>` — лабіринт із цим зерном.
- Клавіатурний тренажер: `games/klaviatura/#<id рівня>` (наприклад `#l06`; id рівнів `l01`…`l37`).
- Перегони слів: `games/perehony/#easy`, `#medium`, `#hard` відразу запускають заїзд.
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
