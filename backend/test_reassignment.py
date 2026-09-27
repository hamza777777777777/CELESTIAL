"""
Tests for the reassignment endpoints.
Covers 7 scenarios (test 8 is the full suite run below).
"""

import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import uuid

from backend.main import app
from backend.database import Base, get_db
from backend.models import Task, Staff, User, Assignment, AuditLog, TaskStatusHistory
from backend.models.skill import Skill, staff_skills
from backend.auth import get_token_verifier
from fastapi import HTTPException, status

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

# ---------------------------------------------------------------------------
# Shared test DB fixture (per-test isolation)
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def override_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    db = TestSession()

    # Seed Manager user for auth
    u_mgr = User(id=999, name="Test Manager", role="Manager", email="mgr@test.com", firebase_uid="test-manager-uid")
    db.add(u_mgr)
    db.commit()

    def get_test_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = get_test_db
    yield db
    app.dependency_overrides.pop(get_db, None)
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(override_db):
    return TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_skill(db, name=None):
    name = name or f"Skill_{uuid.uuid4().hex[:6]}"
    skill = Skill(name=name)
    db.add(skill)
    db.flush()
    return skill


def make_staff(db, name="Worker", dept="Maintenance", available=True,
               shift_start="00:00", shift_end="23:59", skills=None):
    email = f"{name.lower().replace(' ', '.')}_{uuid.uuid4().hex[:6]}@test.com"
    user = User(name=name, email=email, role="staff")
    db.add(user)
    db.flush()
    staff = Staff(user_id=user.id, department=dept,
                  shift_start=shift_start, shift_end=shift_end,
                  available=available)
    db.add(staff)
    db.flush()
    if skills:
        for sk in skills:
            db.execute(staff_skills.insert().values(staff_id=staff.id, skill_id=sk.id))
    db.flush()
    return staff


def make_task(db, dept="Maintenance", priority="High", status="assigned", skill=None):
    task = Task(
        complaint_id=1,
        issue_type="Plumbing",
        department=dept,
        priority=priority,
        location="Room 101",
        required_skill_id=skill.id if skill else None,
        status=status,
        last_recorded_sla_status=None,
    )
    db.add(task)
    db.flush()
    return task


def make_assignment(db, task, staff, minutes_ago=30):
    assigned_at = datetime.datetime.utcnow() - datetime.timedelta(minutes=minutes_ago)
    a = Assignment(task_id=task.id, staff_id=staff.id,
                   score=0.8, score_breakdown={}, assigned_at=assigned_at)
    db.add(a)
    db.flush()
    return a


# ---------------------------------------------------------------------------
# 1. GET candidates excludes current assignee
# ---------------------------------------------------------------------------

def test_candidates_excludes_current_assignee(client, override_db):
    db = override_db
    skill = make_skill(db, "Plumbing")
    current = make_staff(db, "Current Worker", skills=[skill])
    other = make_staff(db, "Other Worker", skills=[skill])
    task = make_task(db, skill=skill)
    make_assignment(db, task, current)
    db.commit()

    resp = client.get(f"/api/tasks/{task.id}/reassignment-candidates", headers=AUTH_HEADER)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    ids = [c["staff_id"] for c in data["candidates"]]
    assert current.id not in ids
    assert other.id in ids


# ---------------------------------------------------------------------------
# 2. GET candidates returns correctly scored/ranked staff
# ---------------------------------------------------------------------------

def test_candidates_ranked_by_score(client, override_db):
    db = override_db
    skill = make_skill(db, "Plumbing2")
    current = make_staff(db, "Current", skills=[skill])
    cand_a = make_staff(db, "Candidate A", skills=[skill])
    cand_b = make_staff(db, "Candidate B", skills=[skill])

    task = make_task(db, skill=skill)
    make_assignment(db, task, current)

    # Give cand_a a recent extra assignment (hurts recency score)
    extra_task = make_task(db, skill=skill, status="in_progress")
    make_assignment(db, extra_task, cand_a, minutes_ago=5)

    db.commit()

    resp = client.get(f"/api/tasks/{task.id}/reassignment-candidates", headers=AUTH_HEADER)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    cands = data["candidates"]
    assert len(cands) >= 2

    scores = [c["score"] for c in cands]
    assert scores == sorted(scores, reverse=True), "Candidates must be sorted by score descending"

    for c in cands:
        bd = c["score_breakdown"]
        for key in ("weighted_total", "skill_match", "workload", "availability", "priority", "recency"):
            assert key in bd, f"Missing '{key}' in score_breakdown"


# ---------------------------------------------------------------------------
# 3. GET candidates returns empty + reason when none eligible
# ---------------------------------------------------------------------------

def test_candidates_empty_when_none_eligible(client, override_db):
    db = override_db
    skill = make_skill(db, "Unique")
    only_staff = make_staff(db, "Only One", skills=[skill])
    task = make_task(db, skill=skill)
    make_assignment(db, task, only_staff)
    db.commit()

    resp = client.get(f"/api/tasks/{task.id}/reassignment-candidates", headers=AUTH_HEADER)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["candidates"] == []
    assert data["empty_reason"] is not None
    assert len(data["empty_reason"]) > 10  # non-trivial message


# ---------------------------------------------------------------------------
# 4. POST reassign rejects wrong-department staff
# ---------------------------------------------------------------------------

def test_reassign_rejects_wrong_department(client, override_db):
    db = override_db
    skill = make_skill(db, "PlumbingX")
    current = make_staff(db, "Maintenance Worker", dept="Maintenance", skills=[skill])
    wrong_dept = make_staff(db, "Housekeeping Worker", dept="Housekeeping", skills=[skill])

    task = make_task(db, dept="Maintenance", skill=skill)
    make_assignment(db, task, current)
    db.commit()

    resp = client.post(
        f"/api/tasks/{task.id}/reassign",
        json={"new_staff_id": wrong_dept.id, "reason": "test"},
        headers=AUTH_HEADER,
    )
    assert resp.status_code == 400, resp.text
    assert "department" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 5. POST reassign succeeds with valid eligible staff
# ---------------------------------------------------------------------------

def test_reassign_succeeds_valid_staff(client, override_db):
    db = override_db
    skill = make_skill(db, "PlumbingY")
    current = make_staff(db, "Current Worker", skills=[skill])
    new_worker = make_staff(db, "New Worker", skills=[skill])

    task = make_task(db, skill=skill)
    make_assignment(db, task, current)
    db.commit()

    resp = client.post(
        f"/api/tasks/{task.id}/reassign",
        json={"new_staff_id": new_worker.id, "reason": "Better fit"},
        headers=AUTH_HEADER,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assignments = data.get("assignments", [])
    assert len(assignments) >= 2, "Should have old + new assignment"
    last = assignments[-1]
    assert last["staff_id"] == new_worker.id


# ---------------------------------------------------------------------------
# 6. POST reassign resets assigned_at and last_recorded_sla_status
# ---------------------------------------------------------------------------

def test_reassign_resets_sla_state(client, override_db):
    db = override_db
    skill = make_skill(db, "PlumbingZ")
    current = make_staff(db, "Current Worker", skills=[skill])
    new_worker = make_staff(db, "New Worker", skills=[skill])

    task = make_task(db, skill=skill)
    make_assignment(db, task, current, minutes_ago=120)
    task.last_recorded_sla_status = "overdue"
    db.commit()

    before_reassign = datetime.datetime.utcnow()

    resp = client.post(
        f"/api/tasks/{task.id}/reassign",
        json={"new_staff_id": new_worker.id},
        headers=AUTH_HEADER,
    )
    assert resp.status_code == 200, resp.text

    db.expire_all()
    updated_task = db.query(Task).filter(Task.id == task.id).first()
    # After reassignment, the SLA dedup state must not be 'overdue' —
    # perform_reassignment clears it to None, and get_task may re-evaluate
    # it to 'on_track' (since the clock just reset). Either None or on_track
    # confirms the stale 'overdue' state was cleared.
    assert updated_task.last_recorded_sla_status != "overdue", (
        f"Stale SLA status 'overdue' must be cleared after reassignment, "
        f"got '{updated_task.last_recorded_sla_status}'"
    )

    newest_assignment = (
        db.query(Assignment)
        .filter(Assignment.task_id == task.id)
        .order_by(Assignment.assigned_at.desc())
        .first()
    )
    assert newest_assignment.staff_id == new_worker.id
    assert newest_assignment.assigned_at >= before_reassign - datetime.timedelta(seconds=5)


# ---------------------------------------------------------------------------
# 7. POST reassign creates exactly one TASK_REASSIGNED audit entry
# ---------------------------------------------------------------------------

def test_reassign_creates_exactly_one_audit(client, override_db):
    db = override_db
    skill = make_skill(db, "PlumbingW")
    current = make_staff(db, "Current Worker", skills=[skill])
    new_worker = make_staff(db, "New Worker", skills=[skill])

    task = make_task(db, skill=skill)
    make_assignment(db, task, current)
    db.commit()

    count_before = db.query(AuditLog).filter(AuditLog.action == "TASK_REASSIGNED").count()

    resp = client.post(
        f"/api/tasks/{task.id}/reassign",
        json={"new_staff_id": new_worker.id, "reason": "test reason"},
        headers=AUTH_HEADER,
    )
    assert resp.status_code == 200, resp.text

    db.expire_all()
    count_after = db.query(AuditLog).filter(AuditLog.action == "TASK_REASSIGNED").count()
    assert count_after - count_before == 1, "Exactly one TASK_REASSIGNED audit event"

    audit = (
        db.query(AuditLog)
        .filter(AuditLog.action == "TASK_REASSIGNED", AuditLog.resource_id == task.id)
        .first()
    )
    assert audit is not None
    details = audit.details_json
    assert details["source"] == "manager_action"
    assert details["new_staff"] is not None
    assert details["old_staff"] is not None
    assert "new_assignment_score" in details
    assert details["reason"] == "test reason"
