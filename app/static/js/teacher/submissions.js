// app/static/js/teacher/submissions.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;
  const { utils } = NS;

  const submissions = (NS.submissions = NS.submissions || {});

  async function loadSubmissionsIntoExamAccordion(exam, bodyEl) {
    const subBlock = document.createElement("div");
    subBlock.innerHTML = `
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div class="fw-semibold">Submissions</div>
        <div class="small text-muted" data-sub-status>Caricamento...</div>
      </div>
      <div class="list-group" data-sub-list></div>
      <div class="text-muted small d-none" data-sub-empty>Nessuna submission trovata.</div>
    `;
    bodyEl.appendChild(subBlock);

    const subStatus = subBlock.querySelector("[data-sub-status]");
    const subList = subBlock.querySelector("[data-sub-list]");
    const subEmpty = subBlock.querySelector("[data-sub-empty]");

    try {
      const paged = await window.DASH.api(`/submissions/by-exam/${exam.id}?page=1&page_size=200`);
      const items = paged.items || [];
      subStatus.textContent = `${items.length} submissions`;

      subList.innerHTML = "";
      if (!items.length) {
        subEmpty.classList.remove("d-none");
        return;
      }
      subEmpty.classList.add("d-none");

      items.forEach((s) => {
        const a = document.createElement("button");
        a.type = "button";
        a.className =
          "list-group-item list-group-item-action d-flex justify-content-between align-items-center";

        a.innerHTML = `
          <div>
            <div class="fw-semibold">${utils.getStudentLabelFromSubmission(s)}</div>
            <div class="small text-muted">
              <span class="me-2"><strong>Submitted:</strong> ${utils.safeDate(s.submitted_at)}</span>
              <span class="me-2">•</span>
              <span><strong>Status:</strong> ${utils.escapeHtml(s.status)}</span>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right text-muted"></i>
        `;

        a.onclick = () => NS.modal.openSubmissionModal(s, exam);
        subList.appendChild(a);
      });
    } catch (e) {
      subStatus.textContent = `Errore`;
      subList.innerHTML = "";
      const err = document.createElement("div");
      err.className = "alert alert-danger mb-0";
      err.textContent =
        e?.message ||
        "Errore caricamento submissions. (Assicurati di avere /submissions/by-exam/{exam_id})";
      subBlock.appendChild(err);
    }
  }

  submissions.loadIntoExamAccordion = loadSubmissionsIntoExamAccordion;
})();
