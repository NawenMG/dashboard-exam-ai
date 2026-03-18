// app/static/js/execution-exam/ui.core.js
(() => {
  window.EXEC_EXAM = window.EXEC_EXAM || {};
  const NS = window.EXEC_EXAM;

  const ui = (NS.ui = NS.ui || {});

  const viewLoading = document.getElementById("viewLoading");
  const viewExam = document.getElementById("viewExam");

  const examTitleEl = document.getElementById("examTitle");
  const examDescEl = document.getElementById("examDesc");
  const qCountLabel = document.getElementById("qCountLabel");
  const questionsWrap = document.getElementById("questionsWrap");

  const answersError = document.getElementById("answersError");
  const selfEvalError = document.getElementById("selfEvalError");
  const submitFatalError = document.getElementById("submitFatalError");

  const selfScoreEl = document.getElementById("selfScore");
  const selfHonorsEl = document.getElementById("selfHonors");
  const selfCommentEl = document.getElementById("selfComment");

  const confirmModalEl = document.getElementById("confirmSubmitModal");
  const confirmModalErr = document.getElementById("confirmModalErr");
  const btnConfirmSubmit = document.getElementById("btnConfirmSubmit");

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
  }

  function showLoading(on) {
    viewLoading?.classList.toggle("d-none", !on);
    viewExam?.classList.toggle("d-none", on);
  }

  function showAnswersError(msg) {
    answersError.textContent = msg || "Error";
    answersError.classList.remove("d-none");
  }

  function hideAnswersError() {
    answersError.classList.add("d-none");
    answersError.textContent = "";
  }

  function showSelfEvalError(msg) {
    selfEvalError.textContent = msg || "Error";
    selfEvalError.classList.remove("d-none");
  }

  function hideSelfEvalError() {
    selfEvalError.classList.add("d-none");
    selfEvalError.textContent = "";
  }

  function showFatalError(msg) {
    submitFatalError.textContent = msg || "Error";
    submitFatalError.classList.remove("d-none");
  }

  function hideFatalError() {
    submitFatalError.classList.add("d-none");
    submitFatalError.textContent = "";
  }

  function setExamHeader(exam) {
    examTitleEl.textContent = exam.title || `Exam #${exam.id}`;
    examDescEl.textContent = exam.description || "";
  }

  function getQuestions(exam) {
    const q = exam?.questions_json?.questions;
    return Array.isArray(q) ? q : [];
  }

  ui.refs = {
    viewLoading,
    viewExam,
    examTitleEl,
    examDescEl,
    qCountLabel,
    questionsWrap,
    answersError,
    selfEvalError,
    submitFatalError,
    selfScoreEl,
    selfHonorsEl,
    selfCommentEl,
    confirmModalEl,
    confirmModalErr,
    btnConfirmSubmit,
  };

  ui.escapeHtml = escapeHtml;
  ui.showLoading = showLoading;
  ui.showAnswersError = showAnswersError;
  ui.hideAnswersError = hideAnswersError;
  ui.showSelfEvalError = showSelfEvalError;
  ui.hideSelfEvalError = hideSelfEvalError;
  ui.showFatalError = showFatalError;
  ui.hideFatalError = hideFatalError;
  ui.setExamHeader = setExamHeader;
  ui.getQuestions = getQuestions;
})();