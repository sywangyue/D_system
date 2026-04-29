"""
tag_api.py — Phase 2 人工打标 API（FastAPI）

端点：
    PATCH  /api/brands/{brand_id}/tags          更新标签字段
    GET    /api/brands/{brand_id}/tag-history   查询打标历史
    GET    /api/brands/{brand_id}               查询品牌详情
    GET    /api/health                          健康检查

启动：
    uvicorn tag_api:app --reload --port 8000
"""
from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

BASE_DIR   = Path(__file__).parent
DB_PATH    = BASE_DIR / "mwlab.db"

# ─── 可打标字段白名单 ──────────────────────────────────────────────────────────
TAGGABLE_FIELDS: dict[str, type] = {
    "competition_relation":  str,   # 是/否/''
    "mds_related":           str,
    "scale_score":           int,   # 1-10
    "is_international":      int,   # 0/1
    "is_ufi_certified":      int,   # 0/1
    "ma_potential":          int,   # 1-5
    "strategic_relevance":   int,   # 1-5
    "competitor_group":      str,
    "industry_l1":           str,
    "industry_l2":           str,
    "notes":                 str,
    "first_year":            int,
    "organizer":             str,
    "co_organizer":          str,
    "city":                  str,
    "frequency":             str,
    "website":               str,
}

# ─── DB helper ────────────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


# ─── Pydantic 模型 ─────────────────────────────────────────────────────────────
class TagUpdate(BaseModel):
    field_name: str
    new_value: Any
    changed_by: str  # 操作人邮箱
    reason: Optional[str] = ''

    @field_validator('field_name')
    @classmethod
    def validate_field_name(cls, v: str) -> str:
        if v not in TAGGABLE_FIELDS:
            raise ValueError(
                f"不可打标字段: {v!r}。允许字段: {list(TAGGABLE_FIELDS.keys())}"
            )
        return v

    @field_validator('changed_by')
    @classmethod
    def validate_changed_by(cls, v: str) -> str:
        if not v or '@' not in v:
            raise ValueError("changed_by 必须是有效邮箱")
        return v.strip()

    @field_validator('new_value')
    @classmethod
    def validate_new_value(cls, v: Any) -> Any:
        if v is None:
            raise ValueError("new_value 不能为 None")
        return v


class TagHistoryItem(BaseModel):
    id: int
    brand_id: str
    field_name: str
    old_value: str
    new_value: str
    changed_by: str
    changed_at: str
    reason: str


# ─── 约束验证 ─────────────────────────────────────────────────────────────────
_ENUM_CONSTRAINTS: dict[str, set] = {
    "competition_relation": {'是', '否', ''},
    "status":               {'已举办', '即将举办', '取消', '延期', ''},
}
_INT_RANGE_CONSTRAINTS: dict[str, tuple[int, int]] = {
    "scale_score":         (1, 10),
    "ma_potential":        (1, 5),
    "strategic_relevance": (1, 5),
    "is_international":    (0, 1),
    "is_ufi_certified":    (0, 1),
}

def validate_value(field_name: str, new_value: Any) -> tuple[bool, str]:
    """返回 (is_valid, error_msg)。"""
    expected_type = TAGGABLE_FIELDS.get(field_name)
    if expected_type is int:
        try:
            iv = int(new_value)
        except (ValueError, TypeError):
            return False, f"{field_name} 必须是整数，收到: {new_value!r}"
        if field_name in _INT_RANGE_CONSTRAINTS:
            lo, hi = _INT_RANGE_CONSTRAINTS[field_name]
            if not (lo <= iv <= hi):
                return False, f"{field_name} 必须在 [{lo}, {hi}] 范围内，收到: {iv}"

    if field_name in _ENUM_CONSTRAINTS:
        if str(new_value) not in _ENUM_CONSTRAINTS[field_name]:
            return False, (
                f"{field_name} 枚举值无效: {new_value!r}。"
                f"允许值: {_ENUM_CONSTRAINTS[field_name]}"
            )

    return True, ''


# ─── 应用 ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="MWLAB Tag API",
    description="Phase 2 人工打标接口",
    version="1.0.0",
)


@app.get("/api/health")
def health():
    return {"status": "ok", "db": str(DB_PATH)}


@app.get("/api/brands/{brand_id}")
def get_brand(brand_id: str, conn: sqlite3.Connection = Depends(get_db)):
    row = conn.execute(
        "SELECT * FROM exhibition_brand WHERE brand_id = ?", (brand_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"品牌不存在: {brand_id}")
    return dict(row)


@app.patch("/api/brands/{brand_id}/tags")
def update_tag(
    brand_id: str,
    body: TagUpdate,
    conn: sqlite3.Connection = Depends(get_db),
):
    # 品牌存在性检查
    row = conn.execute(
        "SELECT * FROM exhibition_brand WHERE brand_id = ?", (brand_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"品牌不存在: {brand_id}")

    # 值合法性检查
    ok, err = validate_value(body.field_name, body.new_value)
    if not ok:
        raise HTTPException(status_code=422, detail=err)

    brand = dict(row)
    old_value = str(brand.get(body.field_name, '') or '')
    new_value = str(body.new_value)

    # 更新主表
    conn.execute(
        f"UPDATE exhibition_brand SET {body.field_name} = ?, updated_at = datetime('now','localtime') "
        f"WHERE brand_id = ?",
        (body.new_value, brand_id)
    )

    # 记录历史
    conn.execute(
        """
        INSERT INTO manual_tag_history
            (brand_id, field_name, old_value, new_value, changed_by, reason)
        VALUES (?,?,?,?,?,?)
        """,
        (brand_id, body.field_name, old_value, new_value,
         body.changed_by, body.reason or '')
    )
    conn.commit()

    return {
        "brand_id":   brand_id,
        "field_name": body.field_name,
        "old_value":  old_value,
        "new_value":  new_value,
        "changed_by": body.changed_by,
        "changed_at": datetime.now().isoformat(),
    }


@app.get("/api/brands/{brand_id}/tag-history")
def get_tag_history(
    brand_id: str,
    field_name: Optional[str] = None,
    conn: sqlite3.Connection = Depends(get_db),
):
    exists = conn.execute(
        "SELECT 1 FROM exhibition_brand WHERE brand_id = ?", (brand_id,)
    ).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail=f"品牌不存在: {brand_id}")

    if field_name:
        rows = conn.execute(
            "SELECT * FROM manual_tag_history "
            "WHERE brand_id = ? AND field_name = ? "
            "ORDER BY changed_at DESC",
            (brand_id, field_name)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM manual_tag_history "
            "WHERE brand_id = ? ORDER BY changed_at DESC",
            (brand_id,)
        ).fetchall()

    return [dict(r) for r in rows]
