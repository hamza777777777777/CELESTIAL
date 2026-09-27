from fastapi import APIRouter, Depends
from backend.auth import require_manager, require_team_head, require_staff, require_guest

from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import AuditLog
from backend.schemas.ml import CancellationPredictionRequest, CancellationPredictionResponse, DemandForecastResponse
from backend.services.ml_service import predict_cancellation_risk, predict_demand_forecast
import datetime

router = APIRouter(dependencies=[Depends(require_manager)], prefix="/api/ml", tags=["ml"])

@router.post("/cancellation-risk", response_model=CancellationPredictionResponse)
def analyze_cancellation_risk(request: CancellationPredictionRequest, db: Session = Depends(get_db)):
    # 1. Perform Inference
    response = predict_cancellation_risk(request)
    
    # 2. Determine deterministic decision
    if response.risk_level == "High":
        decision = "Flag booking for retention follow-up"
    elif response.risk_level == "Medium":
        decision = "Monitor booking behavior"
    else:
        decision = "No action required"
    
    # 3. Create Audit Trail Entry
    audit_entry = AuditLog(
        action="ML_CANCELLATION_PREDICTION",
        resource_type="booking",
        resource_id=0, # Arbitrary ID as it's a theoretical booking
        details_json={
            "source": "ml",
            "model_name": response.model_name,
            "model_version": response.model_version,
            "algorithm": response.algorithm,
            "prediction": "Canceled" if response.prediction == 1 else "Not Canceled",
            "risk_level": response.risk_level,
            "cancellation_probability": response.cancellation_probability,
            "dataset_source": response.dataset_source,
            "features": response.key_input_features,
            "evaluation": response.evaluation_metrics,
            "decision": decision
        },
        created_at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(audit_entry)
    db.commit()
    
    return response

@router.get("/demand-forecast", response_model=DemandForecastResponse)
def get_demand_forecast():
    # NOTE: No AuditLog write on GET.
    # Ordinary page refreshes MUST NOT flood AuditLog.
    # If an explicit manager-triggered forecast event is needed in future,
    # implement a separate POST /api/ml/demand-forecast/generate action.
    return predict_demand_forecast()
