"""
auth_api.py — JWT 认证 API（独立服务）

端点：
    POST   /api/auth/login       邮箱+密码 → JWT token
    GET    /api/auth/verify       验证 JWT token → { valid, email, role }
    GET    /api/auth/users        管理员查看用户列表

决策：
    W1 独立 auth_api.py（vs 并入 tag_api.py），理由见 PLAN.md。
    D-17 "保留 FastAPI" 兼容两种方式，代理层屏蔽后端子服务细节。

启动：
    uvicorn auth_api:app --reload --port 8000
"""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# ─── 配置 ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "mwlab.db"

JWT_SECRET = os.environ.get("JWT_SECRET", "mwlab-dev-secret-2026-with-extra-length")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

security = HTTPBearer()


# ─── 应用 ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="MWLAB Auth API",
    description="JWT 用户认证服务",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic 模型 ────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    email: str
    role: str
    display_name: str


# ─── DB 辅助函数 ──────────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# ─── 端点 ─────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login", response_model=LoginResponse)
def login(req: LoginRequest):
    """验证邮箱+密码，返回 JWT token。"""
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM user WHERE email = ? AND is_active = 1",
            (req.email.strip().lower(),),
        ).fetchone()
    finally:
        conn.close()

    # 统一 401 —— 不泄露用户名是否存在（T-04-01 防信息泄露）
    if not user or not bcrypt.checkpw(
            req.password.encode("utf-8"),
            user["password_hash"].encode("utf-8"),
        ):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    # 更新 last_login
    conn2 = get_db()
    try:
        conn2.execute(
            "UPDATE user SET last_login = datetime('now','localtime') WHERE user_id = ?",
            (user["user_id"],),
        )
        conn2.commit()
    finally:
        conn2.close()

    # JWT 签发
    payload = {
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return LoginResponse(
        token=token,
        email=user["email"],
        role=user["role"],
        display_name=user["display_name"],
    )


@app.get("/api/auth/verify")
def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """验证 JWT token，返回有效状态和用户信息。"""
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
        return {"valid": True, "email": payload["email"], "role": payload["role"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效 Token")


@app.get("/api/auth/users")
def list_users(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """管理员查看用户列表（T-04-03: 仅 admin 可访问，否则 403）。"""
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效 Token")

    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查看用户列表")

    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT user_id, email, role, is_active, last_login FROM user ORDER BY email"
        ).fetchall()
    finally:
        conn.close()

    return [
        {
            "user_id": row["user_id"],
            "email": row["email"],
            "role": row["role"],
            "is_active": bool(row["is_active"]),
            "last_login": row["last_login"],
        }
        for row in rows
    ]
