# assets/fonts/

Шрифти сайту на власному хостингу: сторінки не звертаються до Google Fonts.

| Шрифт | Призначення | Ваги (variable) | Файли |
|---|---|---|---|
| Nunito | основний текст | 400..800 | `nunito-cyrillic.woff2`, `nunito-latin.woff2` |
| Unbounded | заголовки | 600..800 | `unbounded-cyrillic.woff2`, `unbounded-latin.woff2` |
| Caveat | рукописні акценти | 600..700 | `caveat-cyrillic.woff2`, `caveat-latin.woff2` |
| JetBrains Mono | моноширинний (КіберЩит, Код Галактики) | 500..700 | `jetbrains-mono-cyrillic.woff2`, `jetbrains-mono-latin.woff2` |

- Підмножини: лише `cyrillic` (включно з Ґ, Є, І, Ї) і `latin`. Підмножину `cyrillic-ext` та інші не взято; рідкісні символи з них (наприклад ₴) показуються системним шрифтом.
- Джерело: Google Fonts CSS2 API (`https://fonts.googleapis.com/css2?family=...&display=swap`, запит із сучасним User-Agent браузера, діапазон ваг дає один variable-файл на підмножину). Файли завантажено 2026-11-22. `unicode-range` у `fonts.css` узято з відповіді Google.
- Ліцензія: SIL Open Font License 1.1, текст у `OFL.txt`.
- Підключення: `<link rel="stylesheet" href="…/assets/fonts/fonts.css">` на кожній сторінці. `fonts.css` лежить поруч з файлами, шляхи в ньому відносні.

## Як додати вагу чи шрифт

Завантаж CSS з Google (як вище), візьми `woff2` для `cyrillic` і `latin`, збережи як `<сімейство>-<підмножина>.woff2` і додай `@font-face` у `fonts.css`. Якщо в CSS сторінок з'являється вага поза діапазоном, розшир діапазон і перезавантаж файли.
