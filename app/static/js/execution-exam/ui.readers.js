// app/static/js/execution-exam/ui.readers.js
(() => {
  window.EXEC_EXAM = window.EXEC_EXAM || {};
  const NS = window.EXEC_EXAM;
  const ui = (NS.ui = NS.ui || {});

  function readAnswers() {
    ui.hideAnswersError();

    const { questionsWrap } = ui.refs;
    const out = [];
    const areas = questionsWrap.querySelectorAll("textarea[data-qidx]");

    areas.forEach((ta) => {
      const i = Number(ta.getAttribute("data-qidx"));
      const txt = (ta.value || "").trim();
      out.push({ question_index: i, answer_text: txt });
    });

    const empty = out.filter((a) => !a.answer_text);
    if (empty.length) {
      throw new Error(
        `Fill in all answers. Missing: ${empty.map((x) => "#" + (x.question_index + 1)).join(", ")}`,
      );
    }
    return out;
  }

  function readSelfEvaluation() {
    ui.hideSelfEvalError();

    const { selfScoreEl, selfHonorsEl, selfCommentEl } = ui.refs;

    const score = Number(selfScoreEl.value);
    const honors = !!selfHonorsEl.checked;
    const comment = (selfCommentEl.value || "").trim();

    if (!Number.isInteger(score) || score < 0 || score > 30) {
      throw new Error("Self-evaluation: score must be an integer between 0 and 30.");
    }
    if (honors && score !== 30) {
      throw new Error("Self-evaluation: honors is allowed only when score = 30.");
    }
    if (!comment) {
      throw new Error("Self-evaluation: enter a comment.");
    }

    return { score, honors, comment };
  }

  ui.readAnswers = readAnswers;
  ui.readSelfEvaluation = readSelfEvaluation;
})();