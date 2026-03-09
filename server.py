import logging
import os
import time
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.api.personas import router as personas_router
from app.api.review import router as review_router
from app.api.save import router as save_router
from app.services.review_pipeline import shutdown_active_executors

app = FastAPI(title="Synthetic Panels")
logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static"
templates = Jinja2Templates(directory=str(STATIC_DIR))


def _git_info() -> tuple[str, str]:
    import subprocess
    cwd = str(Path(__file__).parent)
    try:
        version = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=cwd, text=True, stderr=subprocess.DEVNULL
        ).strip()
        raw_date = subprocess.check_output(
            ["git", "log", "-1", "--format=%ci"], cwd=cwd, text=True, stderr=subprocess.DEVNULL
        ).strip()
        last_updated = datetime.fromisoformat(raw_date).strftime("%Y-%m-%d %H:%M")
    except Exception:
        version = "dev"
        last_updated = datetime.now().strftime("%Y-%m-%d %H:%M")
    return version, last_updated


def _resolve_asset_version(app_version: str) -> str:
    render_commit = os.getenv("RENDER_GIT_COMMIT", "").strip()
    if render_commit:
        return render_commit[:12]
    if app_version and app_version != "dev":
        return app_version
    return str(int(time.time()))


APP_VERSION, LAST_UPDATED = _git_info()
ASSET_VERSION = _resolve_asset_version(APP_VERSION)


@app.middleware("http")
async def set_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/":
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    elif path.startswith("/static/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(personas_router)
app.include_router(review_router)
app.include_router(save_router)


@app.on_event("shutdown")
async def _shutdown():
    shutdown_active_executors()


@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "version": APP_VERSION,
            "last_updated": LAST_UPDATED,
            "asset_version": ASSET_VERSION,
        },
    )
