import sys
import os

# Ensure the root workspace directory is in sys.path so 'backend' package imports succeed
_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

# Helper to load .env when python-dotenv is not installed
def _load_env():
    for env_path in [os.path.join(os.path.dirname(__file__), ".env"), os.path.join(_root_dir, ".env")]:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    content = f.read()
                if "FIREBASE_SERVICE_ACCOUNT_JSON=" in content:
                    if "FIREBASE_SERVICE_ACCOUNT_JSON='" in content:
                        s = content.index("FIREBASE_SERVICE_ACCOUNT_JSON='") + len("FIREBASE_SERVICE_ACCOUNT_JSON='")
                        e = content.index("'", s)
                        os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = content[s:e]
                    elif 'FIREBASE_SERVICE_ACCOUNT_JSON="' in content:
                        s = content.index('FIREBASE_SERVICE_ACCOUNT_JSON="') + len('FIREBASE_SERVICE_ACCOUNT_JSON="')
                        e = content.index('"', s)
                        os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = content[s:e]
                for line in content.splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line and not line.startswith("FIREBASE_SERVICE_ACCOUNT_JSON"):
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip("'").strip('"')
                        if k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass
_load_env()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.database import engine, Base
from backend.routes import health, complaints, tasks
from backend.routes import (
    staff, stats, rooms, intelligence, pricing, recommendations, audit, reports, ml, auth_routes
)

# Create all tables on startup (including new rooms table)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Resort 360 API")

# Allow Vite dev server
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Day 2 routes (unchanged) ─────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(complaints.router)
app.include_router(tasks.router)

# ── Day 3 routes (new) ───────────────────────────────────────────────────────
app.include_router(staff.router)
app.include_router(stats.router)
app.include_router(rooms.router)
app.include_router(intelligence.router)
app.include_router(pricing.router)
app.include_router(recommendations.router)
app.include_router(audit.router)
app.include_router(reports.router)
app.include_router(ml.router)
app.include_router(auth_routes.router)

from backend.routes import guest_portal, bookings
app.include_router(guest_portal.router)
app.include_router(bookings.router)

# ── Static file serving for completion proof images ──────────────────────────
os.makedirs("uploads/proofs", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ── Seed demo room data at startup if none exists ────────────────────────────
def seed_rooms():
    """
    Seed demonstration room data.
    NOTE: This is DEMO DATA — not a live PMS/booking system.
    Room statuses are static seeds for the Resort 360 manager view.
    """
    from backend.database import SessionLocal
    from backend.models.room import Room
    from datetime import datetime, timedelta
    db = SessionLocal()
    try:

        now = datetime.utcnow()
        cleaning_start_25m_ago = (now - timedelta(minutes=25)).isoformat()
        cleaning_start_50m_ago = (now - timedelta(minutes=50)).isoformat()
        
        demo_rooms = [
            # Floor 1
            Room(room_number=101, room_type="Deluxe",   floor=1, status="occupied", base_rate=3500, base_price_per_night=3500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
            Room(room_number=102, room_type="Normal",   floor=1, status="available", base_rate=2500, base_price_per_night=2500, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
            Room(room_number=103, room_type="Duplex",   floor=1, status="cleaning", cleaning_started_at=cleaning_start_25m_ago, cleaning_duration_minutes=45, base_rate=5000, base_price_per_night=5000, max_adults=4, max_children=2, has_extra_bed_option=True, extra_bed_price=1000),
            Room(room_number=104, room_type="Normal",   floor=1, status="occupied", base_rate=2500, base_price_per_night=2500, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
            # Floor 2
            Room(room_number=201, room_type="Suite",    floor=2, status="available", base_rate=8500, base_price_per_night=8500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=1500),
            Room(room_number=202, room_type="Luxury",   floor=2, status="available", base_rate=6000, base_price_per_night=6000, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
            Room(room_number=203, room_type="Normal",   floor=2, status="available", base_rate=2500, base_price_per_night=2500, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
            Room(room_number=204, room_type="Deluxe",   floor=2, status="available", base_rate=3500, base_price_per_night=3500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
            # Floor 3
            Room(room_number=301, room_type="Family",   floor=3, status="available", base_rate=5500, base_price_per_night=5500, max_adults=4, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
            Room(room_number=302, room_type="Deluxe",   floor=3, status="cleaning", cleaning_started_at=cleaning_start_50m_ago, cleaning_duration_minutes=45, base_rate=3500, base_price_per_night=3500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
            Room(room_number=303, room_type="Normal",   floor=3, status="maintenance", base_rate=2500, base_price_per_night=2500, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
            Room(room_number=304, room_type="Suite",    floor=3, status="available", base_rate=8500, base_price_per_night=8500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=1500),
            # Floor 4
            Room(room_number=401, room_type="Penthouse",floor=4, status="available", base_rate=15000, base_price_per_night=15000, max_adults=2, max_children=0, has_extra_bed_option=False, extra_bed_price=0),
            Room(room_number=402, room_type="Luxury",   floor=4, status="available", base_rate=6000, base_price_per_night=6000, max_adults=2, max_children=1, has_extra_bed_option=False, extra_bed_price=0),
            Room(room_number=403, room_type="Family",   floor=4, status="cleaning", cleaning_started_at=cleaning_start_25m_ago, cleaning_duration_minutes=30, base_rate=5500, base_price_per_night=5500, max_adults=4, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
            Room(room_number=404, room_type="Deluxe",   floor=4, status="occupied", base_rate=3500, base_price_per_night=3500, max_adults=2, max_children=2, has_extra_bed_option=True, extra_bed_price=500),
        ]
        
        # Check if rooms are already seeded, if we have less than 16, we add the missing ones
        existing_rooms = db.query(Room).all()
        existing_room_numbers = {r.room_number for r in existing_rooms}
        
        rooms_to_add = [r for r in demo_rooms if r.room_number not in existing_room_numbers]
        if rooms_to_add:
            db.add_all(rooms_to_add)
            db.commit()
        else:
            return # Already seeded everything

        from backend.models.booking import Booking
        from datetime import date, timedelta
        today = date.today()
        
        # Check if we already have bookings seeded for demo
        if not db.query(Booking).first():
            room_101 = db.query(Room).filter_by(room_number=101).first()
            room_201 = db.query(Room).filter_by(room_number=201).first()
            
            if room_101 and room_201:
                b1 = Booking(room_id=room_101.id, guest_id=1, check_in_date=today - timedelta(days=2), check_out_date=today + timedelta(days=2), adults=2, children=0, status="confirmed", total_price=14000)
                b2 = Booking(room_id=room_201.id, guest_id=2, check_in_date=today + timedelta(days=1), check_out_date=today + timedelta(days=5), adults=2, children=1, status="confirmed", total_price=34000)
                db.add_all([b1, b2])
                db.commit()
                print("[startup] Seeded 2 demo bookings.")
    finally:
        db.close()


seed_rooms()
