// app/static/js/teacher/exams.js
(() => {
  window.TEACHER = window.TEACHER || {};
  const NS = window.TEACHER;
  const { utils } = NS;

  const exams = (NS.exams = NS.exams || {});

  // ==========================
  // Exam render/edit helpers
  // ==========================
  function renderFieldRow({ label, valueHtml, editable, onEditClick, rightExtraHtml = "" }) {
    const editBtn = editable
      ? `<button type="button" class="btn btn-sm btn-outline-secondary ms-2" data-action="edit" title="Modifica">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>`
      : `<button type="button" class="btn btn-sm btn-outline-secondary ms-2" disabled title="Non modificabile (pubblicato)">
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
            ? `<textarea class="form-control" rows="3" placeholder="${utils.escapeHtml(placeholder || "")}"></textarea>`
            : `<input class="form-control" placeholder="${utils.escapeHtml(placeholder || "")}">`
        }
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-sm btn-secondary" data-act="cancel">Annulla</button>
          <button type="button" class="btn btn-sm text-white" style="background-color:#619ad6" data-act="save">Salva</button>
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
        err.textContent = e?.message || "Errore";
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
            <input class="form-control q-text" placeholder="Testo domanda" value="${utils.escapeHtml(text)}">
          </div>
          <div class="col-3">
            <input type="number" class="form-control q-score" value="${score}" placeholder="Score">
          </div>
          <div class="col-2 d-flex justify-content-end">
            <button type="button" class="btn btn-sm btn-outline-danger" title="Rimuovi">
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
    btnAdd.innerHTML = `<i class="fa-solid fa-plus me-1"></i>Aggiungi domanda`;
    btnAdd.onclick = () => list.appendChild(qRow());

    const footer = document.createElement("div");
    footer.className = "d-flex justify-content-end gap-2 mt-2";
    footer.innerHTML = `
      <button type="button" class="btn btn-sm btn-secondary">Annulla</button>
      <button type="button" class="btn btn-sm text-white" style="background-color:#619ad6">Salva</button>
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
        err.textContent = "Inserisci almeno una domanda.";
        err.classList.remove("d-none");
        return;
      }

      try {
        await onSaveAll(out);
      } catch (e) {
        err.textContent = e?.message || "Errore";
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
            <input class="form-control c-name" placeholder="Nome criterio" value="${utils.escapeHtml(name)}">
          </div>
          <div class="col-3">
            <input type="number" step="0.1" class="form-control c-weight" value="${weight}" placeholder="Peso">
          </div>
          <div class="col-2 d-flex justify-content-end">
            <button type="button" class="btn btn-sm btn-outline-danger" title="Rimuovi">
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
      list.appendChild(cRow("Correttezza", 1));
    }

    const btnAdd = document.createElement("button");
    btnAdd.type = "button";
    btnAdd.className = "btn btn-sm btn-outline-secondary";
    btnAdd.innerHTML = `<i class="fa-solid fa-plus me-1"></i>Aggiungi criterio`;
    btnAdd.onclick = () => list.appendChild(cRow());

    const footer = document.createElement("div");
    footer.className = "d-flex justify-content-end gap-2 mt-2";
    footer.innerHTML = `
      <button type="button" class="btn btn-sm btn-secondary">Annulla</button>
      <button type="button" class="btn btn-sm text-white" style="background-color:#619ad6">Salva</button>
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
        err.textContent = "Inserisci almeno un criterio di valutazione.";
        err.classList.remove("d-none");
        return;
      }

      try {
        await onSaveAll(out);
      } catch (e) {
        err.textContent = e?.message || "Errore";
        err.classList.remove("d-none");
      }
    };

    box.appendChild(list);
    box.appendChild(btnAdd);
    box.appendChild(footer);
    box.appendChild(err);

    return box;
  }

  // ==========================
  // Accordion hydration (dettagli + publish + submissions)
  // ==========================
  async function hydrateExamAccordion(exam, bodyEl) {
    const editable = !exam.is_published;
    bodyEl.innerHTML = "";

    const top = document.createElement("div");
    top.className = "mb-2";

    top.innerHTML = `
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="small text-muted">
          <span class="me-3">
            <strong>Pubblicato:</strong>
            ${
              exam.is_published
                ? `<span class="text-success fw-semibold">yes</span>`
                : `<span class="text-warning fw-semibold">no</span>`
            }
          </span>

          <span class="me-3"><strong>Creato:</strong> ${utils.safeDate(exam.created_at)}</span>
          <span class="me-3"><strong>Aggiornato:</strong> ${utils.safeDate(exam.updated_at)}</span>
        </div>

        ${
          !exam.is_published
            ? `
              <button class="btn btn-sm btn-warning" data-action="publish-show-confirm">
                <i class="fa-solid fa-upload me-1"></i>Pubblica esame
              </button>
            `
            : `
              <span class="badge bg-success">
                <i class="fa-solid fa-lock me-1"></i>Pubblicato (bloccato)
              </span>
            `
        }
      </div>

      <div class="collapse mt-2" data-publish-confirm>
        <div class="card border-warning bg-light">
          <div class="card-body small">
            <div class="fw-semibold text-warning mb-1">Attenzione: pubblicazione irreversibile</div>

            <div class="mb-2">
              Dopo la pubblicazione:
              <ul class="mb-2">
                <li>l'esame sarà visibile agli studenti</li>
                <li>non sarà più modificabile</li>
                <li>questa azione non può essere annullata</li>
              </ul>
            </div>

            <div class="d-flex justify-content-end gap-2">
              <button class="btn btn-sm btn-secondary" data-action="publish-cancel">Annulla</button>
              <button class="btn btn-sm btn-danger" data-action="publish-confirm">Conferma pubblicazione</button>
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
        btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>Pubblicazione...';

        try {
          const updated = await window.DASH.api(`/exams/${exam.id}`, {
            method: "PUT",
            body: JSON.stringify({ is_published: true }),
          });

          Object.assign(exam, updated);
          await hydrateExamAccordion(exam, bodyEl);
        } catch (e2) {
          errBox.textContent = e2?.message || "Errore durante la pubblicazione.";
          errBox.classList.remove("d-none");
          btnConfirm.disabled = false;
          btnConfirm.innerHTML = "Conferma pubblicazione";
        }
      });
    }

    const detailsCard = document.createElement("div");
    detailsCard.className = "card border-0 bg-light p-2 mb-3";

    const details = document.createElement("div");
    details.className = "d-grid gap-2";

    // Title
    details.appendChild(
      renderFieldRow({
        label: "Titolo",
        valueHtml: `<strong>${utils.escapeHtml(exam.title)}</strong>`,
        editable,
        onEditClick: () => {
          const editor = makeInlineEditor({
            currentValue: exam.title,
            type: "input",
            placeholder: "Titolo esame",
            onCancel: () => hydrateExamAccordion(exam, bodyEl),
            onSave: async (val) => {
              const newTitle = String(val || "").trim();
              if (!newTitle) throw new Error("Titolo obbligatorio.");
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

    // Description
    const descValue =
      exam.description && exam.description.trim()
        ? utils.escapeHtml(exam.description)
        : `<span class="text-muted">—</span>`;

    details.appendChild(
      renderFieldRow({
        label: "Descrizione",
        valueHtml: `<div class="small">${descValue}</div>`,
        editable,
        onEditClick: () => {
          const editor = makeInlineEditor({
            currentValue: exam.description || "",
            type: "textarea",
            placeholder: "Descrizione (opzionale)",
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

    // Questions
    const qs = utils.getQuestions(exam);
    const qSummary = qs.length ? `<span>${qs.length} domande</span>` : `<span class="text-muted">0 domande</span>`;

    const qRow = renderFieldRow({
      label: "Domande",
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
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="peekQ" title="Mostra elenco">
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
          ? `<div class="text-muted small">Nessuna domanda.</div>`
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

    // Criteria
    const cs = utils.getCriteria(exam);
    const cSummary = cs.length ? `<span>${cs.length} criteri</span>` : `<span class="text-muted">0 criteri</span>`;

    const cRow = renderFieldRow({
      label: "Criteri",
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
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="peekC" title="Mostra elenco">
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
          ? `<div class="text-muted small">Nessun criterio.</div>`
          : `
            <div class="small">
              ${csLocal
                .map(
                  (c) => `
                    <div class="mb-1">
                      ${utils.escapeHtml(c.name)}
                      <span class="text-muted">(peso ${c.weight ?? 0})</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `;
    };
    details.appendChild(cRow);

    // AI config
    const ai = exam.openai_schema_json || null;
    let aiSummary = `<span class="text-muted">—</span>`;
    try {
      const score = ai?.properties?.score;
      const min = score?.minimum ?? 0;
      const max = score?.maximum ?? 30;
      const honors = !!ai?.properties?.honors?.default;
      const notes = ai?.properties?.teacher_notes?.default || "";
      aiSummary = `<span>Range ${min}-${max} • honors ${honors ? "on" : "off"}${
        notes ? ` • note: ${utils.escapeHtml(notes)}` : ""
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
                <label class="form-label mb-1 small text-muted">Voto minimo</label>
                <input type="number" class="form-control" id="editAiMin" value="${minV}">
              </div>
              <div class="col-6">
                <label class="form-label mb-1 small text-muted">Voto massimo</label>
                <input type="number" class="form-control" id="editAiMax" value="${maxV}">
              </div>

              <div class="col-12 d-flex align-items-center gap-2 mt-1">
                <input class="form-check-input" type="checkbox" id="editAiHonors" ${honorsV ? "checked" : ""}>
                <label class="form-check-label" for="editAiHonors">Permetti honors</label>
              </div>

              <div class="col-12">
                <label class="form-label mb-1 small text-muted">Note per AI (opzionale)</label>
                <input type="text" class="form-control" id="editAiNotes" value="${utils.escapeHtml(notesV)}">
              </div>

              <div class="col-12 d-flex justify-content-end gap-2 mt-2">
                <button type="button" class="btn btn-sm btn-secondary" data-act="cancel">Annulla</button>
                <button type="button" class="btn btn-sm text-white" style="background-color:#619ad6" data-act="save">Salva</button>
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
              err.textContent = "Voto massimo deve essere >= voto minimo.";
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
              err.textContent = e?.message || "Errore";
              err.classList.remove("d-none");
            }
          };

          details.replaceChildren(box);
        },
      }),
    );

    detailsCard.appendChild(details);
    bodyEl.appendChild(detailsCard);

    // Submissions block (delegato)
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
                <div class="text-muted small">Apri per caricare dettagli...</div>
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

  async function loadTeacherMyExams() {
    const status = document.getElementById("examsStatus");
    const container = document.getElementById("examsList");

    if (container) container.innerHTML = "";
    if (status) status.textContent = "Caricamento...";

    try {
      const paged = await window.DASH.api(`/exams/mine?page=1&page_size=50`);
      const items = paged.items || [];

      if (status) status.textContent = `${items.length} esami`;

      if (items.length === 0) {
        if (container) container.innerHTML = `<div class="text-muted small">Nessun esame trovato.</div>`;
        return;
      }

      for (const exam of items) {
        container.appendChild(renderExamCard(exam));
      }
    } catch (e) {
      if (status) status.textContent = "";
      if (container) container.innerHTML = `<div class="alert alert-danger">Errore: ${utils.escapeHtml(e.message)}</div>`;
    }
  }

  // ==========================
  // Create exam modal (come prima)
  // ==========================
  function initCreateExamModal() {
    const ceTitle = document.getElementById("ceTitle");
    const ceDescription = document.getElementById("ceDescription");
    const cePublished = document.getElementById("cePublished");

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
            <input class="form-control q-text" placeholder="Testo domanda" value="${utils.escapeHtml(text)}">
          </div>
          <div class="col-3">
            <input type="number" class="form-control q-score" value="${score}" placeholder="Score">
          </div>
          <div class="col-2 d-flex justify-content-end">
            <button type="button" class="btn btn-sm btn-outline-danger" title="Rimuovi">
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
            <input class="form-control c-name" placeholder="Nome criterio" value="${utils.escapeHtml(name)}">
          </div>
          <div class="col-3">
            <input type="number" step="0.1" class="form-control c-weight" value="${weight}" placeholder="Peso">
          </div>
          <div class="col-2 d-flex justify-content-end">
            <button type="button" class="btn btn-sm btn-outline-danger" title="Rimuovi">
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

      aiMinScore.value = "0";
      aiMaxScore.value = "30";
      aiHonors.checked = false;
      aiNotes.value = "";

      questionsContainer.innerHTML = "";
      criteriaContainer.innerHTML = "";

      addQuestionRow("", 10);
      addCriterionRow("Correttezza", 1);
    }

    async function submitCreateExam() {
      if (isSubmittingExam) return;
      isSubmittingExam = true;

      ceError.classList.add("d-none");
      ceError.textContent = "";

      const title = ceTitle.value.trim();
      if (!title) {
        ceError.textContent = "Titolo obbligatorio.";
        ceError.classList.remove("d-none");
        isSubmittingExam = false;
        return;
      }

      const q = buildQuestionsJson().questions;
      const c = buildRubricJson().criteria;

      if (q.length === 0) {
        ceError.textContent = "Inserisci almeno una domanda.";
        ceError.classList.remove("d-none");
        isSubmittingExam = false;
        return;
      }

      if (c.length === 0) {
        ceError.textContent = "Inserisci almeno un criterio di valutazione.";
        ceError.classList.remove("d-none");
        isSubmittingExam = false;
        return;
      }

      const schemaObj = buildAISchemaJson();

      const payload = {
        title,
        description: ceDescription.value.trim() || null,
        questions_json: { questions: q },
        rubric_json: { criteria: c },
        openai_schema_json: schemaObj,
        is_published: !!cePublished.checked,
      };

      ceSubmitBtn.disabled = true;
      ceSubmitBtn.textContent = "Creazione...";

      try {
        await window.DASH.api("/exams", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        await loadTeacherMyExams();

        const modalEl = document.getElementById("createExamModal");
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      } catch (e) {
        ceError.textContent = e?.message || "Errore durante la creazione.";
        ceError.classList.remove("d-none");
      } finally {
        ceSubmitBtn.disabled = false;
        ceSubmitBtn.textContent = "Crea esame";
        isSubmittingExam = false;
      }
    }

    ceSubmitBtn.onclick = () => submitCreateExam();

    exams.resetCreateExamForm = resetCreateExamForm;
  }

  // exports
  exams.loadTeacherMyExams = loadTeacherMyExams;
  exams.initCreateExamModal = initCreateExamModal;
})();
