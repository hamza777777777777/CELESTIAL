import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from backend.main import app
from backend.database import SessionLocal, Base, engine
from backend.models import User, Staff, Task, Complaint, Assignment
from backend.auth import get_token_verifier
from fastapi import HTTPException, status

client = TestClient(app)

def mock_firebase_verifier(token: str) -> str:
    """Mock verifier for testing RBAC token verification."""
    if not token or not token.startswith("test-"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase ID token"
        )
    if not token.endswith("-uid"):
        return f"{token}-uid"
    return token

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    app.dependency_overrides[get_token_verifier] = lambda: mock_firebase_verifier
    
    import uuid
    # Instead of deleting, just create unique users for tests
    unique_suffix = f"test_rbac_{uuid.uuid4().hex[:8]}"
    
    # Create test users
    users = [
        User(name="Manager", role="Manager", email=f"manager_{unique_suffix}@test.com", firebase_uid=f"test-manager-{unique_suffix}-uid"),
        User(name="TeamHead", role="Team Head", email=f"head_{unique_suffix}@test.com", firebase_uid=f"test-head-{unique_suffix}-uid"),
        User(name="Staff1", role="Staff", email=f"staff1_{unique_suffix}@test.com", firebase_uid=f"test-staff1-{unique_suffix}-uid"),
        User(name="Staff2", role="Staff", email=f"staff2_{unique_suffix}@test.com", firebase_uid=f"test-staff2-{unique_suffix}-uid"),
        User(name="Guest1", role="Guest", email=f"guest1_{unique_suffix}@test.com", firebase_uid=f"test-guest1-{unique_suffix}-uid"),
        User(name="Guest2", role="Guest", email=f"guest2_{unique_suffix}@test.com", firebase_uid=f"test-guest2-{unique_suffix}-uid"),
    ]
    for u in users:
        db.add(u)
    db.commit()
    
    manager = db.query(User).filter_by(email=f"manager_{unique_suffix}@test.com").first()
    head = db.query(User).filter_by(email=f"head_{unique_suffix}@test.com").first()
    staff1 = db.query(User).filter_by(email=f"staff1_{unique_suffix}@test.com").first()
    staff2 = db.query(User).filter_by(email=f"staff2_{unique_suffix}@test.com").first()
    guest1 = db.query(User).filter_by(email=f"guest1_{unique_suffix}@test.com").first()
    guest2 = db.query(User).filter_by(email=f"guest2_{unique_suffix}@test.com").first()
    
    # Create staff profiles
    db.add(Staff(user_id=staff1.id, department="Housekeeping", available=True, shift_start="00:00", shift_end="23:59"))
    db.add(Staff(user_id=staff2.id, department="Maintenance", available=True, shift_start="00:00", shift_end="23:59"))
    db.commit()
    
    s1 = staff1.staff_profile
    s2 = staff2.staff_profile

    from backend.models.skill import Skill
    sk_clean = db.query(Skill).filter_by(name="Cleaning").first()
    if not sk_clean:
        sk_clean = Skill(name="Cleaning")
        db.add(sk_clean)
    sk_ac = db.query(Skill).filter_by(name="AC Repair").first()
    if not sk_ac:
        sk_ac = Skill(name="AC Repair")
        db.add(sk_ac)
    db.commit()
    s1.skills.append(sk_clean)
    s2.skills.append(sk_ac)
    db.commit()
    
    # Create tasks for staff
    c1 = Complaint(guest_id=guest1.id, text="c1", request_category="complaint", status="classified")
    db.add(c1)
    db.commit()
    db.refresh(c1)
    
    t1 = Task(complaint_id=c1.id, status="in_progress")
    db.add(t1)
    db.commit()
    db.refresh(t1)
    
    a1 = Assignment(task_id=t1.id, staff_id=s1.id, score=100)
    db.add(a1)
    
    c2 = Complaint(guest_id=guest2.id, text="c2", request_category="complaint", status="classified")
    db.add(c2)
    db.commit()
    db.refresh(c2)
    
    t2 = Task(complaint_id=c2.id, status="in_progress")
    db.add(t2)
    db.commit()
    db.refresh(t2)
    
    a2 = Assignment(task_id=t2.id, staff_id=s2.id, score=100)
    db.add(a2)
    db.commit()
    
    # Create task t3 for proof upload
    c3 = Complaint(guest_id=guest1.id, text="c3", request_category="complaint", status="classified")
    db.add(c3)
    db.commit()
    db.refresh(c3)
    
    t3 = Task(complaint_id=c3.id, status="in_progress")
    db.add(t3)
    db.commit()
    db.refresh(t3)
    
    a3 = Assignment(task_id=t3.id, staff_id=s1.id, score=100)
    db.add(a3)
    db.commit()
    
    yield {
        "unique_suffix": unique_suffix,
        "manager": manager, "head": head, "staff1": staff1, "staff2": staff2,
        "guest1": guest1, "guest2": guest2,
        "t1": t1.id, "t2": t2.id, "t3": t3.id
    }
    
    app.dependency_overrides.pop(get_token_verifier, None)
    db.close()

def mock_auth(token: str):
    return {"Authorization": f"Bearer {token}"}

def test_missing_token():
    res = client.get("/api/reports/operations")
    assert res.status_code == 401

def test_invalid_token():
    res = client.get("/api/reports/operations", headers={"Authorization": "Bearer invalid"})
    assert res.status_code == 401

def test_manager_access(setup_db):
    res = client.get("/api/reports/operations", headers=mock_auth(f"test-manager-{setup_db['unique_suffix']}"))
    assert res.status_code == 200

def test_guest_cannot_access_manager(setup_db):
    res = client.get("/api/reports/operations", headers=mock_auth(f"test-guest1-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_staff_cannot_access_manager(setup_db):
    res = client.get("/api/reports/operations", headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_team_head_cannot_access_manager(setup_db):
    res = client.get("/api/reports/operations", headers=mock_auth(f"test-head-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_team_head_can_access_team(setup_db):
    res = client.get("/api/staff", headers=mock_auth(f"test-head-{setup_db['unique_suffix']}"))
    assert res.status_code == 200

def test_guest_cannot_access_team_head(setup_db):
    res = client.get("/api/staff", headers=mock_auth(f"test-guest1-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_staff_update_own_task(setup_db):
    t1_id = setup_db["t1"]
    res = client.patch(f"/api/tasks/{t1_id}/status", json={"status": "completed"}, headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code == 200

def test_staff_cannot_update_other_task(setup_db):
    t2_id = setup_db["t2"]
    res = client.patch(f"/api/tasks/{t2_id}/status", json={"status": "completed"}, headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_staff_cannot_verify_own_task(setup_db):
    t1_id = setup_db["t1"]
    res = client.patch(f"/api/tasks/{t1_id}/status", json={"status": "verified"}, headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code in (400, 403)
    if res.status_code == 400: # Need proof first
        from backend.models import CompletionProof
        db = SessionLocal()
        db.add(CompletionProof(task_id=t1_id, photo_path="test", verified=False))
        db.commit()
        db.close()
        res = client.patch(f"/api/tasks/{t1_id}/status", json={"status": "verified"}, headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
        assert res.status_code == 403

def test_guest_can_access_own_requests(setup_db):
    g1 = setup_db["guest1"].id
    res = client.get(f"/api/guest/{g1}/requests", headers=mock_auth(f"test-guest1-{setup_db['unique_suffix']}"))
    assert res.status_code == 200

def test_guest_cannot_access_other_requests(setup_db):
    g2 = setup_db["guest2"].id
    res = client.get(f"/api/guest/{g2}/requests", headers=mock_auth(f"test-guest1-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_guest_can_access_own_notifications(setup_db):
    g1 = setup_db["guest1"].id
    res = client.get(f"/api/guest/{g1}/notifications", headers=mock_auth(f"test-guest1-{setup_db['unique_suffix']}"))
    assert res.status_code == 200

def test_guest_cannot_access_other_notifications(setup_db):
    g2 = setup_db["guest2"].id
    res = client.get(f"/api/guest/{g2}/notifications", headers=mock_auth(f"test-guest1-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_staff_view_own_task(setup_db):
    t1_id = setup_db["t1"]
    res = client.get(f"/api/tasks/{t1_id}", headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code == 200
    assert res.json()["id"] == t1_id

def test_staff_cannot_view_other_task(setup_db):
    t2_id = setup_db["t2"]
    res = client.get(f"/api/tasks/{t2_id}", headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_staff_upload_proof_own_task(setup_db):
    t3_id = setup_db["t3"]
    files = {"file": ("proof.jpg", b"fake image bytes", "image/jpeg")}
    res = client.post(f"/api/tasks/{t3_id}/completion-proof", files=files, headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code == 200

def test_staff_cannot_upload_proof_other_task(setup_db):
    t2_id = setup_db["t2"]
    # Ensure t2 is in_progress
    client.patch(f"/api/tasks/{t2_id}/status", json={"status": "in_progress"}, headers=mock_auth(f"test-manager-{setup_db['unique_suffix']}"))
    files = {"file": ("proof.jpg", b"fake image bytes", "image/jpeg")}
    res = client.post(f"/api/tasks/{t2_id}/completion-proof", files=files, headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_staff_cannot_reassign_task(setup_db):
    t1_id = setup_db["t1"]
    res = client.post(f"/api/tasks/{t1_id}/reassign", json={"new_staff_id": 2, "reason": "Staff reassign attempt"}, headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code in (400, 403)

def test_staff_cannot_access_manager_pricing(setup_db):
    res = client.get("/api/pricing/competitive-analysis", headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_staff_cannot_access_team_head_rooms(setup_db):
    res = client.get("/api/rooms", headers=mock_auth(f"test-staff1-{setup_db['unique_suffix']}"))
    assert res.status_code == 403

def test_manager_can_access_operational_guest_data(setup_db):
    # Manager has full operational visibility into resort tasks and complaints
    res = client.get("/api/tasks", headers=mock_auth(f"test-manager-{setup_db['unique_suffix']}"))
    assert res.status_code == 200

def test_signup_creates_guest(setup_db):
    suffix = setup_db['unique_suffix']
    res = client.post("/api/auth/signup", json={
        "name": f"New Guest {suffix}",
        "email": f"newguest_{suffix}@test.com",
        "firebase_uid": f"test-newguest-{suffix}-uid"
    })
    assert res.status_code == 200
    assert res.json()["role"] == "Guest"


# ── Targeted Tests (Part 7: Guest Access & Assignment) ─────────────────────

def test_guest_can_access_recommendation(setup_db):
    guest_auth = mock_auth(f"test-guest1-{setup_db['unique_suffix']}")
    res = client.post("/api/recommendations/room-match", json={"query": "quiet room near pool"}, headers=guest_auth)
    assert res.status_code == 200

def test_guest_can_access_booking_occupancy_allowed(setup_db):
    guest_auth = mock_auth(f"test-guest1-{setup_db['unique_suffix']}")
    res = client.get("/api/rooms/categories", headers=guest_auth)
    assert res.status_code == 200

def test_guest_can_submit_complaint(setup_db):
    guest_auth = mock_auth(f"test-guest1-{setup_db['unique_suffix']}")
    guest1 = setup_db["guest1"]
    res = client.post("/api/complaints", data={
        "guest_id": guest1.id,
        "room_number": 101,
        "text": "AC is not cooling properly",
        "language": "en"
    }, headers=guest_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["task_status"] == "assigned"
    assert data["assignment"]["staff_id"] is not None

def test_guest_cannot_access_dashboard_stats(setup_db):
    guest_auth = mock_auth(f"test-guest1-{setup_db['unique_suffix']}")
    res = client.get("/api/stats", headers=guest_auth)
    assert res.status_code == 403

def test_guest_cannot_access_staff_endpoint(setup_db):
    guest_auth = mock_auth(f"test-guest1-{setup_db['unique_suffix']}")
    res = client.get("/api/staff", headers=guest_auth)
    assert res.status_code == 403

def test_guest_cannot_access_task_management_endpoint(setup_db):
    guest_auth = mock_auth(f"test-guest1-{setup_db['unique_suffix']}")
    res = client.get("/api/tasks", headers=guest_auth)
    assert res.status_code == 403

def test_guest_cannot_access_audit_endpoint(setup_db):
    guest_auth = mock_auth(f"test-guest1-{setup_db['unique_suffix']}")
    res = client.get("/api/audit", headers=guest_auth)
    assert res.status_code == 403

def test_guest_cannot_access_pricing_endpoint(setup_db):
    guest_auth = mock_auth(f"test-guest1-{setup_db['unique_suffix']}")
    res = client.get("/api/pricing/competitive-analysis", headers=guest_auth)
    assert res.status_code == 403

def test_complaint_with_eligible_staff_automatically_assigned(setup_db):
    guest_auth = mock_auth(f"test-guest1-{setup_db['unique_suffix']}")
    guest1 = setup_db["guest1"]
    res = client.post("/api/complaints", data={
        "guest_id": guest1.id,
        "room_number": 102,
        "text": "Please send fresh linen and clean the room",
        "language": "en"
    }, headers=guest_auth)
    assert res.status_code == 200
    data = res.json()
    assert data["task_id"] is not None
    assert data["task_status"] == "assigned"
    assert data["assignment"]["staff_name"] is not None

def test_assignment_hard_filters_enforced():
    from backend.services.assignment_service import find_best_staff
    from backend.services.classification_service import ClassificationResult
    db = SessionLocal()
    try:
        clf = ClassificationResult(
            issue_type="Unknown",
            department="NonExistentDept",
            priority="Low",
            location=None,
            required_skill="General",
            confidence=0.9,
            source="rule_based",
            reasoning="test"
        )
        res = find_best_staff(clf, db)
        assert res is None
    finally:
        db.close()

def test_assignment_weighted_scoring():
    from backend.services.assignment_service import WEIGHTS
    assert WEIGHTS["skill_match"] == 0.35
    assert WEIGHTS["workload"] == 0.25
    assert WEIGHTS["availability"] == 0.20
    assert WEIGHTS["priority"] == 0.15
    assert WEIGHTS["recency"] == 0.05
    assert sum(WEIGHTS.values()) == 1.0

def test_no_eligible_staff_produces_clear_assignment_failure(setup_db):
    from backend.models.staff import Staff
    db = SessionLocal()
    kitchen_staff = db.query(Staff).filter(Staff.department == "Kitchen").all()
    ids_and_states = [(s.id, s.available) for s in kitchen_staff]
    for s in kitchen_staff:
        s.available = False
    db.commit()
    db.close()

    try:
        guest_auth = mock_auth(f"test-guest1-{setup_db['unique_suffix']}")
        guest1 = setup_db["guest1"]
        res = client.post("/api/complaints", data={
            "guest_id": guest1.id,
            "room_number": 103,
            "text": "The dinner was cold and need chef to recook food",
            "language": "en"
        }, headers=guest_auth)
        assert res.status_code == 409
        assert res.json()["detail"] == "No eligible staff member is currently available for this complaint."
    finally:
        db = SessionLocal()
        for sid, orig in ids_and_states:
            st = db.query(Staff).get(sid)
            if st:
                st.available = orig
        db.commit()
        db.close()
