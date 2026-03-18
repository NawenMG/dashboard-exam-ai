// app/static/js/teacher/exams.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;
  const { utils, examsRender } = NS;

  const exams = (NS.exams = NS.exams || {});

  async function loadTeacherMyExams() {
    const status = document.getElementById("examsStatus");
    const container = document.getElementById("examsList");

    if (container) container.innerHTML = "";
    if (status) status.textContent = "Loading...";

    try {
      const paged = await window.DASH.api(`/exams/mine?page=1&page_size=50`);
      const items = paged.items || [];

      if (status) status.textContent = `${items.length} exams`;

      if (items.length === 0) {
        if (container) container.innerHTML = `<div class="text-muted small">No exams found.</div>`;
        return;
      }

      for (const exam of items) container.appendChild(examsRender.renderExamCard(exam));
    } catch (e) {
      if (status) status.textContent = "";
      if (container) {
        container.innerHTML = `<div class="alert alert-danger">Error: ${utils.escapeHtml(
          e.message,
        )}</div>`;
      }
    }
  }

  exams.loadTeacherMyExams = loadTeacherMyExams;
})();