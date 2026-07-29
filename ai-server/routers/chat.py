"""对话路由"""
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from services.ai_service import ai_chat, ai_chat_stream, ai_chat_with_tools
from services.tool_service import TOOLS

router = APIRouter()

@router.post("/chat", tags=["AI"])
async def chat(body: dict):
    messages = body.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")
    reply = await ai_chat(messages, body.get("system"))
    return {"reply": reply}

@router.post("/chat/stream", tags=["AI"])
async def chat_stream(body: dict):
    messages = body.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")
    async def gen():
        collected = []
        async def on_chunk(delta):
            collected.append(delta)
        try:
            full = await ai_chat_stream(messages, body.get("system"), on_chunk)
            for delta in collected:
                yield f"data: {json.dumps({'delta': delta, 'done': False}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'delta': '', 'done': True, 'fullText': full}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})

@router.get("/chat/tools", tags=["AI"])
async def list_tools():
    return {"tools": TOOLS}

@router.post("/chat/tools", tags=["AI"])
async def chat_tools(body: dict):
    messages = body.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")
    async def gen():
        collected = []
        async def on_chunk(delta):
            collected.append(delta)
        context = {"profile": body.get("profile", {}), "garments": []}
        try:
            full = await ai_chat_with_tools(messages, on_chunk, context)
            for delta in collected:
                yield f"data: {json.dumps({'delta': delta, 'done': False}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'delta': '', 'done': True, 'fullText': full}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})
