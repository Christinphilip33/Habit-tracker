from dotenv import load_dotenv
load_dotenv()

import os
import re
import bcrypt
import jwt
import logging
import secrets
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from contextlib import asynccontextmanager

# ============================================================
# CONFIG
# ============================================================
JWT_ALGORITHM = "HS256"
XP_PER_COMPLETION = 100
XP_WEEKLY_CAP = 4000
XP_PER_LEVEL = 2000

def get_jwt_secret():
    return _JWT_SECRET

_JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not _JWT_SECRET or len(_JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET environment variable must be set and at least 32 characters")

# ============================================================
# PASSWORD HASHING
# ============================================================
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# ============================================================
# JWT TOKENS
# ============================================================
def create_access_token(user_id: str, email: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access", "tv": token_version}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh", "tv": token_version}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

IS_PRODUCTION = os.environ.get("ENVIRONMENT", "development") == "production"

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="strict",
        max_age=60 * 60,  # 1 hour
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="strict",
        max_age=7 * 24 * 60 * 60,  # 7 days
        path="/api/auth/refresh",
    )

def clear_auth_cookies(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/auth/refresh")

# ============================================================
# DATABASE
# ============================================================
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "habitflow")
if IS_PRODUCTION and "localhost" in MONGO_URL and "@" not in MONGO_URL:
    raise RuntimeError("Production MongoDB must use an authenticated connection string (not unauthenticated localhost)")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ============================================================
# AUTH HELPER
# ============================================================
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        # Validate token version — logout invalidates all prior tokens
        if payload.get("tv", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Session invalidated")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_user(user: dict) -> dict:
    u = {**user}
    u["id"] = str(u.pop("_id"))
    u.pop("password_hash", None)
    return u

# ============================================================
# DEFAULT DATA
# ============================================================
DEFAULT_CATEGORIES = [
    {"id": "cat_health", "name": "Health", "icon": "heart", "color": "#FB7185"},
    {"id": "cat_fitness", "name": "Fitness", "icon": "dumbbell", "color": "#4ADE80"},
    {"id": "cat_mind", "name": "Mind", "icon": "brain", "color": "#A78BFA"},
    {"id": "cat_work", "name": "Work", "icon": "briefcase", "color": "#60A5FA"},
    {"id": "cat_social", "name": "Social", "icon": "users", "color": "#FBBF24"},
    {"id": "cat_creative", "name": "Creative", "icon": "palette", "color": "#F472B6"},
]

# ============================================================
# PYDANTIC MODELS
# ============================================================
class RegisterRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., max_length=128)
    name: str = Field(default="User", max_length=50)

class LoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., max_length=128)

class HabitFrequency(BaseModel):
    type: str = Field(default="daily", max_length=20)
    days: list[int] = Field(default_factory=list)
    interval: int = Field(default=2, ge=1, le=365)
    perMonth: int = Field(default=5, ge=1, le=31)

class HabitCreate(BaseModel):
    name: str = Field(..., max_length=100)
    identity: str = Field(default="", max_length=150)
    category: str = Field(default="", max_length=50)
    type: str = Field(default="toggle", max_length=10)
    targetValue: int = Field(default=1, ge=1, le=10000)
    unit: str = Field(default="", max_length=30)
    frequency: HabitFrequency = Field(default_factory=HabitFrequency)
    duration: Optional[int] = Field(default=None, ge=1, le=480)
    reminderTime: str = Field(default="", max_length=10)
    startDate: str = Field(default="", max_length=10)

class HabitUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    identity: Optional[str] = Field(default=None, max_length=150)
    category: Optional[str] = Field(default=None, max_length=50)
    type: Optional[str] = Field(default=None, max_length=10)
    targetValue: Optional[int] = Field(default=None, ge=1, le=10000)
    unit: Optional[str] = Field(default=None, max_length=30)
    frequency: Optional[HabitFrequency] = None
    duration: Optional[int] = Field(default=None, ge=1, le=480)
    reminderTime: Optional[str] = Field(default=None, max_length=10)
    startDate: Optional[str] = Field(default=None, max_length=10)
    archived: Optional[bool] = None

class CompletionToggle(BaseModel):
    dateKey: str = Field(..., max_length=10)

class NumericUpdate(BaseModel):
    dateKey: str = Field(..., max_length=10)
    delta: int = Field(..., ge=-10000, le=10000)

class TimerAction(BaseModel):
    dateKey: str = Field(..., max_length=10)
    action: str = Field(..., max_length=10)
    durationMinutes: int = Field(default=10, ge=1, le=480)

class TaskCreate(BaseModel):
    title: str = Field(..., max_length=200)
    dueDate: str = Field(default="", max_length=10)
    category: str = Field(default="", max_length=50)

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    dueDate: Optional[str] = Field(default=None, max_length=10)
    category: Optional[str] = Field(default=None, max_length=50)
    completed: Optional[bool] = None

class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=50)
    icon: str = Field(default="tag", max_length=20)
    color: str = Field(default="#6B7280", max_length=20)

class XPUpdate(BaseModel):
    amount: int = Field(..., ge=0, le=10000)

class SettingsUpdate(BaseModel):
    theme: Optional[str] = Field(default=None, max_length=20)
    notifications: Optional[bool] = None

class RewardCreate(BaseModel):
    name: str = Field(..., max_length=100)
    cost: int = Field(..., ge=0, le=100000)
    icon: str = Field(default="gift", max_length=20)

class RewardPurchase(BaseModel):
    rewardId: str = Field(..., max_length=20)

# ============================================================
# HELPER FUNCTIONS
# ============================================================
def today_key():
    now = datetime.now(timezone.utc)
    return f"{now.year}-{str(now.month).zfill(2)}-{str(now.day).zfill(2)}"

def get_week_start():
    now = datetime.now(timezone.utc)
    day = now.weekday()  # Monday = 0
    start = now - timedelta(days=(day + 1) % 7)  # Sunday start
    return f"{start.year}-{str(start.month).zfill(2)}-{str(start.day).zfill(2)}"

def get_completion_status(completions: dict, date_key: str) -> str:
    comp = completions.get(date_key)
    if not comp:
        return "pending"
    if isinstance(comp, str):
        return comp
    return comp.get("status", "pending")

# ============================================================
# LIFESPAN
# ============================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await seed_admin()
    yield
    # Shutdown
    client.close()

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@habitflow.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        raise RuntimeError("ADMIN_PASSWORD environment variable must be set")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "token_version": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # Also seed default categories for admin
        await seed_user_data(admin_email)

async def seed_user_data(email: str):
    user = await db.users.find_one({"email": email})
    if not user:
        return
    user_id = str(user["_id"])
    existing = await db.categories.find_one({"userId": user_id})
    if not existing:
        cats = [{"userId": user_id, **c} for c in DEFAULT_CATEGORIES]
        await db.categories.insert_many(cats)
    # Init XP if not exists
    xp = await db.xp.find_one({"userId": user_id})
    if not xp:
        await db.xp.insert_one({
            "userId": user_id,
            "total": 0,
            "weekStart": get_week_start(),
            "weekXP": 0,
            "streakProtectionsUsed": 0,
            "availableXP": 0,
        })
    # Init settings
    settings = await db.settings.find_one({"userId": user_id})
    if not settings:
        await db.settings.insert_one({
            "userId": user_id,
            "theme": "dark",
            "notifications": False,
            "rewards": [],
        })

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("habitflow")

# ============================================================
# APP
# ============================================================
app = FastAPI(title="HabitFlow API", lifespan=lifespan)

# CORS
from fastapi.middleware.cors import CORSMiddleware

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "").split(",")
ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS if o.strip() and o.strip() != "*"]
if IS_PRODUCTION and not ALLOWED_ORIGINS:
    raise RuntimeError("ALLOWED_ORIGINS must be set in production (comma-separated list of allowed origins, '*' is not permitted)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Security headers
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self' https:; object-src 'none'; frame-ancestors 'none'"
        if IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting
TRUSTED_PROXY_HEADER = os.environ.get("TRUSTED_PROXY_HEADER", "")  # e.g. "X-Forwarded-For"
RATE_LIMIT_MAX_KEYS = 10_000  # Cap to prevent OOM from spoofed IPs

class RateLimiter:
    """Sliding-window rate limiter with bounded cache."""
    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self._hits: dict[str, list[float]] = {}

    def _evict_if_full(self):
        """Evict oldest entries if cache exceeds max keys."""
        if len(self._hits) > RATE_LIMIT_MAX_KEYS:
            # Remove the oldest half of entries
            sorted_keys = sorted(self._hits.keys(), key=lambda k: self._hits[k][-1] if self._hits[k] else 0)
            for k in sorted_keys[:len(sorted_keys) // 2]:
                del self._hits[k]

    def is_allowed(self, key: str) -> bool:
        now = time.monotonic()
        hits = self._hits.get(key, [])
        # Prune expired entries
        hits = [t for t in hits if now - t < self.window]
        if len(hits) >= self.max_requests:
            self._hits[key] = hits
            return False
        hits.append(now)
        self._hits[key] = hits
        self._evict_if_full()
        return True

_rate_limiter = RateLimiter(max_requests=60, window_seconds=60)

def _get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting trusted proxy headers."""
    if TRUSTED_PROXY_HEADER:
        forwarded = request.headers.get(TRUSTED_PROXY_HEADER, "")
        if forwarded:
            # First IP in the chain is the original client
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        client_ip = _get_client_ip(request)
        if not _rate_limiter.is_allowed(client_ip):
            return JSONResponse(status_code=429, content={"detail": "Too many requests. Please slow down."})
        return await call_next(request)

app.add_middleware(RateLimitMiddleware)

# Origin verification middleware for CSRF defense-in-depth
class OriginVerificationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method in ("POST", "PUT", "DELETE") and ALLOWED_ORIGINS:
            origin = request.headers.get("Origin", "")
            if origin and origin not in ALLOWED_ORIGINS:
                return JSONResponse(status_code=403, content={"detail": "Origin not allowed"})
        return await call_next(request)

app.add_middleware(OriginVerificationMiddleware)

# Global exception handler for unhandled errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# ============================================================
# HEALTH
# ============================================================
@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "HabitFlow"}

# ============================================================
# AUTH ENDPOINTS
# ============================================================
@app.post("/api/auth/register")
async def register(req: RegisterRequest, response: Response):
    logger.info("Register attempt")
    try:
        email = req.email.strip().lower()
        if not email or not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
            raise HTTPException(status_code=400, detail="Invalid email address")
        if len(req.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        if not re.search(r'[A-Z]', req.password) or not re.search(r'[a-z]', req.password) or not re.search(r'[0-9]', req.password):
            raise HTTPException(status_code=400, detail="Password must contain uppercase, lowercase, and a number")

        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered. Please sign in instead.")

        hashed = hash_password(req.password)
        result = await db.users.insert_one({
            "email": email,
            "password_hash": hashed,
            "name": req.name[:50],
            "role": "user",
            "token_version": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        user_id = str(result.inserted_id)
        await seed_user_data(email)

        access = create_access_token(user_id, email, token_version=0)
        refresh = create_refresh_token(user_id, token_version=0)

        user = await db.users.find_one({"_id": result.inserted_id})
        user_data = serialize_user(user)
        set_auth_cookies(response, access, refresh)
        logger.info("Register success")
        return user_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")

@app.post("/api/auth/login")
async def login(req: LoginRequest, request: Request, response: Response):
    email = req.email.strip().lower()
    ip = _get_client_ip(request)
    identifier = f"{ip}:{email}"

    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < datetime.fromisoformat(locked_until):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        # Increment failed attempts
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Clear failed attempts
    await db.login_attempts.delete_one({"identifier": identifier})

    user_id = str(user["_id"])
    tv = user.get("token_version", 0)
    access = create_access_token(user_id, email, token_version=tv)
    refresh = create_refresh_token(user_id, token_version=tv)
    user_data = serialize_user(user)
    set_auth_cookies(response, access, refresh)
    return user_data

@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    # Increment token_version to invalidate all existing tokens
    try:
        user = await get_current_user(request)
        await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"token_version": 1}})
    except HTTPException:
        pass  # Already invalid or no token — still clear cookies
    clear_auth_cookies(response)
    return {"message": "Logged out"}

@app.get("/api/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@app.post("/api/auth/refresh")
async def refresh_token(request: Request, response: Response):
    # Read refresh token from cookie first, then fall back to body/header
    token = request.cookies.get("refresh_token", "")
    if not token:
        try:
            body = await request.json()
            token = body.get("refresh_token", "")
        except Exception:
            pass
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        # Validate token version
        if payload.get("tv", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Session invalidated")
        user_id = str(user["_id"])
        tv = user.get("token_version", 0)
        access = create_access_token(user_id, user["email"], token_version=tv)
        refresh = create_refresh_token(user_id, token_version=tv)
        set_auth_cookies(response, access, refresh)
        user_data = serialize_user(user)
        return user_data
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ============================================================
# HABITS ENDPOINTS
# ============================================================
@app.get("/api/habits")
async def get_habits(request: Request):
    user = await get_current_user(request)
    habits = await db.habits.find({"userId": user["_id"]}, {"_id": 0}).to_list(500)
    return habits

@app.post("/api/habits")
async def create_habit(req: HabitCreate, request: Request):
    user = await get_current_user(request)
    habit_id = secrets.token_hex(8)
    habit = {
        "id": habit_id,
        "userId": user["_id"],
        "name": req.name[:100],
        "identity": req.identity[:150],
        "category": req.category,
        "type": req.type if req.type in ("toggle", "numeric", "timer") else "toggle",
        "targetValue": max(1, min(10000, req.targetValue)),
        "unit": req.unit[:30],
        "frequency": req.frequency.dict(),
        "duration": max(1, min(480, req.duration)) if req.duration else None,
        "reminderTime": req.reminderTime,
        "startDate": req.startDate or today_key(),
        "createdAt": today_key(),
        "completions": {},
        "archived": False,
    }
    await db.habits.insert_one(habit)
    habit.pop("_id", None)
    return habit

@app.put("/api/habits/{habit_id}")
async def update_habit(habit_id: str, req: HabitUpdate, request: Request):
    user = await get_current_user(request)
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    result = await db.habits.update_one({"id": habit_id, "userId": user["_id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Habit not found")
    habit = await db.habits.find_one({"id": habit_id, "userId": user["_id"]}, {"_id": 0})
    return habit

@app.delete("/api/habits/{habit_id}")
async def delete_habit(habit_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.habits.delete_one({"id": habit_id, "userId": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Habit not found")
    return {"message": "Habit deleted"}

@app.post("/api/habits/{habit_id}/toggle")
async def toggle_habit(habit_id: str, req: CompletionToggle, request: Request):
    user = await get_current_user(request)
    habit = await db.habits.find_one({"id": habit_id, "userId": user["_id"]})
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    if habit.get("type") != "toggle":
        raise HTTPException(status_code=400, detail="Only toggle habits can use this endpoint")

    completions = habit.get("completions", {})
    current = completions.get(req.dateKey)
    current_status = current if isinstance(current, str) else (current.get("status") if current else "pending")
    if not current_status or current_status == "pending":
        current_status = "pending"

    xp_delta = 0
    if current_status == "pending":
        new_status = "completed"
        xp_delta = XP_PER_COMPLETION
    elif current_status == "completed":
        # BUG FIX: Streak protection now actually protects the streak
        xp_data = await db.xp.find_one({"userId": user["_id"]})
        if xp_data and xp_data.get("streakProtectionsUsed", 0) < 1:
            new_status = "streak_protected"  # New status that preserves the streak
            await db.xp.update_one({"userId": user["_id"]}, {"$inc": {"streakProtectionsUsed": 1}})
        else:
            new_status = "missed"
            xp_delta = -XP_PER_COMPLETION
    elif current_status in ("missed", "streak_protected"):
        new_status = "pending"
    else:
        new_status = "pending"

    completions[req.dateKey] = new_status
    await db.habits.update_one({"id": habit_id, "userId": user["_id"]}, {"$set": {"completions": completions}})

    if xp_delta != 0:
        await update_xp(user["_id"], xp_delta)

    return {"status": new_status, "xpDelta": xp_delta}

@app.post("/api/habits/{habit_id}/numeric")
async def update_numeric(habit_id: str, req: NumericUpdate, request: Request):
    user = await get_current_user(request)
    habit = await db.habits.find_one({"id": habit_id, "userId": user["_id"]})
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    completions = habit.get("completions", {})
    comp = completions.get(req.dateKey)
    if not comp or isinstance(comp, str):
        comp = {"status": "pending", "value": 0}
    
    old_val = comp.get("value", 0)
    new_val = max(0, old_val + req.delta)
    target = habit.get("targetValue", 1)

    xp_unit = XP_PER_COMPLETION / target
    effective_old = min(old_val, target)
    effective_new = min(new_val, target)
    xp_delta = int((effective_new - effective_old) * xp_unit)

    comp["value"] = new_val
    if new_val >= target:
        comp["status"] = "completed"
    elif new_val > 0:
        comp["status"] = "partial"
    else:
        comp["status"] = "pending"

    completions[req.dateKey] = comp
    await db.habits.update_one({"id": habit_id, "userId": user["_id"]}, {"$set": {"completions": completions}})

    if xp_delta != 0:
        await update_xp(user["_id"], xp_delta)

    return comp

@app.post("/api/habits/{habit_id}/timer")
async def timer_action(habit_id: str, req: TimerAction, request: Request):
    user = await get_current_user(request)
    habit = await db.habits.find_one({"id": habit_id, "userId": user["_id"]})
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    completions = habit.get("completions", {})
    comp = completions.get(req.dateKey)
    if not comp or isinstance(comp, str):
        comp = {"status": comp if isinstance(comp, str) else "pending"}

    if req.action == "start":
        comp["timer_start"] = datetime.now(timezone.utc).isoformat()
        completions[req.dateKey] = comp
        await db.habits.update_one({"id": habit_id, "userId": user["_id"]}, {"$set": {"completions": completions}})
        return {"status": "started"}

    if req.action == "complete":
        start_time = comp.get("timer_start")
        if not start_time:
            raise HTTPException(status_code=400, detail="Timer not started")
        elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(start_time)).total_seconds()
        expected = (habit.get("duration") or 10) * 60
        if elapsed < expected - 10:
            raise HTTPException(status_code=400, detail="Timer completed too early")
        comp["status"] = "completed"
        completions[req.dateKey] = comp
        await db.habits.update_one({"id": habit_id, "userId": user["_id"]}, {"$set": {"completions": completions}})
        await update_xp(user["_id"], XP_PER_COMPLETION)
        return {"status": "completed"}

    return {"status": "ok"}

@app.post("/api/habits/reorder")
async def reorder_habits(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    ordered_ids = body.get("orderedIds", [])
    if not isinstance(ordered_ids, list):
        raise HTTPException(status_code=400, detail="orderedIds must be a list")
    # Deduplicate while preserving order, cap at 500
    seen = set()
    unique_ids = []
    for hid in ordered_ids:
        if isinstance(hid, str) and hid not in seen and len(unique_ids) < 500:
            seen.add(hid)
            unique_ids.append(hid)
    # Bulk write instead of individual updates
    from pymongo import UpdateOne
    habits = await db.habits.find({"userId": user["_id"]}, {"id": 1}).to_list(500)
    valid_ids = {h["id"] for h in habits}
    ops = [UpdateOne({"id": hid, "userId": user["_id"]}, {"$set": {"order": i}})
           for i, hid in enumerate(unique_ids) if hid in valid_ids]
    if ops:
        await db.habits.bulk_write(ops, ordered=False)
    return {"message": "Reordered"}

# ============================================================
# TASKS ENDPOINTS
# ============================================================
@app.get("/api/tasks")
async def get_tasks(request: Request):
    user = await get_current_user(request)
    tasks = await db.tasks.find({"userId": user["_id"]}, {"_id": 0}).to_list(500)
    return tasks

@app.post("/api/tasks")
async def create_task(req: TaskCreate, request: Request):
    user = await get_current_user(request)
    task_id = secrets.token_hex(8)
    task = {
        "id": task_id,
        "userId": user["_id"],
        "title": req.title[:200],
        "dueDate": req.dueDate,
        "category": req.category,
        "completed": False,
        "createdAt": today_key(),
    }
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task

@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, req: TaskUpdate, request: Request):
    user = await get_current_user(request)
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    result = await db.tasks.update_one({"id": task_id, "userId": user["_id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    task = await db.tasks.find_one({"id": task_id, "userId": user["_id"]}, {"_id": 0})
    return task

@app.post("/api/tasks/{task_id}/toggle")
async def toggle_task(task_id: str, request: Request):
    user = await get_current_user(request)
    task = await db.tasks.find_one({"id": task_id, "userId": user["_id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    new_completed = not task.get("completed", False)
    await db.tasks.update_one(
        {"id": task_id, "userId": user["_id"]},
        {"$set": {"completed": new_completed, "completedAt": datetime.now(timezone.utc).isoformat() if new_completed else None}}
    )
    task = await db.tasks.find_one({"id": task_id, "userId": user["_id"]}, {"_id": 0})
    return task

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.tasks.delete_one({"id": task_id, "userId": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

# ============================================================
# CATEGORIES ENDPOINTS
# ============================================================
@app.get("/api/categories")
async def get_categories(request: Request):
    user = await get_current_user(request)
    cats = await db.categories.find({"userId": user["_id"]}, {"_id": 0}).to_list(100)
    return cats

@app.post("/api/categories")
async def create_category(req: CategoryCreate, request: Request):
    user = await get_current_user(request)
    cat = {
        "id": secrets.token_hex(8),
        "userId": user["_id"],
        "name": req.name[:50],
        "icon": req.icon[:10],
        "color": req.color,
    }
    await db.categories.insert_one(cat)
    cat.pop("_id", None)
    return cat

@app.delete("/api/categories/{cat_id}")
async def delete_category(cat_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.categories.delete_one({"id": cat_id, "userId": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

# ============================================================
# XP ENDPOINTS
# ============================================================
async def update_xp(user_id: str, amount: int):
    xp = await db.xp.find_one({"userId": user_id})
    if not xp:
        xp = {"userId": user_id, "total": 0, "weekStart": get_week_start(), "weekXP": 0, "streakProtectionsUsed": 0, "availableXP": 0}
        await db.xp.insert_one(xp)

    if xp.get("weekStart") != get_week_start():
        xp["weekStart"] = get_week_start()
        xp["weekXP"] = 0
        xp["streakProtectionsUsed"] = 0

    if amount > 0:
        if xp["weekXP"] >= XP_WEEKLY_CAP:
            return xp
        earnable = min(amount, XP_WEEKLY_CAP - xp["weekXP"])
        xp["total"] = xp.get("total", 0) + earnable
        xp["weekXP"] = xp.get("weekXP", 0) + earnable
        xp["availableXP"] = xp.get("availableXP", 0) + earnable
    else:
        abs_amount = abs(amount)
        xp["total"] = max(0, xp.get("total", 0) - abs_amount)
        xp["weekXP"] = max(0, xp.get("weekXP", 0) - abs_amount)

    await db.xp.update_one({"userId": user_id}, {"$set": xp}, upsert=True)
    return xp

@app.get("/api/xp")
async def get_xp(request: Request):
    user = await get_current_user(request)
    xp = await db.xp.find_one({"userId": user["_id"]}, {"_id": 0})
    if not xp:
        return {"total": 0, "weekStart": get_week_start(), "weekXP": 0, "streakProtectionsUsed": 0, "availableXP": 0}
    xp.pop("userId", None)
    return xp

# ============================================================
# SETTINGS ENDPOINTS
# ============================================================
@app.get("/api/settings")
async def get_settings(request: Request):
    user = await get_current_user(request)
    settings = await db.settings.find_one({"userId": user["_id"]}, {"_id": 0})
    if not settings:
        return {"theme": "dark", "notifications": False, "rewards": []}
    settings.pop("userId", None)
    return settings

@app.put("/api/settings")
async def update_settings(req: SettingsUpdate, request: Request):
    user = await get_current_user(request)
    updates = {k: v for k, v in req.dict().items() if v is not None}
    await db.settings.update_one({"userId": user["_id"]}, {"$set": updates}, upsert=True)
    settings = await db.settings.find_one({"userId": user["_id"]}, {"_id": 0})
    settings.pop("userId", None)
    return settings

@app.post("/api/settings/rewards")
async def add_reward(req: RewardCreate, request: Request):
    user = await get_current_user(request)
    reward = {"id": secrets.token_hex(8), "name": req.name[:100], "cost": max(0, min(req.cost, 100000)), "icon": req.icon[:10]}
    await db.settings.update_one({"userId": user["_id"]}, {"$push": {"rewards": reward}}, upsert=True)
    return reward

@app.post("/api/settings/rewards/purchase")
async def purchase_reward(req: RewardPurchase, request: Request):
    user = await get_current_user(request)
    settings = await db.settings.find_one({"userId": user["_id"]})
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    rewards = settings.get("rewards", [])
    reward = next((r for r in rewards if r["id"] == req.rewardId), None)
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    xp = await db.xp.find_one({"userId": user["_id"]})
    if not xp or xp.get("availableXP", 0) < reward["cost"]:
        raise HTTPException(status_code=400, detail="Not enough XP")
    await db.xp.update_one({"userId": user["_id"]}, {"$inc": {"availableXP": -reward["cost"]}})
    return {"message": "Purchased", "reward": reward}

# ============================================================
# ANALYTICS ENDPOINT
# ============================================================
@app.get("/api/analytics")
async def get_analytics(request: Request):
    user = await get_current_user(request)
    habits = await db.habits.find({"userId": user["_id"], "archived": {"$ne": True}}, {"_id": 0}).to_list(500)
    xp = await db.xp.find_one({"userId": user["_id"]}, {"_id": 0})

    total_completions = 0
    cat_counts = {}
    day_counts = {}

    for h in habits:
        for k, v in h.get("completions", {}).items():
            status = v if isinstance(v, str) else v.get("status", "pending")
            if status == "completed":
                total_completions += 1
                cat = h.get("category", "")
                if cat:
                    cat_counts[cat] = cat_counts.get(cat, 0) + 1
                day_counts[k] = day_counts.get(k, 0) + 1

    return {
        "totalCompletions": total_completions,
        "categoryBreakdown": cat_counts,
        "dailyCompletions": day_counts,
        "xp": xp or {"total": 0},
        "habitCount": len(habits),
    }

# ============================================================
# DATA EXPORT/IMPORT
# ============================================================
@app.get("/api/export")
async def export_data(request: Request):
    user = await get_current_user(request)
    habits = await db.habits.find({"userId": user["_id"]}, {"_id": 0, "userId": 0}).to_list(500)
    tasks = await db.tasks.find({"userId": user["_id"]}, {"_id": 0, "userId": 0}).to_list(500)
    cats = await db.categories.find({"userId": user["_id"]}, {"_id": 0, "userId": 0}).to_list(100)
    xp = await db.xp.find_one({"userId": user["_id"]}, {"_id": 0, "userId": 0})
    settings = await db.settings.find_one({"userId": user["_id"]}, {"_id": 0, "userId": 0})
    return {
        "habits": habits,
        "tasks": tasks,
        "categories": cats,
        "xp": xp or {},
        "settings": settings or {},
        "exportDate": datetime.now(timezone.utc).isoformat(),
    }

ALLOWED_HABIT_FIELDS = {"id", "name", "identity", "category", "type", "targetValue", "unit",
                        "frequency", "duration", "reminderTime", "startDate", "createdAt",
                        "completions", "archived", "order"}
ALLOWED_TASK_FIELDS = {"id", "title", "dueDate", "category", "completed", "createdAt"}
ALLOWED_CATEGORY_FIELDS = {"id", "name", "icon", "color"}
ALLOWED_XP_FIELDS = {"total", "weekStart", "weekXP", "streakProtectionsUsed", "availableXP"}

def _sanitize_doc(doc: dict, allowed_fields: set) -> dict:
    """Strip system fields and any fields not in the allowlist."""
    return {k: v for k, v in doc.items() if k in allowed_fields}

@app.post("/api/import")
async def import_data(request: Request):
    user = await get_current_user(request)
    data = await request.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid import data")
    user_id = user["_id"]

    if "habits" in data:
        if not isinstance(data["habits"], list) or len(data["habits"]) > 1000:
            raise HTTPException(status_code=400, detail="habits must be a list (max 1000)")
        await db.habits.delete_many({"userId": user_id})
        habits = [{"userId": user_id, **_sanitize_doc(h, ALLOWED_HABIT_FIELDS)} for h in data["habits"] if isinstance(h, dict)]
        if habits:
            await db.habits.insert_many(habits)

    if "tasks" in data:
        if not isinstance(data["tasks"], list) or len(data["tasks"]) > 1000:
            raise HTTPException(status_code=400, detail="tasks must be a list (max 1000)")
        await db.tasks.delete_many({"userId": user_id})
        tasks = [{"userId": user_id, **_sanitize_doc(t, ALLOWED_TASK_FIELDS)} for t in data["tasks"] if isinstance(t, dict)]
        if tasks:
            await db.tasks.insert_many(tasks)

    if "categories" in data:
        if not isinstance(data["categories"], list) or len(data["categories"]) > 100:
            raise HTTPException(status_code=400, detail="categories must be a list (max 100)")
        await db.categories.delete_many({"userId": user_id})
        cats = [{"userId": user_id, **_sanitize_doc(c, ALLOWED_CATEGORY_FIELDS)} for c in data["categories"] if isinstance(c, dict)]
        if cats:
            await db.categories.insert_many(cats)

    if "xp" in data:
        if not isinstance(data["xp"], dict):
            raise HTTPException(status_code=400, detail="xp must be an object")
        sanitized_xp = _sanitize_doc(data["xp"], ALLOWED_XP_FIELDS)
        # Clamp XP values to sane bounds
        if "total" in sanitized_xp:
            sanitized_xp["total"] = max(0, min(int(sanitized_xp["total"]), 1_000_000))
        if "weekXP" in sanitized_xp:
            sanitized_xp["weekXP"] = max(0, min(int(sanitized_xp["weekXP"]), XP_WEEKLY_CAP))
        if "availableXP" in sanitized_xp:
            sanitized_xp["availableXP"] = max(0, min(int(sanitized_xp["availableXP"]), 1_000_000))
        if "streakProtectionsUsed" in sanitized_xp:
            sanitized_xp["streakProtectionsUsed"] = max(0, min(int(sanitized_xp["streakProtectionsUsed"]), 100))
        await db.xp.update_one({"userId": user_id}, {"$set": sanitized_xp}, upsert=True)

    return {"message": "Data imported successfully"}
