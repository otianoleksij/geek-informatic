/* Приватність: кнопка «Очистити мої дані». ES5. */
(function () {
  "use strict";
  function init() {
    var btn = document.getElementById("clear-btn"), st = document.getElementById("clear-status");
    if (!btn || !st || !window.GIStorage) return;
    btn.hidden = false;
    btn.addEventListener("click", function () {
      if (!window.confirm(t("privacy.confirm"))) return;
      var n = 0;
      try { n = window.GIStorage.clearAll(); } catch (e) { n = 0; }
      st.textContent = n > 0 ? t("privacy.cleared", { count: n }) : t("privacy.nothing");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
