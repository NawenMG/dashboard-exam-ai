// app/static/js/execution-exam/ui.modal.js
(() => {
  window.EXEC_EXAM = window.EXEC_EXAM || {};
  const NS = window.EXEC_EXAM;
  const ui = (NS.ui = NS.ui || {});

  function openConfirmModal() {
    const { confirmModalErr, confirmModalEl } = ui.refs;
    confirmModalErr.classList.add("d-none");
    confirmModalErr.textContent = "";
    bootstrap.Modal.getOrCreateInstance(confirmModalEl).show();
  }

  function setConfirmModalError(msg) {
    const { confirmModalErr } = ui.refs;
    confirmModalErr.textContent = msg || "Error";
    confirmModalErr.classList.remove("d-none");
  }

  function setConfirmSubmitBusy(busy) {
    const { btnConfirmSubmit } = ui.refs;
    if (!btnConfirmSubmit) return;
    btnConfirmSubmit.disabled = !!busy;
    if (busy) {
      btnConfirmSubmit.dataset.oldHtml = btnConfirmSubmit.innerHTML;
      btnConfirmSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Submitting...`;
    } else {
      btnConfirmSubmit.innerHTML = btnConfirmSubmit.dataset.oldHtml || "Confirm submission";
    }
  }

  ui.openConfirmModal = openConfirmModal;
  ui.setConfirmModalError = setConfirmModalError;
  ui.setConfirmSubmitBusy = setConfirmSubmitBusy;
})();