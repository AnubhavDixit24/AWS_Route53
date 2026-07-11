from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from .database import Base, engine, SessionLocal
from .seed import seed_data
from .routers import auth as auth_router
from .routers import zones as zones_router
from .routers import records as records_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the server starts up
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
    yield
    # (nothing needed on shutdown)


app = FastAPI(title="Route53 Clone API", version="1.0.0", lifespan=lifespan)

# Allow the Next.js frontend (running on a different port) to call this API
# and to send/receive cookies (needed for our session-based auth).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(zones_router.router)
app.include_router(records_router.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}