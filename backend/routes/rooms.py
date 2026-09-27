"""
Rooms route — Smart Resort 360
================================
GET /api/rooms returns seeded demo room data.

NOTE: Room occupancy data is SEEDED FOR DEMONSTRATION PURPOSES only.
      This project does not have a live booking/PMS system.
      Room statuses are seeded at startup and do not change dynamically.
"""
from fastapi import APIRouter, Depends
from backend.auth import require_manager, require_team_head, require_staff, require_guest

from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.database import get_db
from backend.models.room import Room
from backend.models.booking import Booking
from backend.schemas.room import RoomResponse

router = APIRouter(dependencies=[Depends(require_team_head)], prefix="/api/rooms", tags=["rooms"])


@router.get("", response_model=List[RoomResponse])
def get_rooms(view_date: Optional[str] = None, db: Session = Depends(get_db)):
    """Return all rooms (seeded demo data), optionally annotated with booking status."""
    rooms = db.query(Room).order_by(Room.room_number).all()

    now = datetime.utcnow()
    for r in rooms:
        # Calculate cleaning timer for all responses
        r.cleaning_minutes_remaining = None
        if r.status == "cleaning" and r.cleaning_started_at and r.cleaning_duration_minutes:
            try:
                started_dt = datetime.fromisoformat(r.cleaning_started_at)
                elapsed = (now - started_dt).total_seconds() / 60
                remaining = int(r.cleaning_duration_minutes - elapsed)
                r.cleaning_minutes_remaining = remaining
            except ValueError:
                pass

    if not view_date:
        for r in rooms:
            r.booking_status = "available"
            r.booking_check_in = None
            r.booking_check_out = None
        return rooms
        
    try:
        vd = datetime.strptime(view_date, "%Y-%m-%d").date()
    except ValueError:
        for r in rooms:
            r.booking_status = "available"
            r.booking_check_in = None
            r.booking_check_out = None
        return rooms

    bookings = db.query(Booking).filter(
        Booking.status == 'confirmed',
        Booking.check_in_date <= vd,
        Booking.check_out_date > vd
    ).all()

    booked_room_map = {b.room_id: b for b in bookings}

    for r in rooms:
        if r.id in booked_room_map:
            b = booked_room_map[r.id]
            r.booking_status = "booked"
            r.booking_check_in = str(b.check_in_date)
            r.booking_check_out = str(b.check_out_date)
        else:
            r.booking_status = "available"
            r.booking_check_in = None
            r.booking_check_out = None

    return rooms
