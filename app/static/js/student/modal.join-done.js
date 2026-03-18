// app/static/js/student/modal.join-done.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;
  const { utils } = NS;

  const modal = (NS.modal = NS.modal || {});

  let JOIN_EXAM_ID = null;

  function openJoinModal(exam) {
    JOIN_EXAM_ID = exam.id;

    if (modal.refs.joinExamTitleEl) modal.refs.joinExamTitleEl.textContent = exam.title || "Exam";
    if (modal.refs.joinExamDescEl) modal.refs.joinExamDescEl.textContent = exam.description || "—";
    if (modal.refs.joinExamErrorEl) {
      modal.refs.joinExamErrorEl.classList.add("d-none");
      modal.refs.joinExamErrorEl.textContent = "";
    }

    bootstrap.Modal.getOrCreateInstance(modal.refs.joinExamModalEl).show();
  }

  async function loadFinalGradeForSubmission(submissionId) {
    if (modal.refs.fgFrontHintEl) modal.refs.fgFrontHintEl.textContent = "Click to flip the card";
    if (modal.refs.fgBackBodyEl) {
      modal.refs.fgBackBodyEl.innerHTML = `<div class="text-muted small">Loading final grade...</div>`;
    }

    try {
      const fg = await window.DASH.api(`/final-grades/by-submission/${submissionId}`);

      modal.refs.fgBackBodyEl.innerHTML = `
        <div class="d-flex flex-wrap gap-3 small text-muted mb-2">
          <div><strong>Peer:</strong> ${Number(fg.peer_weight).toFixed(2)}</div>
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
      modal.refs.fgBackBodyEl.innerHTML = `
        <div class="alert alert-warning mb-0">
          Final grade not available yet.
        </div>
      `;
    }
  }

  function openDoneModal(submission, exam) {
    const title = exam?.title || `Exam #${submission.exam_id}`;
    if (modal.refs.doneModalTitleEl) modal.refs.doneModalTitleEl.textContent = title;

    if (modal.refs.doneModalMetaEl) {
      modal.refs.doneModalMetaEl.innerHTML = `
        <div><strong>Exam ID:</strong> ${submission.exam_id}</div>
        <div>
          <strong>Submitted:</strong> ${utils.safeDate(submission.submitted_at)}
          <span class="mx-2">•</span>
          <strong>Status:</strong> ${utils.escapeHtml(submission.status)}
        </div>
      `;
    }

    if (modal.refs.doneModalAnswersEl) modal.refs.doneModalAnswersEl.innerHTML = "";
    const answers = submission.answers || [];

    if (!answers.length) {
      modal.refs.doneModalEmptyEl?.classList.remove("d-none");
    } else {
      modal.refs.doneModalEmptyEl?.classList.add("d-none");
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
          modal.refs.doneModalAnswersEl.appendChild(card);
        });
    }

    modal.refs.finalFlipCardEl?.classList.remove("is-flipped");
    if (modal.refs.fgFrontHintEl) modal.refs.fgFrontHintEl.textContent = "Loading...";
    if (modal.refs.fgBackBodyEl) {
      modal.refs.fgBackBodyEl.innerHTML = `<div class="text-muted small">Loading final grade...</div>`;
    }

    loadFinalGradeForSubmission(submission.id);

    bootstrap.Modal.getOrCreateInstance(modal.refs.doneExamModalEl).show();
  }

  async function handleConfirmJoin() {
    if (!JOIN_EXAM_ID) return;

    modal.refs.btnConfirmJoin.disabled = true;
    const old = modal.refs.btnConfirmJoin.innerHTML;
    modal.refs.btnConfirmJoin.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Confirming...`;

    try {
      bootstrap.Modal.getOrCreateInstance(modal.refs.joinExamModalEl).hide();
      window.location.href = `/dashboard/execution-exam/${JOIN_EXAM_ID}`;
    } catch (e) {
      if (modal.refs.joinExamErrorEl) {
        modal.refs.joinExamErrorEl.textContent = e?.message || "Error";
        modal.refs.joinExamErrorEl.classList.remove("d-none");
      }
    } finally {
      modal.refs.btnConfirmJoin.disabled = false;
      modal.refs.btnConfirmJoin.innerHTML = old;
    }
  }

  function bindJoinDoneEvents() {
    modal.refs.btnConfirmJoin?.addEventListener("click", handleConfirmJoin);

    modal.refs.finalFlipCardEl?.addEventListener("click", () => {
      modal.refs.finalFlipCardEl.classList.toggle("is-flipped");
    });
  }

  modal.openJoinModal = openJoinModal;
  modal.openDoneModal = openDoneModal;
  modal.loadFinalGradeForSubmission = loadFinalGradeForSubmission;
  modal.bindJoinDoneEvents = bindJoinDoneEvents;
})();