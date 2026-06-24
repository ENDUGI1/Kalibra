"""Request/response contracts for the model service. Stable API surface — the
Phase 0 baseline can be swapped for a real model without changing these."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PredictFeatures(BaseModel):
    """Optional, model-version-specific signal overrides.

    When omitted, the baseline derives deterministic team strengths from the
    team codes so the service is fully self-contained in Phase 0.
    """

    home_lambda: float | None = Field(
        default=None, ge=0.0, le=10.0, description="Expected home goals (overrides derived value)."
    )
    away_lambda: float | None = Field(
        default=None, ge=0.0, le=10.0, description="Expected away goals (overrides derived value)."
    )

    model_config = {"extra": "allow"}


class PredictRequest(BaseModel):
    market_id: str = Field(..., description="Opaque market id, e.g. 0x-prefixed hash.")
    home: str = Field(..., min_length=1, max_length=8, description="Home team code, e.g. ARS.")
    away: str = Field(..., min_length=1, max_length=8, description="Away team code, e.g. CHE.")
    features: PredictFeatures = Field(default_factory=PredictFeatures)


class PredictResponse(BaseModel):
    market_id: str
    prob_home: float = Field(..., ge=0.0, le=1.0, description="P(home win), 0..1.")
    model_version: str


class HealthResponse(BaseModel):
    status: str = "ok"
    model_version: str
