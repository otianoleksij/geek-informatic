/* Спільне для сайтових сторінок (головна, приватність, вчителі): поточний рік у підвалі. ES5. */
(function () {
  "use strict";
  try {
    var el = document.getElementById("yr");
    if (el) el.textContent = new Date().getFullYear();
  } catch (e) {}
})();
