// app/static/js/teacher/modal.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;
  const { utils } = NS;

  const modal = (NS.modal = NS.modal || {});

  modal.refs = {
    subModalEl: document.getElementById("submissionModal"),
    subModalTitle: document.getElementById("subModalTitle"),
    subModalMeta: document.getElementById("subModalMeta"),
    subModalAnswers: document.getElementById("subModalAnswers"),
    subModalEmpty: document.getElementById("subModalEmpty"),

    evalStudentBody: document.getElementById("evalStudentBody"),
    evalTeacherBody: document.getElementById("evalTeacherBody"),
    evalAiBody: document.getElementById("evalAiBody"),

    btnComputeFinalGrade: document.getElementById("btnComputeFinalGrade"),
    finalGradeContainer: document.getElementById("finalGradeContainer"),

    finalGradeCollapseEl: document.getElementById("finalGradeCollapse"),
    wStudentEl: document.getElementById("wStudent"),
    wTeacherEl: document.getElementById("wTeacher"),
    wAiEl: document.getElementById("wAi"),
    weightsSumEl: document.getElementById("weightsSum"),
    weightsHintEl: document.getElementById("weightsHint"),
    weightsErrorEl: document.getElementById("weightsError"),
    btnCancelFinalGrade: document.getElementById("btnCancelFinalGrade"),
    btnConfirmFinalGrade: document.getElementById("btnConfirmFinalGrade"),
  };

  modal.bsFinalCollapse = modal.refs.finalGradeCollapseEl
    ? new bootstrap.Collapse(modal.refs.finalGradeCollapseEl, { toggle: false })
    : null;

  modal.state = {
    currentSubmissionId: null,
    peerClosedAt: null,
  };

  function hideWeightsError() {
    const { weightsErrorEl } = modal.refs;
    if (!weightsErrorEl) return;
    weightsErrorEl.classList.add("d-none");
    weightsErrorEl.textContent = "";
  }

  function showWeightsError(msg) {
    const { weightsErrorEl } = modal.refs;
    if (!weightsErrorEl) return;
    weightsErrorEl.textContent = msg || "Error";
    weightsErrorEl.classList.remove("d-none");
  }

  function getInt1to10(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 10) return null;
    return n;
  }

  function validateWeightsAndToggle() {
    const {
      wStudentEl,
      wTeacherEl,
      wAiEl,
      btnConfirmFinalGrade,
      weightsSumEl,
      weightsHintEl,
    } = modal.refs;

    hideWeightsError();

    const ws = getInt1to10(wStudentEl?.value);
    const wt = getInt1to10(wTeacherEl?.value);
    const wa = getInt1to10(wAiEl?.value);

    if (ws === null || wt === null || wa === null) {
      if (btnConfirmFinalGrade) btnConfirmFinalGrade.disabled = true;
      if (weightsSumEl) weightsSumEl.textContent = "—";
      if (weightsHintEl) weightsHintEl.textContent = "Weights must be integers between 1 and 10";
      return null;
    }

    const sum = ws + wt + wa;
    if (weightsSumEl) weightsSumEl.textContent = String(sum);

    if (sum !== 10) {
      if (btnConfirmFinalGrade) btnConfirmFinalGrade.disabled = true;
      if (weightsHintEl) weightsHintEl.textContent = "The sum must be exactly 10";
      return null;
    }

    if (weightsHintEl) weightsHintEl.textContent = "OK";
    if (btnConfirmFinalGrade) btnConfirmFinalGrade.disabled = false;
    return { ws, wt, wa };
  }

  function weightsToDecimals(ws, wt, wa) {
    return {
      self_weight: ws / 10,
      teacher_weight: wt / 10,
      ai_weight: wa / 10,
    };
  }

  function resetEvalUI() {
    const {
      evalStudentBody,
      evalTeacherBody,
      evalAiBody,
      btnComputeFinalGrade,
      finalGradeContainer,
      weightsHintEl,
      weightsSumEl,
      btnConfirmFinalGrade,
    } = modal.refs;

    modal.state.peerClosedAt = null;

    if (evalStudentBody) {
      evalStudentBody.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-muted">
          <div class="spinner-border spinner-border-sm text-success"></div>
          <div>Waiting for self-evaluation...</div>
        </div>
      `;
    }

    if (evalTeacherBody) evalTeacherBody.innerHTML = `<div class="text-muted">Loading peer data...</div>`;
    if (evalAiBody) evalAiBody.innerHTML = `<div class="text-muted">Loading...</div>`;

    if (btnComputeFinalGrade) btnComputeFinalGrade.disabled = true;
    if (finalGradeContainer) finalGradeContainer.innerHTML = "";

    hideWeightsError();
    if (weightsHintEl) weightsHintEl.textContent = "";
    if (weightsSumEl) weightsSumEl.textContent = "10";
    if (btnConfirmFinalGrade) btnConfirmFinalGrade.disabled = true;
    modal.bsFinalCollapse?.hide();
  }

  async function loadFinalGrade(submissionId) {
    try {
      const fg = await window.DASH.api(`/final-grades/by-submission/${submissionId}`);
      renderFinalGradeCard(fg);
    } catch {
      if (modal.refs.finalGradeContainer) modal.refs.finalGradeContainer.innerHTML = "";
    }
  }

  function renderFinalGradeCard(fg) {
    const { finalGradeContainer, btnComputeFinalGrade } = modal.refs;
    if (!finalGradeContainer) return;

    if (!fg) {
      finalGradeContainer.innerHTML = "";
      return;
    }

    finalGradeContainer.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="fw-semibold mb-2">Final Grade</div>

          <div class="d-flex flex-wrap gap-3 small text-muted mb-2">
            <div><strong>Peer weight:</strong> ${Number(fg.teacher_weight).toFixed(2)}</div>
            <div><strong>AI weight:</strong> ${Number(fg.ai_weight).toFixed(2)}</div>
            <div><strong>Self weight:</strong> ${Number(fg.self_weight).toFixed(2)}</div>
          </div>

          <div class="fs-5">
            <strong>${Number(fg.final_score).toFixed(2)}</strong>
            ${fg.final_honors ? `<span class="badge bg-success ms-2">Honors</span>` : ""}
          </div>

          <div class="small text-muted mt-2">
            Computed: ${utils.safeDate(fg.computed_at)}
          </div>
        </div>
      </div>
    `;

    if (btnComputeFinalGrade) btnComputeFinalGrade.disabled = true;
    modal.bsFinalCollapse?.hide();
  }

  function openSubmissionModal(sub, exam) {
    const {
      subModalTitle,
      subModalMeta,
      subModalAnswers,
      subModalEmpty,
      subModalEl,
    } = modal.refs;

    modal.state.currentSubmissionId = sub.id;

    const examTitle = exam?.title || "Exam";
    if (subModalTitle) subModalTitle.textContent = `Submission #${sub.id} — ${examTitle}`;

    if (subModalMeta) {
      subModalMeta.innerHTML = `
        <div><strong>Student:</strong> ${utils.getStudentLabelFromSubmission(sub)}</div>
        <div>
          <strong>Submitted:</strong> ${utils.safeDate(sub.submitted_at)}
          <span class="mx-2">•</span>
          <strong>Status:</strong> ${utils.escapeHtml(sub.status)}
        </div>
      `;
    }

    resetEvalUI();

    if (subModalAnswers) {
      subModalAnswers.innerHTML = "";
      const answers = sub.answers || [];

      if (!answers.length) {
        subModalEmpty?.classList.remove("d-none");
      } else {
        subModalEmpty?.classList.add("d-none");
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
            subModalAnswers.appendChild(card);
          });
      }
    }

    modal.loadEvaluations(sub.id);
    loadFinalGrade(sub.id);

    bootstrap.Modal.getOrCreateInstance(subModalEl).show();
  }

  [modal.refs.wStudentEl, modal.refs.wTeacherEl, modal.refs.wAiEl].forEach((el) =>
    el?.addEventListener("input", () => {
      validateWeightsAndToggle();
      if (modal.state.currentSubmissionId) modal.renderPeerSummary(modal.state.currentSubmissionId);
    }),
  );

  modal.refs.btnCancelFinalGrade?.addEventListener("click", () => {
    hideWeightsError();
    modal.bsFinalCollapse?.hide();
  });

  modal.refs.btnConfirmFinalGrade?.addEventListener("click", async () => {
    if (!modal.state.currentSubmissionId) return;

    const v = validateWeightsAndToggle();
    if (!v) return;

    const { ws, wt, wa } = v;
    const decimals = weightsToDecimals(ws, wt, wa);

    modal.refs.btnConfirmFinalGrade.disabled = true;
    const old = modal.refs.btnConfirmFinalGrade.innerHTML;
    modal.refs.btnConfirmFinalGrade.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Computing...`;

    try {
      const fg = await window.DASH.api("/final-grades", {
        method: "POST",
        body: JSON.stringify({
          submission_id: modal.state.currentSubmissionId,
          ...decimals,
        }),
      });

      renderFinalGradeCard(fg);
      modal.bsFinalCollapse?.hide();
    } catch (e) {
      showWeightsError(e?.message || "Error computing final grade.");
      modal.refs.btnConfirmFinalGrade.disabled = false;
    } finally {
      modal.refs.btnConfirmFinalGrade.innerHTML = old;
    }
  });

  modal.refs.btnComputeFinalGrade?.addEventListener("click", () => {
    if (!modal.state.currentSubmissionId) return;
    hideWeightsError();
    validateWeightsAndToggle();
    modal.bsFinalCollapse?.show();
  });

  modal.hideWeightsError = hideWeightsError;
  modal.showWeightsError = showWeightsError;
  modal.getInt1to10 = getInt1to10;
  modal.validateWeightsAndToggle = validateWeightsAndToggle;
  modal.weightsToDecimals = weightsToDecimals;
  modal.resetEvalUI = resetEvalUI;
  modal.loadFinalGrade = loadFinalGrade;
  modal.renderFinalGradeCard = renderFinalGradeCard;
  modal.openSubmissionModal = openSubmissionModal;

  window.runAiEvaluation = modal.runAiEvaluation;
})();