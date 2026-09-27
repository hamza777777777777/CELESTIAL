from fastapi.testclient import TestClient
from backend.main import app
from backend.models import AuditLog
from backend.auth import get_token_verifier
from fastapi import HTTPException, status
import pytest

client = TestClient(app)

def mock_firebase_verifier(token: str) -> str:
    if not token or not token.startswith("test-"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return "test-manager-uid"

@pytest.fixture(scope="module", autouse=True)
def setup_auth_module():
    app.dependency_overrides[get_token_verifier] = lambda: mock_firebase_verifier
    yield
    app.dependency_overrides.pop(get_token_verifier, None)

AUTH_HEADER = {"Authorization": "Bearer test-manager-uid"}

def test_demand_forecast_endpoint_success(test_db):
    """GET /api/ml/demand-forecast returns HTTP 200 with correct structure."""
    response = client.get("/api/ml/demand-forecast", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()

    assert data["horizon_days"] == 7
    assert len(data["forecast"]) == 7

    for day in data["forecast"]:
        assert day["predicted_demand"] >= 0
        assert "date" in day

    assert data["source"] == "public_benchmark"
    assert "disclaimer" in data
    assert "public European hotel booking data" in data["disclaimer"]
    assert "simulated historical context" in data["disclaimer"]

def test_demand_forecast_no_audit_on_get(test_db):
    """GET /api/ml/demand-forecast MUST NOT write AuditLog records.
    
    Ordinary page refreshes must not flood AuditLog.
    """
    before = test_db.query(AuditLog).filter(AuditLog.action == "DEMAND_FORECAST_GENERATED").count()

    # Call 5 times to prove no flood
    for _ in range(5):
        r = client.get("/api/ml/demand-forecast", headers=AUTH_HEADER)
        assert r.status_code == 200

    after = test_db.query(AuditLog).filter(AuditLog.action == "DEMAND_FORECAST_GENERATED").count()

    assert after == before, (
        f"AuditLog flooded: {before} before, {after} after 5 GET requests. "
        "GET /api/ml/demand-forecast must NOT write audit records."
    )

def test_demand_forecast_event_calendar_structure(test_db):
    """Events are only attached when calendar overlaps forecast; no demand fabrication."""
    response = client.get("/api/ml/demand-forecast", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()

    for day in data["forecast"]:
        if day.get("event") is not None:
            assert "name" in day["event"]
            assert "category" in day["event"]
            assert "importance" in day["event"]
        if day.get("planning_signal") is not None:
            # planning_signal must be event-driven (event must also be non-null)
            assert day.get("event") is not None, (
                "planning_signal present but event is null — planning signals must be driven by events"
            )

def test_demand_forecast_inference_source_in_metrics(test_db):
    """API response must document inference data source so clients know it is simulated."""
    response = client.get("/api/ml/demand-forecast", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()

    metrics = data.get("metrics", {})
    assert metrics.get("inference_data_source") == "simulated_benchmark_context"
    assert "inference_data_note" in metrics
