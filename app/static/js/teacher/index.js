// app/static/js/teacher/index.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;

  window.addEventListener("DOMContentLoaded", () => {
    if (window.__TEACHER_INDEX_INIT__) return;
    window.__TEACHER_INDEX_INIT__ = true;

    function showOnly(sectionId) {
      const ids = [
        "viewTeacherExams",
        "viewTeacherStudents",
        "viewTeacherFinals",
        "viewStudentAvailable",
        "viewStudentCompleted",
      ];
      for (const id of ids) {
        document.getElementById(id)?.classList.toggle("d-none", id !== sectionId);
      }
    }

    function initWhenDashReady() {
      const me = window.DASH?.me;
      if (!me) return;

      if (me.role === "teacher") {
        window.DASH.showCreateExamButton(true);

        NS.exams.initCreateExamModal();

        window.DASH.onCreateExamClick(() => {
          NS.exams.resetCreateExamForm();
          const modalEl = document.getElementById("createExamModal");
          bootstrap.Modal.getOrCreateInstance(modalEl).show();
        });

        showOnly("viewTeacherExams");
        NS.exams.loadTeacherMyExams();
      } else {
        window.DASH.showCreateExamButton(false);
        showOnly("viewStudentAvailable");
      }
    }

    if (window.DASH && window.DASH.me) {
      initWhenDashReady();
    } else {
      window.addEventListener("dash:ready", () => initWhenDashReady(), { once: true });
    }
  });
})();