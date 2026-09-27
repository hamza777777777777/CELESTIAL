from fastapi import APIRouter, Depends, Query
from backend.auth import require_manager, require_team_head, require_staff, require_guest

from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models.audit_log import AuditLog
from backend.schemas.audit import AuditLogResponse

router = APIRouter(dependencies=[Depends(require_manager)], prefix="/api/audit", tags=["audit"])

@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Retrieve the most recent audit logs.
    Bounded by limit (default 50, max 100) to prevent unbounded DB reads.
    Newest records first.
    """
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
