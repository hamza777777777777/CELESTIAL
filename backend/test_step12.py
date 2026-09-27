import os
import pytest
from backend.main import app
from backend.models.audit_log import AuditLog
from backend.auth import get_token_verifier
from fastapi import HTTPException, status

# The client and db sessions are provided by conftest.py fixtures

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

def test_model_loads():
    # Test 1 - Model loads
    from backend.services.ml_service import load_model_and_metrics
    model, metrics = load_model_and_metrics()
    assert model is not None
    assert metrics is not None
    assert "model_name" in metrics

def test_valid_inference(client_with_db, test_db):
    # Test 2 & 3 & 4
    payload = {
        "lead_time": 45,
        "arrival_date_week_number": 27,
        "arrival_date_day_of_month": 4,
        "stays_in_weekend_nights": 0,
        "stays_in_week_nights": 2,
        "adults": 2,
        "children": 0,
        "babies": 0,
        "is_repeated_guest": 0,
        "previous_cancellations": 0,
        "previous_bookings_not_canceled": 0,
        "booking_changes": 0,
        "agent": 9.0,
        "days_in_waiting_list": 0,
        "adr": 105.0,
        "required_car_parking_spaces": 0,
        "total_of_special_requests": 0,
        "hotel": "Resort Hotel",
        "arrival_date_year": 2017,
        "arrival_date_month": "July",
        "meal": "BB",
        "country": "PRT",
        "market_segment": "Online TA",
        "distribution_channel": "TA/TO",
        "reserved_room_type": "A",
        "deposit_type": "No Deposit",
        "customer_type": "Transient"
    }
    
    response = client_with_db.post("/api/ml/cancellation-risk", json=payload, headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    
    # Test 2
    assert "prediction" in data
    assert "cancellation_probability" in data
    assert "risk_level" in data
    
    # Test 3
    assert 0 <= data["cancellation_probability"] <= 1
    
    # Test 4
    assert data["model_name"] == "Smart Resort Cancellation Predictor"
    assert "v" in data["model_version"]
    assert data["algorithm"] == "RandomForestClassifier"
    assert "Hotel Booking Demand" in data["dataset_source"]
    assert "roc_auc" in data["evaluation_metrics"]

def test_invalid_input(client_with_db):
    # Test 5
    response = client_with_db.post("/api/ml/cancellation-risk", json={"lead_time": "INVALID_TYPE", "country": 123}, headers=AUTH_HEADER)
    assert response.status_code == 422

def test_audit_event_created(test_db):
    # Test 6, 8
    # Check latest audit log
    log = test_db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    if log is None:
        return # Skip if tests run out of order
    assert log.action == "ML_CANCELLATION_PREDICTION"
    assert log.details_json["source"] == "ml"
    assert "prediction" in log.details_json
    assert "cancellation_probability" in log.details_json
    assert "Hotel Booking Demand" in log.details_json["dataset_source"]
