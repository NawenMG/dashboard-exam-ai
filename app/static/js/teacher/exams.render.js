// app/static/js/teacher/exams.render.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;
  const { utils, examsMaterials } = NS;

  const renderNS = (NS.examsRender = NS.examsRender || {});

  function renderFieldRow({ label, valueHtml, editable, onEditClick, rightExtraHtml = "" }) {
    const editBtn = editable
      ? `<button type="button" class="btn btn-sm btn-outline-secondary ms-2" data-action="edit" title="Edit">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>`
      : `<button type="button" class="btn btn-sm btn-outline-secondary ms-2" disabled title="Not editable (published)">
          <i class="fa-solid fa-lock"></i>
        </button>`;

    const el = document.createElement("div");
    el.className = "py-1";

    el.innerHTML = `
      <div class="d-flex align-items-start justify-content-between gap-2">
        <div class="me-2">
          <div class="small text-muted">${utils.escapeHtml(label)}</div>
          <div>${valueHtml}</div>
        </div>
        <div class="d-flex align-items-center">
          ${rightExtraHtml || ""}
          ${editBtn}
        </div>
      </div>
      <div class="mt-2 d-none" data-inline-slot></div>
    `;

    el.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
      if (!editable) return;
      onEditClick?.();
    });

    return el;
  }

  function makeInlineEditor({ currentValue, type, placeholder, onSave, onCancel }) {
    const wrap = document.createElement("div");
    wrap.className = "card p-2 bg-light border-0";

    wrap.innerHTML = `
      <div class="d-grid gap-2">
        ${
          type === "textarea"
            ? `<textarea class="form-control" rows="3" placeholder="${utils.escapeHtml(
                placeholder || "",
              )}"></textarea>`
            : `<input class="form-control" placeholder="${utils.escapeHtml(placeholder || "")}">`
        }
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-sm btn-secondary" data-act="cancel">Cancel</button>
          <button type="button" class="btn btn-sm text-white" style="background-color:#619ad6" data-act="save">Save</button>
        </div>
        <div class="alert alert-danger d-none mb-0" data-err></div>
      </div>
    `;

    const input = wrap.querySelector("input, textarea");
    input.value = currentValue ?? "";

    const err = wrap.querySelector("[data-err]");

    wrap.querySelector('[data-act="cancel"]').onclick = () => onCancel?.();
    wrap.querySelector('[data-act="save"]').onclick = async () => {
      err.classList.add("d-none");
      err.textContent = "";
      try {
        await onSave(input.value);
      } catch (e) {
        err.textContent = e?.message || "Error";
        err.classList.remove("d-none");
      }
    };

    return wrap;
  }

  function renderQuestionsEditor(exam, onSaveAll, onCancel) {
    const questions = utils.getQuestions(exam);

    const box = document.createElement("div");
    box.className = "card p-2 bg-light border-0";

    const list = document.createElement("div");
    list.className = "d-grid gap-2";

    function qRow(text = "", score = 10) {
      const row = document.createElement("div");
      row.className = "card p-2 border-0 shadow-sm";
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
      return row;
    }

    if (questions.length) {
      questions.forEach((q) => list.appendChild(qRow(q.text || "", q.max_score ?? 0)));
    } else {
      list.appendChild(qRow("", 10));
    }

    const btnAdd = document.createElement("button");
    btnAdd.type = "button";
    btnAdd.className = "btn btn-sm btn-outline-secondary";
    btnAdd.innerHTML = `<i class="fa-solid fa-plus me-1"></i>Add question`;
    btnAdd.onclick = () => list.appendChild(qRow());

    const footer = document.createElement("div");
    footer.className = "d-flex justify-content-end gap-2 mt-2";
    footer.innerHTML = `
      <button type="button" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="button" class="btn btn-sm text-white" style="background-color:#619ad6">Save</button>
    `;

    const err = document.createElement("div");
    err.className = "alert alert-danger d-none mb-0 mt-2";

    footer.children[0].onclick = () => onCancel?.();
    footer.children[1].onclick = async () => {
      err.classList.add("d-none");
      err.textContent = "";

      const out = [];
      list.querySelectorAll(".card").forEach((row) => {
        const text = row.querySelector(".q-text").value.trim();
        const score = parseFloat(row.querySelector(".q-score").value);
        if (text) out.push({ text, max_score: Number.isFinite(score) ? score : 0 });
      });

      if (!out.length) {
        err.textContent = "Enter at least one question.";
        err.classList.remove("d-none");
        return;
      }

      try {
        await onSaveAll(out);
      } catch (e) {
        err.textContent = e?.message || "Error";
        err.classList.remove("d-none");
      }
    };

    box.appendChild(list);
    box.appendChild(btnAdd);
    box.appendChild(footer);
    box.appendChild(err);

    return box;
  }

  function renderCriteriaEditor(exam, onSaveAll, onCancel) {
    const criteria = utils.getCriteria(exam);

    const box = document.createElement("div");
    box.className = "card p-2 bg-light border-0";

    const list = document.createElement("div");
    list.className = "d-grid gap-2";

    function cRow(name = "", weight = 1) {
      const row = document.createElement("div");
      row.className = "card p-2 border-0 shadow-sm";
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
      return row;
    }

    if (criteria.length) {
      criteria.forEach((c) => list.appendChild(cRow(c.name || "", c.weight ?? 0)));
    } else {
      list.appendChild(cRow("Correctness", 1));
    }

    const btnAdd = document.createElement("button");
    btnAdd.type = "button";
    btnAdd.className = "btn btn-sm btn-outline-secondary";
    btnAdd.innerHTML = `<i class="fa-solid fa-plus me-1"></i>Add criterion`;
    btnAdd.onclick = () => list.appendChild(cRow());

    const footer = document.createElement("div");
    footer.className = "d-flex justify-content-end gap-2 mt-2";
    footer.innerHTML = `
      <button type="button" class="btn btn-sm btn-secondary">Cancel</button>
      <button type="button" class="btn btn-sm text-white" style="background-color:#619ad6">Save</button>
    `;

    const err = document.createElement("div");
    err.className = "alert alert-danger d-none mb-0 mt-2";

    footer.children[0].onclick = () => onCancel?.();
    footer.children[1].onclick = async () => {
      err.classList.add("d-none");
      err.textContent = "";

      const out = [];
      list.querySelectorAll(".card").forEach((row) => {
        const name = row.querySelector(".c-name").value.trim();
        const weight = parseFloat(row.querySelector(".c-weight").value);
        if (name) out.push({ name, weight: Number.isFinite(weight) ? weight : 0 });
      });

      if (!out.length) {
        err.textContent = "Enter at least one evaluation criterion.";
        err.classList.remove("d-none");
        return;
      }

      try {
        await onSaveAll(out);
      } catch (e) {
        err.textContent = e?.message || "Error";
        err.classList.remove("d-none");
      }
    };

    box.appendChild(list);
    box.appendChild(btnAdd);
    box.appendChild(footer);
    box.appendChild(err);

    return box;
  }

  function makeMaterialsBlockForExistingExam(exam, editable) {
    const wrap = document.createElement("div");
    wrap.className = "card p-2 bg-light border-0";

    wrap.innerHTML = `
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="small text-muted">PDFs attached to this exam</div>
        <div class="d-flex align-items-center gap-2">
          <button type="button" class="btn btn-sm btn-outline-primary" data-act="add" ${
            editable ? "" : "disabled"
          }>
            <i class="fa-solid fa-file-arrow-up me-1"></i>Add PDF
          </button>
          <input type="file" accept="application/pdf" class="d-none" data-act="file" multiple />
        </div>
      </div>

      <div class="small mt-2 text-muted" data-act="status"></div>

      <div class="mt-2 d-grid gap-2" data-act="list"></div>
      <div class="small text-muted mt-1" data-act="empty">No PDF uploaded.</div>
    `;

    const btnAdd = wrap.querySelector('[data-act="add"]');
    const fileInput = wrap.querySelector('[data-act="file"]');
    const status = wrap.querySelector('[data-act="status"]');
    const list = wrap.querySelector('[data-act="list"]');
    const empty = wrap.querySelector('[data-act="empty"]');

    function setStatus(msg, kind = "muted") {
      const cls =
        kind === "success" ? "text-success" : kind === "danger" ? "text-danger" : "text-muted";
      status.className = `small mt-2 ${cls}`;
      status.textContent = msg || "";
    }

    async function render() {
      list.innerHTML = "";
      empty.classList.add("d-none");

      const items = await examsMaterials.listMaterials(exam.id);
      if (!items.length) {
        empty.classList.remove("d-none");
        return;
      }

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
              <button class="btn btn-sm btn-outline-danger" type="button" title="Remove" data-act="del" ${
                editable ? "" : "disabled"
              }>
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `;

        row.querySelector('[data-act="open"]').onclick = () => examsMaterials.openMaterial(exam.id, it.id);

        row.querySelector('[data-act="del"]').onclick = async () => {
          if (!editable) return;
          const delBtn = row.querySelector('[data-act="del"]');
          const openBtn = row.querySelector('[data-act="open"]');

          try {
            delBtn.disabled = true;
            openBtn.disabled = true;
            await examsMaterials.deleteMaterial(exam.id, it.id);
            setStatus("File removed.", "success");
            await render();
          } catch (e) {
            setStatus(`Remove error: ${e?.message || "error"}`, "danger");
            delBtn.disabled = false;
            openBtn.disabled = false;
          }
        };

        list.appendChild(row);
      }
    }

    btnAdd?.addEventListener("click", () => {
      if (!editable) return;
      fileInput.value = "";
      fileInput.click();
    });

    fileInput?.addEventListener("change", async () => {
      if (!editable) return;
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;

      btnAdd.disabled = true;
      setStatus("Upload in progress...", "muted");

      try {
        for (const f of files) await examsMaterials.uploadMaterialPdfToExam(exam.id, f);
        setStatus("Upload completed.", "success");
        await render();
      } catch (e) {
        setStatus(`Upload error: ${e?.message || "error"}`, "danger");
      } finally {
        btnAdd.disabled = false;
        fileInput.value = "";
      }
    });

    render().catch((e) => setStatus(`List loading error: ${e?.message || "error"}`, "danger"));
    return wrap;
  }

  async function hydrateExamAccordion(exam, bodyEl) {
    const editable = !exam.is_published;
    bodyEl.innerHTML = "";

    const top = document.createElement("div");
    top.className = "mb-2";

    top.innerHTML = `
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="small text-muted">
          <span class="me-3">
            <strong>Published:</strong>
            ${
              exam.is_published
                ? `<span class="text-success fw-semibold">yes</span>`
                : `<span class="text-warning fw-semibold">no</span>`
            }
          </span>

          <span class="me-3">
            <strong>Peer debug:</strong>
            ${
              exam.peer_debug_broadcast
                ? `<span class="text-danger fw-semibold">on</span>`
                : `<span class="text-muted fw-semibold">off</span>`
            }
          </span>

          <span class="me-3"><strong>Created:</strong> ${utils.safeDate(exam.created_at)}</span>
          <span class="me-3"><strong>Updated:</strong> ${utils.safeDate(exam.updated_at)}</span>
        </div>

        ${
          !exam.is_published
            ? `
              <button class="btn btn-sm btn-warning" data-action="publish-show-confirm">
                <i class="fa-solid fa-upload me-1"></i>Publish exam
              </button>
            `
            : `
              <span class="badge bg-success">
                <i class="fa-solid fa-lock me-1"></i>Published (locked)
              </span>
            `
        }
      </div>

      <div class="collapse mt-2" data-publish-confirm>
        <div class="card border-warning bg-light">
          <div class="card-body small">
            <div class="fw-semibold text-warning mb-1">Warning: publishing is irreversible</div>

            <div class="mb-2">
              After publishing:
              <ul class="mb-2">
                <li>the exam will be visible to students</li>
                <li>it will no longer be editable</li>
                <li>this action cannot be undone</li>
              </ul>
            </div>

            <div class="d-flex justify-content-end gap-2">
              <button class="btn btn-sm btn-secondary" data-action="publish-cancel">Cancel</button>
              <button class="btn btn-sm btn-danger" data-action="publish-confirm">Confirm publish</button>
            </div>

            <div class="alert alert-danger d-none mt-2 mb-0" data-publish-error></div>
          </div>
        </div>
      </div>
    `;
    bodyEl.appendChild(top);

    const btnShowConfirm = top.querySelector('[data-action="publish-show-confirm"]');
    const confirmCollapse = top.querySelector("[data-publish-confirm]");
    const btnCancel = top.querySelector('[data-action="publish-cancel"]');
    const btnConfirm = top.querySelector('[data-action="publish-confirm"]');
    const errBox = top.querySelector("[data-publish-error]");

    if (btnShowConfirm && confirmCollapse) {
      const bsCollapse = new bootstrap.Collapse(confirmCollapse, { toggle: false });

      function stopEvt(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      btnShowConfirm.addEventListener("mousedown", stopEvt);
      btnShowConfirm.addEventListener("click", (e) => {
        stopEvt(e);
        bsCollapse.toggle();
      });

      btnCancel.addEventListener("mousedown", stopEvt);
      btnCancel.addEventListener("click", (e) => {
        stopEvt(e);
        bsCollapse.hide();
      });

      btnConfirm.addEventListener("mousedown", stopEvt);
      btnConfirm.addEventListener("click", async (e) => {
        stopEvt(e);

        errBox.classList.add("d-none");
        errBox.textContent = "";

        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>Publishing...';

        try {
          const updated = await window.DASH.api(`/exams/${exam.id}`, {
            method: "PUT",
            body: JSON.stringify({ is_published: true }),
          });

          Object.assign(exam, updated);
          await hydrateExamAccordion(exam, bodyEl);
        } catch (e2) {
          errBox.textContent = e2?.message || "Error during publishing.";
          errBox.classList.remove("d-none");
          btnConfirm.disabled = false;
          btnConfirm.innerHTML = "Confirm publish";
        }
      });
    }

    const detailsCard = document.createElement("div");
    detailsCard.className = "card border-0 bg-light p-2 mb-3";

    const details = document.createElement("div");
    details.className = "d-grid gap-2";

    details.appendChild(
      renderFieldRow({
        label: "Title",
        valueHtml: `<strong>${utils.escapeHtml(exam.title)}</strong>`,
        editable,
        onEditClick: () => {
          const editor = makeInlineEditor({
            currentValue: exam.title,
            type: "input",
            placeholder: "Exam title",
            onCancel: () => hydrateExamAccordion(exam, bodyEl),
            onSave: async (val) => {
              const newTitle = String(val || "").trim();
              if (!newTitle) throw new Error("Title is required.");
              const updated = await window.DASH.api(`/exams/${exam.id}`, {
                method: "PUT",
                body: JSON.stringify({ title: newTitle }),
              });
              Object.assign(exam, updated);
              await hydrateExamAccordion(exam, bodyEl);
            },
          });
          details.replaceChildren(editor);
        },
      }),
    );

    const descValue =
      exam.description && exam.description.trim()
        ? utils.escapeHtml(exam.description)
        : `<span class="text-muted">—</span>`;

    details.appendChild(
      renderFieldRow({
        label: "Description",
        valueHtml: `<div class="small">${descValue}</div>`,
        editable,
        onEditClick: () => {
          const editor = makeInlineEditor({
            currentValue: exam.description || "",
            type: "textarea",
            placeholder: "Description (optional)",
            onCancel: () => hydrateExamAccordion(exam, bodyEl),
            onSave: async (val) => {
              const newDesc = String(val || "").trim();
              const updated = await window.DASH.api(`/exams/${exam.id}`, {
                method: "PUT",
                body: JSON.stringify({ description: newDesc || null }),
              });
              Object.assign(exam, updated);
              await hydrateExamAccordion(exam, bodyEl);
            },
          });
          details.replaceChildren(editor);
        },
      }),
    );

    const qs = utils.getQuestions(exam);
    const qSummary = qs.length
      ? `<span>${qs.length} questions</span>`
      : `<span class="text-muted">0 questions</span>`;

    const qRow = renderFieldRow({
      label: "Questions",
      valueHtml: qSummary,
      editable,
      onEditClick: () => {
        const editor = renderQuestionsEditor(
          exam,
          async (newQuestions) => {
            const updated = await window.DASH.api(`/exams/${exam.id}`, {
              method: "PUT",
              body: JSON.stringify({ questions_json: { questions: newQuestions } }),
            });
            Object.assign(exam, updated);
            await hydrateExamAccordion(exam, bodyEl);
          },
          () => hydrateExamAccordion(exam, bodyEl),
        );
        details.replaceChildren(editor);
      },
      rightExtraHtml: `
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="peekQ" title="Show list">
          <i class="fa-solid fa-list"></i>
        </button>
      `,
    });

    qRow.querySelector('[data-action="peekQ"]').onclick = () => {
      const slot = qRow.querySelector("[data-inline-slot]");
      if (!slot) return;

      if (!slot.classList.contains("d-none")) {
        slot.classList.add("d-none");
        slot.innerHTML = "";
        return;
      }

      const qsLocal = utils.getQuestions(exam);
      slot.classList.remove("d-none");
      slot.innerHTML =
        qsLocal.length === 0
          ? `<div class="text-muted small">No questions.</div>`
          : `
            <div class="small">
              ${qsLocal
                .map(
                  (q, i) => `
                    <div class="mb-1">
                      <span class="text-muted">#${i + 1}</span>
                      ${utils.escapeHtml(q.text)}
                      <span class="text-muted">(${q.max_score ?? 0})</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `;
    };
    details.appendChild(qRow);

    const cs = utils.getCriteria(exam);
    const cSummary = cs.length
      ? `<span>${cs.length} criteria</span>`
      : `<span class="text-muted">0 criteria</span>`;

    const cRow = renderFieldRow({
      label: "Criteria",
      valueHtml: cSummary,
      editable,
      onEditClick: () => {
        const editor = renderCriteriaEditor(
          exam,
          async (newCriteria) => {
            const updated = await window.DASH.api(`/exams/${exam.id}`, {
              method: "PUT",
              body: JSON.stringify({ rubric_json: { criteria: newCriteria } }),
            });
            Object.assign(exam, updated);
            await hydrateExamAccordion(exam, bodyEl);
          },
          () => hydrateExamAccordion(exam, bodyEl),
        );
        details.replaceChildren(editor);
      },
      rightExtraHtml: `
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="peekC" title="Show list">
          <i class="fa-solid fa-list"></i>
        </button>
      `,
    });

    cRow.querySelector('[data-action="peekC"]').onclick = () => {
      const slot = cRow.querySelector("[data-inline-slot]");
      if (!slot) return;

      if (!slot.classList.contains("d-none")) {
        slot.classList.add("d-none");
        slot.innerHTML = "";
        return;
      }

      const csLocal = utils.getCriteria(exam);
      slot.classList.remove("d-none");
      slot.innerHTML =
        csLocal.length === 0
          ? `<div class="text-muted small">No criteria.</div>`
          : `
            <div class="small">
              ${csLocal
                .map(
                  (c) => `
                    <div class="mb-1">
                      ${utils.escapeHtml(c.name)}
                      <span class="text-muted">(weight ${c.weight ?? 0})</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `;
    };
    details.appendChild(cRow);

    const matWrap = document.createElement("div");
    matWrap.className = "py-1";
    matWrap.innerHTML = `
      <div class="d-flex align-items-start justify-content-between gap-2">
        <div class="me-2">
          <div class="small text-muted">Materials (PDF)</div>
          <div class="small text-muted">View, add or remove PDFs attached to this exam.</div>
        </div>
      </div>
    `;
    const matSlot = document.createElement("div");
    matSlot.className = "mt-2";
    matSlot.appendChild(makeMaterialsBlockForExistingExam(exam, editable));
    matWrap.appendChild(matSlot);
    details.appendChild(matWrap);

    const ai = exam.openai_schema_json || null;
    let aiSummary = `<span class="text-muted">—</span>`;
    try {
      const score = ai?.properties?.score;
      const min = score?.minimum ?? 0;
      const max = score?.maximum ?? 30;
      const honors = !!ai?.properties?.honors?.default;
      const notes = ai?.properties?.teacher_notes?.default || "";
      aiSummary = `<span>Range ${min}-${max} • honors ${honors ? "on" : "off"}${
        notes ? ` • notes: ${utils.escapeHtml(notes)}` : ""
      }</span>`;
    } catch (_) {}

    details.appendChild(
      renderFieldRow({
        label: "AI config",
        valueHtml: `<div class="small">${aiSummary}</div>`,
        editable,
        onEditClick: () => {
          const box = document.createElement("div");
          box.className = "card p-2 bg-light border-0";

          const minV = ai?.properties?.score?.minimum ?? 0;
          const maxV = ai?.properties?.score?.maximum ?? 30;
          const honorsV = !!ai?.properties?.honors?.default;
          const notesV = ai?.properties?.teacher_notes?.default || "";

          box.innerHTML = `
            <div class="row g-2">
              <div class="col-6">
                <label class="form-label mb-1 small text-muted">Minimum score</label>
                <input type="number" class="form-control" id="editAiMin" value="${minV}">
              </div>
              <div class="col-6">
                <label class="form-label mb-1 small text-muted">Maximum score</label>
                <input type="number" class="form-control" id="editAiMax" value="${maxV}">
              </div>

              <div class="col-12 d-flex align-items-center gap-2 mt-1">
                <input class="form-check-input" type="checkbox" id="editAiHonors" ${
                  honorsV ? "checked" : ""
                }>
                <label class="form-check-label" for="editAiHonors">Allow honors</label>
              </div>

              <div class="col-12">
                <label class="form-label mb-1 small text-muted">AI notes (optional)</label>
                <input type="text" class="form-control" id="editAiNotes" value="${utils.escapeHtml(
                  notesV,
                )}">
              </div>

              <div class="col-12 d-flex justify-content-end gap-2 mt-2">
                <button type="button" class="btn btn-sm btn-secondary" data-act="cancel">Cancel</button>
                <button type="button" class="btn btn-sm text-white" style="background-color:#619ad6" data-act="save">Save</button>
              </div>

              <div class="col-12">
                <div class="alert alert-danger d-none mb-0" data-err></div>
              </div>
            </div>
          `;

          const err = box.querySelector("[data-err]");
          box.querySelector('[data-act="cancel"]').onclick = () => hydrateExamAccordion(exam, bodyEl);

          box.querySelector('[data-act="save"]').onclick = async () => {
            err.classList.add("d-none");
            err.textContent = "";

            const min = parseFloat(box.querySelector("#editAiMin").value);
            const max = parseFloat(box.querySelector("#editAiMax").value);
            const honors = !!box.querySelector("#editAiHonors").checked;
            const notes = box.querySelector("#editAiNotes").value.trim();

            const minimum = Number.isFinite(min) ? min : 0;
            const maximum = Number.isFinite(max) ? max : 30;
            if (maximum < minimum) {
              err.textContent = "Maximum score must be >= minimum score.";
              err.classList.remove("d-none");
              return;
            }

            const schemaObj = {
              type: "object",
              additionalProperties: false,
              properties: {
                score: { type: "number", minimum, maximum },
                honors: { type: "boolean", default: honors },
                comment: { type: "string" },
                teacher_notes: { type: "string", default: notes || "" },
              },
              required: ["score", "honors", "comment"],
            };

            try {
              const updated = await window.DASH.api(`/exams/${exam.id}`, {
                method: "PUT",
                body: JSON.stringify({ openai_schema_json: schemaObj }),
              });
              Object.assign(exam, updated);
              await hydrateExamAccordion(exam, bodyEl);
            } catch (e) {
              err.textContent = e?.message || "Error";
              err.classList.remove("d-none");
            }
          };

          details.replaceChildren(box);
        },
      }),
    );

    detailsCard.appendChild(details);
    bodyEl.appendChild(detailsCard);

    await NS.submissions.loadIntoExamAccordion(exam, bodyEl);
  }

  function renderExamCard(exam) {
    const examId = exam.id;
    const accordionId = `accExam${examId}`;
    const collapseId = `collapseExam${examId}`;

    const el = document.createElement("div");
    el.className = "card shadow-sm";

    el.innerHTML = `
      <div class="card-body py-2">
        <div class="accordion" id="${accordionId}">
          <div class="accordion-item border-0">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed py-2" type="button"
                      data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                <strong>${utils.escapeHtml(exam.title || "Exam #" + examId)}</strong>
              </button>
            </h2>

            <div id="${collapseId}" class="accordion-collapse collapse">
              <div class="accordion-body" data-exam-body>
                <div class="text-muted small">Open to load details...</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    const collapseEl = el.querySelector("#" + collapseId);
    const bodyEl = el.querySelector("[data-exam-body]");

    collapseEl.addEventListener(
      "shown.bs.collapse",
      async (ev) => {
        if (ev.target !== collapseEl) return;
        await hydrateExamAccordion(exam, bodyEl);
      },
      { once: true },
    );

    return el;
  }

  renderNS.renderFieldRow = renderFieldRow;
  renderNS.makeInlineEditor = makeInlineEditor;
  renderNS.renderQuestionsEditor = renderQuestionsEditor;
  renderNS.renderCriteriaEditor = renderCriteriaEditor;
  renderNS.makeMaterialsBlockForExistingExam = makeMaterialsBlockForExistingExam;
  renderNS.hydrateExamAccordion = hydrateExamAccordion;
  renderNS.renderExamCard = renderExamCard;
})();