from fastapi import APIRouter, Depends
from backend.auth import require_manager, require_team_head, require_staff, require_guest

from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Task, Complaint, Assignment

router = APIRouter(dependencies=[Depends(require_staff)], prefix="/api/stats", tags=["stats"])

HIGH_PRIORITY_VALUES = {"high", "critical", "High", "Critical"}
ACTIVE_TASK_STATUSES = {"created", "assigned", "in_progress", "completed", "verified"}
CLOSED_TASK_STATUSES = {"closed"}


@router.get("")
def get_stats(db: Session = Depends(get_db)):
    """Return aggregated operational statistics from live database data."""

    # ── Task counts by status ────────────────────────────────────────────────
    all_tasks = db.query(Task).all()
    status_counts: dict[str, int] = {}
    for t in all_tasks:
        status_counts[t.status] = status_counts.get(t.status, 0) + 1

    # Active tasks = everything that isn't closed
    active_tasks = sum(
        v for k, v in status_counts.items() if k not in CLOSED_TASK_STATUSES
    )

    # Unassigned = tasks in "created" status (no assignment yet)
    unassigned_tasks = status_counts.get("created", 0)

    # High-priority active tasks (priority lives on Task, not Complaint)
    high_priority_tasks = (
        db.query(Task)
        .filter(
            Task.priority.in_(list(HIGH_PRIORITY_VALUES)),
            Task.status.notin_(list(CLOSED_TASK_STATUSES))
        )
        .count()
    )

    # ── Complaint counts ─────────────────────────────────────────────────────
    total_complaints = db.query(Complaint).count()
    # Open complaints = not resolved
    open_complaints = (
        db.query(Complaint)
        .filter(Complaint.status.notin_(["resolved", "closed"]))
        .count()
    )

    return {
        "tasks": {
            "total": len(all_tasks),
            "created": status_counts.get("created", 0),
            "assigned": status_counts.get("assigned", 0),
            "in_progress": status_counts.get("in_progress", 0),
            "completed": status_counts.get("completed", 0),
            "verified": status_counts.get("verified", 0),
            "closed": status_counts.get("closed", 0),
            "active": active_tasks,
        },
        "complaints": {
            "total": total_complaints,
            "open": open_complaints,
            "high_priority": high_priority_tasks,
        },
        "assignments": {
            "assigned": status_counts.get("assigned", 0),
            "unassigned": unassigned_tasks,
        },
    }
