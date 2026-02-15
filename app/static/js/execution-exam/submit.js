// app/static/js/execution-exam/submit.js
(() => {
  window.EXEC_EXAM = window.EXEC_EXAM || {};
  const NS = window.EXEC_EXAM;

  NS.submit = NS.submit || {};

  const btnFinishExam = document.getElementById("btnFinishExam");
  const btnConfirmSubmit = document.getElementById("btnConfirmSubmit");
  const confirmModalEl = document.getElementById("confirmSubmitModal");

  function validateBeforeModal() {
    NS.ui.hideFatalError();

    try {
      NS.ui.readAnswers();
      NS.ui.readSelfEvaluation();
      return true;
    } catch (e) {
      const msg = e?.message || "Errore validazione.";
      if (String(msg).toLowerCase().includes("autovalutazione")) {
        NS.ui.showSelfEvalError(msg);
      } else {
        NS.ui.showAnswersError(msg);
      }
      return false;
    }
  }

  async function doSubmit() {
    NS.ui.setConfirmSubmitBusy(true);
    NS.ui.hideFatalError();

    try {
      const answers = NS.ui.readAnswers();
      const selfEval = NS.ui.readSelfEvaluation();
      const EXAM_ID = Number(NS.EXAM_ID);

      // 1) create submission
      const submission = await window.DASH.api("/submissions", {
        method: "POST",
        body: JSON.stringify({ exam_id: EXAM_ID, answers }),
      });

      // 2) create evaluation (student)
      await window.DASH.api("/evaluations", {
        method: "POST",
        body: JSON.stringify({
          submission_id: submission.id,
          evaluator_type: "student",
          score: selfEval.score,
          honors: selfEval.honors,
          comment: selfEval.comment,
          details_json: null,
        }),
      });

      bootstrap.Modal.getOrCreateInstance(confirmModalEl).hide();
      window.location.href = "/dashboard/student";
    } catch (e) {
      NS.ui.setConfirmModalError(e?.message || "Errore invio.");
    } finally {
      NS.ui.setConfirmSubmitBusy(false);
    }
  }

  function bind() {
    btnFinishExam?.addEventListener("click", () => {
      if (!validateBeforeModal()) return;
      NS.ui.openConfirmModal();
    });

    btnConfirmSubmit?.addEventListener("click", async () => {
      await doSubmit();
    });
  }

  NS.submit.bind = bind;
})();
