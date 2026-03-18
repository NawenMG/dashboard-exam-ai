// app/static/js/student/modal.js
(() => {
  window.STUDENT = window.STUDENT || {};
  const NS = window.STUDENT;

  const modal = (NS.modal = NS.modal || {});

  modal.refs = {
    joinExamModalEl: document.getElementById("joinExamModal"),
    joinExamTitleEl: document.getElementById("joinExamTitle"),
    joinExamDescEl: document.getElementById("joinExamDesc"),
    joinExamErrorEl: document.getElementById("joinExamError"),
    btnConfirmJoin: document.getElementById("btnConfirmJoin"),

    doneExamModalEl: document.getElementById("doneExamModal"),
    doneModalTitleEl: document.getElementById("doneModalTitle"),
    doneModalMetaEl: document.getElementById("doneModalMeta"),
    doneModalAnswersEl: document.getElementById("doneModalAnswers"),
    doneModalEmptyEl: document.getElementById("doneModalEmpty"),

    finalFlipCardEl: document.getElementById("finalFlipCard"),
    fgFrontHintEl: document.getElementById("fgFrontHint"),
    fgBackBodyEl: document.getElementById("fgBackBody"),

    peerEvalModalEl: document.getElementById("peerEvalModal"),
    peerEvalSubmissionTitleEl: document.getElementById("peerEvalSubmissionTitle"),
    peerModalAnswersEl: document.getElementById("peerModalAnswers"),
    peerModalEmptyEl: document.getElementById("peerModalEmpty"),

    peerEvalScoreEl: document.getElementById("peerEvalScore"),
    peerEvalCommentEl: document.getElementById("peerEvalComment"),
    peerEvalErrorEl: document.getElementById("peerEvalError"),
    peerEvalSuccessEl: document.getElementById("peerEvalSuccess"),
    btnSubmitPeerEvalEl: document.getElementById("btnSubmitPeerEval"),
  };

  function bindModalEvents() {
    modal.bindJoinDoneEvents?.();
    modal.bindPeerEvents?.();
  }

  bindModalEvents();
})();