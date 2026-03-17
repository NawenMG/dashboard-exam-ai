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
    function getQuestions(examOrQ) {
      // supporta:
      // - exam.questions_json.questions
      // - questions_json.questions
      // - questions_json (array)
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
      const txt = q?.text?.trim() || q?.question?.trim(); // supporta seed "question"
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

  // ✅ Peer modal refs
  const peerEvalModalEl = document.getElementById("peerEvalModal");
  const peerEvalSubmissionTitleEl = document.getElementById("peerEvalSubmissionTitle");
  const peerModalAnswersEl = document.getElementById("peerModalAnswers");
  const peerModalEmptyEl = document.getElementById("peerModalEmpty");

  const peerEvalScoreEl = document.getElementById("peerEvalScore");
  const peerEvalCommentEl = document.getElementById("peerEvalComment");
  const peerEvalErrorEl = document.getElementById("peerEvalError");
  const peerEvalSuccessEl = document.getElementById("peerEvalSuccess");
  const btnSubmitPeerEvalEl = document.getElementById("btnSubmitPeerEval");

  let JOIN_EXAM_ID = null;

  // peer modal state
  let PEER_CURRENT_TASK = null;
  let PEER_ON_SUCCESS = null;

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

  // ==========================
  // ✅ Peer modal helpers
  // ==========================
  function resetPeerModal() {
    peerEvalErrorEl?.classList.add("d-none");
    if (peerEvalErrorEl) peerEvalErrorEl.textContent = "";

    peerEvalSuccessEl?.classList.add("d-none");

    if (peerEvalScoreEl) peerEvalScoreEl.value = "";
    if (peerEvalCommentEl) peerEvalCommentEl.value = "";

    if (peerModalAnswersEl) peerModalAnswersEl.innerHTML = "";
    peerModalEmptyEl?.classList.add("d-none");

    if (btnSubmitPeerEvalEl) btnSubmitPeerEvalEl.disabled = false;
  }

  function renderPeerAnswers(task) {
    if (!peerModalAnswersEl) return;

    peerModalAnswersEl.innerHTML = "";
    peerModalEmptyEl?.classList.add("d-none");

    const sub = task?.submission || {};
    // supporta entrambe le forme:
    // - sub.questions_json
    // - sub.exam.questions_json
    const examOrQ = sub?.questions_json ? sub : sub?.exam ? sub.exam : null;

    const answers = Array.isArray(sub?.answers) ? sub.answers : [];

    if (!answers.length) {
      peerModalEmptyEl?.classList.remove("d-none");
      return;
    }

    answers
      .slice()
      .sort((a, b) => (a.question_index ?? 0) - (b.question_index ?? 0))
      .forEach((a) => {
        const qText = utils.getQuestionText(examOrQ, a.question_index);
        const card = document.createElement("div");
        card.className = "card shadow-sm";
        card.innerHTML = `
          <div class="card-body py-2">
            <div class="small text-muted mb-1">${utils.escapeHtml(qText)}</div>
            <div>${utils.escapeHtml(a.answer_text)}</div>
          </div>
        `;
        peerModalAnswersEl.appendChild(card);
      });
  }

  function openPeerEvalModal(task, opts = {}) {
    PEER_CURRENT_TASK = task;
    PEER_ON_SUCCESS = typeof opts.onSuccess === "function" ? opts.onSuccess : null;

    resetPeerModal();

    const sub = task?.submission || {};
    const sid = sub?.id ?? "—";
    const examTitle =
  typeof sub?.exam_title === "string" && sub.exam_title.trim()
    ? ` • ${sub.exam_title.trim()}`
    : "";
if (peerEvalSubmissionTitleEl) {
  peerEvalSubmissionTitleEl.textContent = `Submission anonima #${sid}${examTitle}`;
}

    // ✅ render Q&A sopra
    renderPeerAnswers(task);

    bootstrap.Modal.getOrCreateInstance(peerEvalModalEl).show();
  }

  btnSubmitPeerEvalEl?.addEventListener("click", async () => {
    if (!PEER_CURRENT_TASK) return;

    const sub = PEER_CURRENT_TASK.submission || {};
    const submissionId = Number(sub.id);

    const score = Number(peerEvalScoreEl?.value);
    const comment = (peerEvalCommentEl?.value || "").trim();

    if (!Number.isFinite(score) || score < 0 || score > 30) {
      if (peerEvalErrorEl) {
        peerEvalErrorEl.textContent = "Inserisci un voto valido (0–30).";
        peerEvalErrorEl.classList.remove("d-none");
      }
      return;
    }
    if (!comment) {
      if (peerEvalErrorEl) {
        peerEvalErrorEl.textContent = "Inserisci una motivazione.";
        peerEvalErrorEl.classList.remove("d-none");
      }
      return;
    }

    btnSubmitPeerEvalEl.disabled = true;
    const old = btnSubmitPeerEvalEl.innerHTML;
    btnSubmitPeerEvalEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Invio...`;

    try {
      await window.DASH.api("/evaluations", {
        method: "POST",
        body: JSON.stringify({
          submission_id: submissionId,
          evaluator_type: "peer",
          score,
          honors: false,
          comment,
          details_json: null,
        }),
      });

      if (peerEvalSuccessEl) {
  peerEvalSuccessEl.textContent =
    "Peer evaluation inviata! La lista verrà aggiornata automaticamente.";
  peerEvalSuccessEl.classList.remove("d-none");
}

setTimeout(async () => {
  bootstrap.Modal.getOrCreateInstance(peerEvalModalEl).hide();
  if (PEER_ON_SUCCESS) await PEER_ON_SUCCESS();
}, 350);
    } catch (e) {
      if (peerEvalErrorEl) {
        peerEvalErrorEl.textContent = e?.message || "Errore invio peer evaluation.";
        peerEvalErrorEl.classList.remove("d-none");
      }
    } finally {
      btnSubmitPeerEvalEl.disabled = false;
      btnSubmitPeerEvalEl.innerHTML = old;
    }
  });

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

  // ✅ export peer modal opener
  modal.openPeerEvalModal = openPeerEvalModal;
})();