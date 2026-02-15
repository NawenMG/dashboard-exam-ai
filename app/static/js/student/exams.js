// app/static/js/student/exams.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;
  const { utils } = NS;

  const exams = (NS.exams = NS.exams || {});

  // UI refs
  const todoList = document.getElementById("todoList");
  const todoEmpty = document.getElementById("todoEmpty");
  const todoStatus = document.getElementById("todoStatus");
  const todoCount = document.getElementById("todoCount");

  const doneList = document.getElementById("doneList");
  const doneEmpty = document.getElementById("doneEmpty");
  const doneStatus = document.getElementById("doneStatus");
  const doneCount = document.getElementById("doneCount");

  // State
  let ALL_PUBLISHED_EXAMS = [];
  let MY_SUBMISSIONS = [];

  function mapExamsById(examsArr) {
    const m = new Map();
    (examsArr || []).forEach((e) => m.set(e.id, e));
    return m;
  }

  // ✅ paginazione (page_size max 50 per evitare 422 su /by-student)
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

  function splitTodoDone(examsArr, submissionsArr) {
    const doneExamIds = new Set((submissionsArr || []).map((s) => s.exam_id));
    const todo = (examsArr || []).filter((e) => !doneExamIds.has(e.id));
    const done = submissionsArr || [];
    return { todo, done };
  }

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
            <span class="badge bg-success">Pubblicato</span>
            <button class="btn btn-sm btn-dark" data-action="join">Partecipa</button>
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

          <button class="btn btn-sm btn-outline-secondary" data-action="show" title="Mostra">
            <i class="fa-solid fa-eye"></i>
          </button>
        </div>
      </div>
    `;

    el.querySelector('[data-action="show"]').onclick = () => NS.modal.openDoneModal(submission, exam);
    return el;
  }

  async function refreshUI(me) {
    // reset UI
    todoList.innerHTML = "";
    todoEmpty.classList.add("d-none");
    todoStatus.textContent = "Caricamento...";

    doneList.innerHTML = "";
    doneEmpty.classList.add("d-none");
    doneStatus.textContent = "Caricamento...";

    try {
      ALL_PUBLISHED_EXAMS = (await loadAllPublishedExams()).filter((x) => !!x.is_published);
      MY_SUBMISSIONS = await loadMySubmissions(me.id);

      const exById = mapExamsById(ALL_PUBLISHED_EXAMS);
      const { todo, done } = splitTodoDone(ALL_PUBLISHED_EXAMS, MY_SUBMISSIONS);

      todoCount.textContent = String(todo.length);
      todoStatus.textContent = `${todo.length} esami`;
      if (!todo.length) {
        todoEmpty.classList.remove("d-none");
      } else {
        todo.forEach((exam) => todoList.appendChild(renderTodoCard(exam)));
      }

      doneCount.textContent = String(done.length);
      doneStatus.textContent = `${done.length} esami`;
      if (!done.length) {
        doneEmpty.classList.remove("d-none");
      } else {
        done.forEach((sub) => {
          const exam = exById.get(sub.exam_id) || null;
          doneList.appendChild(renderDoneCard(sub, exam));
        });
      }
    } catch (e) {
      todoStatus.textContent = "Errore";
      doneStatus.textContent = "Errore";
      todoList.innerHTML = `<div class="alert alert-danger">Errore caricamento: ${utils.escapeHtml(e.message)}</div>`;
      doneList.innerHTML = "";
    }
  }

  // exports
  exams.refreshUI = refreshUI;
})();
