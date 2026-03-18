// app/static/js/student/index.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;

  window.addEventListener("DOMContentLoaded", () => {
    if (window.__DASH_STUDENT_INIT__) return;
    window.__DASH_STUDENT_INIT__ = true;

    async function initWhenDashReady() {
      const me = window.DASH?.me;
      if (!me) return;

      await NS.exams.refreshUI(me);

      if (NS.peer?.refreshUI) {
        await NS.peer.refreshUI(me);
      }
    }

    if (window.DASH && window.DASH.me) {
      initWhenDashReady();
    } else {
      window.addEventListener("dash:ready", () => initWhenDashReady(), { once: true });
    }
  });
})();