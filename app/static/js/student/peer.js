// app/static/js/student/peer.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;
  const { utils } = NS;

  const peer = (NS.peer = NS.peer || {});

  // UI refs
  const peerList = document.getElementById("peerList");
  const peerEmpty = document.getElementById("peerEmpty");
  const peerStatus = document.getElementById("peerStatus");
  const peerCount = document.getElementById("peerCount");

  // State
  let PEER_TASKS = [];

  function setLoading() {
    if (peerStatus) peerStatus.textContent = "Caricamento...";
    if (peerList) peerList.innerHTML = "";
    peerEmpty?.classList.add("d-none");
    if (peerCount) peerCount.textContent = "0";
  }

  function setError(msg) {
    if (peerStatus) peerStatus.textContent = "Errore";
    if (peerList) {
      peerList.innerHTML = `<div class="alert alert-danger mb-0">${utils.escapeHtml(msg)}</div>`;
    }
    peerEmpty?.classList.add("d-none");
    if (peerCount) peerCount.textContent = "0";
  }

  function normalizeTasks(payload) {
    // ci aspettiamo list[PeerTaskOut], ma tolleriamo forme diverse
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  }

  function getSubmissionPreview(task) {
    const sub = task?.submission || {};

    // 1) titolo esame se presente
    const examTitle = sub?.exam_title;
    if (typeof examTitle === "string" && examTitle.trim()) {
      return `Esame: ${examTitle.trim()}`;
    }

    // 2) fallback: prima risposta (se il backend manda answers)
    const answers = Array.isArray(sub?.answers) ? sub.answers : [];
    const first = answers.find((a) => typeof a?.answer_text === "string" && a.answer_text.trim());
    if (first) {
      const txt = first.answer_text.trim();
      return txt.length > 160 ? txt.slice(0, 160) + "…" : txt;
    }

    return "";
  }

  function renderTaskCard(task) {
    const el = document.createElement("div");
    el.className = "card shadow-sm";

    const sub = task?.submission || {};
    const sid = sub?.id ?? "—";
    const preview = getSubmissionPreview(task);

    el.innerHTML = `
      <div class="card-body py-2">
        <div class="d-flex align-items-center justify-content-between gap-2">
          <div class="me-2">
            <div class="fw-semibold">Submission anonima #${utils.escapeHtml(sid)}</div>
            <div class="small text-muted">Valutazione peer assegnata</div>
            ${
              preview
                ? `<div class="small mt-2">${utils.escapeHtml(preview)}</div>`
                : `<div class="small mt-2 text-muted fst-italic">Apri per valutare.</div>`
            }
          </div>

          <button class="btn btn-sm btn-outline-secondary" data-action="eval" title="Valuta">
            <i class="fa-solid fa-pen"></i>
          </button>
        </div>
      </div>
    `;

    el.querySelector('[data-action="eval"]').onclick = () => {
      // apre il modale e, dopo submit OK, refresh della lista
      NS.modal.openPeerEvalModal(task, {
        onSuccess: async () => {
          await peer.refreshUI(window.DASH.me);
        },
      });
    };

    return el;
  }

  async function fetchPeerTasks({ examId = null, limit = 5 } = {}) {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    if (examId != null) qs.set("exam_id", String(examId));
    const url = `/evaluations/peer/tasks?${qs.toString()}`;
    const data = await window.DASH.api(url);
    return normalizeTasks(data);
  }

  async function refreshUI(_me) {
    setLoading();

    try {
      PEER_TASKS = await fetchPeerTasks({ limit: 5 });

      if (peerCount) peerCount.textContent = String(PEER_TASKS.length);
      if (peerStatus) peerStatus.textContent = `${PEER_TASKS.length} assegnate`;

      if (!PEER_TASKS.length) {
        peerEmpty?.classList.remove("d-none");
        if (peerList) peerList.innerHTML = "";
        return;
      }

      peerEmpty?.classList.add("d-none");
      if (peerList) peerList.innerHTML = "";
      PEER_TASKS.forEach((t) => peerList.appendChild(renderTaskCard(t)));
    } catch (e) {
      setError(e?.message || "Errore caricamento peer tasks.");
    }
  }

  // exports
  peer.refreshUI = refreshUI;
})();