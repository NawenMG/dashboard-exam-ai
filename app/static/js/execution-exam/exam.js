// app/static/js/execution-exam/exam.js
(() => {
  window.EXEC_EXAM = window.EXEC_EXAM || {};
  const NS = window.EXEC_EXAM;

  NS.exam = NS.exam || {};

  async function initExam() {
    const EXAM_ID = Number(NS.EXAM_ID);
    NS.ui.showLoading(true);

    try {
      const exam = await NS.api.loadExamById(EXAM_ID);
      if (!exam) {
        throw new Error("Esame non trovato o non pubblicato. (Controlla /exams/published)");
      }

      NS.exam.current = exam;

      NS.ui.setExamHeader(exam);

      const questions = NS.ui.getQuestions(exam);
      NS.exam.questions = questions;

      if (!questions.length) NS.ui.renderNoQuestions();
      else NS.ui.renderQuestions(questions);

      NS.ui.showLoading(false);
    } catch (e) {
      NS.ui.showLoading(false);
      // forza visibilità se siamo in errore
      document.getElementById("viewExam")?.classList.remove("d-none");
      NS.ui.showFatalError(e?.message || "Errore caricamento esame.");
    }
  }

  NS.exam.initExam = initExam;
})();
