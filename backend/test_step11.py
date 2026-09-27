import os
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.audit_log import AuditLog
from backend.auth import get_token_verifier
from fastapi import HTTPException, status
# test_db fixture is provided by conftest.py (isolated in-memory SQLite)

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

# test_db fixture is inherited from conftest.py — do NOT redefine it here


def seed_audits(db, count=5):
    for i in range(count):
        db.add(AuditLog(
            action=f"TEST_ACTION_{i}",
            resource_type="TestResource",
            resource_id=i,
            details_json={"info": f"test_{i}"}
        ))
    db.commit()


# ── Test 1: Empty audit log returns clean empty list
def test_empty_audit_log(test_db):
    res = client.get("/api/audit", headers=AUTH_HEADER)
    assert res.status_code == 200
    assert res.json() == []


# ── Test 2: Existing audit records are returned
def test_existing_records(test_db):
    seed_audits(test_db, 3)
    res = client.get("/api/audit", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 3


# ── Test 3: Newest records appear first
def test_ordering(test_db):
    seed_audits(test_db, 3)
    res = client.get("/api/audit", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    # Seed inserts 0, 1, 2 sequentially. So 2 is newest.
    assert data[0]["action"] == "TEST_ACTION_2"
    assert data[2]["action"] == "TEST_ACTION_0"


# ── Test 4: Limit works
def test_limit(test_db):
    seed_audits(test_db, 5)
    res = client.get("/api/audit?limit=2", headers=AUTH_HEADER)
    assert res.status_code == 200
    assert len(res.json()) == 2


# ── Test 5: Maximum limit protection
def test_max_limit_protection(test_db):
    # Trying to pass limit > 100 should return 422 Validation Error
    res = client.get("/api/audit?limit=105", headers=AUTH_HEADER)
    assert res.status_code == 422


# ── Test 6: Real event types are intact
def test_real_event_types(test_db):
    test_db.add(AuditLog(
        action="COMPLAINT_CLASSIFIED",
        resource_type="Complaint",
        resource_id=99,
        details_json={"score": 92}
    ))
    test_db.commit()
    
    res = client.get("/api/audit", headers=AUTH_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert data[0]["action"] == "COMPLAINT_CLASSIFIED"
    assert data[0]["resource_type"] == "Complaint"
    assert data[0]["resource_id"] == 99
    assert data[0]["details_json"] == {"score": 92}


# ── Test 7: No mutation
def test_no_mutation(test_db):
    res1 = client.get("/api/audit", headers=AUTH_HEADER)
    assert res1.json() == []
    
    res2 = client.get("/api/audit", headers=AUTH_HEADER)
    assert res2.json() == []

# ── Test 8: Complaint submission with "en" succeeds
def test_complaint_submission_en(test_db):
    res = client.post("/api/complaints", data={
        "guest_id": 1,
        "room_number": 101,
        "text": "AC broken",
        "language": "en"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["language"] == "en"

# ── Test 9: Verification rules
def test_verification_rules(test_db):
    from backend.models import Task, CompletionProof, Complaint
    # Need a complaint first for FK
    comp = Complaint(guest_id=1, room_number=101, text="test", language="en", status="classified")
    test_db.add(comp)
    test_db.commit()
    
    task = Task(status="completed", complaint_id=comp.id)
    test_db.add(task)
    test_db.commit()
    test_db.refresh(task)
    
    # Cannot verify without proof
    res = client.patch(f"/api/tasks/{task.id}/status", json={"status": "verified"}, headers=AUTH_HEADER)
    assert res.status_code == 400
    
    # Add proof
    test_db.add(CompletionProof(task_id=task.id, photo_path="test.jpg"))
    test_db.commit()
    
    # Can verify with proof
    res = client.patch(f"/api/tasks/{task.id}/status", json={"status": "verified"}, headers=AUTH_HEADER)
    assert res.status_code == 200

# ── Test 10: Report Download
def test_report_download(test_db):
    res = client.get("/api/reports/operations", headers=AUTH_HEADER)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Task ID" in res.text
