📘 DOCS – Aggiornare una tabella con Alembic (FastAPI + Docker + Yugabyte)
🎯 Obiettivo

Aggiornare una tabella esistente (evaluations) modificando:

Enum logico EvaluatorType

Check constraint ck_evaluations_evaluator_type_valid

Eventuale data migration (teacher → peer)

🧠 Architettura coinvolta

SQLAlchemy models → definiscono lo schema

Alembic → genera e applica migrazioni

Docker Compose → esegue il servizio API

YugabyteDB (PostgreSQL-compatible) → database

🧩 STEP 1 — Modifica del Model

File:

app/models/evaluation.py

Abbiamo cambiato:

class EvaluatorType(str, enum.Enum):
    student = "student"
    peer = "peer"   # 🔥 sostituisce teacher
    ai = "ai"

E il CheckConstraint automaticamente usa:

f"evaluator_type IN {EvaluatorType.values()}"

⚠️ Questo NON aggiorna il DB automaticamente.
Serve una migrazione.

🛠 STEP 2 — Generare la migrazione Alembic

⚠️ Importantissimo: Alembic gira DENTRO il container.

Comando corretto:

docker compose exec -w /app api alembic -c /app/alembic.ini revision --autogenerate -m "replace teacher with peer"

Spiegazione:

-w /app → working directory nel container

-c /app/alembic.ini → path corretto del file di config

--autogenerate → confronta metadata vs DB

Se Alembic non rileva cambiamenti strutturali (come in questo caso), genera un file vuoto.

File creato:

alembic/versions/6d518f11a29a_replace_teacher_with_peer.py
✍ STEP 3 — Scrivere manualmente la migrazione

Poiché abbiamo cambiato un CHECK constraint, Alembic non lo rileva automaticamente.

Abbiamo quindi modificato manualmente:

def upgrade() -> None:
    # 1) data migration
    op.execute("UPDATE evaluations SET evaluator_type='peer' WHERE evaluator_type='teacher'")

    # 2) aggiorna check constraint
    op.drop_constraint("ck_evaluations_evaluator_type_valid", "evaluations", type_="check")
    op.create_check_constraint(
        "ck_evaluations_evaluator_type_valid",
        "evaluations",
        "evaluator_type IN ('student','peer','ai')",
    )


def downgrade() -> None:
    op.execute("UPDATE evaluations SET evaluator_type='teacher' WHERE evaluator_type='peer'")

    op.drop_constraint("ck_evaluations_evaluator_type_valid", "evaluations", type_="check")
    op.create_check_constraint(
        "ck_evaluations_evaluator_type_valid",
        "evaluations",
        "evaluator_type IN ('student','teacher','ai')",
    )
🚀 STEP 4 — Applicare la migrazione
docker compose exec -w /app api alembic -c /app/alembic.ini upgrade head

Nei log vedrai:

INFO  [alembic.runtime.migration] Running upgrade b7c9fdfba510 -> 6d518f11a29a

Questo significa:

Migrazione applicata

Constraint aggiornato

Eventuale data migration eseguita

🔁 STEP 5 — Riavvio completo (opzionale)

Se vuoi ripartire pulito:

docker compose down -v
docker compose up --build

L’entrypoint fa:

Wait DB

alembic upgrade head

seed

start FastAPI

🌱 STEP 6 — Aggiornare il Seed

Nel seed abbiamo modificato:

peer_eval = Evaluation(
    submission_id=submission.id,
    evaluator_type=EvaluatorType.peer,
    ...
)

E aggiornato il calcolo:

final_score = (
    peer_eval.score * 0.6 + ai_eval.score * 0.3 + student_eval.score * 0.1
)
🧪 Verifica corretta applicazione

Puoi verificare da DB:

SELECT DISTINCT evaluator_type FROM evaluations;

Dovresti vedere:

student
peer
ai
📌 Perché Alembic non ha autogenerato nulla?

Perché:

Hai un String(20) → tipo non cambiato

Il CheckConstraint è string-based

Alembic non confronta automaticamente il contenuto delle CHECK

Quindi:

Modifica logica

Ma schema identico
→ Migrazione manuale necessaria

🧠 Pattern generale per future modifiche
Caso 1 — Aggiunta colonna

✔ Autogenerate funziona

Caso 2 — Cambio tipo colonna

✔ Autogenerate spesso funziona (con compare_type=True)

Caso 3 — Modifica CHECK constraint

❌ Scrivere migrazione manuale

Caso 4 — Data migration

❌ Sempre manuale con op.execute()

📂 Struttura Alembic nel tuo progetto
alembic/
    env.py
    versions/
        f667730baf43_initial.py
        b000672a218f_add_revoked_tokens.py
        b7c9fdfba510_add_materials_json.py
        6d518f11a29a_replace_teacher_with_peer.py

env.py è corretto perché:

target_metadata = Base.metadata
import app.models  # registra tutti i model
🔐 Best Practice usate

✔ Migrazione reversibile (upgrade + downgrade)
✔ Data migration inclusa
✔ Constraint coerente con model
✔ Seed aggiornato
✔ Docker-friendly workflow

🏁 Stato attuale del sistema

Evaluation types: student, peer, ai

Constraint coerente

Seed coerente

Alembic allineato

DB cluster Yugabyte ok

RAG & Qdrant separati per exam_id

🔥 Se vuoi alzare il livello

Possibili miglioramenti futuri:

Usare Enum nativo PostgreSQL invece di string

Aggiungere indice su evaluator_type

Separare evaluation weights in config table

Versionare rubriche