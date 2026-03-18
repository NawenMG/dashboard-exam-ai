// app/static/js/student/exams.render.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;
  const { utils } = NS;

  const examsRender = (NS.examsRender = NS.examsRender || {});

  function renderTodoCard(exam) {
    const el = document.createElement("div");
    el.className = "card shadow-sm";

    el.innerHTML = `
      <div class="card-body py-2">
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div class="me-2">
            <div class="fw-semibold">${utils.escapeHtml(exam.title || "Exam")}</div>
            <div class="small text-muted">${utils.escapeHtml(exam.description || "")}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-success">Published</span>
            <button class="btn btn-sm btn-dark" data-action="join">Join</button>
          </div>
        </div>
      </div>
    `;

    el.querySelector('[data-action="join"]').onclick = () => NS.modal.openJoinModal(exam);
    return el;
  }

  function renderDoneCard(submission, exam) {
    const el = document.createElement("div");
    el.className = "card shadow-sm";

    const title = exam?.title || `Exam #${submission.exam_id}`;
    const desc = exam?.description || "";
    const status = submission.status || "—";

    el.innerHTML = `
      <div class="card-body py-2">
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div class="me-2">
            <div class="fw-semibold">${utils.escapeHtml(title)}</div>
            <div class="small text-muted">${utils.escapeHtml(desc)}</div>
            <div class="small text-muted mt-1">
              <strong>Submitted:</strong> ${utils.safeDate(submission.submitted_at)}
              <span class="mx-2">•</span>
              <strong>Status:</strong> ${utils.escapeHtml(status)}
            </div>
          </div>

          <button class="btn btn-sm btn-outline-secondary" data-action="show" title="Open">
            <i class="fa-solid fa-eye"></i>
          </button>
        </div>
      </div>
    `;

    el.querySelector('[data-action="show"]').onclick = () => NS.modal.openDoneModal(submission, exam);
    return el;
  }

  examsRender.renderTodoCard = renderTodoCard;
  examsRender.renderDoneCard = renderDoneCard;
})();