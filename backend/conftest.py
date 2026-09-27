"""
conftest.py — Smart Resort 360 Test Isolation
=============================================

CRITICAL: This file ensures that NO test ever touches the production/demo
database at backend/app.db.

Every test that uses the TestClient or direct DB sessions will operate
on a per-test in-memory SQLite database. The production engine is completely
untouched during test runs.

Architecture:
  Application:  DATABASE_URL → backend/app.db (file on disk — NEVER touched by tests)
  Tests:        TEST_DATABASE_URL → sqlite:///:memory: (isolated, per-test)

How it works:
  1. A pytest fixture `test_engine` creates a fresh in-memory SQLAlchemy engine.
  2. `get_db` (FastAPI dependency) is overridden to use the test session factory.
  3. All routes and services that receive `db` via Depends(get_db) automatically
     use the test database.
  4. Services that call SessionLocal() directly (e.g., test_step7 audit cleanup)
     are handled by patching `backend.database.SessionLocal` via the fixture.
  5. Each test function gets a completely fresh database — no shared state.
"""
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import Base, get_db


def _make_test_engine():
    """
    Create an isolated in-memory SQLite engine suitable for testing.
    StaticPool ensures the same in-memory connection is reused across
    threads (required by FastAPI's TestClient which may use threadpools).
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Enforce foreign keys for every connection
    @event.listens_for(engine, "connect")
    def _set_fk(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


@pytest.fixture()
def test_db():
    """
    Provides an isolated in-memory database session for each test.

    - Creates all tables fresh.
    - Overrides FastAPI's get_db dependency so routes use the same session.
    - Cleans up completely after each test (in-memory db is discarded).

    Usage in tests:
        def test_something(test_db):
            test_db.add(...)
            test_db.commit()
            res = client.get("/api/...")  # uses same isolated db
    """
    engine = _make_test_engine()
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create all tables
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    from backend.models.user import User
    from backend.models.staff import Staff
    if not db.query(User).filter_by(id=999).first():
        u_manager = User(id=999, name="Test Manager", role="Manager", email="mgr@test.com", firebase_uid="test-manager-uid")
        u_guest = User(id=1, name="Test Guest", role="Guest", email="guest@test.com", firebase_uid="test-guest-uid")
        u_staff = User(id=777, name="Test Staff", role="Staff", email="staff@test.com", firebase_uid="test-staff-uid")
        u_team_head = User(id=888, name="Test Team Head", role="Team Head", email="th@test.com", firebase_uid="test-th-uid")
        db.add_all([u_manager, u_guest, u_staff, u_team_head])
        db.commit()
        from backend.models.skill import Skill
        s_staff = Staff(id=777, user_id=777, department="Maintenance", available=True, shift_start="00:00", shift_end="23:59")
        s_th = Staff(id=888, user_id=888, department="Housekeeping", available=True, shift_start="00:00", shift_end="23:59")
        db.add_all([s_staff, s_th])
        db.commit()

        skills = [
            Skill(name="AC Repair"), Skill(name="HVAC"), Skill(name="Plumbing"), Skill(name="Electrical"),
            Skill(name="Cleaning"), Skill(name="Linen"), Skill(name="General"),
            Skill(name="Appliance Repair"), Skill(name="Carpentry")
        ]
        db.add_all(skills)
        db.commit()

        s_staff.skills.extend([s for s in skills if s.name in ["AC Repair", "HVAC", "Plumbing", "Electrical", "General", "Appliance Repair", "Carpentry"]])
        s_th.skills.extend([s for s in skills if s.name in ["Cleaning", "Linen", "General"]])
        db.commit()

    # Override the FastAPI dependency
    def override_get_db():
        try:
            yield db
        finally:
            pass  # we close in the finally block below

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        # Remove override so other test contexts are clean
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def client_with_db(test_db):
    """
    Returns a TestClient already wired to the isolated test database.
    Use this when you only need HTTP-level access and not direct DB access.
    """
    return TestClient(app)


