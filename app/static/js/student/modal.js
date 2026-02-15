// app/static/js/student/modal.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;

  // ==========================
  // Utils condivise
  // ==========================
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

  utils.getQuestionText =
    utils.getQuestionText ||
    function getQuestionText(exam, questionIndex) {
      const qs = utils.getQuestions(exam);
      const q = qs?.[Number(questionIndex)] || null;
      const txt = q?.text?.trim();
      return txt ? txt : `Domanda #${Number(questionIndex) + 1}`;
    };

  // ==========================
  // Modal module
  // ==========================
  const modal = (NS.modal = NS.modal || {});

  // Join modal refs
  const joinExamModalEl = document.getElementById("joinExamModal");
  const joinExamTitleEl = document.getElementById("joinExamTitle");
  const joinExamDescEl = document.getElementById("joinExamDesc");
  const joinExamErrorEl = document.getElementById("joinExamError");
  const btnConfirmJoin = document.getElementById("btnConfirmJoin");

  // Done modal refs
  const doneExamModalEl = document.getElementById("doneExamModal");
  const doneModalTitleEl = document.getElementById("doneModalTitle");
  const doneModalMetaEl = document.getElementById("doneModalMeta");
  const doneModalAnswersEl = document.getElementById("doneModalAnswers");
  const doneModalEmptyEl = document.getElementById("doneModalEmpty");

  const finalFlipCardEl = document.getElementById("finalFlipCard");
  const fgFrontHintEl = document.getElementById("fgFrontHint");
  const fgBackBodyEl = document.getElementById("fgBackBody");

  let JOIN_EXAM_ID = null;

  function openJoinModal(exam) {
    JOIN_EXAM_ID = exam.id;
    if (joinExamTitleEl) joinExamTitleEl.textContent = exam.title || "Exam";
    if (joinExamDescEl) joinExamDescEl.textContent = exam.description || "—";
    if (joinExamErrorEl) {
      joinExamErrorEl.classList.add("d-none");
      joinExamErrorEl.textContent = "";
    }

    bootstrap.Modal.getOrCreateInstance(joinExamModalEl).show();
  }

  async function loadFinalGradeForSubmission(submissionId) {
    if (fgFrontHintEl) fgFrontHintEl.textContent = "Clicca per girare la card";
    if (fgBackBodyEl) fgBackBodyEl.innerHTML = `<div class="text-muted small">Caricamento final grade...</div>`;

    try {
      const fg = await window.DASH.api(`/final-grades/by-submission/${submissionId}`);

      fgBackBodyEl.innerHTML = `
        <div class="d-flex flex-wrap gap-3 small text-muted mb-2">
          <div><strong>Teacher:</strong> ${Number(fg.teacher_weight).toFixed(2)}</div>
          <div><strong>AI:</strong> ${Number(fg.ai_weight).toFixed(2)}</div>
          <div><strong>Self:</strong> ${Number(fg.self_weight).toFixed(2)}</div>
        </div>

        <div class="fs-4">
          <strong>${Number(fg.final_score).toFixed(2)}</strong>
          ${fg.final_honors ? `<span class="badge bg-success ms-2">Honors</span>` : ""}
        </div>

        <div class="small text-muted mt-2">
          Computed: ${utils.safeDate(fg.computed_at)}
        </div>
      `;
    } catch (_) {
      fgBackBodyEl.innerHTML = `
        <div class="alert alert-warning mb-0">
          Final grade non disponibile (ancora non calcolato).
        </div>
      `;
    }
  }

  function openDoneModal(submission, exam) {
    const title = exam?.title || `Exam #${submission.exam_id}`;
    if (doneModalTitleEl) doneModalTitleEl.textContent = title;

    if (doneModalMetaEl) {
      doneModalMetaEl.innerHTML = `
        <div><strong>Exam ID:</strong> ${submission.exam_id}</div>
        <div>
          <strong>Submitted:</strong> ${utils.safeDate(submission.submitted_at)}
          <span class="mx-2">•</span>
          <strong>Status:</strong> ${utils.escapeHtml(submission.status)}
        </div>
      `;
    }

    if (doneModalAnswersEl) doneModalAnswersEl.innerHTML = "";
    const answers = submission.answers || [];

    if (!answers.length) {
      doneModalEmptyEl?.classList.remove("d-none");
    } else {
      doneModalEmptyEl?.classList.add("d-none");
      answers
        .slice()
        .sort((a, b) => (a.question_index ?? 0) - (b.question_index ?? 0))
        .forEach((a) => {
          const qText = utils.getQuestionText(exam, a.question_index);
          const card = document.createElement("div");
          card.className = "card shadow-sm";
          card.innerHTML = `
            <div class="card-body py-2">
              <div class="small text-muted mb-1">${utils.escapeHtml(qText)}</div>
              <div>${utils.escapeHtml(a.answer_text)}</div>
            </div>
          `;
          doneModalAnswersEl.appendChild(card);
        });
    }

    finalFlipCardEl?.classList.remove("is-flipped");
    if (fgFrontHintEl) fgFrontHintEl.textContent = "Caricamento...";
    if (fgBackBodyEl) fgBackBodyEl.innerHTML = `<div class="text-muted small">Caricamento final grade...</div>`;
    loadFinalGradeForSubmission(submission.id);

    bootstrap.Modal.getOrCreateInstance(doneExamModalEl).show();
  }

  // bind: confirm join
  btnConfirmJoin?.addEventListener("click", async () => {
    if (!JOIN_EXAM_ID) return;

    btnConfirmJoin.disabled = true;
    const old = btnConfirmJoin.innerHTML;
    btnConfirmJoin.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Conferma...`;

    try {
      bootstrap.Modal.getOrCreateInstance(joinExamModalEl).hide();
      window.location.href = `/dashboard/execution-exam/${JOIN_EXAM_ID}`;
    } catch (e) {
      if (joinExamErrorEl) {
        joinExamErrorEl.textContent = e?.message || "Errore";
        joinExamErrorEl.classList.remove("d-none");
      }
    } finally {
      btnConfirmJoin.disabled = false;
      btnConfirmJoin.innerHTML = old;
    }
  });

  // bind: flip card
  finalFlipCardEl?.addEventListener("click", () => {
    finalFlipCardEl.classList.toggle("is-flipped");
  });

  // exports
  modal.openJoinModal = openJoinModal;
  modal.openDoneModal = openDoneModal;
})();
