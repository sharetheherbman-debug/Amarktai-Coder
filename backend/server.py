"""
Reverse proxy from the Emergent ingress (/api/*) to the Next.js app on port 3000.

The Emergent Kubernetes ingress routes /api/* traffic to port 8001. The
Amarktai Coder app is a single Next.js process on port 3000 that handles
both pages AND its own /api/* API routes. To keep the ingress contract
without splitting the stack, this small FastAPI app simply proxies every
/api/* request (any method) to http://127.0.0.1:3000/api/*, including
headers, body, query string, and cookies.

Health endpoint at /api/health works because the Next.js route exists.
"""
from __future__ import annotations
import os
import asyncio
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse, JSONResponse

TARGET = os.environ.get("PROXY_TARGET", "http://127.0.0.1:3000")
TIMEOUT = float(os.environ.get("PROXY_TIMEOUT", "120"))

app = FastAPI(title="Amarktai Ingress Proxy")

# Shared transport keeps connection pooling without sharing a cookie jar.
_transport: httpx.AsyncHTTPTransport | None = None
_transport_lock = asyncio.Lock()


async def _get_transport() -> httpx.AsyncHTTPTransport:
    global _transport
    if _transport is None:
        async with _transport_lock:
            if _transport is None:
                _transport = httpx.AsyncHTTPTransport()
    return _transport


HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}


def _filter_headers(headers) -> dict:
    return {k: v for k, v in headers.items() if k.lower() not in HOP_BY_HOP}


@app.get("/")
async def root():
    return {"service": "amarktai-ingress-proxy", "target": TARGET}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(path: str, request: Request):
    transport = await _get_transport()
    upstream_path = f"/api/{path}"
    try:
        body = await request.body()
        # Use a fresh AsyncClient per request so that no cookie jar / state is
        # ever shared across users. The shared HTTP transport keeps connection
        # pooling efficient.
        async with httpx.AsyncClient(
            base_url=TARGET,
            timeout=TIMEOUT,
            follow_redirects=False,
            transport=transport,
        ) as client:
            upstream = await client.request(
                request.method,
                upstream_path,
                params=dict(request.query_params),
                headers=_filter_headers(request.headers),
                content=body if body else None,
            )
    except httpx.RequestError as e:
        return JSONResponse({"error": f"proxy_error: {e!s}"}, status_code=502)

    out_headers = _filter_headers(upstream.headers)
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=out_headers,
        media_type=out_headers.get("content-type"),
    )
