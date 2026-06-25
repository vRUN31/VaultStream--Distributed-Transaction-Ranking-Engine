-- Phase 3: Security & Row Level Security (RLS)

-- 1. Enable RLS on core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 2. Policies for Users Table
-- Users can read their own profile
CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
USING ( auth.uid() = id );

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
USING ( auth.uid() = id );

-- The backend Service Role will automatically bypass RLS for inserting new users or updating balances.

-- 3. Policies for Transactions Table
-- Users can view their own transaction history
CREATE POLICY "Users can view own transactions"
ON transactions FOR SELECT
USING ( auth.uid() = user_id );

-- Users cannot insert transactions directly from the frontend (must go through the secure backend)
-- No INSERT, UPDATE, or DELETE policies are granted to the public or authenticated users for transactions.
-- The backend uses the Service Role key to insert transactions, bypassing RLS.
