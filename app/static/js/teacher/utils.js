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
    function getQuestions(exam) {
      return exam?.questions_json?.questions || [];
    };

  utils.getRubricType =
    utils.getRubricType ||
    function getRubricType(exam) {
      const type = exam?.rubric_json?.type;
      return type === "level_based" ? "level_based" : "simple";
    };

  utils.isLevelRubric =
    utils.isLevelRubric ||
    function isLevelRubric(exam) {
      return utils.getRubricType(exam) === "level_based";
    };

  utils.getCriteria =
    utils.getCriteria ||
    function getCriteria(exam) {
      return exam?.rubric_json?.criteria || [];
    };

  utils.getCriterionLevels =
    utils.getCriterionLevels ||
    function getCriterionLevels(criterion) {
      const levels = criterion?.levels || {};
      return {
        "5": levels["5"] || "",
        "4": levels["4"] || "",
        "3": levels["3"] || "",
        "2": levels["2"] || "",
        "1": levels["1"] || "",
      };
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