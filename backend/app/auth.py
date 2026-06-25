import os
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
import logging

logger = logging.getLogger("vaultstream.auth")

# Header Extraction Pass: FastAPI HTTPBearer automatically handles the 'Bearer ' prefix
security = HTTPBearer()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Use synchronous `def` so FastAPI runs this in a threadpool to avoid blocking the event loop
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> uuid.UUID:
    """
    Verifies the token securely using Supabase's native get_user method.
    This natively handles asymmetric keys (ES256/RS256) which cannot be verified
    with just the symmetric JWT_SECRET.
    """
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: Supabase client is not initialized."
        )

    token = credentials.credentials

    try:
        # Native secure token verification against Supabase
        user_response = supabase.auth.get_user(jwt=token)
        
        user_id = user_response.user.id
        if not user_id:
            raise ValueError("No user ID found in verified token")
            
        return uuid.UUID(user_id)
        
    except Exception as e:
        logger.warning(f"Auth verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed. Invalid or expired token."
        )
