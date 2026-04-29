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
      let value = String(dt);

      // Se il backend manda UTC senza timezone, aggiungo Z
      // così il browser capisce che è UTC e lo converte in Europe/Rome.
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)) {
        value += "Z";
      }

      return new Date(value).toLocaleString("it-IT", {
        timeZone: "Europe/Rome",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
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