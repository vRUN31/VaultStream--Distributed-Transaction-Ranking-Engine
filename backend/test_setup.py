import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_ANON_KEY")

supabase: Client = create_client(url, key)

email = "testuser@vaultstream.com"
password = "securepassword123"

print("Attempting to create/login test user to generate a JWT token...\n")

try:
    # Attempt to sign up
    response = supabase.auth.sign_up({
        "email": email,
        "password": password,
        "options": {
            "data": {
                "username": "TestUserOne"
            }
        }
    })
    
    if response.session:
        print(f"✅ User signed up successfully! (Postgres Trigger should have fired)")
        print(f"User ID: {response.user.id}")
        print(f"JWT Token:\n{response.session.access_token}")
    else:
        print("Sign up succeeded but email confirmation is required in your Supabase settings. Please disable email confirmations in Supabase Auth settings to test locally, or manually confirm the user in the dashboard.")
        
except Exception as e:
    print(f"User might already exist. Attempting login instead...")
    try:
        # Attempt to login
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        print(f"✅ Logged in successfully!")
        print(f"User ID: {response.user.id}")
        print(f"\n🔑 YOUR JWT TOKEN (Copy this):\n{response.session.access_token}\n")
    except Exception as login_e:
        print(f"❌ Failed to get token. Error: {login_e}")
