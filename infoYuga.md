Docs – Implementazione YugabyteDB (3 nodi) + FastAPI
1) Obiettivo

Avere un database Distributed SQL con:

Sharding automatico (tabelle spezzate in tablet)

Replica (fault tolerance)

Cluster multi-nodo (3 nodi: yb1, yb2, yb3)

App FastAPI con:

driver async (asyncpg)

migrazioni Alembic

seed iniziale

Possibilità di ispezionare dati con:

UI (Master/TServer)

Client SQL: DBeaver / ysqlsh

2) Architettura (come funziona davvero)
2.1 Tablet = sharding (pezzi della tabella)

Ogni tabella viene spezzata in più tablet (shards). Ogni tablet contiene una porzione delle righe.

2.2 Replica = fault tolerance

Ogni tablet ha:

1 leader (scritture)

N follower (repliche)

Con replication_factor=3:

leader su un nodo

repliche sugli altri due

2.3 Bilanciamento

Yugabyte distribuisce i leader dei tablet tra i nodi per evitare che uno solo “regga tutto”.

Risultato:

i dati sono distribuiti

ogni pezzo è replicato

se un nodo muore, un follower diventa leader

3) Docker Compose consigliato (cluster 3 nodi)

Questo compose è stabile e evita i problemi di “join ip not reachable” usando un until basato sulla UI master (porta 7000).

Nota: yb2 e yb3 non espongono porte all’host: non serve. Basta esporre solo su yb1.

services:
  yb1:
    image: yugabytedb/yugabyte:2025.2.1.0-b141
    container_name: yb1
    hostname: yb1
    command:
      [
        "bin/yugabyted",
        "start",
        "--base_dir=/home/yugabyte/yb_data",
        "--background=false",
        "--advertise_address=yb1",
        "--master_flags=replication_factor=3",
      ]
    environment:
      TZ: Europe/Rome
    ports:
      - "7000:7000"   # Master UI
      - "9000:9000"   # TServer UI
      - "5433:5433"   # YSQL endpoint (Postgres-compatible)
      - "9042:9042"   # YCQL endpoint (Cassandra-like)
    volumes:
      - yb1_data:/home/yugabyte/yb_data

  yb2:
    image: yugabytedb/yugabyte:2025.2.1.0-b141
    container_name: yb2
    hostname: yb2
    restart: unless-stopped
    depends_on:
      - yb1
    command:
      [
        "bash",
        "-lc",
        "until (exec 3<>/dev/tcp/yb1/7000) >/dev/null 2>&1; do echo 'Waiting yb1:7000...'; sleep 2; done; exec bin/yugabyted start --base_dir=/home/yugabyte/yb_data --background=false --advertise_address=yb2 --join=yb1",
      ]
    environment:
      TZ: Europe/Rome
    volumes:
      - yb2_data:/home/yugabyte/yb_data

  yb3:
    image: yugabytedb/yugabyte:2025.2.1.0-b141
    container_name: yb3
    hostname: yb3
    restart: unless-stopped
    depends_on:
      - yb1
    command:
      [
        "bash",
        "-lc",
        "until (exec 3<>/dev/tcp/yb1/7000) >/dev/null 2>&1; do echo 'Waiting yb1:7000...'; sleep 2; done; exec bin/yugabyted start --base_dir=/home/yugabyte/yb_data --background=false --advertise_address=yb3 --join=yb1",
      ]
    environment:
      TZ: Europe/Rome
    volumes:
      - yb3_data:/home/yugabyte/yb_data

  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: fastapi_api
    restart: unless-stopped
    depends_on:
      - yb1
      - yb2
      - yb3
    env_file:
      - .env
    environment:
      TZ: Europe/Rome
      DATABASE_URL: "postgresql+asyncpg://yugabyte:yugabyte@yb1:5433/yugabyte"
      RUN_SEED: "true"
      SEED_STRICT: "false"
      OLLAMA_BASE_URL: "http://host.docker.internal:11434"
      OLLAMA_MODEL: "llama3.1:8b"
    ports:
      - "8000:8000"
    volumes:
      - ./:/app

volumes:
  yb1_data:
  yb2_data:
  yb3_data:

Comandi utili

Start:

docker compose up --build


Stop + reset completo (cancella DB):

docker compose down -v


Stato servizi:

docker compose ps

4) Porte / UI
4.1 Yugabyte UI

Master UI: http://localhost:7000

TServer UI: http://localhost:9000

Da qui puoi vedere:

nodi del cluster

tablet / leader / replica

health, placement, replication status

Nota: alcune guide citano porte diverse (es. 15433/13000) ma nel tuo setup con yugabyted start “standard”, la parte affidabile per UI è 7000/9000. Per vedere dati conviene DBeaver o ysqlsh.

5) Connessione al DB
5.1 Stringa “Postgres-like” (YSQL)

Host (da host machine): localhost

Porta: 5433

User: yugabyte

Password: yugabyte

DB: yugabyte

5.2 Da FastAPI (container)

Nel container api, usi:
yb1:5433 perché è il DNS interno di docker compose.

DATABASE_URL=postgresql+asyncpg://yugabyte:yugabyte@yb1:5433/yugabyte

5.3 DBeaver (consigliato per vedere tabelle e dati)

Crea connessione PostgreSQL:

Host: localhost

Port: 5433

DB: yugabyte

Username: yugabyte

Password: yugabyte

Poi:

Schemas → public → Tables → right click → View Data

6) SQLAlchemy + Alembic (punti critici)
6.1 Registrazione modelli (fondamentale)

Per far sì che Alembic veda le tabelle, devi importare i modelli in app/models/__init__.py.

Esempio (il tuo, corretto):

from .user import User
from .exam import Exam
from .submission import Submission
from .answer import Answer
from .evaluation import Evaluation
from .final_grade import FinalGrade
from .revoked_token import RevokedToken

__all__ = [
    "User",
    "Exam",
    "Submission",
    "Answer",
    "Evaluation",
    "FinalGrade",
    "RevokedToken",
]


Poi verifichi:

docker compose exec api bash -lc "python -c 'import app.models; from app.db.base import Base; print(sorted(Base.metadata.tables.keys()))'"

6.2 Migrazione “revoked_tokens”

Se la tabella manca:

alembic revision --autogenerate -m "add revoked_tokens"

alembic upgrade head

E verifichi con ysqlsh nel container yb1:

docker compose exec yb1 bash -lc "ysqlsh -h yb1 -p 5433 -U yugabyte -d yugabyte -c '\dt'"

7) Problemi incontrati e soluzioni
7.1 “relation revoked_tokens does not exist”

Causa: modello non importato (quindi alembic non lo migra) o migrazione non eseguita.

Fix:

import in models/__init__.py

genera migrazione + upgrade

7.2 Errore JSON: “json.loads expected str but got list”

Log:
TypeError: the JSON object must be str, bytes or bytearray, not list

Causa: nel DB questions_json era salvato come lista/dict (già strutturato), ma _from_json_str cercava comunque json.loads().

Fix robusto: accetta dict e list:

def _from_json_str(data):
    if data is None:
        return None
    if isinstance(data, (dict, list)):
        return data
    return json.loads(data)

7.3 Datetime: “can't subtract offset-naive and offset-aware datetimes”

Causa tipica:

stai inserendo datetime timezone-aware (UTC con tzinfo)

ma la colonna è TIMESTAMP WITHOUT TIME ZONE

Asyncpg impazzisce perché c’è mismatch.

Soluzioni (scegline UNA, meglio la #1):

DB timezone-aware (consigliata):
cambia il model RevokedToken (e qualsiasi altro datetime) a:

DateTime(timezone=True)

Oppure converti a naive prima di salvare (meno elegante):

expires_at.replace(tzinfo=None)

now.replace(tzinfo=None)

Tu alla fine l’hai risolta proprio andando verso questa normalizzazione.

7.4 Yugabyte “join ip not reachable” (in loop)

Succede quando yb2/yb3 provano a joinare troppo presto o non riescono a risolvere yb1 perché rete/compose non corretti.

Fix:

usare un until /dev/tcp/yb1/7000 prima del join (come compose sopra)

assicurarsi di avere una sola rete (di default è ok) e di non creare network duplicate

8) Verifiche utili (sanity checks)
8.1 Verifica tabelle dal DB
docker compose exec yb1 bash -lc "ysqlsh -h yb1 -p 5433 -U yugabyte -d yugabyte -c '\dt'"

8.2 Verifica schema tabella
docker compose exec yb1 bash -lc "ysqlsh -h yb1 -p 5433 -U yugabyte -d yugabyte -c '\d revoked_tokens'"

8.3 Verifica distribuzione / tablet

Da UI:

http://localhost:7000

cerca “Tables / Tablets” e controlla:

leader placement

replicas placement

9) Best practices per sviluppo

In dev, se “rompi” le migrazioni e vuoi ripartire:

docker compose down -v
docker compose up --build


Mantieni RUN_SEED=true solo in dev (in prod no)

Evita di usare UI “exotic ports” non garantite; per dati veri usa DBeaver.

Per timestamp: scegli una strategia coerente:

timezone=True ovunque (consigliata), oppure

naive ovunque

10) Cosa hai ottenuto (in sintesi)

✅ cluster distribuito 3 nodi
✅ tabelle shardate automaticamente in tablet
✅ replica a RF=3 (alta affidabilità)
✅ app FastAPI con migrazioni e seed
✅ ispezione dati con DBeaver
✅ gestione errori reali (JSON, datetime, migrazioni, join)