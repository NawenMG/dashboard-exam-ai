// app/static/js/execution-exam/api.js
(() => {
  window.EXEC_EXAM = window.EXEC_EXAM || {};
  const NS = window.EXEC_EXAM;

  NS.api = NS.api || {};

  async function loadExamById(examId, maxPages = 10) {
    for (let p = 1; p <= maxPages; p++) {
      const paged = await window.DASH.api(`/exams/published?page=${p}&page_size=50`);
      const items = paged.items || [];
      const found = items.find((x) => Number(x.id) === Number(examId));
      if (found) return found;

      const totalPages = paged?.meta?.total_pages;
      if (totalPages && p >= totalPages) break;
      if (!items.length) break;
    }
    return null;
  }

  NS.api.loadExamById = loadExamById;
})();