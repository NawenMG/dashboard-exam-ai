// app/static/js/teacher/exams.create.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;
  const { utils, examsMaterials } = NS;

  const exams = (NS.exams = NS.exams || {});

  function initCreateExamModal() {
    const ceTitle = document.getElementById("ceTitle");
    const ceDescription = document.getElementById("ceDescription");
    const cePublished = document.getElementById("cePublished");
    const cePeerDebugBroadcast = document.getElementById("cePeerDebugBroadcast");

    const questionsContainer = document.getElementById("questionsContainer");
    const criteriaContainer = document.getElementById("criteriaContainer");

    const aiMinScore = document.getElementById("aiMinScore");
    const aiMaxScore = document.getElementById("aiMaxScore");
    const aiHonors = document.getElementById("aiHonors");
    const aiNotes = document.getElementById("aiNotes");

    const ceError = document.getElementById("ceError");
    const ceSubmitBtn = document.getElementById("ceSubmitBtn");
    const createExamForm = document.getElementById("createExamForm");

    const btnAddQuestion = document.getElementById("btnAddQuestion");
    const btnAddCriterion = document.getElementById("btnAddCriterion");

    const fileInput = document.getElementById("globalMaterialPdfInput");
    const createModalEl = document.getElementById("createExamModal");

    let isSubmittingExam = false;

    // Stato LOCALE del create modal: come nel file monolitico funzionante
    let createdExamIdForUpload = null;
    let createdExamIsDraft = false;
    let draftSupported = null;

    createExamForm.onsubmit = (e) => {
      e.preventDefault();
      submitCreateExam();
    };

    function addQuestionRow(text = "", score = 10) {
      const row = document.createElement("div");
      row.className = "card p-2 question-row border-0 shadow-sm";

      row.innerHTML = `
        <div class="row g-2 align-items-center">
          <div class="col">
            <input class="form-control q-text" placeholder="Question text" value="${utils.escapeHtml(text)}">
          </div>
          <div class="col-3">
            <input type="number" class="form-control q-score" value="${score}" placeholder="Score">
          </div>
          <div class="col-2 d-flex justify-content-end">
            <button type="button" class="btn btn-sm btn-outline-danger" title="Remove">
              <i class="fa-solid fa-x"></i>
            </button>
          </div>
        </div>
      `;
      row.querySelector("button").onclick = () => row.remove();
      questionsContainer.appendChild(row);
    }

    function addCriterionRow(name = "", weight = 1) {
      const row = document.createElement("div");
      row.className = "card p-2 criterion-row border-0 shadow-sm";

      row.innerHTML = `
        <div class="row g-2 align-items-center">
          <div class="col">
            <input class="form-control c-name" placeholder="Criterion name" value="${utils.escapeHtml(name)}">
          </div>
          <div class="col-3">
            <input type="number" step="0.1" class="form-control c-weight" value="${weight}" placeholder="Weight">
          </div>
          <div class="col-2 d-flex justify-content-end">
            <button type="button" class="btn btn-sm btn-outline-danger" title="Remove">
              <i class="fa-solid fa-x"></i>
            </button>
          </div>
        </div>
      `;
      row.querySelector("button").onclick = () => row.remove();
      criteriaContainer.appendChild(row);
    }

    btnAddQuestion.onclick = () => addQuestionRow();
    btnAddCriterion.onclick = () => addCriterionRow();

    function buildQuestionsJson() {
      const questions = [];
      document.querySelectorAll("#createExamModal .question-row").forEach((row) => {
        const text = row.querySelector(".q-text").value.trim();
        const score = parseFloat(row.querySelector(".q-score").value);
        if (text) questions.push({ text, max_score: Number.isFinite(score) ? score : 0 });
      });
      return { questions };
    }

    function buildRubricJson() {
      const criteria = [];
      document.querySelectorAll("#createExamModal .criterion-row").forEach((row) => {
        const name = row.querySelector(".c-name").value.trim();
        const weight = parseFloat(row.querySelector(".c-weight").value);
        if (name) criteria.push({ name, weight: Number.isFinite(weight) ? weight : 0 });
      });
      return { criteria };
    }

    function buildAISchemaJson() {
      const minV = parseFloat(aiMinScore.value);
      const maxV = parseFloat(aiMaxScore.value);

      const minimum = Number.isFinite(minV) ? minV : 0;
      const maximum = Number.isFinite(maxV) ? maxV : 30;

      return {
        type: "object",
        additionalProperties: false,
        properties: {
          score: { type: "number", minimum, maximum },
          honors: { type: "boolean", default: !!aiHonors.checked },
          comment: { type: "string" },
          teacher_notes: { type: "string", default: aiNotes.value.trim() || "" },
        },
        required: ["score", "honors", "comment"],
      };
    }

    function setUploadStatus(msg, kind = "muted") {
      const el = document.getElementById("materialUploadStatus");
      if (!el) return;
      const cls =
        kind === "success" ? "text-success" : kind === "danger" ? "text-danger" : "text-muted";
      el.className = `small mt-2 ${cls}`;
      el.textContent = msg || "";
    }

    function setUploadButtonEnabled(enabled) {
      const btn = document.getElementById("btnUploadMaterialPdf");
      if (!btn) return;
      btn.setAttribute("aria-disabled", enabled ? "false" : "true");
      btn.classList.toggle("opacity-50", !enabled);
      btn.classList.toggle("disabled", !enabled);
    }

    function setCreatedExamId(examId, { isDraft = false } = {}) {
      createdExamIdForUpload = examId;
      createdExamIsDraft = !!isDraft;

      const hidden = document.getElementById("ceDraftExamId");
      if (hidden) {
        hidden.value = examId ? String(examId) : "";
      }

      const hint = document.getElementById("materialUploadHint");
      setUploadButtonEnabled(true);

      if (hint) {
        if (!examId) {
          hint.textContent = "Upload PDFs: a draft exam will be created automatically.";
        } else if (isDraft) {
          hint.textContent = `Draft ready (ID ${examId}). You can upload PDFs now.`;
        } else {
          hint.textContent = `Exam ready (ID ${examId}). You can upload PDFs.`;
        }
      }
    }

    async function ensureDraftExamId() {
      if (createdExamIdForUpload) return createdExamIdForUpload;
      if (draftSupported === false) throw new Error("Draft is not supported by the backend.");

      setUploadStatus("Creating draft for upload...", "muted");

      try {
        const draft = await window.DASH.api("/exams/draft", { method: "POST" });
        if (!draft?.id) throw new Error("Invalid draft.");

        draftSupported = true;
        setCreatedExamId(draft.id, { isDraft: true });
        return draft.id;
      } catch (e) {
        draftSupported = false;
        throw e;
      }
    }

    function renderCreateMaterialsList(items) {
      const listEl = document.getElementById("materialPdfList");
      const emptyEl = document.getElementById("materialPdfEmpty");
      if (!listEl || !emptyEl) return;

      listEl.innerHTML = "";
      if (!items.length) {
        emptyEl.classList.remove("d-none");
        return;
      }
      emptyEl.classList.add("d-none");

      for (const it of items) {
        const row = document.createElement("div");
        row.className = "card p-2 border-0 shadow-sm";
        row.innerHTML = `
          <div class="d-flex align-items-center justify-content-between gap-2">
            <div class="small">
              <i class="fa-solid fa-file-pdf me-2 text-danger"></i>
              ${utils.escapeHtml(it.filename || ("PDF #" + it.id))}
              <div class="text-muted small">${utils.safeDate(it.uploaded_at)}</div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary" type="button" title="Open" data-act="open">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" type="button" title="Remove" data-act="del">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `;

        row.querySelector('[data-act="open"]').onclick = () => {
          if (!createdExamIdForUpload) return;
          examsMaterials.openMaterial(createdExamIdForUpload, it.id);
        };

        row.querySelector('[data-act="del"]').onclick = async () => {
          if (!createdExamIdForUpload) return;

          const delBtn = row.querySelector('[data-act="del"]');
          const openBtn = row.querySelector('[data-act="open"]');
          delBtn.disabled = true;
          openBtn.disabled = true;

          try {
            await examsMaterials.deleteMaterial(createdExamIdForUpload, it.id);
            const updated = await examsMaterials.listMaterials(createdExamIdForUpload);
            renderCreateMaterialsList(updated);
            setUploadStatus("File removed.", "success");
          } catch (e) {
            setUploadStatus(`Remove error: ${e?.message || "error"}`, "danger");
            delBtn.disabled = false;
            openBtn.disabled = false;
          }
        };

        listEl.appendChild(row);
      }
    }

    async function refreshCreateMaterialsList() {
      if (!createdExamIdForUpload) {
        renderCreateMaterialsList([]);
        return;
      }
      const items = await examsMaterials.listMaterials(createdExamIdForUpload);
      renderCreateMaterialsList(items);
    }

    function resetCreateExamForm() {
      ceError.classList.add("d-none");
      ceError.textContent = "";

      ceTitle.value = "";
      ceDescription.value = "";
      cePublished.checked = false;
      if (cePeerDebugBroadcast) cePeerDebugBroadcast.checked = false;

      aiMinScore.value = "0";
      aiMaxScore.value = "30";
      aiHonors.checked = false;
      aiNotes.value = "";

      questionsContainer.innerHTML = "";
      criteriaContainer.innerHTML = "";

      addQuestionRow("", 10);
      addCriterionRow("Correctness", 1);

      createdExamIdForUpload = null;
      createdExamIsDraft = false;

      const hidden = document.getElementById("ceDraftExamId");
      if (hidden) hidden.value = "";

      if (fileInput) fileInput.value = "";
      setUploadStatus("");
      renderCreateMaterialsList([]);
      setCreatedExamId(null);
    }

    async function submitCreateExam() {
      if (isSubmittingExam) return;
      isSubmittingExam = true;

      ceError.classList.add("d-none");
      ceError.textContent = "";

      const title = ceTitle.value.trim();
      if (!title) {
        ceError.textContent = "Title is required.";
        ceError.classList.remove("d-none");
        isSubmittingExam = false;
        return;
      }

      const q = buildQuestionsJson().questions;
      const c = buildRubricJson().criteria;

      if (q.length === 0) {
        ceError.textContent = "Enter at least one question.";
        ceError.classList.remove("d-none");
        isSubmittingExam = false;
        return;
      }

      if (c.length === 0) {
        ceError.textContent = "Enter at least one evaluation criterion.";
        ceError.classList.remove("d-none");
        isSubmittingExam = false;
        return;
      }

      const payload = {
        title,
        description: ceDescription.value.trim() || null,
        questions_json: { questions: q },
        rubric_json: { criteria: c },
        openai_schema_json: buildAISchemaJson(),
        is_published: !!cePublished.checked,
        peer_debug_broadcast: !!cePeerDebugBroadcast?.checked,
      };

      ceSubmitBtn.disabled = true;
      ceSubmitBtn.textContent = "Saving...";

      try {
        if (createdExamIdForUpload && createdExamIsDraft) {
          await window.DASH.api(`/exams/${createdExamIdForUpload}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          createdExamIsDraft = false;
          setCreatedExamId(createdExamIdForUpload, { isDraft: false });
        } else if (!createdExamIdForUpload) {
          const created = await window.DASH.api("/exams", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setCreatedExamId(created?.id, { isDraft: false });
        } else {
          await window.DASH.api(`/exams/${createdExamIdForUpload}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        }

        await exams.loadTeacherMyExams();
        setUploadStatus("Exam saved. Uploaded PDFs remain attached.", "success");
        await refreshCreateMaterialsList();

        bootstrap.Modal.getInstance(createModalEl)?.hide();
      } catch (e) {
        ceError.textContent = e?.message || "Error during exam creation.";
        ceError.classList.remove("d-none");
      } finally {
        ceSubmitBtn.disabled = false;
        ceSubmitBtn.textContent = "Create exam";
        isSubmittingExam = false;
      }
    }

    createModalEl?.addEventListener("shown.bs.modal", async () => {
      try {
        setCreatedExamId(null);
        renderCreateMaterialsList([]);
        setUploadStatus("Preparing draft for upload...", "muted");

        await ensureDraftExamId();
        await refreshCreateMaterialsList();
        setUploadStatus("Draft ready. You can upload PDFs now.", "success");
      } catch (e) {
        setCreatedExamId(null);
        renderCreateMaterialsList([]);
        setUploadButtonEnabled(false);
        setUploadStatus("Draft unavailable: create the exam to upload PDFs.", "danger");
      }
    });

    createModalEl?.addEventListener("hidden.bs.modal", () => {
      resetCreateExamForm();
    });

    if (fileInput && !fileInput.dataset.createBound) {
      fileInput.dataset.createBound = "true";

      fileInput.addEventListener("change", async () => {
        const createModalOpen = !!createModalEl?.classList.contains("show");
        if (!createModalOpen) return;

        const files = Array.from(fileInput.files || []);
        if (!files.length) return;

        try {
          if (!createdExamIdForUpload) {
            await ensureDraftExamId();
          }

          setUploadButtonEnabled(false);
          setUploadStatus("Upload in progress...", "muted");

          for (const f of files) {
            await examsMaterials.uploadMaterialPdfToExam(createdExamIdForUpload, f);
          }

          setUploadStatus("Upload completed.", "success");
          await refreshCreateMaterialsList();
        } catch (e) {
          setUploadStatus(`Upload error: ${e?.message || "error"}`, "danger");
        } finally {
          setUploadButtonEnabled(true);
          fileInput.value = "";
        }
      });
    }

    ceSubmitBtn.onclick = () => submitCreateExam();
    exams.resetCreateExamForm = resetCreateExamForm;
  }

  exams.initCreateExamModal = initCreateExamModal;
})();