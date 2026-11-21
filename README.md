# Geek Informatic

Вебквести з інформатики для уроків. Статичний сайт для GitHub Pages: без збірки, просто HTML.

## Структура

```
index.html                         головна сторінка зі списком квестів
web-quests/
  agenty-kibershchytu/index.html   «Агенти КіберЩиту», 6 клас, кібербезпека
  kod-galaktyky/index.html         «Код Галактики», 7 клас, тестова місія 1
.nojekyll                          вимикає обробку Jekyll
```

## Публікація на GitHub Pages

1. Створи на GitHub репозиторій `geek-informatic` і запуш у нього цю папку.
2. Settings → Pages → Source: **Deploy from a branch**, гілка `main`, папка `/ (root)`.
3. Сайт буде за адресою `https://<логін>.github.io/geek-informatic/`.

## Як додати новий квест

1. Створи папку `web-quests/<назва-латиницею>/` з файлом `index.html`.
2. Додай у квест посилання назад: `<a href="../../">Квести</a>`.
3. На головній (`index.html`) скопіюй блок `<a class="book …">` і зміни текст і посилання.
