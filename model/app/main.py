"""FastAPI entrypoint for the Kalibra model service."""

from __future__ import annotations

from fastapi import FastAPI

from app import MODEL_VERSION
from app.baseline import prob_home_win
from app.schemas import HealthResponse, PredictRequest, PredictResponse

app = FastAPI(
    title="Kalibra Model Service",
    version=MODEL_VERSION,
    summary="Baseline probabilistic football forecast (P home win).",
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", model_version=MODEL_VERSION)


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    prob = prob_home_win(
        req.home,
        req.away,
        home_lambda=req.features.home_lambda,
        away_lambda=req.features.away_lambda,
    )
    return PredictResponse(
        market_id=req.market_id,
        prob_home=round(prob, 4),
        model_version=MODEL_VERSION,
    )
