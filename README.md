# BitBuddy — LC-3 Simulator

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Frontend (second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173/ (no preview parameter needed).

## Tests

```bash
cd backend
python -m pytest -q
```

Frontend: `cd frontend && npm run build`.
