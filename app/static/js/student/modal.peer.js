// app/static/js/student/modal.peer.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;
  const { utils } = NS;

  const modal = (NS.modal = NS.modal || {});

  let PEER_CURRENT_TASK = null;
  let PEER_ON_SUCCESS = null;

  function resetPeerModal() {
    modal.refs.peerEvalErrorEl?.classList.add("d-none");
    if (modal.refs.peerEvalErrorEl) modal.refs.peerEvalErrorEl.textContent = "";

    modal.refs.peerEvalSuccessEl?.classList.add("d-none");

    if (modal.refs.peerEvalScoreEl) modal.refs.peerEvalScoreEl.value = "";
    if (modal.refs.peerEvalCommentEl) modal.refs.peerEvalCommentEl.value = "";

    if (modal.refs.peerModalAnswersEl) modal.refs.peerModalAnswersEl.innerHTML = "";
    modal.refs.peerModalEmptyEl?.classList.add("d-none");

    if (modal.refs.btnSubmitPeerEvalEl) modal.refs.btnSubmitPeerEvalEl.disabled = false;
  }

  function renderPeerAnswers(task) {
    if (!modal.refs.peerModalAnswersEl) return;

    modal.refs.peerModalAnswersEl.innerHTML = "";
    modal.refs.peerModalEmptyEl?.classList.add("d-none");

    const sub = task?.submission || {};
    const examOrQ = sub?.questions_json ? sub : sub?.exam ? sub.exam : null;
    const answers = Array.isArray(sub?.answers) ? sub.answers : [];

    if (!answers.length) {
      modal.refs.peerModalEmptyEl?.classList.remove("d-none");
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
        modal.refs.peerModalAnswersEl.appendChild(card);
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

    if (modal.refs.peerEvalSubmissionTitleEl) {
      modal.refs.peerEvalSubmissionTitleEl.textContent = `Anonymous submission #${sid}${examTitle}`;
    }

    renderPeerAnswers(task);

    bootstrap.Modal.getOrCreateInstance(modal.refs.peerEvalModalEl).show();
  }

  async function handleSubmitPeerEval() {
    if (!PEER_CURRENT_TASK) return;

    const sub = PEER_CURRENT_TASK.submission || {};
    const submissionId = Number(sub.id);

    const score = Number(modal.refs.peerEvalScoreEl?.value);
    const comment = (modal.refs.peerEvalCommentEl?.value || "").trim();

    if (!Number.isFinite(score) || score < 0 || score > 30) {
      if (modal.refs.peerEvalErrorEl) {
        modal.refs.peerEvalErrorEl.textContent = "Enter a valid score (0–30).";
        modal.refs.peerEvalErrorEl.classList.remove("d-none");
      }
      return;
    }

    if (!comment) {
      if (modal.refs.peerEvalErrorEl) {
        modal.refs.peerEvalErrorEl.textContent = "Enter a rationale.";
        modal.refs.peerEvalErrorEl.classList.remove("d-none");
      }
      return;
    }

    modal.refs.btnSubmitPeerEvalEl.disabled = true;
    const old = modal.refs.btnSubmitPeerEvalEl.innerHTML;
    modal.refs.btnSubmitPeerEvalEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Submitting...`;

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

      if (modal.refs.peerEvalSuccessEl) {
        modal.refs.peerEvalSuccessEl.textContent =
          "Peer evaluation submitted. The list will refresh automatically.";
        modal.refs.peerEvalSuccessEl.classList.remove("d-none");
      }

      setTimeout(async () => {
        bootstrap.Modal.getOrCreateInstance(modal.refs.peerEvalModalEl).hide();
        if (PEER_ON_SUCCESS) await PEER_ON_SUCCESS();
      }, 350);
    } catch (e) {
      if (modal.refs.peerEvalErrorEl) {
        modal.refs.peerEvalErrorEl.textContent = e?.message || "Error submitting peer evaluation.";
        modal.refs.peerEvalErrorEl.classList.remove("d-none");
      }
    } finally {
      modal.refs.btnSubmitPeerEvalEl.disabled = false;
      modal.refs.btnSubmitPeerEvalEl.innerHTML = old;
    }
  }

  function bindPeerEvents() {
    modal.refs.btnSubmitPeerEvalEl?.addEventListener("click", handleSubmitPeerEval);
  }

  modal.resetPeerModal = resetPeerModal;
  modal.renderPeerAnswers = renderPeerAnswers;
  modal.openPeerEvalModal = openPeerEvalModal;
  modal.bindPeerEvents = bindPeerEvents;
})();