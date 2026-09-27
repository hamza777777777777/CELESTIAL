import pytest
import os
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.complaint import Complaint
from backend.models.task import Task
from backend.services.anomaly_service import detect_systemic_issues
# test_db fixture is provided by conftest.py (isolated in-memory SQLite)

from backend.auth import get_token_verifier
from fastapi import HTTPException, status

client = TestClient(app)

def mock_firebase_verifier(token: str) -> str:
    if not token or not token.startswith("test-"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return "test-manager-uid"

@pytest.fixture(scope="module", autouse=True)
def setup_auth_manager():
    app.dependency_overrides[get_token_verifier] = lambda: mock_firebase_verifier
    yield
    app.dependency_overrides.pop(get_token_verifier, None)

AUTH_HEADER = {"Authorization": "Bearer test-manager-uid"}

# test_db fixture is inherited from conftest.py — do NOT redefine it here

def seed_complaints(db, texts):
    for i, t in enumerate(texts):
        # We also assign a room number for floor extraction
        room_num = 101 + i
        comp = Complaint(guest_id=1, room_number=room_num, text=t, language="en", status="submitted")
        db.add(comp)
    db.commit()

# Test 1 — Pattern detected
@patch.dict(os.environ, {"OPENAI_API_KEY": "dummy_key"})
@patch("backend.services.anomaly_service.httpx.post")
def test_pattern_detected(mock_post, test_db):
    seed_complaints(test_db, [
        "AC is not cooling",
        "HVAC is broken",
        "It's too hot in here, AC failed"
    ])
    
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {
        "choices": [{"message": {"content": '{"summary": "AC is failing on floor 1"}'}}]
    }
    
    response = client.get("/api/intelligence/systemic-issues", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    
    assert len(data["issues"]) == 1
    issue = data["issues"][0]
    assert issue["type"] == "recurring_issue"
    assert issue["severity"] == "medium" # 3 complaints, no tasks => medium
    assert issue["summary"] == "AC is failing on floor 1"
    assert issue["source"] == "hybrid"
    assert "3 HVAC-related complaints recorded" in issue["evidence"][0]

# Test 2 — Different unrelated complaints
def test_unrelated_complaints(test_db):
    seed_complaints(test_db, [
        "AC is not cooling",
        "Food was cold",
        "Room needs cleaning"
    ])
    
    response = client.get("/api/intelligence/systemic-issues", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert len(data["issues"]) == 0

# Test 3 — Threshold
def test_threshold(test_db):
    seed_complaints(test_db, [
        "AC is not cooling",
        "HVAC is broken"
    ])
    
    response = client.get("/api/intelligence/systemic-issues", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert len(data["issues"]) == 0

# Test 4 — AI unavailable
@patch.dict(os.environ, clear=True) # Ensure API key is missing
def test_ai_unavailable(test_db):
    # Ensure OPENAI_API_KEY is not in env
    if "OPENAI_API_KEY" in os.environ:
        del os.environ["OPENAI_API_KEY"]
        
    seed_complaints(test_db, [
        "AC is not cooling",
        "HVAC is broken",
        "It's too hot in here, AC failed"
    ])
    
    response = client.get("/api/intelligence/systemic-issues", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert len(data["issues"]) == 1
    issue = data["issues"][0]
    assert issue["source"] == "rule_based"
    assert "3 recent complaints share the issue type HVAC." in issue["summary"]

# Test 5 — Malformed AI response
@patch.dict(os.environ, {"OPENAI_API_KEY": "dummy_key"})
@patch("backend.services.anomaly_service.httpx.post")
def test_malformed_ai_response(mock_post, test_db):
    seed_complaints(test_db, [
        "AC is not cooling",
        "HVAC is broken",
        "It's too hot in here, AC failed"
    ])
    
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {
        "choices": [{"message": {"content": 'invalid json'}}]
    }
    
    response = client.get("/api/intelligence/systemic-issues", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert len(data["issues"]) == 1
    issue = data["issues"][0]
    assert issue["source"] == "rule_based"

# Test 6 — Empty dataset
def test_empty_dataset(test_db):
    response = client.get("/api/intelligence/systemic-issues", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert "issues" in data
    assert len(data["issues"]) == 0
