import asyncio
import os
import redis.asyncio as redis
from dotenv import load_dotenv

load_dotenv()

async def main():
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    await redis_client.delete("leaderboard_zset")
    await redis_client.delete("global:total_liquidity")
    await redis_client.delete("global:total_tx_count")
    print("Redis leaderboard and global metrics flushed.")
    await redis_client.close()

if __name__ == "__main__":
    asyncio.run(main())
