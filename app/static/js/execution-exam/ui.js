// app/static/js/execution-exam/ui.js
(() => {
  window.EXEC_EXAM = window.EXEC_EXAM || {};
  const NS = window.EXEC_EXAM;

  const ui = (NS.ui = NS.ui || {});

  // Refs
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
    answersError.textContent = msg || "Errore";
    answersError.classList.remove("d-none");
  }
  function hideAnswersError() {
    answersError.classList.add("d-none");
    answersError.textContent = "";
  }

  function showSelfEvalError(msg) {
    selfEvalError.textContent = msg || "Errore";
    selfEvalError.classList.remove("d-none");
  }
  function hideSelfEvalError() {
    selfEvalError.classList.add("d-none");
    selfEvalError.textContent = "";
  }

  function showFatalError(msg) {
    submitFatalError.textContent = msg || "Errore";
    submitFatalError.classList.remove("d-none");
  }
  function hideFatalError() {
    submitFatalError.classList.add("d-none");
    submitFatalError.textContent = "";
  }

  function openConfirmModal() {
    confirmModalErr.classList.add("d-none");
    confirmModalErr.textContent = "";
    bootstrap.Modal.getOrCreateInstance(confirmModalEl).show();
  }

  function setConfirmModalError(msg) {
    confirmModalErr.textContent = msg || "Errore";
    confirmModalErr.classList.remove("d-none");
  }

  function setExamHeader(exam) {
    examTitleEl.textContent = exam.title || `Exam #${exam.id}`;
    examDescEl.textContent = exam.description || "";
  }

  function getQuestions(exam) {
    const q = exam?.questions_json?.questions;
    return Array.isArray(q) ? q : [];
  }

  function renderQuestions(questions) {
    questionsWrap.innerHTML = "";

    questions.forEach((q, idx) => {
      const card = document.createElement("div");
      card.className = "card shadow-sm";
      card.innerHTML = `
        <div class="card-body">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div class="me-2">
              <div class="small text-muted mb-1">
                Domanda #${idx + 1}
                ${
                  q?.max_score != null
                    ? `<span class="ms-2 badge bg-secondary">max ${escapeHtml(q.max_score)}</span>`
                    : ""
                }
              </div>
              <div class="fw-semibold mb-2">${escapeHtml(q?.text || "")}</div>
            </div>
          </div>

          <label class="form-label small text-muted mb-1">Risposta</label>
          <textarea
            class="form-control"
            rows="3"
            data-qidx="${idx}"
            placeholder="Scrivi qui la tua risposta..."
          ></textarea>
        </div>
      `;
      questionsWrap.appendChild(card);
    });

    qCountLabel.textContent = `${questions.length} domande`;
  }

  function renderNoQuestions() {
    questionsWrap.innerHTML = `<div class="alert alert-warning mb-0">Questo esame non ha domande.</div>`;
    qCountLabel.textContent = "";
  }

  function readAnswers() {
    hideAnswersError();

    const out = [];
    const areas = questionsWrap.querySelectorAll("textarea[data-qidx]");
    areas.forEach((ta) => {
      const i = Number(ta.getAttribute("data-qidx"));
      const txt = (ta.value || "").trim();
      out.push({ question_index: i, answer_text: txt });
    });

    const empty = out.filter((a) => !a.answer_text);
    if (empty.length) {
      throw new Error(
        `Compila tutte le risposte. Mancano: ${empty.map((x) => "#" + (x.question_index + 1)).join(", ")}`,
      );
    }
    return out;
  }

  function readSelfEvaluation() {
    hideSelfEvalError();

    const score = Number(selfScoreEl.value);
    const honors = !!selfHonorsEl.checked;
    const comment = (selfCommentEl.value || "").trim();

    if (!Number.isInteger(score) || score < 0 || score > 30) {
      throw new Error("Autovalutazione: score deve essere un intero tra 0 e 30.");
    }
    if (honors && score !== 30) {
      throw new Error("Autovalutazione: la lode è consentita solo con score = 30.");
    }
    if (!comment) {
      throw new Error("Autovalutazione: inserisci un commento.");
    }

    return { score, honors, comment };
  }

  function setConfirmSubmitBusy(busy) {
    if (!btnConfirmSubmit) return;
    btnConfirmSubmit.disabled = !!busy;
    if (busy) {
      btnConfirmSubmit.dataset.oldHtml = btnConfirmSubmit.innerHTML;
      btnConfirmSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Invio...`;
    } else {
      btnConfirmSubmit.innerHTML = btnConfirmSubmit.dataset.oldHtml || "Conferma invio";
    }
  }

  // exports
  ui.escapeHtml = escapeHtml;
  ui.showLoading = showLoading;

  ui.showAnswersError = showAnswersError;
  ui.hideAnswersError = hideAnswersError;

  ui.showSelfEvalError = showSelfEvalError;
  ui.hideSelfEvalError = hideSelfEvalError;

  ui.showFatalError = showFatalError;
  ui.hideFatalError = hideFatalError;

  ui.openConfirmModal = openConfirmModal;
  ui.setConfirmModalError = setConfirmModalError;
  ui.setConfirmSubmitBusy = setConfirmSubmitBusy;

  ui.setExamHeader = setExamHeader;
  ui.getQuestions = getQuestions;
  ui.renderQuestions = renderQuestions;
  ui.renderNoQuestions = renderNoQuestions;

  ui.readAnswers = readAnswers;
  ui.readSelfEvaluation = readSelfEvaluation;
})();
