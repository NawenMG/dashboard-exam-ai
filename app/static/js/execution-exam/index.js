// app/static/js/execution-exam/index.js
(() => {
  window.addEventListener("DOMContentLoaded", () => {
    if (window.__EXEC_EXAM_INIT__) return;
    window.__EXEC_EXAM_INIT__ = true;

    const NS = (window.EXEC_EXAM = window.EXEC_EXAM || {});

    function initWhenDashReady() {
      NS.exam.initExam();
      NS.submit.bind();
    }

    if (window.DASH && window.DASH.me) {
      initWhenDashReady();
    } else {
      window.addEventListener("dash:ready", () => initWhenDashReady(), { once: true });
    }
  });
})();