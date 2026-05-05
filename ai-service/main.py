import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routers import health, recognition, aging, humanization

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Suspectra AI Service v2.0 starting…")
    humanization.init_service()
    aging.init_service()
    yield
    logger.info("Suspectra AI Service shutting down…")


app = FastAPI(
    title="Suspectra AI Service",
    description=(
        "AI microservice for forensic sketch humanization (SD+ControlNet), "
        "facial recognition, aging/de-aging, and prompt-based structural editing."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router,         prefix="/api",              tags=["Health"])
app.include_router(humanization.router,   prefix="/api/humanization", tags=["Humanization"])
app.include_router(recognition.router,    prefix="/api/recognition",  tags=["Recognition"])
app.include_router(aging.router,          prefix="/api/aging",        tags=["Aging"])
