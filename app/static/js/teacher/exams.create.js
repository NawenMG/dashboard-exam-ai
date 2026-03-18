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

      examsMaterials.setCreatedExamId(null);
      examsMaterials.createdExamIsDraft = false;
      if (fileInput) fileInput.value = "";
      examsMaterials.setUploadStatus("");
      examsMaterials.renderCreateMaterialsList([]);
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
        if (examsMaterials.createdExamIdForUpload && examsMaterials.createdExamIsDraft) {
          const updated = await window.DASH.api(`/exams/${examsMaterials.createdExamIdForUpload}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          examsMaterials.createdExamIsDraft = false;
          Object.assign(payload, updated || {});
          examsMaterials.setCreatedExamId(examsMaterials.createdExamIdForUpload, { isDraft: false });
        } else if (!examsMaterials.createdExamIdForUpload) {
          const created = await window.DASH.api("/exams", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          examsMaterials.setCreatedExamId(created?.id, { isDraft: false });
        } else {
          await window.DASH.api(`/exams/${examsMaterials.createdExamIdForUpload}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        }

        await exams.loadTeacherMyExams();
        examsMaterials.setUploadStatus("Exam saved. Uploaded PDFs remain attached.", "success");
        await examsMaterials.refreshCreateMaterialsList();

        const modalEl = document.getElementById("createExamModal");
        bootstrap.Modal.getInstance(modalEl)?.hide();
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
        examsMaterials.setCreatedExamId(null);
        examsMaterials.renderCreateMaterialsList([]);
        examsMaterials.setUploadStatus("Preparing draft for upload...", "muted");

        await examsMaterials.ensureDraftExamId();
        await examsMaterials.refreshCreateMaterialsList();
        examsMaterials.setUploadStatus("Draft ready. You can upload PDFs now.", "success");
      } catch (e) {
        examsMaterials.setCreatedExamId(null);
        examsMaterials.renderCreateMaterialsList([]);
        examsMaterials.setUploadButtonEnabled(false);
        examsMaterials.setUploadStatus("Draft unavailable: create the exam to upload PDFs.", "danger");
      }
    });

    createModalEl?.addEventListener("hidden.bs.modal", () => {
      resetCreateExamForm();
    });

    fileInput?.addEventListener("change", async () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;

      try {
        if (!examsMaterials.createdExamIdForUpload) {
          await examsMaterials.ensureDraftExamId();
        }

        examsMaterials.setUploadButtonEnabled(false);
        examsMaterials.setUploadStatus("Upload in progress...", "muted");

        for (const f of files) {
          await examsMaterials.uploadMaterialPdfToExam(examsMaterials.createdExamIdForUpload, f);
        }

        examsMaterials.setUploadStatus("Upload completed.", "success");
        await examsMaterials.refreshCreateMaterialsList();
      } catch (e) {
        examsMaterials.setUploadStatus(`Upload error: ${e?.message || "error"}`, "danger");
      } finally {
        examsMaterials.setUploadButtonEnabled(true);
        fileInput.value = "";
      }
    });

    ceSubmitBtn.onclick = () => submitCreateExam();
    exams.resetCreateExamForm = resetCreateExamForm;
  }

  exams.initCreateExamModal = initCreateExamModal;
})();