@echo off
:: Start the AI service in dev mode.
:: --host 0.0.0.0    — bind all interfaces so the frontend can reach it.
:: --reload-dir app  — WatchFiles only watches app/, never the sam/ repo.
:: Without this, patching sam/models/stylegan2/op/ at startup triggers
:: an infinite reload loop.
uvicorn main:app --host 0.0.0.0 --port 8001 --reload --reload-dir app
