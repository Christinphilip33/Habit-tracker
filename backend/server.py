from dotenv import load_dotenv
load_dotenv()

import os
import bcrypt
import jwt
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Response, Depends
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
    return os.environ["JWT_SECRET"]

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
def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    # Tokens are returned in JSON body, cookies are optional fallback
    pass

# ============================================================
# DATABASE
# ============================================================
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "habitflow")

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
    email: str
    password: str
    name: str = "User"

class LoginRequest(BaseModel):
    email: str
    password: str

class HabitCreate(BaseModel):
    name: str
    identity: str = ""
    category: str = ""
    type: str = "toggle"
    targetValue: int = 1
    unit: str = ""
    frequency: dict = Field(default_factory=lambda: {"type": "daily", "days": [], "interval": 2, "perMonth": 5})
    duration: Optional[int] = None
    reminderTime: str = ""
    startDate: str = ""

class HabitUpdate(BaseModel):
    name: Optional[str] = None
    identity: Optional[str] = None
    category: Optional[str] = None
    type: Optional[str] = None
    targetValue: Optional[int] = None
    unit: Optional[str] = None
    frequency: Optional[dict] = None
    duration: Optional[int] = None
    reminderTime: Optional[str] = None
    startDate: Optional[str] = None
    archived: Optional[bool] = None

class CompletionToggle(BaseModel):
    dateKey: str

class NumericUpdate(BaseModel):
    dateKey: str
    delta: int

class TimerAction(BaseModel):
    dateKey: str
    action: str  # "start", "pause", "reset"
    durationMinutes: int = 10

class TaskCreate(BaseModel):
    title: str
    dueDate: str = ""
    category: str = ""

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    dueDate: Optional[str] = None
    category: Optional[str] = None
    completed: Optional[bool] = None

class CategoryCreate(BaseModel):
    name: str
    icon: str = "tag"
    color: str = "#6B7280"

class XPUpdate(BaseModel):
    amount: int

class SettingsUpdate(BaseModel):
    theme: Optional[str] = None
    notifications: Optional[bool] = None

class RewardCreate(BaseModel):
    name: str
    cost: int
    icon: str = "gift"

class RewardPurchase(BaseModel):
    rewardId: str

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
    admin_password = os.environ.get("ADMIN_PASSWORD", "***REMOVED***")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # Also seed default categories for admin
        await seed_user_data(admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n")
        f.write(f"## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n")
        f.write(f"## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n- POST /api/auth/refresh\n")

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

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("habitflow")

# ============================================================
# APP
# ============================================================
app = FastAPI(title="HabitFlow API", lifespan=lifespan)

# Global exception handler for unhandled errors
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) if str(exc) else "Internal server error"},
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
    logger.info(f"Register attempt: email={req.email}")
    try:
        email = req.email.strip().lower()
        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="Invalid email address")
        if len(req.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered. Please sign in instead.")

        hashed = hash_password(req.password)
        result = await db.users.insert_one({
            "email": email,
            "password_hash": hashed,
            "name": req.name[:50],
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        user_id = str(result.inserted_id)
        await seed_user_data(email)

        access = create_access_token(user_id, email)
        refresh = create_refresh_token(user_id)

        user = await db.users.find_one({"_id": result.inserted_id})
        user_data = serialize_user(user)
        user_data["access_token"] = access
        user_data["refresh_token"] = refresh
        logger.info(f"Register success: email={email}")
        return user_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/api/auth/login")
async def login(req: LoginRequest, request: Request, response: Response):
    email = req.email.strip().lower()
    ip = request.client.host if request.client else "unknown"
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
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    user_data = serialize_user(user)
    user_data["access_token"] = access
    user_data["refresh_token"] = refresh
    return user_data

@app.post("/api/auth/logout")
async def logout(response: Response):
    return {"message": "Logged out"}

@app.get("/api/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@app.post("/api/auth/refresh")
async def refresh_token(request: Request, response: Response):
    body = await request.json()
    token = body.get("refresh_token", "")
    if not token:
        # Fallback to header
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
        user_id = str(user["_id"])
        access = create_access_token(user_id, user["email"])
        user_data = serialize_user(user)
        user_data["access_token"] = access
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
        "frequency": req.frequency,
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
    if req.action == "complete":
        completions[req.dateKey] = "completed"
        await db.habits.update_one({"id": habit_id, "userId": user["_id"]}, {"$set": {"completions": completions}})
        await update_xp(user["_id"], XP_PER_COMPLETION)
        return {"status": "completed"}

    return {"status": "ok"}

@app.post("/api/habits/reorder")
async def reorder_habits(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    ordered_ids = body.get("orderedIds", [])
    habits = await db.habits.find({"userId": user["_id"]}).to_list(500)
    id_map = {h["id"]: h for h in habits}
    for i, hid in enumerate(ordered_ids):
        if hid in id_map:
            await db.habits.update_one({"id": hid, "userId": user["_id"]}, {"$set": {"order": i}})
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
    reward = {"id": secrets.token_hex(8), "name": req.name[:100], "cost": min(req.cost, 100000), "icon": req.icon[:10]}
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

@app.post("/api/import")
async def import_data(request: Request):
    user = await get_current_user(request)
    data = await request.json()
    user_id = user["_id"]

    if "habits" in data:
        await db.habits.delete_many({"userId": user_id})
        habits = [{"userId": user_id, **h} for h in data["habits"]]
        if habits:
            await db.habits.insert_many(habits)

    if "tasks" in data:
        await db.tasks.delete_many({"userId": user_id})
        tasks = [{"userId": user_id, **t} for t in data["tasks"]]
        if tasks:
            await db.tasks.insert_many(tasks)

    if "categories" in data:
        await db.categories.delete_many({"userId": user_id})
        cats = [{"userId": user_id, **c} for c in data["categories"]]
        if cats:
            await db.categories.insert_many(cats)

    if "xp" in data:
        await db.xp.update_one({"userId": user_id}, {"$set": data["xp"]}, upsert=True)

    return {"message": "Data imported successfully"}
