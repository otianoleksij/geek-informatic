/* GitHub Pages віддає цей файл для будь-якого неіснуючого адресу. Для адрес під en/ перемикаємо тексти й посилання на англійську. */
(function () {
  if (location.pathname.indexOf(document.documentElement.getAttribute("data-base") + "en/") !== 0) return;
  document.documentElement.lang = "en";
  [].forEach.call(document.querySelectorAll("[data-en]"), function (e) { e.textContent = e.getAttribute("data-en"); });
  [].forEach.call(document.querySelectorAll("[data-en-href]"), function (e) { e.setAttribute("href", e.getAttribute("data-en-href")); });
  [].forEach.call(document.querySelectorAll("[data-en-label]"), function (e) { e.setAttribute("aria-label", e.getAttribute("data-en-label")); });
})();
