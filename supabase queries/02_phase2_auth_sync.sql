-- 1. The Sync Function Configuration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert into public.users immediately upon invocation
  INSERT INTO public.users (id, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username' -- Extract the custom display handle from metadata
  );
  
  -- Return NEW state record to ensure native registration completes
  RETURN NEW;
END;
$$;

-- 2. The Trigger Binding Configuration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Bind trigger explicitly to auth.users system table managed by Supabase
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
