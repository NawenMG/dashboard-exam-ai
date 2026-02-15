// app/static/js/student/index.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;

  window.addEventListener("DOMContentLoaded", () => {
    if (window.__DASH_STUDENT_INIT__) return;
    window.__DASH_STUDENT_INIT__ = true;

    function initWhenDashReady() {
      const me = window.DASH?.me;
      if (!me) return;
      NS.exams.refreshUI(me);
    }

    if (window.DASH && window.DASH.me) {
      initWhenDashReady();
    } else {
      window.addEventListener("dash:ready", () => initWhenDashReady(), { once: true });
    }
  });
})();
