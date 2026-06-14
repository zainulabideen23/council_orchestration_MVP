"""
Model wrapper — single interface for all LLM calls.
Supports OpenRouter (default) and Ollama via AI_MODE env var.
"""

import os
import time
import asyncio
from typing import Optional
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY', '')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
AI_MODE = os.getenv('AI_MODE', 'openrouter')
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
ROUND_TIMEOUT_MS = int(os.getenv('ROUND_TIMEOUT_MS', '120000'))

# Serialize API calls to avoid provider rate limits (429s) during concurrent agent execution
_model_semaphore = asyncio.Semaphore(1)

OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
OPENROUTER_HEADERS = {
    'Authorization': f'Bearer {OPENROUTER_API_KEY}',
    'Content-Type': 'application/json',
    'HTTP-Referer': 'http://localhost:3001',
    'X-Title': 'Council Orchestration Console',
}

NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
NVIDIA_HEADERS = {
    'Authorization': f'Bearer {NVIDIA_API_KEY}',
    'Content-Type': 'application/json',
}

GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
GROQ_HEADERS = {
    'Authorization': f'Bearer {GROQ_API_KEY}',
    'Content-Type': 'application/json',
}

async def call_model(
    messages: list,
    model: str = 'meta-llama/llama-3.1-8b-instruct',
    temperature: float = 0.0,
    max_tokens: int = 2048,
    timeout_ms: Optional[int] = None,
) -> dict:
    """
    Call an LLM and return { content, tokens_used, latency_ms }.
    Raises on unrecoverable error; returns error content on retry exhaustion.
    Serializes through a global semaphore to avoid provider rate limits.
    """
    async with _model_semaphore:
        if AI_MODE == 'ollama':
            return await _call_ollama(messages, model, temperature, max_tokens, timeout_ms)
        if AI_MODE == 'nvidia':
            return await _call_nvidia(messages, model, temperature, max_tokens, timeout_ms)
        if AI_MODE == 'groq':
            return await _call_groq(messages, model, temperature, max_tokens, timeout_ms)
        return await _call_openrouter(messages, model, temperature, max_tokens, timeout_ms)


async def _call_openrouter(
    messages: list,
    model: str,
    temperature: float,
    max_tokens: int,
    timeout_ms: Optional[int],
) -> dict:
    if not OPENROUTER_API_KEY:
        return {
            'content': '[ERROR: No OPENROUTER_API_KEY set]',
            'tokens_used': 0,
            'latency_ms': 0,
        }

    timeout = (timeout_ms or ROUND_TIMEOUT_MS) / 1000
    start = time.monotonic()
    last_error = None

    payload = {
        'model': model,
        'messages': messages,
        'temperature': temperature,
        'max_tokens': max_tokens,
    }

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(OPENROUTER_URL, json=payload, headers=OPENROUTER_HEADERS)

            latency = int((time.monotonic() - start) * 1000)

            if resp.status_code == 200:
                data = resp.json()
                content = data['choices'][0]['message']['content']
                usage = data.get('usage', {})
                tokens = usage.get('total_tokens', 0)
                return {'content': content, 'tokens_used': tokens, 'latency_ms': latency}

            if resp.status_code == 429:
                wait = (2 ** attempt) * 5
                print(f'  [model] 429 rate limit, retrying in {wait}s (attempt {attempt + 1})')
                await asyncio.sleep(wait)
                continue

            if resp.status_code == 400:
                body = resp.text[:200]
                return {
                    'content': f'[ERROR: 400 — {body}]',
                    'tokens_used': 0,
                    'latency_ms': latency,
                }

            last_error = f'HTTP {resp.status_code}: {resp.text[:200]}'
            if attempt < 2:
                await asyncio.sleep(2)

        except httpx.TimeoutException:
            last_error = 'TIMEOUT'
            if attempt < 2:
                await asyncio.sleep(2)

        except Exception as e:
            last_error = str(e)
            if attempt < 2:
                await asyncio.sleep(2)

    latency = int((time.monotonic() - start) * 1000)
    return {
        'content': f'[ERROR: {last_error}]',
        'tokens_used': 0,
        'latency_ms': latency,
    }


async def _call_nvidia(
    messages: list,
    model: str,
    temperature: float,
    max_tokens: int,
    timeout_ms: Optional[int],
) -> dict:
    if not NVIDIA_API_KEY:
        return {
            'content': '[ERROR: No NVIDIA_API_KEY set]',
            'tokens_used': 0,
            'latency_ms': 0,
        }

    timeout = (timeout_ms or ROUND_TIMEOUT_MS) / 1000
    start = time.monotonic()
    last_error = None

    payload = {
        'model': model,
        'messages': messages,
        'temperature': temperature,
        'max_tokens': max_tokens,
        'top_p': 1.00,
        'stream': False,
    }

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(NVIDIA_URL, json=payload, headers=NVIDIA_HEADERS)

            latency = int((time.monotonic() - start) * 1000)

            if resp.status_code == 200:
                data = resp.json()
                content = data['choices'][0]['message']['content']
                usage = data.get('usage', {})
                tokens = usage.get('total_tokens', 0)
                return {'content': content, 'tokens_used': tokens, 'latency_ms': latency}

            if resp.status_code == 429:
                if attempt < 2:
                    wait = (2 ** attempt) * 8
                    print(f'  [nvidia] 429 rate limit, retrying in {wait}s (attempt {attempt + 1})')
                    await asyncio.sleep(wait)
                    continue
                last_error = f'429 rate limit exhausted after 3 attempts'
                break

            last_error = f'HTTP {resp.status_code}: {resp.text[:200]}'
            if attempt < 2:
                await asyncio.sleep(2)

        except httpx.TimeoutException:
            last_error = 'TIMEOUT'
            if attempt < 2:
                await asyncio.sleep(2)

        except Exception as e:
            last_error = str(e)
            if attempt < 2:
                await asyncio.sleep(2)

    latency = int((time.monotonic() - start) * 1000)
    return {
        'content': f'[ERROR: {last_error}]',
        'tokens_used': 0,
        'latency_ms': latency,
    }


async def _call_groq(
    messages: list,
    model: str,
    temperature: float,
    max_tokens: int,
    timeout_ms: Optional[int],
) -> dict:
    if not GROQ_API_KEY:
        return {
            'content': '[ERROR: No GROQ_API_KEY set]',
            'tokens_used': 0,
            'latency_ms': 0,
        }

    timeout = (timeout_ms or ROUND_TIMEOUT_MS) / 1000
    start = time.monotonic()
    last_error = None

    payload = {
        'model': model,
        'messages': messages,
        'temperature': temperature,
        'max_tokens': max_tokens,
    }

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(GROQ_URL, json=payload, headers=GROQ_HEADERS)

            latency = int((time.monotonic() - start) * 1000)

            if resp.status_code == 200:
                data = resp.json()
                content = data['choices'][0]['message']['content']
                usage = data.get('usage', {})
                tokens = usage.get('total_tokens', 0)
                return {'content': content, 'tokens_used': tokens, 'latency_ms': latency}

            if resp.status_code == 429:
                if attempt < 2:
                    wait = (2 ** attempt) * 3
                    print(f'  [groq] 429 rate limit, retrying in {wait}s (attempt {attempt + 1})')
                    await asyncio.sleep(wait)
                    continue
                last_error = '429 rate limit exhausted after 3 attempts'
                break

            last_error = f'HTTP {resp.status_code}: {resp.text[:200]}'
            if attempt < 2:
                await asyncio.sleep(2)

        except httpx.TimeoutException:
            last_error = 'TIMEOUT'
            if attempt < 2:
                await asyncio.sleep(2)

        except Exception as e:
            last_error = str(e)
            if attempt < 2:
                await asyncio.sleep(2)

    latency = int((time.monotonic() - start) * 1000)
    return {
        'content': f'[ERROR: {last_error}]',
        'tokens_used': 0,
        'latency_ms': latency,
    }


async def _call_ollama(
    messages: list,
    model: str,
    temperature: float,
    max_tokens: int,
    timeout_ms: Optional[int],
) -> dict:
    timeout = (timeout_ms or ROUND_TIMEOUT_MS) / 1000
    start = time.monotonic()

    ollama_model = model.split('/')[-1] if '/' in model else model

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(f'{OLLAMA_BASE_URL}/api/chat', json={
                'model': ollama_model,
                'messages': messages,
                'options': { 'temperature': temperature, 'num_predict': max_tokens },
            })

        latency = int((time.monotonic() - start) * 1000)

        if resp.status_code == 200:
            data = resp.json()
            return {
                'content': data['message']['content'],
                'tokens_used': 0,
                'latency_ms': latency,
            }

        return {
            'content': f'[ERROR: Ollama {resp.status_code}]',
            'tokens_used': 0,
            'latency_ms': latency,
        }

    except Exception as e:
        latency = int((time.monotonic() - start) * 1000)
        return {
            'content': f'[ERROR: Ollama — {e}]',
            'tokens_used': 0,
            'latency_ms': latency,
        }
