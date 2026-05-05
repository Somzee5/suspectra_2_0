@echo off
:: Start the AI service in dev mode.
:: --reload-dir app  — WatchFiles only watches app/, never the sam/ repo.
:: Without this, patching sam/models/stylegan2/op/ at startup triggers
:: an infinite reload loop.
uvicorn main:app --port 8001 --reload --reload-dir app
