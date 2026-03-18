// app/static/js/teacher/modal.evaluations.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;
  const { utils } = NS;

  const modal = (NS.modal = NS.modal || {});

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
    const refs = modal.refs;
    if (!refs?.evalStudentBody) return;

    if (!ev) {
      refs.evalStudentBody.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-muted">
          <div class="spinner-border spinner-border-sm text-success"></div>
          <div>Waiting for self-evaluation...</div>
        </div>
      `;
      return;
    }

    const w = modal.getInt1to10(refs.wStudentEl?.value) ?? 1;
    refs.evalStudentBody.innerHTML = `
      <div>Score: <strong>${ev.score}</strong></div>
      <div>Honors: ${ev.honors ? "yes" : "no"}</div>
      <div class="mt-2">${utils.escapeHtml(ev.comment)}</div>
      <div class="mt-2 text-muted">Current weight: <strong>${w}</strong>/10</div>
    `;
  }

  function buildPeerCommentsCarousel(submissionId, comments) {
    const items = (comments || []).filter((c) => String(c || "").trim().length > 0);
    if (!items.length) {
      return `<div class="text-muted small mt-2">No peer comments available.</div>`;
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
        <div class="small text-muted text-center mt-1">${items.length} comments</div>
      </div>
    `;
  }

  function renderPeerGate(submissionId) {
    const refs = modal.refs;
    if (!refs?.evalTeacherBody) return;

    const w = modal.getInt1to10(refs.wTeacherEl?.value) ?? 6;

    refs.evalTeacherBody.innerHTML = `
      <div class="fw-semibold">Peer review</div>
      <div class="small text-muted">
        Close peer evaluations for this submission and compute the average.
      </div>

      <button class="btn btn-sm btn-dark mt-2" id="btnClosePeerReviews">
        <i class="fa-solid fa-lock me-1"></i>Close peer reviews & compute average
      </button>

      <div class="small text-muted mt-2">Current weight: <strong>${w}</strong>/10</div>

      <div id="peerGateError" class="alert alert-danger d-none mt-2 mb-0 small"></div>
    `;

    const btn = document.getElementById("btnClosePeerReviews");
    const err = document.getElementById("peerGateError");

    btn?.addEventListener("click", async () => {
      btn.disabled = true;
      const old = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Closing...`;

      if (err) {
        err.classList.add("d-none");
        err.textContent = "";
      }

      try {
        await window.DASH.api(`/evaluations/peer/close/${submissionId}`, { method: "POST" });
        await renderPeerSummary(submissionId);
        await loadEvaluations(submissionId);
      } catch (e) {
        if (err) {
          err.textContent = e?.message || "Error while closing peer reviews.";
          err.classList.remove("d-none");
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = old;
      }
    });
  }

  async function renderPeerSummary(submissionId) {
    const refs = modal.refs;
    if (!refs?.evalTeacherBody) return;

    let summary = null;
    try {
      summary = await window.DASH.api(`/evaluations/peer/summary/${submissionId}`);
    } catch {
      summary = null;
    }

    modal.state.peerClosedAt = summary?.closed_at || null;

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

    if (!modal.state.peerClosedAt) {
      renderPeerGate(submissionId);
      return;
    }

    const w = modal.getInt1to10(refs.wTeacherEl?.value) ?? 6;
    const avg = summary?.avg;
    const count = summary?.count ?? 0;
    const min = summary?.min;
    const max = summary?.max;

    refs.evalTeacherBody.innerHTML = `
      <div class="fw-semibold d-flex align-items-center justify-content-between">
        <span>Peer summary</span>
        <span class="badge bg-secondary">Closed</span>
      </div>

      <div class="mt-2">
        <div>Average: <strong>${avg == null ? "—" : Number(avg).toFixed(2)}</strong></div>
        <div class="small text-muted">
          N=${count}
          ${min != null ? ` • min ${min}` : ""}
          ${max != null ? ` • max ${max}` : ""}
        </div>
        <div class="small text-muted mt-1">
          Closed: ${utils.safeDate(modal.state.peerClosedAt)}
        </div>
        <div class="small text-muted mt-2">Current weight: <strong>${w}</strong>/10</div>
      </div>

      <div class="mt-2">
        <div class="small fw-semibold mb-1">Peer comments</div>
        ${buildPeerCommentsCarousel(submissionId, comments)}
      </div>
    `;
  }

  function renderAiEval(submissionId, ev) {
    const refs = modal.refs;
    if (!refs?.evalAiBody) return;

    if (!ev) {
      refs.evalAiBody.innerHTML = `
        <button class="btn btn-sm btn-primary"
                onclick="runAiEvaluation(${submissionId})">
          Run AI evaluation
        </button>

        <div class="small text-muted mt-2">
          Endpoint: <code>/ai-evaluations/${submissionId}</code>
        </div>
      `;
      return;
    }

    const w = modal.getInt1to10(refs.wAiEl?.value) ?? 3;
    refs.evalAiBody.innerHTML = `
      <div>Score: <strong>${ev.score}</strong></div>
      <div>Honors: ${ev.honors ? "yes" : "no"}</div>
      <div class="mt-2">${utils.escapeHtml(ev.comment)}</div>
      <div class="mt-2 text-muted">Current weight: <strong>${w}</strong>/10</div>
      <div class="small text-muted mt-2">
        Endpoint: <code>/ai-evaluations/${submissionId}</code>
      </div>
    `;
  }

  function checkFinalGradeReady(student, ai) {
    const refs = modal.refs;
    const ready = !!(student && ai && modal.state.peerClosedAt);
    if (refs?.btnComputeFinalGrade) refs.btnComputeFinalGrade.disabled = !ready;
    if (!ready) modal.bsFinalCollapse?.hide();
  }

  async function loadEvaluations(submissionId) {
    const refs = modal.refs;
    if (refs?.evalStudentBody) {
      refs.evalStudentBody.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-muted">
          <div class="spinner-border spinner-border-sm text-success"></div>
          <div>Waiting for self-evaluation...</div>
        </div>
      `;
    }
    if (refs?.evalTeacherBody) refs.evalTeacherBody.innerHTML = `<div class="text-muted">Loading peer data...</div>`;
    if (refs?.evalAiBody) refs.evalAiBody.innerHTML = `<div class="text-muted">Loading...</div>`;

    let raw;
    try {
      raw = await window.DASH.api(`/evaluations/by-submission/${submissionId}`);
    } catch (_) {
      if (refs?.evalTeacherBody) {
        refs.evalTeacherBody.innerHTML = `<div class="text-danger small">Error loading evaluations.</div>`;
      }
      if (refs?.evalAiBody) {
        refs.evalAiBody.innerHTML = `<div class="text-danger small">Error loading evaluations.</div>`;
      }
      return;
    }

    const norm = normalizeEvaluationsPayload(raw);
    const studentEval = norm.student || null;
    const aiEval = norm.ai || null;

    renderStudentEval(studentEval);
    renderAiEval(submissionId, aiEval);

    await renderPeerSummary(submissionId);

    checkFinalGradeReady(studentEval, aiEval);
  }

  async function runAiEvaluation(submissionId) {
    const refs = modal.refs;
    if (refs?.evalAiBody) {
      refs.evalAiBody.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-muted">
          <div class="spinner-border spinner-border-sm text-primary"></div>
          <div>AI evaluation in progress...</div>
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
      if (!refs?.evalAiBody) return;
      refs.evalAiBody.innerHTML = `
        <div class="text-danger small">
          AI evaluation error: ${utils.escapeHtml(e?.message || "error")}
        </div>

        <button class="btn btn-sm btn-primary mt-2"
                onclick="runAiEvaluation(${submissionId})">
          Retry AI
        </button>

        <div class="small text-muted mt-2">
          Endpoint: <code>/ai-evaluations/${submissionId}</code>
        </div>
      `;
    }
  }

  modal.normalizeEvaluationsPayload = normalizeEvaluationsPayload;
  modal.renderStudentEval = renderStudentEval;
  modal.buildPeerCommentsCarousel = buildPeerCommentsCarousel;
  modal.renderPeerGate = renderPeerGate;
  modal.renderPeerSummary = renderPeerSummary;
  modal.renderAiEval = renderAiEval;
  modal.checkFinalGradeReady = checkFinalGradeReady;
  modal.loadEvaluations = loadEvaluations;
  modal.runAiEvaluation = runAiEvaluation;
})();