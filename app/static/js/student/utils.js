// app/static/js/student/utils.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;

  const utils = (NS.utils = NS.utils || {});

  utils.escapeHtml =
    utils.escapeHtml ||
    function escapeHtml(s) {
      return String(s ?? "").replace(/[&<>"']/g, (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
      );
    };

  utils.safeDate =
    utils.safeDate ||
    function safeDate(dt) {
      if (!dt) return "—";
      try {
        return new Date(dt).toLocaleString();
      } catch {
        return String(dt);
      }
    };

  utils.getQuestions =
    utils.getQuestions ||
    function getQuestions(examOrQ) {
      if (!examOrQ) return [];
      const qj = examOrQ?.questions_json ?? examOrQ;
      if (!qj) return [];
      if (Array.isArray(qj)) return qj;
      if (Array.isArray(qj?.questions)) return qj.questions;
      return [];
    };

  utils.getQuestionText =
    utils.getQuestionText ||
    function getQuestionText(examOrQ, questionIndex) {
      const qs = utils.getQuestions(examOrQ);
      const q = qs?.[Number(questionIndex)] || null;
      const txt = q?.text?.trim() || q?.question?.trim();
      return txt ? txt : `Question #${Number(questionIndex) + 1}`;
    };
})();