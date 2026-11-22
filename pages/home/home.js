/* Головна: дата у верхньому рядку «зошита». Мова й формат — через GII18n (Intl). ES5. */
(function () {
  "use strict";
  try {
    var el = document.getElementById("today");
    if (!el || !window.GII18n) return;
    var s = window.GII18n.formatDate(new Date(), { day: "numeric", month: "long" });
    if (s) el.textContent = s.charAt(0).toUpperCase() + s.slice(1);
  } catch (e) {}
})();
