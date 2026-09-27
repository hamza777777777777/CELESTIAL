from fastapi import APIRouter, Depends, HTTPException, Query
from backend.auth import require_manager, require_team_head, require_staff, require_guest

from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas.pricing import PricingAnalysisResponse
from backend.services.pricing_service import get_competitive_analysis

router = APIRouter(dependencies=[Depends(require_manager)], 
    prefix="/api/pricing",
    tags=["pricing"]
)

@router.get("/competitive-analysis", response_model=PricingAnalysisResponse)
def get_analysis(
    room_type: str = Query("AC Deluxe", description="The room type to analyze"),
    db: Session = Depends(get_db)
):
    try:
        analysis = get_competitive_analysis(db, room_type)
        
        from backend.models import AuditLog
        import datetime
        last_log = db.query(AuditLog).filter(
            AuditLog.action == "PRICING_INTELLIGENCE"
        ).order_by(AuditLog.id.desc()).first()
        
        if not last_log or last_log.details_json.get("prediction") != analysis.recommendation:
            audit_entry = AuditLog(
                resource_type="pricing",
                resource_id=0,
                action="PRICING_INTELLIGENCE",
                details_json={
                    "source": "llm",
                    "model": "gpt-4o-mini",
                    "prediction": analysis.recommendation,
                    "confidence": 1.0,
                    "evidence": f"Analyzed {room_type} against competitors",
                    "reasoning": analysis.reason
                },
                created_at=datetime.datetime.now(datetime.timezone.utc)
            )
            db.add(audit_entry)
            db.commit()
            
        return analysis
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        with open("scratch/pricing_error.txt", "w", encoding="utf-8") as f:
            f.write(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to retrieve pricing analysis")
