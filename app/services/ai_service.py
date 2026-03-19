import json
import os
from typing import Any, Dict, List, Optional, Union

import httpx

# LAYER INFRASTRUTTURALE CHE SI OCCUPA DI PARLARE CON OLLAMA

# Base URL configurabile (Docker-friendly)
# Esempi:
# - Ollama in compose:  http://ollama:11434
# - Ollama su host:     http://host.docker.internal:11434
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

# Endpoint configurabile (di default /api/generate)
OLLAMA_GENERATE_PATH = os.getenv("OLLAMA_GENERATE_PATH", "/api/generate")
OLLAMA_URL = f"{OLLAMA_BASE_URL}{OLLAMA_GENERATE_PATH}"

# Modello letto da env
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")


class AIEvaluationError(Exception):
    pass


def _loads_maybe(v: Any) -> Any:
    """
    Accetta:
    - dict/list -> ritorna com'è
    - string -> prova json.loads; se il risultato è ancora una stringa JSON-like, riprova
    - None -> None
    """
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return v
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None

        try:
            obj = json.loads(s)
        except Exception:
            return v

        if isinstance(obj, str):
            s2 = obj.strip()
            if s2.startswith("{") or s2.startswith("["):
                try:
                    return json.loads(s2)
                except Exception:
                    return obj

        return obj
    return v


def normalize_questions(questions_json: Any) -> List[Dict[str, Any]]:
    """
    Supporta:
    - {"questions":[...]}  (formato attuale)
    - [...]               (lista diretta)
    """
    data = _loads_maybe(questions_json)
    if isinstance(data, dict) and isinstance(data.get("questions"), list):
        return data["questions"]
    if isinstance(data, list):
        return data
    raise AIEvaluationError("Invalid questions_json format")


def normalize_rubric(rubric_json: Any) -> Any:
    data = _loads_maybe(rubric_json)
    if data is None:
        raise AIEvaluationError("rubric_json missing")
    return data


def build_items_for_prompt(
    questions: List[Dict[str, Any]],
    answers_by_index: Dict[int, str],
) -> List[Dict[str, Any]]:
    """
    Converte questions + answers in lista compatta per prompt.
    FIX: supporta chiave 'text' (nuova) e 'question' (legacy).
    """
    items: List[Dict[str, Any]] = []

    for i, q in enumerate(questions):
        q_text = q.get("text") or q.get("question") or q.get("prompt")
        max_score = q.get("max_score")

        if not isinstance(q_text, str) or not q_text.strip():
            raise AIEvaluationError(
                f"Question[{i}] invalid text/question (expected non-empty string)"
            )

        if isinstance(max_score, str):
            try:
                max_score = float(max_score)
            except Exception:
                max_score = None

        if not isinstance(max_score, (int, float)):
            raise AIEvaluationError(f"Question[{i}] invalid 'max_score'")

        items.append(
            {
                "i": i,
                "q": q_text.strip(),
                "a": (answers_by_index.get(i) or "").strip(),
                "m": int(max_score),
            }
        )

    return items


def build_prompt(
    *,
    exam_title: str,
    exam_description: Optional[str],
    rubric: Any,
    qa_items: List[Dict[str, Any]],
) -> str:
    rubric_s = json.dumps(rubric, ensure_ascii=False, separators=(",", ":"))
    qa_s = json.dumps(qa_items, ensure_ascii=False, separators=(",", ":"))
    desc = (exam_description or "").strip()

    return f"""
Sei un docente universitario.

Valuta le risposte usando SOLO la RUBRICA.

TITOLO:
{exam_title}

DESCRIZIONE:
{desc}

RUBRICA_JSON:
{rubric_s}

RISPOSTE_JSON:
{qa_s}

REGOLE:
- score: intero 0..30
- honors: true solo se score=30
- comment: opzionale; se presente deve essere una stringa breve, chiara e utile
- details_json: null oppure breakdown per domanda (opzionale)

Rispondi SOLO con JSON valido nel formato:
{{"score":0,"honors":false,"comment":null,"details_json":null}}

Il campo "comment" può essere null oppure una stringa.
Nessun testo fuori dal JSON.
""".strip()


def _validate_result(result: Dict[str, Any]) -> None:
    if not isinstance(result, dict):
        raise AIEvaluationError("AI output is not a JSON object")

    score = result.get("score")
    honors = result.get("honors")
    comment = result.get("comment")

    if not isinstance(score, int) or not (0 <= score <= 30):
        raise AIEvaluationError("Field 'score' must be int 0..30")

    if not isinstance(honors, bool):
        raise AIEvaluationError("Field 'honors' must be boolean")

    # comment opzionale:
    # - può mancare
    # - può essere null
    # - se è stringa vuota => normalizziamo a None
    if comment is not None and not isinstance(comment, str):
        raise AIEvaluationError("Field 'comment' must be a string or null")

    if isinstance(comment, str):
        normalized_comment = comment.strip()
        result["comment"] = normalized_comment if normalized_comment else None

    if honors and score != 30:
        raise AIEvaluationError("honors=true allowed only when score=30")

    if "details_json" in result and result["details_json"] is not None:
        if not isinstance(result["details_json"], (dict, list)):
            raise AIEvaluationError("details_json must be object/array/null")


async def evaluate_with_ollama(
    *,
    model: Optional[str],
    prompt: str,
    schema_format: Union[str, dict, None] = None,
    num_predict: int = 256,
    timeout_s: float = 180.0,
    keep_alive: str = "10m",
) -> Dict[str, Any]:
    use_model = model or DEFAULT_OLLAMA_MODEL

    fmt: Any = "json"
    if schema_format is not None:
        fmt = _loads_maybe(schema_format)

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        try:
            r = await client.post(
                OLLAMA_URL,
                json={
                    "model": use_model,
                    "prompt": prompt,
                    "stream": False,
                    "format": fmt,
                    "keep_alive": keep_alive,
                    "options": {"temperature": 0, "num_predict": int(num_predict)},
                },
            )
        except httpx.ConnectError as e:
            raise AIEvaluationError(
                f"Cannot connect to Ollama at {OLLAMA_URL}. "
                f"Set OLLAMA_BASE_URL correctly (docker: http://ollama:11434, host: http://host.docker.internal:11434)."
            ) from e

    if r.status_code != 200:
        raise AIEvaluationError(f"Ollama HTTP {r.status_code}: {r.text}")

    data = r.json()
    raw = data.get("response")
    if not raw:
        raise AIEvaluationError("Empty response from Ollama")

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        raise AIEvaluationError(f"Model returned invalid JSON: {raw}")

    _validate_result(result)
    return result
