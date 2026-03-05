// app/static/js/teacher/modal.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;

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
  // ✅ rimane evalTeacherBody come base, ma dentro ci mettiamo PEER UI
  const evalTeacherBody = document.getElementById("evalTeacherBody");
  const evalAiBody = document.getElementById("evalAiBody");

  const btnComputeFinalGrade = document.getElementById("btnComputeFinalGrade");
  const finalGradeContainer = document.getElementById("finalGradeContainer");

  // Final grade collapse refs
  const finalGradeCollapseEl = document.getElementById("finalGradeCollapse");
  const wStudentEl = document.getElementById("wStudent");
  // ✅ rimane wTeacher come base, ma è il peso PEER
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

  // ✅ peer gate state
  let peerClosedAt = null;

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
    const wt = getInt1to10(wTeacherEl?.value); // ✅ PEER
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
      teacher_weight: wt / 10, // ✅ compat: teacher_weight usato come PEER weight
      ai_weight: wa / 10,
    };
  }

  function resetEvalUI() {
    peerClosedAt = null;

    if (evalStudentBody) {
      evalStudentBody.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-muted">
          <div class="spinner-border spinner-border-sm text-success"></div>
          <div>In attesa autovalutazione...</div>
        </div>
      `;
    }

    if (evalTeacherBody) evalTeacherBody.innerHTML = `<div class="text-muted">Caricamento peer...</div>`;
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
    const out = { student: null, ai: null, peer: [] };
    if (!raw) return out;

    const arr = raw.evaluations || raw.items || raw.data || null;
    if (Array.isArray(arr)) {
      for (const ev of arr) {
        const t = ev?.evaluator_type;
        if (t === "student") out.student = ev;
        else if (t === "ai") out.ai = ev;
        else if (t === "peer") out.peer.push(ev);
      }
      return out;
    }

    // fallback
    for (const k of Object.keys(raw)) {
      const ev = raw[k];
      if (!ev || typeof ev !== "object") continue;
      const t = ev?.evaluator_type;
      if (t === "student") out.student = ev;
      if (t === "ai") out.ai = ev;
      if (t === "peer") out.peer.push(ev);
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

  function buildPeerCommentsCarousel(submissionId, comments) {
    const items = (comments || []).filter((c) => String(c || "").trim().length > 0);
    if (!items.length) {
      return `<div class="text-muted small mt-2">Nessun commento peer disponibile.</div>`;
    }

    const carouselId = `peerCommentsCarousel_${submissionId}`;

    const slides = items
      .map(
        (c, idx) => `
        <div class="carousel-item ${idx === 0 ? "active" : ""}">
          <div class="border rounded-3 p-2 bg-light">
            <div class="small">${utils.escapeHtml(c)}</div>
          </div>
        </div>
      `,
      )
      .join("");

    return `
      <div id="${carouselId}" class="carousel slide mt-2" data-bs-ride="false">
        <div class="carousel-inner">
          ${slides}
        </div>
        <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Prev</span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Next</span>
        </button>
        <div class="small text-muted text-center mt-1">${items.length} commenti</div>
      </div>
    `;
  }

  function renderPeerGate(submissionId) {
    if (!evalTeacherBody) return;

    const w = getInt1to10(wTeacherEl?.value) ?? 6;

    evalTeacherBody.innerHTML = `
      <div class="fw-semibold">Peer review</div>
      <div class="small text-muted">
        Chiudi le peer evaluation per questa submission e calcola la media.
      </div>

      <button class="btn btn-sm btn-dark mt-2" id="btnClosePeerReviews">
        <i class="fa-solid fa-lock me-1"></i>Chiudi peer & calcola media
      </button>

      <div class="small text-muted mt-2">Peso corrente: <strong>${w}</strong>/10</div>

      <div id="peerGateError" class="alert alert-danger d-none mt-2 mb-0 small"></div>
    `;

    const btn = document.getElementById("btnClosePeerReviews");
    const err = document.getElementById("peerGateError");

    btn?.addEventListener("click", async () => {
      btn.disabled = true;
      const old = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Chiusura...`;

      if (err) {
        err.classList.add("d-none");
        err.textContent = "";
      }

      try {
        await window.DASH.api(`/evaluations/peer/close/${submissionId}`, { method: "POST" });
        await renderPeerSummary(submissionId);
        // ricarico anche enable/disable final grade
        await loadEvaluations(submissionId);
      } catch (e) {
        if (err) {
          err.textContent = e?.message || "Errore chiusura peer review.";
          err.classList.remove("d-none");
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = old;
      }
    });
  }

  async function renderPeerSummary(submissionId) {
    if (!evalTeacherBody) return;

    // 1) summary
    let summary = null;
    try {
      summary = await window.DASH.api(`/evaluations/peer/summary/${submissionId}`);
    } catch {
      summary = null;
    }

    peerClosedAt = summary?.closed_at || null;

    // 2) comments from by-submission (peer completed)
    let comments = [];
    try {
      const raw = await window.DASH.api(`/evaluations/by-submission/${submissionId}`);
      const norm = normalizeEvaluationsPayload(raw);
      comments = (norm.peer || [])
        .filter((x) => x?.status === "completed")
        .map((x) => x?.comment)
        .filter(Boolean);
    } catch {
      comments = [];
    }

    if (!peerClosedAt) {
      renderPeerGate(submissionId);
      return;
    }

    const w = getInt1to10(wTeacherEl?.value) ?? 6;
    const avg = summary?.avg;
    const count = summary?.count ?? 0;
    const min = summary?.min;
    const max = summary?.max;

    evalTeacherBody.innerHTML = `
      <div class="fw-semibold d-flex align-items-center justify-content-between">
        <span>Peer summary</span>
        <span class="badge bg-secondary">Chiusa</span>
      </div>

      <div class="mt-2">
        <div>Media: <strong>${avg == null ? "—" : Number(avg).toFixed(2)}</strong></div>
        <div class="small text-muted">
          N=${count}
          ${min != null ? ` • min ${min}` : ""}
          ${max != null ? ` • max ${max}` : ""}
        </div>
        <div class="small text-muted mt-1">
          Closed: ${utils.safeDate(peerClosedAt)}
        </div>
        <div class="small text-muted mt-2">Peso corrente: <strong>${w}</strong>/10</div>
      </div>

      <div class="mt-2">
        <div class="small fw-semibold mb-1">Commenti peer</div>
        ${buildPeerCommentsCarousel(submissionId, comments)}
      </div>
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

  function checkFinalGradeReady(student, ai) {
    const ready = !!(student && ai && peerClosedAt);
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
    if (evalTeacherBody) evalTeacherBody.innerHTML = `<div class="text-muted">Caricamento peer...</div>`;
    if (evalAiBody) evalAiBody.innerHTML = `<div class="text-muted">Caricamento...</div>`;

    let raw;
    try {
      raw = await window.DASH.api(`/evaluations/by-submission/${submissionId}`);
    } catch (_) {
      if (evalTeacherBody)
        evalTeacherBody.innerHTML = `<div class="text-danger small">Errore caricamento valutazioni.</div>`;
      if (evalAiBody)
        evalAiBody.innerHTML = `<div class="text-danger small">Errore caricamento valutazioni.</div>`;
      return;
    }

    const norm = normalizeEvaluationsPayload(raw);
    const studentEval = norm.student || null;
    const aiEval = norm.ai || null;

    renderStudentEval(studentEval);
    renderAiEval(submissionId, aiEval);

    // ✅ peer: gate oppure summary
    await renderPeerSummary(submissionId);

    checkFinalGradeReady(studentEval, aiEval);
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
  [wStudentEl, wTeacherEl, wAiEl].forEach((el) =>
    el?.addEventListener("input", () => {
      validateWeightsAndToggle();
      // aggiorna solo il peso mostrato nella card peer (se è già renderizzata)
      if (currentSubmissionId) renderPeerSummary(currentSubmissionId);
    }),
  );

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

  // exports
  window.runAiEvaluation = runAiEvaluation;

  modal.openSubmissionModal = openSubmissionModal;
  modal.loadEvaluations = loadEvaluations;
  modal.loadFinalGrade = loadFinalGrade;
})();