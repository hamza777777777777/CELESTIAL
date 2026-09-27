from fastapi import APIRouter, Depends, Response
from backend.auth import require_manager, require_team_head, require_staff, require_guest

from sqlalchemy.orm import Session, joinedload
from backend.database import get_db
from backend.models import Task, Assignment, Staff
import csv
from io import StringIO

router = APIRouter(dependencies=[Depends(require_manager)], prefix="/api/reports", tags=["reports"])

@router.get("/operations")
def download_operations_report(db: Session = Depends(get_db)):
    tasks = db.query(Task).options(
        joinedload(Task.assignments).joinedload(Assignment.staff)
    ).order_by(Task.created_at.desc()).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Task ID",
        "Status",
        "Priority",
        "Department",
        "Issue Type",
        "Location",
        "Assigned Staff",
        "Created At",
        "Updated At"
    ])

    for task in tasks:
        staff_name = "Unassigned"
        if task.assignments:
            latest_assignment = task.assignments[-1]
            if latest_assignment.staff and latest_assignment.staff.user:
                staff_name = latest_assignment.staff.user.name

        writer.writerow([
            f"TSK-{task.id}",
            task.status,
            task.priority or "",
            task.department or "",
            task.issue_type or "",
            task.location or "",
            staff_name,
            task.created_at.isoformat() if task.created_at else "",
            task.updated_at.isoformat() if task.updated_at else ""
        ])

    response = Response(content=output.getvalue())
    response.headers["Content-Disposition"] = 'attachment; filename="smart-resort-operations-report.csv"'
    response.headers["Content-Type"] = "text/csv"
    return response
