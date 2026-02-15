// app/static/js/teacher/modal.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;

  // ==========================
  // Utils condivise
  // ==========================
  const utils = (NS.utils = NS.utils || {});

  utils.escapeHtml = utils.escapeHtml || function escapeHtml(s) {
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

  utils.safeDate = utils.safeDate || function safeDate(dt) {
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

  utils.getCriteria =
    utils.getCriteria ||
    function getCriteria(exam) {
      return exam?.rubric_json?.criteria || [];
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
      return txt ? txt : `Domanda #${Number(questionIndex) + 1}`;
    };

  // ==========================
  // Modal module
  // ==========================
  const modal = (NS.modal = NS.modal || {});

  // DOM refs (modal)
  const subModalEl = document.getElementById("submissionModal");
  const subModalTitle = document.getElementById("subModalTitle");
  const subModalMeta = document.getElementById("subModalMeta");
  const subModalAnswers = document.getElementById("subModalAnswers");
  const subModalEmpty = document.getElementById("subModalEmpty");

  const evalStudentBody = document.getElementById("evalStudentBody");
  const evalTeacherBody = document.getElementById("evalTeacherBody");
  const evalAiBody = document.getElementById("evalAiBody");

  const btnComputeFinalGrade = document.getElementById("btnComputeFinalGrade");
  const finalGradeContainer = document.getElementById("finalGradeContainer");

  // Final grade collapse refs
  const finalGradeCollapseEl = document.getElementById("finalGradeCollapse");
  const wStudentEl = document.getElementById("wStudent");
  const wTeacherEl = document.getElementById("wTeacher");
  const wAiEl = document.getElementById("wAi");
  const weightsSumEl = document.getElementById("weightsSum");
  const weightsHintEl = document.getElementById("weightsHint");
  const weightsErrorEl = document.getElementById("weightsError");
  const btnCancelFinalGrade = document.getElementById("btnCancelFinalGrade");
  const btnConfirmFinalGrade = document.getElementById("btnConfirmFinalGrade");

  const bsFinalCollapse = finalGradeCollapseEl
    ? new bootstrap.Collapse(finalGradeCollapseEl, { toggle: false })
    : null;

  let currentSubmissionId = null;

  function hideWeightsError() {
    if (!weightsErrorEl) return;
    weightsErrorEl.classList.add("d-none");
    weightsErrorEl.textContent = "";
  }

  function showWeightsError(msg) {
    if (!weightsErrorEl) return;
    weightsErrorEl.textContent = msg || "Errore";
    weightsErrorEl.classList.remove("d-none");
  }

  function getInt1to10(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 10) return null;
    return n;
  }

  function validateWeightsAndToggle() {
    hideWeightsError();

    const ws = getInt1to10(wStudentEl?.value);
    const wt = getInt1to10(wTeacherEl?.value);
    const wa = getInt1to10(wAiEl?.value);

    if (ws === null || wt === null || wa === null) {
      if (btnConfirmFinalGrade) btnConfirmFinalGrade.disabled = true;
      if (weightsSumEl) weightsSumEl.textContent = "—";
      if (weightsHintEl) weightsHintEl.textContent = "I pesi devono essere interi tra 1 e 10";
      return null;
    }

    const sum = ws + wt + wa;
    if (weightsSumEl) weightsSumEl.textContent = String(sum);

    if (sum !== 10) {
      if (btnConfirmFinalGrade) btnConfirmFinalGrade.disabled = true;
      if (weightsHintEl) weightsHintEl.textContent = "La somma deve essere esattamente 10";
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
    if (evalStudentBody) {
      evalStudentBody.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-muted">
          <div class="spinner-border spinner-border-sm text-success"></div>
          <div>In attesa autovalutazione...</div>
        </div>
      `;
    }
    if (evalTeacherBody) evalTeacherBody.innerHTML = `<div class="text-muted">Caricamento...</div>`;
    if (evalAiBody) evalAiBody.innerHTML = `<div class="text-muted">Caricamento...</div>`;

    if (btnComputeFinalGrade) btnComputeFinalGrade.disabled = true;
    if (finalGradeContainer) finalGradeContainer.innerHTML = "";

    hideWeightsError();
    if (weightsHintEl) weightsHintEl.textContent = "";
    if (weightsSumEl) weightsSumEl.textContent = "10";
    if (btnConfirmFinalGrade) btnConfirmFinalGrade.disabled = true;
    bsFinalCollapse?.hide();
  }

  function normalizeEvaluationsPayload(raw) {
    const out = { student: null, teacher: null, ai: null };
    if (!raw) return out;

    if (raw.student || raw.teacher || raw.ai || raw.self) {
      out.student = raw.student ?? raw.self ?? null;
      out.teacher = raw.teacher ?? null;
      out.ai = raw.ai ?? null;
      return out;
    }

    const arr = raw.evaluations || raw.items || raw.data || null;
    if (Array.isArray(arr)) {
      for (const ev of arr) {
        const t = ev?.evaluator_type;
        if (t === "student") out.student = ev;
        else if (t === "teacher") out.teacher = ev;
        else if (t === "ai") out.ai = ev;
      }
      return out;
    }

    for (const k of Object.keys(raw)) {
      const ev = raw[k];
      if (!ev || typeof ev !== "object") continue;
      const t = ev?.evaluator_type;
      if (t === "student") out.student = ev;
      if (t === "teacher") out.teacher = ev;
      if (t === "ai") out.ai = ev;
    }

    return out;
  }

  function renderStudentEval(ev) {
    if (!evalStudentBody) return;

    if (!ev) {
      evalStudentBody.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-muted">
          <div class="spinner-border spinner-border-sm text-success"></div>
          <div>In attesa autovalutazione...</div>
        </div>
      `;
      return;
    }

    const w = getInt1to10(wStudentEl?.value) ?? 1;
    evalStudentBody.innerHTML = `
      <div>Score: <strong>${ev.score}</strong></div>
      <div>Honors: ${ev.honors ? "yes" : "no"}</div>
      <div class="mt-2">${utils.escapeHtml(ev.comment)}</div>
      <div class="mt-2 text-muted">Peso corrente: <strong>${w}</strong>/10</div>
    `;
  }

  function renderTeacherEval(submissionId, ev) {
    if (!evalTeacherBody) return;

    if (!ev) {
      evalTeacherBody.innerHTML = `
        <label class="form-label small text-muted mb-1">Score (0-30)</label>
        <input id="teacherScore"
              class="form-control mb-2"
              type="number"
              min="0"
              max="30"
              step="1"
              placeholder="Score (0-30)">

        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" id="teacherHonors">
          <label class="form-check-label" for="teacherHonors">Lode</label>
        </div>

        <textarea id="teacherComment"
                  class="form-control mb-2"
                  placeholder="Comment"></textarea>

        <button class="btn btn-sm btn-danger"
                id="btnSaveTeacherEval"
                onclick="submitTeacherEvaluation(${submissionId})">
          Salva valutazione
        </button>
      `;
      return;
    }

    const w = getInt1to10(wTeacherEl?.value) ?? 6;
    evalTeacherBody.innerHTML = `
      <div>Score: <strong>${ev.score}</strong></div>
      <div>Honors: ${ev.honors ? "yes" : "no"}</div>
      <div class="mt-2">${utils.escapeHtml(ev.comment)}</div>
      <div class="mt-2 text-muted">Peso corrente: <strong>${w}</strong>/10</div>
    `;
  }

  function renderAiEval(submissionId, ev) {
    if (!evalAiBody) return;

    if (!ev) {
      evalAiBody.innerHTML = `
        <button class="btn btn-sm btn-primary"
                onclick="runAiEvaluation(${submissionId})">
          Avvia valutazione AI
        </button>

        <div class="small text-muted mt-2">
          Endpoint: <code>/ai-evaluations/${submissionId}</code>
        </div>
      `;
      return;
    }

    const w = getInt1to10(wAiEl?.value) ?? 3;
    evalAiBody.innerHTML = `
      <div>Score: <strong>${ev.score}</strong></div>
      <div>Honors: ${ev.honors ? "yes" : "no"}</div>
      <div class="mt-2">${utils.escapeHtml(ev.comment)}</div>
      <div class="mt-2 text-muted">Peso corrente: <strong>${w}</strong>/10</div>
      <div class="small text-muted mt-2">
        Endpoint: <code>/ai-evaluations/${submissionId}</code>
      </div>
    `;
  }

  function checkFinalGradeReady(student, teacher, ai) {
    const ready = !!(student && teacher && ai);
    if (btnComputeFinalGrade) btnComputeFinalGrade.disabled = !ready;
    if (!ready) bsFinalCollapse?.hide();
  }

  async function loadEvaluations(submissionId) {
    if (evalStudentBody) {
      evalStudentBody.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-muted">
          <div class="spinner-border spinner-border-sm text-success"></div>
          <div>In attesa autovalutazione...</div>
        </div>
      `;
    }
    if (evalTeacherBody) evalTeacherBody.innerHTML = `<div class="text-muted">Caricamento...</div>`;
    if (evalAiBody) evalAiBody.innerHTML = `<div class="text-muted">Caricamento...</div>`;

    let raw;
    try {
      raw = await window.DASH.api(`/evaluations/by-submission/${submissionId}`);
    } catch (_) {
      if (evalTeacherBody)
        evalTeacherBody.innerHTML = `<div class="text-danger small">Errore caricamento valutazioni.</div>`;
      if (evalAiBody) evalAiBody.innerHTML = `<div class="text-danger small">Errore caricamento valutazioni.</div>`;
      return;
    }

    const norm = normalizeEvaluationsPayload(raw);
    const studentEval = norm.student || null;
    const teacherEval = norm.teacher || null;
    const aiEval = norm.ai || null;

    renderStudentEval(studentEval);
    renderTeacherEval(submissionId, teacherEval);
    renderAiEval(submissionId, aiEval);

    checkFinalGradeReady(studentEval, teacherEval, aiEval);
  }

  async function submitTeacherEvaluation(submissionId) {
    const scoreEl = document.getElementById("teacherScore");
    const honorsEl = document.getElementById("teacherHonors");
    const commentEl = document.getElementById("teacherComment");

    const score = Number(scoreEl?.value);
    const honors = !!honorsEl?.checked;
    const comment = (commentEl?.value || "").trim();

    if (!Number.isInteger(score) || score < 0 || score > 30) {
      alert("Score deve essere un intero tra 0 e 30.");
      return;
    }
    if (honors && score !== 30) {
      alert("La lode è consentita solo con score = 30.");
      return;
    }
    if (!comment) {
      alert("Inserisci un commento.");
      return;
    }

    const btn = document.getElementById("btnSaveTeacherEval");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Salvataggio...`;
    }

    try {
      await window.DASH.api("/evaluations", {
        method: "POST",
        body: JSON.stringify({
          submission_id: submissionId,
          evaluator_type: "teacher",
          score,
          honors,
          comment,
        }),
      });

      await loadEvaluations(submissionId);
    } catch (e) {
      alert(e?.message || "Errore salvataggio valutazione teacher.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `Salva valutazione`;
      }
    }
  }

  async function runAiEvaluation(submissionId) {
    if (evalAiBody) {
      evalAiBody.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-muted">
          <div class="spinner-border spinner-border-sm text-primary"></div>
          <div>Valutazione AI in corso...</div>
        </div>
        <div class="small text-muted mt-2">
          Endpoint: <code>/ai-evaluations/${submissionId}</code>
        </div>
      `;
    }

    try {
      await window.DASH.api(`/ai-evaluations/${submissionId}`, {
        method: "POST",
        body: JSON.stringify({ model: null }),
      });

      await loadEvaluations(submissionId);
    } catch (e) {
      if (!evalAiBody) return;
      evalAiBody.innerHTML = `
        <div class="text-danger small">
          Errore valutazione AI: ${utils.escapeHtml(e?.message || "errore")}
        </div>

        <button class="btn btn-sm btn-primary mt-2"
                onclick="runAiEvaluation(${submissionId})">
          Riprova AI
        </button>

        <div class="small text-muted mt-2">
          Endpoint: <code>/ai-evaluations/${submissionId}</code>
        </div>
      `;
    }
  }

  async function loadFinalGrade(submissionId) {
    try {
      const fg = await window.DASH.api(`/final-grades/by-submission/${submissionId}`);
      renderFinalGradeCard(fg);
    } catch {
      if (finalGradeContainer) finalGradeContainer.innerHTML = "";
    }
  }

  function renderFinalGradeCard(fg) {
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
            <div><strong>Teacher weight:</strong> ${Number(fg.teacher_weight).toFixed(2)}</div>
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
    bsFinalCollapse?.hide();
  }

  function openSubmissionModal(sub, exam) {
    currentSubmissionId = sub.id;

    const examTitle = exam?.title || "Exam";
    if (subModalTitle) subModalTitle.textContent = `Submission #${sub.id} — ${examTitle}`;

    if (subModalMeta) {
      subModalMeta.innerHTML = `
        <div><strong>Studente:</strong> ${utils.getStudentLabelFromSubmission(sub)}</div>
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

    loadEvaluations(sub.id);
    loadFinalGrade(sub.id);

    bootstrap.Modal.getOrCreateInstance(subModalEl).show();
  }

  // event binding per pesi/collapse
  [wStudentEl, wTeacherEl, wAiEl].forEach((el) => el?.addEventListener("input", validateWeightsAndToggle));

  btnCancelFinalGrade?.addEventListener("click", () => {
    hideWeightsError();
    bsFinalCollapse?.hide();
  });

  btnConfirmFinalGrade?.addEventListener("click", async () => {
    if (!currentSubmissionId) return;

    const v = validateWeightsAndToggle();
    if (!v) return;

    const { ws, wt, wa } = v;
    const decimals = weightsToDecimals(ws, wt, wa);

    btnConfirmFinalGrade.disabled = true;
    const old = btnConfirmFinalGrade.innerHTML;
    btnConfirmFinalGrade.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Calcolo...`;

    try {
      const fg = await window.DASH.api("/final-grades", {
        method: "POST",
        body: JSON.stringify({
          submission_id: currentSubmissionId,
          ...decimals,
        }),
      });

      renderFinalGradeCard(fg);
      bsFinalCollapse?.hide();
    } catch (e) {
      showWeightsError(e?.message || "Errore calcolo final grade.");
      btnConfirmFinalGrade.disabled = false;
    } finally {
      btnConfirmFinalGrade.innerHTML = old;
    }
  });

  btnComputeFinalGrade?.addEventListener("click", () => {
    if (!currentSubmissionId) return;
    hideWeightsError();
    validateWeightsAndToggle();
    bsFinalCollapse?.show();
  });

  // exports (per inline onclick già presente in HTML)
  window.runAiEvaluation = runAiEvaluation;
  window.submitTeacherEvaluation = submitTeacherEvaluation;

  // exports per gli altri moduli
  modal.openSubmissionModal = openSubmissionModal;
  modal.loadEvaluations = loadEvaluations;
  modal.loadFinalGrade = loadFinalGrade;
})();
