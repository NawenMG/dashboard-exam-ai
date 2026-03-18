// app/static/js/teacher/exams.materials.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;
  const { utils } = NS;

  const materials = (NS.examsMaterials = NS.examsMaterials || {});

  let createdExamIdForUpload = null;
  let createdExamIsDraft = false;
  let draftSupported = null;

  async function listMaterials(examId) {
    if (!examId) return [];
    const res = await window.DASH.api(`/exams/${examId}/materials`, { method: "GET" });
    return res?.items || [];
  }

  async function deleteMaterial(examId, materialId) {
    if (!examId) throw new Error("Missing exam ID.");
    await window.DASH.api(`/exams/${examId}/materials/${materialId}`, { method: "DELETE" });
  }

  function openMaterial(examId, materialId) {
    if (!examId) return;
    window.open(`/exams/${examId}/materials/${materialId}/download`, "_blank", "noopener");
  }

  async function uploadMaterialPdfToExam(examId, file) {
    if (!examId) throw new Error("Missing exam ID.");
    if (!file) throw new Error("Select a PDF file.");

    const isPdf =
      file.type === "application/pdf" || String(file.name || "").toLowerCase().endsWith(".pdf");
    if (!isPdf) throw new Error("Invalid format: please upload a PDF.");

    const form = new FormData();
    form.append("file", file);

    return await window.DASH.api(`/exams/${examId}/materials/pdf`, {
      method: "POST",
      body: form,
    });
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
        openMaterial(createdExamIdForUpload, it.id);
      };

      row.querySelector('[data-act="del"]').onclick = async () => {
        if (!createdExamIdForUpload) return;
        const delBtn = row.querySelector('[data-act="del"]');
        const openBtn = row.querySelector('[data-act="open"]');
        delBtn.disabled = true;
        openBtn.disabled = true;

        try {
          await deleteMaterial(createdExamIdForUpload, it.id);
          const updated = await listMaterials(createdExamIdForUpload);
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
    const items = await listMaterials(createdExamIdForUpload);
    renderCreateMaterialsList(items);
  }

  materials.listMaterials = listMaterials;
  materials.deleteMaterial = deleteMaterial;
  materials.openMaterial = openMaterial;
  materials.uploadMaterialPdfToExam = uploadMaterialPdfToExam;

  materials.setUploadStatus = setUploadStatus;
  materials.setUploadButtonEnabled = setUploadButtonEnabled;
  materials.setCreatedExamId = setCreatedExamId;
  materials.ensureDraftExamId = ensureDraftExamId;
  materials.renderCreateMaterialsList = renderCreateMaterialsList;
  materials.refreshCreateMaterialsList = refreshCreateMaterialsList;

  Object.defineProperty(materials, "createdExamIdForUpload", {
    get() {
      return createdExamIdForUpload;
    },
  });

  Object.defineProperty(materials, "createdExamIsDraft", {
    get() {
      return createdExamIsDraft;
    },
    set(v) {
      createdExamIsDraft = !!v;
    },
  });
})();