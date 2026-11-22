# vendor/

Сторонні бібліотеки, які хостяться разом із сайтом (без CDN).

## blockly@10.4.3

- Джерело: офіційний реєстр npm, пакет `blockly@10.4.3` (`npm pack blockly@10.4.3`).
- Integrity (npm, sha512 tgz): `sha512-+opfBmQnSiv7vTiY/TkDEBOslxUyfj8luS3S+qs1NnQKjInC+Waf2l9cNsMh9J8BMkmiCIT+Ed/3mmjIaL9wug==` (збігається з `npm view blockly@10.4.3 dist.integrity`).
- Дата додавання: 2026-11-22.
- Ліцензія: Apache-2.0 (`blockly@10.4.3/LICENSE`; пакет npm власного файлу LICENSE не містить, тому взято офіційний текст з apache.org).
- Що взято: `blockly_compressed.js`, `msg/uk.js`, `msg/en.js` (з того самого tgz, sha512 перевірено; повідомлення інтерфейсу Blockly англійською для сторінок `en/`), `media/`. `blocks_compressed.js` не потрібен: ігри використовують лише власні блоки (`defineBlocksWithJsonArray`).
- Використовують: `games/kod-galaktyky/`, `games/mars/` та їхні `en/`-версії. Скрипти підключає `build-pages` за полем `vendorScripts` у `catalog.json` (`vendor/blockly@10.4.3/msg/{lang}.js`: `{lang}` стає `uk` або `en`); `media` задається в `app.js` від `data-root` сторінки.

### Як оновити

1. `npm pack blockly@НОВА_ВЕРСІЯ`, розпакувати, звірити sha512 tgz з `npm view blockly@НОВА_ВЕРСІЯ dist.integrity`.
2. Створити `vendor/blockly@НОВА_ВЕРСІЯ/` з тими самими файлами (включно з `msg/uk.js` і `msg/en.js`), замінити шляхи в `vendorScripts` у `catalog.json` та `media` в обох `app.js`, запустити `node tools/build-pages.js`, видалити стару теку.
3. Перевірити обидві гри в браузері (кольори, іконки, дропдауни, масштаб, українські написи).

## blockly-keyboard-navigation@0.5.13

- Джерело: офіційний реєстр npm, пакет `@blockly/keyboard-navigation@0.5.13` (`npm pack @blockly/keyboard-navigation@0.5.13`). Остання з гілки 0.5.x; `peerDependencies`: `blockly ^10.2.0`.
- Integrity (npm, sha512 tgz): `sha512-ESI6qc2wEqDcLbhqAuDyIKSfN1nKCKWxP5iRbj0BBE+u+53BRvttNXdc5BntNKmxHzqKpoaL9XBODN2kLwYXUw==` (збігається з `npm view @blockly/keyboard-navigation@0.5.13 dist.integrity`).
- Дата додавання: 2026-11-22.
- Ліцензія: Apache-2.0 (`LICENSE`, `index.js.LICENSE.txt`).
- Що взято: `dist/index.js` (UMD, використовує глобальний `Blockly`, експортує глобальний `NavigationController`), без `index.js.map`.
- Використовують: `games/kod-galaktyky/`, `games/mars/` (`<script defer>` після `msg/{lang}.js`; ініціалізація в `app.js` одразу після `Blockly.inject`). Клавіатурний режим вмикається користувачем: Ctrl+Shift+K.
