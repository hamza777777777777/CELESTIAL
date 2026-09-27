import pytest
from datetime import date
from backend.main import app
from backend.models.room import Room
from backend.models.booking import Booking
from backend.auth import get_token_verifier
from fastapi import HTTPException, status

def mock_firebase_verifier(token: str) -> str:
    if not token or not token.startswith("test-"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return "test-th-uid"

@pytest.fixture(scope="module", autouse=True)
def setup_auth_module():
    app.dependency_overrides[get_token_verifier] = lambda: mock_firebase_verifier
    yield
    app.dependency_overrides.pop(get_token_verifier, None)

AUTH_HEADER = {"Authorization": "Bearer test-th-uid"}

def test_no_booking_available(client_with_db, test_db):
    r1 = Room(room_number=101, room_type="Deluxe", status="cleaning", base_price_per_night=100)
    r2 = Room(room_number=102, room_type="Normal", status="maintenance", base_price_per_night=50)
    test_db.add_all([r1, r2])
    test_db.commit()

    response = client_with_db.get("/api/rooms?view_date=2026-10-05", headers=AUTH_HEADER)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    for room in data:
        assert room["booking_status"] == "available"
        assert room["booking_check_in"] is None

def test_booking_active_on_selected_date(client_with_db, test_db):
    r1 = Room(room_number=101, room_type="Deluxe", status="cleaning", base_price_per_night=100)
    test_db.add(r1)
    test_db.commit()

    b = Booking(room_id=r1.id, guest_id=1, check_in_date=date(2026, 10, 5), check_out_date=date(2026, 10, 8), status="confirmed")
    test_db.add(b)
    test_db.commit()
    
    # 2026-10-05 is check-in (Booked)
    res = client_with_db.get("/api/rooms?view_date=2026-10-05", headers=AUTH_HEADER)
    data = res.json()
    r101 = next(r for r in data if r["room_number"] == 101)
    assert r101["booking_status"] == "booked"
    assert r101["booking_check_in"] == "2026-10-05"
    assert r101["status"] == "cleaning" # Housekeeping status untouched

def test_date_before_and_after_booking(client_with_db, test_db):
    r1 = Room(room_number=101, room_type="Deluxe", status="cleaning", base_price_per_night=100)
    test_db.add(r1)
    test_db.commit()

    b = Booking(room_id=r1.id, guest_id=1, check_in_date=date(2026, 10, 5), check_out_date=date(2026, 10, 8), status="confirmed")
    test_db.add(b)
    test_db.commit()
    
    # Before check-in (2026-10-04) -> Available
    res1 = client_with_db.get("/api/rooms?view_date=2026-10-04", headers=AUTH_HEADER)
    r101_before = next(r for r in res1.json() if r["room_number"] == 101)
    assert r101_before["booking_status"] == "available"
    
    # Check-out date (2026-10-08) -> Available (since check_out > view_date is false)
    res2 = client_with_db.get("/api/rooms?view_date=2026-10-08", headers=AUTH_HEADER)
    r101_after = next(r for r in res2.json() if r["room_number"] == 101)
    assert r101_after["booking_status"] == "available"
    
def test_cancelled_booking(client_with_db, test_db):
    r1 = Room(room_number=101, room_type="Deluxe", status="cleaning", base_price_per_night=100)
    test_db.add(r1)
    test_db.commit()

    b = Booking(room_id=r1.id, guest_id=1, check_in_date=date(2026, 10, 5), check_out_date=date(2026, 10, 8), status="cancelled")
    test_db.add(b)
    test_db.commit()
    
    res = client_with_db.get("/api/rooms?view_date=2026-10-06", headers=AUTH_HEADER)
    data = res.json()
    r101 = next(r for r in data if r["room_number"] == 101)
    assert r101["booking_status"] == "available"

def test_cleaning_timer(client_with_db, test_db):
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    started = now - timedelta(minutes=20)
    
    r1 = Room(
        room_number=101, 
        room_type="Deluxe", 
        status="cleaning", 
        base_price_per_night=100,
        cleaning_started_at=started.isoformat(),
        cleaning_duration_minutes=45
    )
    test_db.add(r1)
    test_db.commit()

    res = client_with_db.get("/api/rooms?view_date=2026-10-06", headers=AUTH_HEADER)
    data = res.json()
    r101 = next(r for r in data if r["room_number"] == 101)
    
    assert r101["status"] == "cleaning"
    assert 24 <= r101["cleaning_minutes_remaining"] <= 25

def test_cleaning_timer_expired(client_with_db, test_db):
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    started = now - timedelta(minutes=60) # Overdue
    
    r1 = Room(
        room_number=101, 
        room_type="Deluxe", 
        status="cleaning", 
        base_price_per_night=100,
        cleaning_started_at=started.isoformat(),
        cleaning_duration_minutes=45
    )
    test_db.add(r1)
    test_db.commit()

    res = client_with_db.get("/api/rooms?view_date=2026-10-06", headers=AUTH_HEADER)
    data = res.json()
    r101 = next(r for r in data if r["room_number"] == 101)
    
    assert r101["status"] == "cleaning"
    assert r101["cleaning_minutes_remaining"] <= 0

def test_full_room_inventory(client_with_db, test_db):
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    cleaning_start_25m_ago = (now - timedelta(minutes=25)).isoformat()
    cleaning_start_50m_ago = (now - timedelta(minutes=50)).isoformat()
    
    demo_rooms = [
        # Floor 1
        Room(room_number=101, room_type="Deluxe",   floor=1, status="occupied", base_price_per_night=3500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
        Room(room_number=102, room_type="Normal",   floor=1, status="available", base_price_per_night=2500, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
        Room(room_number=103, room_type="Duplex",   floor=1, status="cleaning", cleaning_started_at=cleaning_start_25m_ago, cleaning_duration_minutes=45, base_price_per_night=5000, max_adults=4, max_children=2, has_extra_bed_option=True, extra_bed_price=1000),
        Room(room_number=104, room_type="Normal",   floor=1, status="occupied", base_price_per_night=2500, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
        # Floor 2
        Room(room_number=201, room_type="Suite",    floor=2, status="occupied", base_price_per_night=8500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=1500),
        Room(room_number=202, room_type="Luxury",   floor=2, status="occupied", base_price_per_night=6000, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
        Room(room_number=203, room_type="Normal",   floor=2, status="available", base_price_per_night=2500, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
        Room(room_number=204, room_type="Deluxe",   floor=2, status="available", base_price_per_night=3500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
        # Floor 3
        Room(room_number=301, room_type="Family",   floor=3, status="available", base_price_per_night=5500, max_adults=4, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
        Room(room_number=302, room_type="Deluxe",   floor=3, status="cleaning", cleaning_started_at=cleaning_start_50m_ago, cleaning_duration_minutes=45, base_price_per_night=3500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
        Room(room_number=303, room_type="Normal",   floor=3, status="maintenance", base_price_per_night=2500, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
        Room(room_number=304, room_type="Suite",    floor=3, status="available", base_price_per_night=8500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=1500),
        # Floor 4
        Room(room_number=401, room_type="Penthouse",floor=4, status="available", base_price_per_night=15000, max_adults=2, max_children=0, has_extra_bed_option=False, extra_bed_price=0),
        Room(room_number=402, room_type="Luxury",   floor=4, status="available", base_price_per_night=6000, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
        Room(room_number=403, room_type="Family",   floor=4, status="cleaning", cleaning_started_at=cleaning_start_25m_ago, cleaning_duration_minutes=30, base_price_per_night=5500, max_adults=4, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
        Room(room_number=404, room_type="Deluxe",   floor=4, status="occupied", base_price_per_night=3500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
    ]
    test_db.add_all(demo_rooms)
    test_db.commit()
    
    res = client_with_db.get("/api/rooms", headers=AUTH_HEADER)
    data = res.json()
    
    assert len(data) >= 16
    
    floors = set(r["floor"] for r in data)
    assert 1 in floors
    assert 2 in floors
    assert 3 in floors
    assert 4 in floors
    
    # Check that booked and occupied statuses co-exist
    # by booking an occupied room
    room_404 = next(r for r in data if r["room_number"] == 404)
    assert room_404["status"] == "occupied"
    
    b = Booking(room_id=room_404["id"], guest_id=1, check_in_date=date(2026, 10, 5), check_out_date=date(2026, 10, 8), status="confirmed")
    test_db.add(b)
    test_db.commit()

    res2 = client_with_db.get("/api/rooms?view_date=2026-10-06", headers=AUTH_HEADER)
    data2 = res2.json()
    
    r404 = next(r for r in data2 if r["room_number"] == 404)
    assert r404["booking_status"] == "booked"
    assert r404["status"] == "occupied"
