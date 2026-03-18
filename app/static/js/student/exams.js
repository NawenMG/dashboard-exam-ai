// app/static/js/student/exams.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;
  const { utils, examsApi, examsRender } = NS;

  const exams = (NS.exams = NS.exams || {});

  const todoList = document.getElementById("todoList");
  const todoEmpty = document.getElementById("todoEmpty");
  const todoStatus = document.getElementById("todoStatus");
  const todoCount = document.getElementById("todoCount");

  const doneList = document.getElementById("doneList");
  const doneEmpty = document.getElementById("doneEmpty");
  const doneStatus = document.getElementById("doneStatus");
  const doneCount = document.getElementById("doneCount");

  let ALL_PUBLISHED_EXAMS = [];
  let MY_SUBMISSIONS = [];

  function mapExamsById(examsArr) {
    const m = new Map();
    (examsArr || []).forEach((e) => m.set(e.id, e));
    return m;
  }

  function splitTodoDone(examsArr, submissionsArr) {
    const doneExamIds = new Set((submissionsArr || []).map((s) => s.exam_id));
    const todo = (examsArr || []).filter((e) => !doneExamIds.has(e.id));
    const done = submissionsArr || [];
    return { todo, done };
  }

  async function refreshUI(me) {
    todoList.innerHTML = "";
    todoEmpty.classList.add("d-none");
    todoStatus.textContent = "Loading...";

    doneList.innerHTML = "";
    doneEmpty.classList.add("d-none");
    doneStatus.textContent = "Loading...";

    try {
      ALL_PUBLISHED_EXAMS = (await examsApi.loadAllPublishedExams()).filter((x) => !!x.is_published);
      MY_SUBMISSIONS = await examsApi.loadMySubmissions(me.id);

      const exById = mapExamsById(ALL_PUBLISHED_EXAMS);
      const { todo, done } = splitTodoDone(ALL_PUBLISHED_EXAMS, MY_SUBMISSIONS);

      todoCount.textContent = String(todo.length);
      todoStatus.textContent = `${todo.length} exams`;
      if (!todo.length) {
        todoEmpty.classList.remove("d-none");
      } else {
        todo.forEach((exam) => todoList.appendChild(examsRender.renderTodoCard(exam)));
      }

      doneCount.textContent = String(done.length);
      doneStatus.textContent = `${done.length} exams`;
      if (!done.length) {
        doneEmpty.classList.remove("d-none");
      } else {
        done.forEach((sub) => {
          const exam = exById.get(sub.exam_id) || null;
          doneList.appendChild(examsRender.renderDoneCard(sub, exam));
        });
      }
    } catch (e) {
      todoStatus.textContent = "Error";
      doneStatus.textContent = "Error";
      todoList.innerHTML = `<div class="alert alert-danger">Loading error: ${utils.escapeHtml(
        e.message,
      )}</div>`;
      doneList.innerHTML = "";
    }
  }

  exams.refreshUI = refreshUI;
})();