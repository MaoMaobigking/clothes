"""FastAPI 主入口"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os, sys

sys.path.insert(0, os.path.dirname(__file__))

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

app = FastAPI(title="AI 服装 - AI 层", version="0.1.0", description="Python FastAPI 版 AI 后端")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

from routers import style, chat, scene
app.include_router(style.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(scene.router, prefix="/api")

@app.get("/api/health")
def health():
    return {"ok": True, "provider": os.getenv("AI_PROVIDER", "openai"), "backend": "fastapi"}
