// app/static/js/teacher/utils.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;

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
    function getQuestions(exam) {
      return exam?.questions_json?.questions || [];
    };

  utils.getCriteria =
    utils.getCriteria ||
    function getCriteria(exam) {
      return exam?.rubric_json?.criteria || [];
    };

  utils.getStudentLabelFromSubmission =
    utils.getStudentLabelFromSubmission ||
    function getStudentLabelFromSubmission(sub) {
      const st = sub?.student || null;
      const first = st?.first_name || "";
      const last = st?.last_name || "";
      const matricola = st?.matricola || "—";
      const full = `${first} ${last}`.trim() || `ID ${sub?.student_id ?? "—"}`;
      return `${utils.escapeHtml(full)} <span class="text-muted">(${utils.escapeHtml(matricola)})</span>`;
    };

  utils.getQuestionText =
    utils.getQuestionText ||
    function getQuestionText(exam, questionIndex) {
      const qs = utils.getQuestions(exam);
      const q = qs?.[Number(questionIndex)] || null;
      const txt = q?.text?.trim();
      return txt ? txt : `Question #${Number(questionIndex) + 1}`;
    };
})();