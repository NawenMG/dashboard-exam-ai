// static/js/teacher/base.js
(() => {
  window.addEventListener("DOMContentLoaded", () => {
    if (window.__DASH_BASE_INIT__) return;
    window.__DASH_BASE_INIT__ = true;

    const token = localStorage.getItem("access_token");
    if (!token) {
      window.location.href = "/auth/login";
      return;
    }

    const btnCreateExam = document.getElementById("btnCreateExam");

    async function api(path, options = {}) {
      const token = localStorage.getItem("access_token");
      const headers = new Headers(options.headers || {});
      if (token) headers.set("Authorization", "Bearer " + token);
      if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const res = await fetch(path, { ...options, headers });

      let data = null;
      try {
        data = await res.json();
      } catch (_) {}

      if (!res.ok) {
        const msg = data?.detail
          ? typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail)
          : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return data;
    }

    function showCreateExamButton(show) {
      if (!btnCreateExam) return;
      btnCreateExam.classList.toggle("d-none", !show);
    }

    function onCreateExamClick(handler) {
      if (!btnCreateExam) return;
      btnCreateExam.onclick = handler;
    }

    async function loadMeAndHeader() {
      try {
        const me = await api("/auth/me");

        if (me?.role !== "teacher") {
          window.location.replace("/dashboard/student");
          return null;
        }

        const roleLabel = me.role === "teacher" ? "Teacher" : "Student";
        const center = document.getElementById("userCenterLabel");
        if (center) {
          center.textContent = `${roleLabel}: ${me.first_name} ${me.last_name}`;
        }

        return me;
      } catch (_) {
        localStorage.removeItem("access_token");
        window.location.href = "/auth/login";
        return null;
      }
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        const token = localStorage.getItem("access_token");
        if (!token) {
          window.location.href = "/auth/login";
          return;
        }

        try {
          await fetch("/auth/logout", {
            method: "POST",
            headers: { Authorization: "Bearer " + token },
          });
        } catch (_) {}

        localStorage.removeItem("access_token");
        window.location.href = "/auth/login";
      };
    }

    (async function initBase() {
      const me = await loadMeAndHeader();
      if (!me) return;

      window.DASH = {
        api,
        me,
        showCreateExamButton,
        onCreateExamClick,
      };

      window.dispatchEvent(new CustomEvent("dash:ready", { detail: me }));
    })();
  });
})();
