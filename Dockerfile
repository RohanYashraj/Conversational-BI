# AgentOS (FastAPI) backend image for the KPI Commentary Tool.
# The Next.js UI in ui/ is deployed separately (Vercel); this image is the
# Python agent server the UI talks to.
FROM python:3.12-slim

# uv resolves/install from the committed uv.lock for reproducible builds.
RUN pip install --no-cache-dir uv

WORKDIR /app

# Keep the environment inside the image so the CMD can call it directly.
ENV UV_PROJECT_ENVIRONMENT=/app/.venv \
    PYTHONUNBUFFERED=1

# Install dependencies first (cached layer). --no-install-project skips building
# the local package, so no [build-system] is needed; uvicorn imports
# conversational_bi from the working directory at runtime.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Application code + bundled demo dataset.
COPY conversational_bi ./conversational_bi

# Render/most hosts inject $PORT; default to 8000 for local `docker run`.
EXPOSE 8000
CMD .venv/bin/uvicorn conversational_bi.agent_os:app --host 0.0.0.0 --port ${PORT:-8000}
