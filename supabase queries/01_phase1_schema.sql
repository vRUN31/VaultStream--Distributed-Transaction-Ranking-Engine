-- The Users Table Configuration
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tx_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_balance_check CHECK (balance >= 0)
);

-- Performance Optimization: Composite descending index on both balance and tx_count
CREATE INDEX IF NOT EXISTS ix_users_balance_tx_count_desc ON public.users (balance DESC, tx_count DESC);

-- The Transactions Table Configuration
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    type VARCHAR NOT NULL,
    idemp_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT transactions_amount_check CHECK (amount > 0),
    CONSTRAINT transactions_type_check CHECK (type IN ('CREDIT', 'DEBIT'))
);

-- Performance Optimization: Index on user_id for fast history lookups
CREATE INDEX IF NOT EXISTS ix_transactions_user_id ON public.transactions (user_id);
