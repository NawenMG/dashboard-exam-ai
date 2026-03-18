// app/static/js/student/exams.api.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;

  const examsApi = (NS.examsApi = NS.examsApi || {});

  async function fetchAllPages(urlBuilder, maxPages = 10) {
    const out = [];
    for (let p = 1; p <= maxPages; p++) {
      const paged = await window.DASH.api(urlBuilder(p));
      const items = paged.items || [];
      out.push(...items);

      const totalPages = paged?.meta?.total_pages;
      if (totalPages && p >= totalPages) break;
      if (!items.length) break;
    }
    return out;
  }

  async function loadAllPublishedExams() {
    return await fetchAllPages((p) => `/exams/published?page=${p}&page_size=50`, 10);
  }

  async function loadMySubmissions(studentId) {
    return await fetchAllPages(
      (p) => `/submissions/by-student/${Number(studentId)}?page=${p}&page_size=50`,
      10,
    );
  }

  examsApi.fetchAllPages = fetchAllPages;
  examsApi.loadAllPublishedExams = loadAllPublishedExams;
  examsApi.loadMySubmissions = loadMySubmissions;
})();