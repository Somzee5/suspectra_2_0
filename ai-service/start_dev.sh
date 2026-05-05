#!/usr/bin/env bash
# Start the AI service in dev mode.
# --reload-dir app — WatchFiles only watches app/, never the sam/ repo.
uvicorn main:app --port 8001 --reload --reload-dir app
