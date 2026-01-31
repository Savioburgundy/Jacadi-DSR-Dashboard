#!/usr/bin/env python3
"""
Bridge server that proxies requests to the Node.js backend.
This exists because supervisor is configured to run uvicorn/Python.
"""
import subprocess
import os
import signal
import sys
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NODE_BACKEND_PORT = 5000
NODE_PROCESS = None

def start_node_server():
    global NODE_PROCESS
    env = os.environ.copy()
    env["PORT"] = str(NODE_BACKEND_PORT)
    NODE_PROCESS = subprocess.Popen(
        ["npx", "ts-node-dev", "--respawn", "--transpile-only", "src/app.ts"],
        cwd="/app/backend",
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    # Give Node time to start
    time.sleep(3)
    return NODE_PROCESS

@app.on_event("startup")
async def startup_event():
    start_node_server()

@app.on_event("shutdown")
async def shutdown_event():
    global NODE_PROCESS
    if NODE_PROCESS:
        NODE_PROCESS.terminate()
        NODE_PROCESS.wait()

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy(request: Request, path: str):
    url = f"http://localhost:{NODE_BACKEND_PORT}/{path}"
    
    async with httpx.AsyncClient() as client:
        # Build the proxied request
        method = request.method
        headers = dict(request.headers)
        headers.pop("host", None)
        
        body = await request.body()
        
        try:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                content=body,
                params=request.query_params,
                timeout=60.0
            )
            
            return StreamingResponse(
                iter([response.content]),
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.headers.get("content-type")
            )
        except httpx.RequestError as e:
            return {"error": f"Node backend unavailable: {str(e)}"}, 503

@app.get("/health")
async def health():
    return {"status": "ok", "type": "bridge"}
