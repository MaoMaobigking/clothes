"""风格报告路由"""
from fastapi import APIRouter, HTTPException
from services.ai_service import generate_report

router = APIRouter()

@router.post("/style-report", tags=["AI"])
async def style_report(body: dict):
    try:
        result = await generate_report(body.get("profile", {}))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
