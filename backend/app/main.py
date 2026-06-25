import os
import uuid
import json
import redis.asyncio as redis
from typing import List

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("vaultstream.api")

load_dotenv()

from app.auth import get_current_user, supabase
from app.schemas import TransactionCreate, TransactionResponse, UserSummaryResponse, TransactionHistoryItem, LeaderboardResponse, LeaderboardMetrics, UserLogin, UserRegister, AuthResponse
from decimal import Decimal

app = FastAPI(title="VaultStream Core Engine")

FRONTEND_URL_ENV = os.getenv("FRONTEND_URL", "http://localhost:5173")
FRONTEND_URLS = [url.strip() for url in FRONTEND_URL_ENV.split(",") if url.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; object-src 'none'"
    return response

# Redis Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

@app.on_event("startup")
async def startup():
    await FastAPILimiter.init(redis_client)

@app.on_event("shutdown")
async def shutdown():
    await redis_client.close()

@app.get("/auth/check-username")
async def check_username(username: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
    if len(username) < 3:
        return {"available": False}
        
    res = supabase.table("users").select("id").eq("username", username).execute()
    # If the username is found, available = False. Otherwise, True.
    available = len(res.data) == 0
    return {"available": available}

@app.post("/auth/register", response_model=AuthResponse, dependencies=[Depends(RateLimiter(times=3, seconds=3600))])
async def register_user(payload: UserRegister, request: Request):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
    try:
        res = supabase.auth.sign_up({
            "email": payload.email,
            "password": payload.password,
            "options": {
                "data": {"username": payload.username}
            }
        })
        if not res.user:
            raise HTTPException(status_code=400, detail="Registration failed")
        
        return AuthResponse(
            access_token=res.session.access_token if res.session else "",
            refresh_token=res.session.refresh_token if res.session else "",
            user_id=uuid.UUID(res.user.id)
        )
    except Exception as e:
        logger.error(f"Registration failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/login", response_model=AuthResponse)
async def login_user(payload: UserLogin, request: Request):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"failed_login:{payload.email}:{client_ip}"
    
    # Check if currently locked out
    attempts = await redis_client.get(rate_limit_key)
    if attempts and int(attempts) >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please wait 5 minutes."
        )
        
    try:
        res = supabase.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password
        })
        
        # On success, clear failed attempts
        await redis_client.delete(rate_limit_key)
        
        if not res.session:
            raise HTTPException(status_code=400, detail="Login failed, no session returned")
            
        return AuthResponse(
            access_token=res.session.access_token,
            refresh_token=res.session.refresh_token,
            user_id=uuid.UUID(res.user.id)
        )
    except Exception as e:
        # On failure, increment and set TTL
        current_attempts = await redis_client.incr(rate_limit_key)
        if current_attempts == 1:
            await redis_client.expire(rate_limit_key, 300) # 5 mins
        elif current_attempts >= 3:
            await redis_client.expire(rate_limit_key, 300) # Refresh block
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. Please wait 5 minutes."
            )
            
        logger.warning(f"Failed login attempt {current_attempts}/3 for {payload.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/transaction", response_model=TransactionResponse, dependencies=[Depends(RateLimiter(times=5, seconds=60))])
async def execute_transaction(
    payload: TransactionCreate,
    user_id: uuid.UUID = Depends(get_current_user)
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")

    # 1. Idempotency Validation (The Redis Gate)
    redis_key = f"idemp:{payload.idemp_key}"
    lock_acquired = await redis_client.set(redis_key, "processing", ex=30, nx=True)
    if not lock_acquired:
        logger.warning(f"Transaction conflict for idempotency key: {payload.idemp_key} by user {user_id}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transaction with this idempotency key is already processing or has been processed."
        )

    try:
        # 2. Fetch User from Supabase
        user_res = supabase.table("users").select("*").eq("id", str(user_id)).execute()
        if not user_res.data:
            # Let's dynamically create the user row if it doesn't exist for seamless UX
            try:
                # Fetch email from auth to create a username
                auth_user = supabase.auth.admin.get_user_by_id(str(user_id))
                username = auth_user.user.email.split('@')[0] if auth_user.user.email else f"user_{str(user_id)[:8]}"
            except Exception:
                username = f"user_{str(user_id)[:8]}"
                
            new_user = {
                "id": str(user_id),
                "username": username,
                "balance": 0.00,
                "tx_count": 0
            }
            create_res = supabase.table("users").insert(new_user).execute()
            if not create_res.data:
                 raise HTTPException(status_code=500, detail="Failed to initialize user ledger.")
            user_data = create_res.data[0]
        else:
            user_data = user_res.data[0]

        current_balance = float(user_data["balance"])
        current_tx_count = int(user_data["tx_count"])

        # 3. Balance Sufficiency Verification
        if payload.type == "DEBIT" and current_balance < float(payload.amount):
            logger.warning(f"Insufficient funds: User {user_id} attempted to debit {payload.amount} but has {current_balance}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient funds for debit transaction."
            )

        # 4. Execute Mathematical Mutations
        if payload.type == "CREDIT":
            new_balance = current_balance + float(payload.amount)
        elif payload.type == "DEBIT":
            new_balance = current_balance - float(payload.amount)
        
        new_tx_count = current_tx_count + 1

        # 5. Update Balance in Supabase
        supabase.table("users").update({
            "balance": new_balance,
            "tx_count": new_tx_count
        }).eq("id", str(user_id)).execute()

        # 6. Record Ledger History
        new_txn_id = str(uuid.uuid4())
        txn_data = {
            "id": new_txn_id,
            "user_id": str(user_id),
            "amount": float(payload.amount),
            "type": payload.type,
            "idemp_key": payload.idemp_key
        }
        supabase.table("transactions").insert(txn_data).execute()

        # 6.5 Update Redis Sorted Set & Hash (Write-Through)
        username = user_data.get("username", f"user_{str(user_id)[:8]}")
        
        # Multi-factor ranking: balance + (tx_count * 10.0)
        ranking_score = new_balance + (new_tx_count * 10.0)
        
        await redis_client.zadd("leaderboard_zset", {str(user_id): ranking_score})
        await redis_client.hset("user_metadata", str(user_id), json.dumps({
            "username": username,
            "tx_count": new_tx_count
        }))

    except Exception as e:
        # If it was an HTTPException (like insufficient funds), re-raise it
        if isinstance(e, HTTPException):
            # Clean up redis lock so they can try again
            await redis_client.delete(redis_key)
            raise e
            
        logger.error(f"Transaction failed critically for user {user_id}: {e}", exc_info=True)
        # Clean up redis lock if execution failed unexpectedly
        await redis_client.delete(redis_key)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transaction failed due to a database error."
        )

    # 7. Commit and Cache 
    await redis_client.set(redis_key, "processed", ex=86400)
    
    # Update global metrics in O(1)
    if payload.type == "CREDIT":
        await redis_client.incrbyfloat("global:total_liquidity", float(payload.amount))
    else:
        await redis_client.incrbyfloat("global:total_liquidity", -float(payload.amount))
        
    await redis_client.incr("global:total_tx_count")
  
    # 8. Output Mapping
    return TransactionResponse(
        status="success",
        transaction_id=uuid.UUID(new_txn_id),
        new_balance=new_balance
    )

@app.api_route("/health", methods=["GET", "HEAD"], dependencies=[Depends(RateLimiter(times=100, seconds=60))])
async def health_check():
    return {"status": "healthy"}

@app.get("/summary/{user_id}", response_model=UserSummaryResponse, dependencies=[Depends(RateLimiter(times=100, seconds=60))])
async def get_user_profile(
    user_id: uuid.UUID,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
    res = supabase.table("users").select("*").eq("id", str(user_id)).execute()
    if not res.data:
        # If user hasn't made a transaction yet, they won't be in the users table.
        # Return a default profile with 0 balance instead of 404.
        try:
            auth_user = supabase.auth.admin.get_user_by_id(str(user_id))
            # Safe extraction of username
            username = f"user_{str(user_id)[:8]}"
            if hasattr(auth_user, 'user') and auth_user.user:
                if hasattr(auth_user.user, 'user_metadata') and auth_user.user.user_metadata and 'username' in auth_user.user.user_metadata:
                    username = auth_user.user.user_metadata['username']
                elif hasattr(auth_user.user, 'email') and auth_user.user.email:
                    username = auth_user.user.email.split('@')[0]
        except Exception:
            username = f"user_{str(user_id)[:8]}"
            
        return UserSummaryResponse(
            id=user_id,
            username=username,
            balance=Decimal("0.00"),
            tx_count=0
        )
        
    return res.data[0]

@app.get("/ranking", response_model=LeaderboardResponse, dependencies=[Depends(RateLimiter(times=100, seconds=60))])
async def get_leaderboard():
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
    cache_key = "leaderboard_zset"
    meta_key = "user_metadata"
    
    zcard = await redis_client.zcard(cache_key)
    
    if zcard == 0:
        # Cache Warming: Fetch all active users if Redis is empty
        logger.info("ZSET empty. Warming cache from Supabase...")
        res = supabase.table("users").select("*").order("balance", desc=True).execute()
        
        if not res.data:
            return LeaderboardResponse(
                metrics=LeaderboardMetrics(tvl=Decimal("0"), active_accounts=0, avg_transactions=0.0),
                top_accounts=[]
            )
            
        pipeline = redis_client.pipeline()
        total_liq = 0.0
        total_tx = 0
        
        for user in res.data:
            bal = float(user["balance"])
            tx_c = int(user["tx_count"])
            total_liq += bal
            total_tx += tx_c
            
            # Multi-factor ranking: balance + (tx_count * 10.0)
            ranking_score = bal + (tx_c * 10.0)
            
            pipeline.zadd(cache_key, {user["id"]: ranking_score})
            pipeline.hset(meta_key, user["id"], json.dumps({
                "username": user["username"],
                "tx_count": tx_c
            }))
            
        pipeline.set("global:total_liquidity", total_liq)
        pipeline.set("global:total_tx_count", total_tx)
        await pipeline.execute()
        
    # Real-time O(1) read
    top_users_raw = await redis_client.zrevrange(cache_key, 0, 99, withscores=True)
    
    total_liq_raw = await redis_client.get("global:total_liquidity")
    total_tx_raw = await redis_client.get("global:total_tx_count")
    
    if not total_liq_raw or not total_tx_raw:
        # Fallback if keys are missing but ZSET was present
        logger.info("Global metrics missing in Redis. Recalculating from Supabase...")
        res = supabase.table("users").select("balance, tx_count").execute()
        total_liq = sum(float(u["balance"]) for u in res.data)
        total_tx = sum(int(u["tx_count"]) for u in res.data)
        await redis_client.set("global:total_liquidity", total_liq)
        await redis_client.set("global:total_tx_count", total_tx)
        total_liquidity = total_liq
        total_transactions = total_tx
    else:
        total_liquidity = float(total_liq_raw)
        total_transactions = int(total_tx_raw)
    
    if not top_users_raw:
        return LeaderboardResponse(
            metrics=LeaderboardMetrics(tvl=Decimal("0"), active_accounts=0, avg_transactions=0.0),
            top_accounts=[]
        )
        
    user_ids = [uid for uid, _ in top_users_raw]
    meta_raw = await redis_client.hmget(meta_key, user_ids)
    
    response_data = []
    for (uid, balance), meta_str in zip(top_users_raw, meta_raw):
        if not meta_str:
            continue
        meta = json.loads(meta_str)
        response_data.append(UserSummaryResponse(
            id=uuid.UUID(uid.decode("utf-8") if isinstance(uid, bytes) else uid),
            username=meta["username"],
            balance=Decimal(str(balance)),
            tx_count=meta["tx_count"]
        ))
        
    # Active accounts is just the number of elements in the ZSET
    # Since we might have warmed the cache above, recalculate zcard
    current_zcard = await redis_client.zcard(cache_key)
    active_accounts = int(current_zcard) if current_zcard else 0
    avg_transactions = round(total_transactions / active_accounts, 1) if active_accounts > 0 else 0.0

    return LeaderboardResponse(
        metrics=LeaderboardMetrics(
            tvl=Decimal(str(total_liquidity)),
            active_accounts=active_accounts,
            avg_transactions=avg_transactions
        ),
        top_accounts=response_data
    )

@app.get("/transactions/{user_id}", response_model=List[TransactionHistoryItem], dependencies=[Depends(RateLimiter(times=100, seconds=60))])
async def get_user_transactions(
    user_id: uuid.UUID,
    limit: int = 50,
    start_date: str | None = None,
    end_date: str | None = None,
    current_user_id: uuid.UUID = Depends(get_current_user)
):
    if user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized to view these transactions"
        )
        
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
    query = supabase.table("transactions").select("*").eq("user_id", str(user_id)).order("created_at", desc=True).limit(limit)
    
    if start_date:
        query = query.gte("created_at", start_date)
    if end_date:
        query = query.lte("created_at", end_date)
        
    res = query.execute()
    return res.data

@app.delete("/account", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(RateLimiter(times=5, seconds=60))])
async def delete_account(current_user_id: uuid.UUID = Depends(get_current_user)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
    user_id_str = str(current_user_id)
    
    # 1. Fetch user data to decrement global caches
    user_res = supabase.table("users").select("balance, tx_count").eq("id", user_id_str).execute()
    if user_res.data:
        bal = float(user_res.data[0]["balance"])
        tx_c = int(user_res.data[0]["tx_count"])
        
        # Decrement Redis global caches
        await redis_client.incrbyfloat("global:total_liquidity", -bal)
        # Note: incrby only takes integers in standard redis, but redis.asyncio handles it. We use incrby for integers.
        await redis_client.incrby("global:total_tx_count", -tx_c)
        
    # 2. Remove from Redis Leaderboard and Metadata
    await redis_client.zrem("leaderboard_zset", user_id_str)
    await redis_client.hdel("user_metadata", user_id_str)
    
    # 3. Delete from public.users (cascades to transactions)
    supabase.table("users").delete().eq("id", user_id_str).execute()
    
    # 4. Delete Auth User using service role
    try:
        supabase.auth.admin.delete_user(user_id_str)
    except Exception as e:
        logger.error(f"Failed to delete user from Supabase Auth: {e}")
        raise HTTPException(status_code=500, detail="Failed to fully delete authentication profile.")
