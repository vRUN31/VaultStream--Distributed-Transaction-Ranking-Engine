import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import os

# Add backend directory to sys path so we can import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Mock dependencies before importing the app to prevent actual connections
with patch("redis.asyncio.from_url") as mock_redis, \
     patch("app.auth.supabase", MagicMock()), \
     patch("app.main.supabase", MagicMock()):
     
    mock_redis_instance = AsyncMock()
    mock_redis.return_value = mock_redis_instance
    from app.main import app
    from fastapi_limiter import FastAPILimiter

    # Initialize FastAPILimiter with the mock redis instance
    import asyncio
    asyncio.run(FastAPILimiter.init(mock_redis_instance))

client = TestClient(app)

def test_health_check():
    """Verify that the API is alive and reachable."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

@patch("app.main.redis_client", new_callable=AsyncMock)
def test_ranking_empty_cache(mock_redis_client):
    """Test leaderboard when Redis cache is empty (mocking Supabase query)"""
    # Simulate cache miss (zcard == 0)
    mock_redis_client.zcard.return_value = 0
    
    # Mock pipeline for cache warming
    mock_pipeline = AsyncMock()
    mock_redis_client.pipeline.return_value = mock_pipeline
    
    # Simulate the newly populated zset and hmget return values
    mock_redis_client.zrevrange.return_value = [("123", 100.0)]
    import json
    mock_redis_client.hmget.return_value = [json.dumps({"username": "testuser", "tx_count": 5})]
    
    # We must patch supabase locally since we imported app
    with patch("app.main.supabase") as mock_supabase:
        mock_res = MagicMock()
        mock_res.data = [{"id": "123", "username": "testuser", "balance": 100.0, "tx_count": 5}]
        # Mock the chained supabase query: supabase.table().select().order().limit().execute()
        mock_supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = mock_res
        
        response = client.get("/ranking")
        
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["username"] == "testuser"
        # Verify redis pipeline was executed to warm cache
        mock_pipeline.execute.assert_called_once()
