from fastapi import APIRouter, Depends, HTTPException
from backend.auth import require_manager, require_team_head, require_staff, require_guest

from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from typing import List

from backend.database import get_db
from backend.models import Staff, Task, Assignment, AuditLog
from backend.schemas.staff import StaffResponse

router = APIRouter(dependencies=[Depends(require_staff)], prefix="/api/staff", tags=["staff"])

class AvailabilityUpdateRequest(BaseModel):
    available: bool


@router.get("", response_model=List[StaffResponse])
def get_staff(db: Session = Depends(get_db)):
    """Return all staff with live availability and active task count."""
    staff_list = db.query(Staff).options(
        joinedload(Staff.user),
        joinedload(Staff.skills),
    ).all()

    results = []
    for s in staff_list:
        # Active tasks: assigned to this staff member and not yet closed/verified
        active_task_count = (
            db.query(Task)
            .join(Assignment, Assignment.task_id == Task.id)
            .filter(
                Assignment.staff_id == s.id,
                Task.status.in_(["assigned", "in_progress", "completed"])
            )
            .count()
        )

        results.append(StaffResponse(
            id=s.id,
            name=s.user.name if s.user else "Unknown",
            department=s.department or "N/A",
            available=s.available,
            shift_start=s.shift_start,
            shift_end=s.shift_end,
            active_task_count=active_task_count,
            skills=[skill.name for skill in s.skills],
        ))

    return results

@router.patch("/{staff_id}/availability", response_model=StaffResponse, dependencies=[Depends(require_team_head)])
def update_staff_availability(
    staff_id: int, 
    request: AvailabilityUpdateRequest, 
    db: Session = Depends(get_db)
):
    """Update staff member's availability."""
    staff = db.query(Staff).options(
        joinedload(Staff.user),
        joinedload(Staff.skills)
    ).filter(Staff.id == staff_id).first()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    old_value = staff.available
    new_value = request.available
    
    staff.available = new_value
    
    audit_log = AuditLog(
        action="STAFF_AVAILABILITY_CHANGED",
        resource_type="Staff",
        resource_id=staff.id,
        details_json={
            "staff_id": staff.id,
            "staff_name": staff.user.name if staff.user else "Unknown",
            "old_value": old_value,
            "new_value": new_value,
            "source": "manager_action"
        }
    )
    db.add(audit_log)
    db.commit()
    db.refresh(staff)
    
    # Calculate active tasks for response
    active_task_count = (
        db.query(Task)
        .join(Assignment, Assignment.task_id == Task.id)
        .filter(
            Assignment.staff_id == staff.id,
            Task.status.in_(["assigned", "in_progress", "completed"])
        )
        .count()
    )
    
    return StaffResponse(
        id=staff.id,
        name=staff.user.name if staff.user else "Unknown",
        department=staff.department or "N/A",
        available=staff.available,
        shift_start=staff.shift_start,
        shift_end=staff.shift_end,
        active_task_count=active_task_count,
        skills=[skill.name for skill in staff.skills],
    )
