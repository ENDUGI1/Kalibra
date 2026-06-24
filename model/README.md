# model — Kalibra forecast service

FastAPI service exposing the forecasting model behind a stable contract. Phase 0 ships a
dependency-free **Poisson baseline**; the API surface stays fixed when a real model replaces it.

## API

- `GET /health` → `{ "status": "ok", "model_version": "baseline-0.1" }`
- `POST /predict`

```jsonc
// request
{ "market_id": "0x...", "home": "ARS", "away": "CHE", "features": {} }
// response
{ "market_id": "0x...", "prob_home": 0.69, "model_version": "baseline-0.1" }
```

`features` is optional. Supply `home_lambda` / `away_lambda` to override the derived expected-goals
rates; otherwise the baseline derives deterministic team strengths from the team codes.

## Develop

```bash
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

uvicorn app.main:app --reload      # http://127.0.0.1:8000  (/docs for OpenAPI)
pytest -q                          # run tests
```

`uv` works too: `uv sync && uv run uvicorn app.main:app --reload`.
