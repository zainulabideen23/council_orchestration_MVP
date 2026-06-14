"""
Callback helper — POSTs real-time events to the Node.js callback URL
so it can relay to Socket.io clients.
"""

import os
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

NODE_CALLBACK_URL = os.getenv('NODE_CALLBACK_URL', 'http://localhost:3001/api/orchestrator/events')


async def emit_event(event: str, data: dict):
    if not NODE_CALLBACK_URL:
        return
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            await client.post(NODE_CALLBACK_URL, json={'event': event, 'data': data})
    except Exception:
        pass
