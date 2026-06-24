from fastapi.testclient import TestClient

from app import MODEL_VERSION
from app.baseline import prob_home_win
from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["model_version"] == MODEL_VERSION


def test_predict_contract():
    resp = client.post(
        "/predict",
        json={"market_id": "0xabc", "home": "ARS", "away": "CHE", "features": {}},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["market_id"] == "0xabc"
    assert body["model_version"] == MODEL_VERSION
    assert 0.0 <= body["prob_home"] <= 1.0


def test_predict_deterministic():
    payload = {"market_id": "0x1", "home": "ARS", "away": "CHE", "features": {}}
    first = client.post("/predict", json=payload).json()["prob_home"]
    second = client.post("/predict", json=payload).json()["prob_home"]
    assert first == second


def test_features_override_changes_prediction():
    strong_home = prob_home_win("ARS", "CHE", home_lambda=3.0, away_lambda=0.3)
    weak_home = prob_home_win("ARS", "CHE", home_lambda=0.3, away_lambda=3.0)
    assert strong_home > weak_home
    assert strong_home > 0.7
    assert weak_home < 0.3


def test_predict_validation_error():
    resp = client.post("/predict", json={"market_id": "0x1", "home": "ARS"})
    assert resp.status_code == 422
