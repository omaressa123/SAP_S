"""Authentication + RBAC for the Airport Twin API (Step 5).

- OAuth2 password flow, JWT (HS256, 12 h TTL).
- Roles: viewer (read) < operator (ingest + commands) < admin (all).
- Passwords: PBKDF2-HMAC-SHA256 (stdlib). Swap for bcrypt/argon2 + a user
  table if this outgrows env-seeded users.
- Users come from TWIN_USERS="user:pass:role,...". Without it, dev defaults
  are used AND a loud warning is printed — set real secrets in production.
"""
import hashlib
import hmac
import os
import secrets
import time

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm  # noqa: F401 (re-exported for router)
from services.logging import get_logger

log = get_logger("auth")

ROLE_RANK = {"viewer": 0, "operator": 1, "admin": 2}
JWT_SECRET = os.getenv("TWIN_JWT_SECRET", "dev-secret-change-me")
JWT_ALG = "HS256"
JWT_TTL_S = 12 * 3600
_USING_DEFAULTS = False


class User:
    def __init__(self, username: str, role: str, pw_hash: str):
        self.username = username
        self.role = role
        self.pw_hash = pw_hash


def hash_password(pw: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)
    return f"pbkdf2$200000${salt.hex()}${dk.hex()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, iters, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def load_users() -> dict[str, User]:
    global _USING_DEFAULTS
    raw = os.getenv("TWIN_USERS", "").strip()
    users: dict[str, User] = {}
    if raw:
        for entry in raw.split(","):
            parts = [p.strip() for p in entry.split(":")]
            if len(parts) != 3 or parts[2] not in ROLE_RANK:
                raise ValueError(f"bad TWIN_USERS entry (want user:pass:role): {entry!r}")
            users[parts[0]] = User(parts[0], parts[2], hash_password(parts[1]))
    else:
        _USING_DEFAULTS = True
        defaults = [("admin", "admin123", "admin"),
                    ("operator", "op123", "operator"),
                    ("viewer", "view123", "viewer")]
        for u, p, r in defaults:
            users[u] = User(u, r, hash_password(p))
        log.warning("using default dev credentials; set TWIN_USERS in production")
    if JWT_SECRET == "dev-secret-change-me":
        log.warning("using dev JWT signing key; set TWIN_JWT_SECRET in production")
    return users


USERS = load_users()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/twin/auth/token")


def create_token(user: User) -> str:
    now = int(time.time())
    return jwt.encode({"sub": user.username, "role": user.role, "iat": now, "exp": now + JWT_TTL_S},
                      JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> User:
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = USERS.get(data.get("sub", ""))
        if not user or user.role != data.get("role"):
            raise ValueError("unknown user or role changed")
        return user
    except Exception as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {e}",
                            {"WWW-Authenticate": "Bearer"})


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    return decode_token(token)


def require_role(role: str):
    """Dependency factory: allows `role` and anything above it."""
    async def dep(user: User = Depends(get_current_user)) -> User:
        if ROLE_RANK.get(user.role, -1) < ROLE_RANK[role]:
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                f"requires {role} role (you are {user.role})")
        return user
    return dep


require_viewer = require_role("viewer")
require_operator = require_role("operator")
require_admin = require_role("admin")
