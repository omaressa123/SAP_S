from fastapi.responses import JSONResponse
from typing import Any, Optional

def success_response(data: Any, meta: Optional[dict] = None, status_code: int = 200):
    content = {
        "success": True,
        "data": data
    }
    if meta:
        content["meta"] = meta
    return JSONResponse(status_code=status_code, content=content)

def error_response(code: str, message: str, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": message
            }
        }
    )
