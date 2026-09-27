from fastapi import APIRouter, Depends
from backend.auth import require_manager, require_team_head, require_staff, require_guest

from sqlalchemy.orm import Session
from datetime import datetime

from backend.database import get_db
from backend.models import Task, Staff, Room, AuditLog, Assignment
from backend.schemas.intelligence import RecommendationResponse
from backend.services.intelligence_service import get_next_best_action

router = APIRouter(dependencies=[Depends(require_manager)], prefix="/api/intelligence", tags=["intelligence"])

@router.get("/next-action", response_model=RecommendationResponse)
def get_next_action(db: Session = Depends(get_db)):
    # 1. Fetch live operational data
    active_tasks = db.query(Task).filter(Task.status.notin_(["closed", "verified"])).all()
    staff = db.query(Staff).all()
    rooms = db.query(Room).all()
    
    # Calculate active tasks per staff
    staff_task_counts = {}
    for s in staff:
        count = db.query(Assignment).join(Task).filter(
            Assignment.staff_id == s.id,
            Task.status.notin_(["closed", "verified"])
        ).count()
        staff_task_counts[s.id] = count

    # 2. Get AI or Rule-based recommendation
    recommendation = get_next_best_action(db, active_tasks, staff, rooms, staff_task_counts)
    
    # 3. Audit Logging (Deduplicated)
    import datetime
    last_log = db.query(AuditLog).filter(
        AuditLog.action.in_(["next_best_action_generated", "NEXT_BEST_ACTION"])
    ).order_by(AuditLog.id.desc()).first()

    if not last_log or last_log.details_json.get("prediction") != recommendation.action and last_log.details_json.get("action") != recommendation.action:
        audit_entry = AuditLog(
            resource_type="system",
            resource_id=0,
            action="NEXT_BEST_ACTION",
            details_json={
                "source": "rule_based" if recommendation.source != "llm" else "llm",
                "prediction": recommendation.action,
                "evidence": "System state (tasks, staff, rooms)",
                "reasoning": "Determined via priority scoring of current resort operational backlog."
            },
            created_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(audit_entry)
        db.commit()
    
    return recommendation

from backend.schemas.intelligence import SystemicIssueResponse
from backend.services.anomaly_service import detect_systemic_issues

@router.get("/systemic-issues", response_model=SystemicIssueResponse)
def get_systemic_issues(db: Session = Depends(get_db)):
    """
    Returns emerging operational patterns based on recent complaints.
    """
    issue = detect_systemic_issues(db)
    
    import datetime
    last_log = db.query(AuditLog).filter(
        AuditLog.action == "EMERGING_PATTERN"
    ).order_by(AuditLog.id.desc()).first()
    
    has_issues = len(issue.issues) > 0
    pattern_title = issue.issues[0].title if has_issues else "No Pattern"
    
    if not last_log or last_log.details_json.get("prediction") != pattern_title:
        audit_entry = AuditLog(
            resource_type="system",
            resource_id=0,
            action="EMERGING_PATTERN",
            details_json={
                "source": "statistical",
                "algorithm": "frequency_thresholding",
                "prediction": pattern_title,
                "evidence": "Recent complaint volume",
                "reasoning": issue.issues[0].summary if has_issues else "Volume below threshold."
            },
            created_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(audit_entry)
        db.commit()
        
    return issue
