📚 FastAPI Exam Dashboard with AI Evaluation

Sistema completo per la gestione di esami universitari con supporto a:

gestione docenti e studenti
creazione e pubblicazione esami
sottomissione risposte con autovalutazione
peer evaluation anonima e ciclica tra studenti
valutazione automatica tramite AI (Ollama + RAG)
calcolo voto finale pesato
autenticazione JWT (Ed25519)
containerizzazione con Docker
🧱 Architettura

Stack principale:

FastAPI
SQLAlchemy 2.0
Alembic
Yugabyte
Docker + Docker Compose
Ollama (LLM locale)
Qdrant (vector DB per RAG)
JWT Ed25519
Repository pattern + Service layer
Frontend: Jinja2 + JavaScript modulare
📁 Struttura progetto
app/
 ├── api/
 ├── core/
 ├── db/
 ├── models/
 ├── repositories/
 ├── services/
 ├── schemas/
 ├── seeds/
 ├── static/
 └── templates/

alembic/
docker-compose.yml
dockerfile
⚙️ Prerequisiti

Installare:

Docker
Docker Compose
Git

Verifica:

docker --version
docker compose version
git --version
🤖 Setup Ollama (fondamentale per AI)

Installazione:

curl -fsSL https://ollama.com/install.sh | sh

Avvio servizio:

ollama serve

Scaricare modelli:

ollama pull llama3.2:3b
ollama pull nomic-embed-text
🚀 Avvio progetto
git clone https://github.com/TUO_USERNAME/dashboard-exam-ai.git
cd dashboard-exam-ai

docker compose up --build

Oppure in background:

docker compose up -d --build
✅ Cosa succede automaticamente

All’avvio:

database creato
migrations Alembic eseguite
seed iniziale caricato
API FastAPI avviata
frontend disponibile

Log:

docker compose logs -f api
🌐 Accesso applicazione
http://localhost:8000

Swagger:

http://localhost:8000/docs
🔐 Credenziali di test

Password:

password

Teacher:

teacher0@test.com
teacher1@test.com
...

Student:

student0@test.com
student1@test.com
...
🧭 Utilizzo Dashboard (Flusso Completo)
1. Creazione esame (Teacher)
Login come teacher
Vai in dashboard
Click su Create exam
Inserisci:
titolo
descrizione
domande
rubric (simple o level-based)
(Opzionale) carica PDF materiali
Salva
2. Pubblicazione esame
Apri card esame
Click Publish

⚠️ Solo esami pubblicati sono visibili agli studenti.

3. Svolgimento esame (Student)
Login come studente
Dashboard → Exams
Click Join
Compila:
risposte
self evaluation (obbligatoria)

Submit:

viene creata:
Submission
Evaluation (type = student)
👥 Peer Evaluation
🔁 Logica

Sistema ciclico:

ogni studente valuta k = 5 submission
se pochi studenti → k = n - 1
nessun self-review
nessun duplicato
anonimato completo
🧪 Come testarla
Step 1 – Creare dataset

Login teacher:

teacher0@test.com

Crea e pubblica un esame.

Step 2 – Creare submission

Login con più studenti:

student0
student1
student2
student3
student4
student5

Ognuno:

svolge esame
invia submission
Step 3 – Generare peer assignments

Login teacher:

Apri esame
Click:
Generate peer assignments

Backend:

POST /evaluations/peer/generate/{exam_id}
Step 4 – Completare peer review

Login studenti:

Vai in:

Dashboard → Peer Review

Ogni studente vede:

Anonymous submission

Deve inserire:

score (0–30)
commento
Step 5 – Chiusura peer (Teacher)

Quando una submission ha:

5 peer completed

Teacher:

apre submission
click:
Close peer reviews

Effetti:

blocca nuove peer
elimina pending
calcola statistiche (avg, min, max)
📊 Distribuzione

Con N studenti:

assegnazioni = N * min(5, N-1)

Esempi:

Studenti	k	Totale
5	4	20
10	5	50
50	5	250
🤖 AI Evaluation

Endpoint:

POST /ai-evaluations/{submission_id}

Richiede:

Ollama attivo
modello installato

Flusso:

recupera risposte
recupera rubric
usa RAG (Qdrant)
genera valutazione AI
salva evaluation type = ai
📊 Final Grade

Endpoint:

POST /final-grades

Richiede:

self evaluation
peer evaluation completate
AI evaluation

Formula:

final = peer * 0.6 + ai * 0.3 + self * 0.1
🗄 Database

Yugabyte + Alembic

Manuale:

docker compose exec api alembic upgrade head
🌱 Seed

Genera:

utenti
esami
submission

⚠️ Le peer NON sono generate automaticamente.

🐳 Servizi Docker
fastapi_api
fastapi_yugabyte
fastapi_adminer
qdrant

Adminer:

http://localhost:8080
🔄 Reset completo
docker compose down -v
docker compose up --build
🧠 Architettura software

Pattern:

Repository Pattern
Service Layer
Dependency Injection
DTO (Pydantic)
🔒 Sicurezza
JWT Ed25519
bcrypt password hashing
RBAC
token revocation
🧪 Dev senza Docker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
👨‍💻 Note finali

Il cuore del sistema è:

Exam
 → Submission
 → Answer[]
 → Evaluation (student)
 → Evaluation (peer[])
 → Evaluation (ai)
 → FinalGrade

La parte avanzata è:

PDF → chunking → embedding → Qdrant → retrieval → prompt → AI evaluation
📄 Licenza

Uso didattico / dimostrativo.