// app/static/js/execution-exam/ui.render.js
(() => {
  window.EXEC_EXAM = window.EXEC_EXAM || {};
  const NS = window.EXEC_EXAM;
  const ui = (NS.ui = NS.ui || {});

  function renderQuestions(questions) {
    const { questionsWrap, qCountLabel } = ui.refs;
    questionsWrap.innerHTML = "";

    questions.forEach((q, idx) => {
      const card = document.createElement("div");
      card.className = "card shadow-sm";
      card.innerHTML = `
        <div class="card-body">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div class="me-2">
              <div class="small text-muted mb-1">
                Question #${idx + 1}
                ${
                  q?.max_score != null
                    ? `<span class="ms-2 badge bg-secondary">max ${ui.escapeHtml(q.max_score)}</span>`
                    : ""
                }
              </div>
              <div class="fw-semibold mb-2">${ui.escapeHtml(q?.text || "")}</div>
            </div>
          </div>

          <label class="form-label small text-muted mb-1">Answer</label>
          <textarea
            class="form-control"
            rows="3"
            data-qidx="${idx}"
            placeholder="Write your answer here..."
          ></textarea>
        </div>
      `;
      questionsWrap.appendChild(card);
    });

    qCountLabel.textContent = `${questions.length} questions`;
  }

  function renderNoQuestions() {
    const { questionsWrap, qCountLabel } = ui.refs;
    questionsWrap.innerHTML = `<div class="alert alert-warning mb-0">This exam has no questions.</div>`;
    qCountLabel.textContent = "";
  }

  ui.renderQuestions = renderQuestions;
  ui.renderNoQuestions = renderNoQuestions;
})();