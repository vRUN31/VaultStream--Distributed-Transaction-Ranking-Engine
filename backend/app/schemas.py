import uuid
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator, ConfigDict

class TransactionCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, le=1000000, description="Amount must be strictly greater than 0 and less than or equal to 1,000,000")
    type: str = Field(..., description="Must be exactly 'CREDIT' or 'DEBIT'")
    idemp_key: str = Field(..., min_length=1, description="Idempotency key is mandatory")

    @field_validator('type')
    @classmethod
    def validate_transaction_type(cls, v: str) -> str:
        if v not in ('CREDIT', 'DEBIT'):
            raise ValueError("Transaction type must be exactly 'CREDIT' or 'DEBIT'")
        return v

class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    status: str = "success"
    transaction_id: uuid.UUID
    new_balance: Decimal

class UserSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    username: str
    balance: Decimal
    tx_count: int

class LeaderboardMetrics(BaseModel):
    tvl: Decimal
    active_accounts: int
    avg_transactions: float

class LeaderboardResponse(BaseModel):
    metrics: LeaderboardMetrics
    top_accounts: list[UserSummaryResponse]

class TransactionHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount: Decimal
    type: str
    created_at: str | None = None

    @field_validator('created_at', mode='before')
    @classmethod
    def serialize_datetime(cls, v):
        if v:
            if hasattr(v, 'isoformat'):
                return v.isoformat()
            return str(v)
        return v

class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    email: str
    password: str
    username: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: uuid.UUID
