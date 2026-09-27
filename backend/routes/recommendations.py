from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.auth import get_current_user
from backend.database import get_db
from backend.schemas.recommendation import RoomMatchRequest, RoomMatchResponse
from backend.services.recommendation_service import get_room_recommendations

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/api/recommendations", tags=["recommendations"])


@router.post("/room-match", response_model=RoomMatchResponse)
def room_match(payload: RoomMatchRequest, db: Session = Depends(get_db)):
    """
    Match a natural-language room request against live available rooms.
    Deterministic matching; AI assists with explanation only.
    """
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    try:
        response = get_room_recommendations(db, payload.query.strip())
        
        from backend.models import AuditLog
        import datetime
        
        # Log the recommendation
        audit_entry = AuditLog(
            resource_type="room",
            resource_id=0,
            action="ROOM_RECOMMENDATION",
            details_json={
                "source": "algorithmic",
                "algorithm": "multi-attribute_matching",
                "prediction": [r.room_type for r in response.matches] if response.matches else [],
                "confidence": response.matches[0].match_score if response.matches else 0.0,
                "evidence": f"Query: {payload.query.strip()}",
                "reasoning": response.matches[0].explanation if response.matches else "No matching rooms."
            },
            created_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(audit_entry)
        db.commit()
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")
