"""情景推荐路由"""
from fastapi import APIRouter, HTTPException
from services.ai_service import generate_scene_outfits

router = APIRouter()

@router.post("/scene-outfits", tags=["AI"])
async def scene_outfits(body: dict):
    try:
        result = await generate_scene_outfits(body)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
