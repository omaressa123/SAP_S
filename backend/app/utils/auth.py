from fastapi import Depends, Security, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from typing import List, Optional
import jwt
from datetime import datetime, timedelta
from ..config import settings
from .errors import AirportException

security_bearer = HTTPBearer()
api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security_bearer)):
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise AirportException(code="TOKEN_EXPIRED", message="JWT token has expired", status_code=401)
    except jwt.InvalidTokenError:
        raise AirportException(code="INVALID_TOKEN", message="Invalid JWT token", status_code=401)

def verify_api_key(api_key: str = Security(api_key_header)):
    if not api_key or api_key != "MOCK_API_KEY_123":
        raise AirportException(code="UNAUTHORIZED", message="Invalid or missing X-API-KEY", status_code=401)
    return api_key

def require_role(allowed_roles: List[str]):
    def role_checker(user: dict = Depends(get_current_user)):
        if user.get("role") not in allowed_roles:
            raise AirportException(code="FORBIDDEN", message=f"Requires one of roles: {allowed_roles}", status_code=403)
        return user
    return role_checker
